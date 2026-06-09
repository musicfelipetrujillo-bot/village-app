// ManualVideo — full-screen Mux player for one Manual video.
//
// Currently rendered via react-native-webview pointing at Mux's hosted
// player (`https://player.mux.com/{playback_id}`). The native expo-video
// path is staged in `api/manual.ts::muxStreamUrl` and ready to swap in
// once the dev-client native rebuild path is unblocked (Stripe/Xcode 26
// compile error blocks `expo run:ios` at the moment — see ManualHomeScreen
// header note). Going through the WebView keeps captions, quality menu,
// AirPlay/PiP all working out of the box; the trade-off is we lose
// `currentTime` access so watch progress is approximated via screen-time.
//
// Watch progress is persisted via mark_video_watched at three points:
//   (1) every ~10s while the screen is mounted (clamped to GREATEST in DB)
//   (2) on screen unmount (so a brief view still updates last_watched_at)
//   (3) when elapsed screen-time crosses 90% of duration_seconds, we send
//       the full duration so completed_at sets server-side
// Replays don't unset completed_at. The 2-min hard cap is enforced at the
// DB; the WebView still respects whatever duration Mux reports.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView,
  Share, Alert, Modal, StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { useAnalytics } from '@hooks/useAnalytics';
import { getLocalClipHtml, MANUAL_VIDEO_REMOTE_BASE } from '@/manual/localManualClips';
import {
  getManualVideo,
  markVideoWatched,
  muxPlayerUrl,
  formatDuration,
  toggleManualSave,
  logManualShare,
  manualVideoShareUrl,
  type ManualVideo,
  type ManualAudience,
} from '@/api/manual';

type ParamList = {
  ManualVideo: {
    audience: ManualAudience;
    category: string;
    videoId: string;
    // Optional playlist: ordered video ids for the chapter "row". When present
    // the player auto-advances on completion and shows prev/next controls.
    playlist?: string[];
    playlistIndex?: number;
  };
};

export default function ManualVideoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ManualVideo'>>();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const { audience, category, videoId } = route.params;

  // Playlist: the ordered ids for this row (or just the single tapped clip).
  const playlist = route.params.playlist && route.params.playlist.length
    ? route.params.playlist
    : [videoId];
  const [index, setIndex] = useState(() => {
    const i = route.params.playlistIndex ?? playlist.indexOf(videoId);
    return i >= 0 && i < playlist.length ? i : 0;
  });
  const currentVideoId = playlist[Math.min(index, playlist.length - 1)] ?? videoId;
  const hasPrev = index > 0;
  const hasNext = index < playlist.length - 1;
  const isPlaylist = playlist.length > 1;

  const [video, setVideo] = useState<ManualVideo | null>(null);
  const [loading, setLoading] = useState(true);
  // ES toggle defaults to user's preferred language when an ES caption track exists.
  const [captionLang, setCaptionLang] = useState<'en' | 'es' | 'off'>('off');

  // Save state — kicks off optimistic so the heart flips immediately; on
  // RPC failure we revert and surface a quiet inline error (no Alert; the
  // user already sees the heart un-flip, which is the real feedback).
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  // Fullscreen presentation (immersive Modal, chrome + status bar hidden).
  const [fullscreen, setFullscreen] = useState(false);
  // Offline-first: try the bundled local clip first; on a hard load error
  // flip to the remote URL. (A clip that isn't bundled never sets local in the
  // first place — see `localHtml` below — so this only covers load failures.)
  const [forceRemote, setForceRemote] = useState(false);

  const { trackEvent } = useAnalytics();

  // Approximate watch position via screen-time. WebView doesn't expose the
  // <video> currentTime without injectedJavaScript posting back, so we use
  // wall-clock seconds since mount as the running max. Good enough for the
  // 90%-completion rule + last_watched_at; pixel-precise resume lands with
  // the native player swap.
  const screenMountedAtRef = useRef(Date.now());
  const completionWrittenRef = useRef(false);

  // Load the video metadata up-front. We use the bucket+id endpoint so the
  // RPC enforces the same approval + locale rules as the grid.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setForceRemote(false); // new clip — try its local bundle again
    completionWrittenRef.current = false; // reset per-clip completion tracking
    (async () => {
      try {
        const v = await getManualVideo(audience, category, currentVideoId, lang);
        if (cancelled) return;
        setVideo(v);
        setSaved(v?.is_saved ?? false);
        screenMountedAtRef.current = Date.now();
        // View event — fires on screen-load (not actual <video> play). Pairs
        // with manual_video_saved + manual_video_shared so the "of X who saw
        // this, Y saved, Z shared" funnel is computable.
        if (v) {
          // audience + category come from route params (the ManualVideo
          // shape returned by list_manual_videos doesn't include the
          // bucket discriminators).
          trackEvent('manual_video_viewed', {
            video_id: v.id,
            audience,
            category,
          });
        }
        // Default captions to user's locale when present, else EN, else off.
        if (v?.has_captions_es && lang === 'es') setCaptionLang('es');
        else if (v?.has_captions_en) setCaptionLang('en');
        else setCaptionLang('off');
      } catch (e) {
        console.error('manual video load', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [audience, category, currentVideoId, lang]);

  // Auto-open fullscreen ONCE for HTML animation clips (authored portrait to
  // fill the screen). Done via a ref so it persists across playlist advances
  // and respects a manual exit (doesn't reopen on the next clip).
  const fsInitRef = useRef(false);
  useEffect(() => {
    if (video?.html_url && !fsInitRef.current) {
      fsInitRef.current = true;
      setFullscreen(true);
    }
  }, [video]);

  // Advance/retreat within the playlist (also used by auto-advance on
  // completion). Resets per-clip refs so the new clip tracks cleanly.
  const goToIndex = (next: number) => {
    if (next < 0 || next >= playlist.length || next === index) return;
    completionWrittenRef.current = false;
    screenMountedAtRef.current = Date.now();
    setIndex(next);
  };

  // Periodic save. Reads elapsed screen-time every 10s and pings
  // mark_video_watched. Fires the duration-as-full once we cross 90% so
  // completed_at sets exactly once even if the user keeps the screen open.
  useEffect(() => {
    if (!video) return;
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - screenMountedAtRef.current) / 1000);
      const clamped = Math.min(elapsed, video.duration_seconds);
      if (clamped <= 0) return;
      const ninety = Math.ceil(video.duration_seconds * 0.9);
      if (clamped >= ninety && !completionWrittenRef.current) {
        completionWrittenRef.current = true;
        markVideoWatched(video.id, video.duration_seconds).catch(() => {});
        // Completion event — fires exactly once per session when watch
        // progress crosses 90%. Pairs with manual_video_viewed (every
        // mount) + manual_video_saved + manual_video_shared so the
        // view → save → share → finish funnel is computable.
        trackEvent('manual_video_completed', {
          video_id: video.id,
          audience,
          category,
        });
        // Playlist auto-advance: when a clip completes, roll to the next one
        // in the row (YouTube-style). Stops at the last clip.
        if (isPlaylist && index < playlist.length - 1) {
          goToIndex(index + 1);
        }
      } else {
        markVideoWatched(video.id, clamped).catch(() => {});
      }
    }, 10_000);
    return () => clearInterval(tick);
  }, [video]);

  // Unmount save — captures partial views (the most common case).
  useEffect(() => {
    return () => {
      if (!video) return;
      const elapsed = Math.floor((Date.now() - screenMountedAtRef.current) / 1000);
      const final = Math.max(0, Math.min(elapsed, video.duration_seconds));
      if (final > 0) {
        markVideoWatched(video.id, final).catch(() => {});
      }
    };
  }, [video]);

  // HTML clips (self-hosted animated pieces) load their URL directly; Mux
  // videos go through the hosted Mux player. Both render in the same WebView.
  const playerUrl = video
    ? (video.html_url
        ?? (video.mux_playback_id
              ? muxPlayerUrl(video.mux_playback_id, { autoplay: true, poster: video.poster_url })
              : null))
    : null;

  // Offline-first source. For bundled HTML clips we feed the self-contained
  // string (no network) with the remote dir as baseUrl so the Google-Fonts
  // <link> still resolves when online. Everything else (Mux, un-bundled clips,
  // or after a local load error) uses the remote URL.
  const localHtml =
    video && !forceRemote ? getLocalClipHtml(video.html_url) : null;
  const usingLocal = !!localHtml;
  // HTML clips are portrait animations; Mux videos are landscape.
  const isHtmlClip = !!video?.html_url;

  // Mount health-check for local clips: a JS error inside the WebView can leave
  // an empty #root WITHOUT firing onError. We poll for ~3s; if React never
  // mounts, post 'clip:empty' and fall back to the remote copy. This makes the
  // bundled-clip path safe to ship even when it can't be render-verified.
  const CLIP_HEALTH_JS = `(function(){var n=0;var iv=setInterval(function(){n++;var r=document.getElementById('root');if(r&&r.childElementCount>0){clearInterval(iv);window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('clip:ok');}else if(n>=30){clearInterval(iv);window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('clip:empty');}},100);})();true;`;

  // One WebView definition reused for the inline frame and the fullscreen
  // Modal. `key` differs so React mounts a fresh instance per placement
  // (the short clip simply restarts on toggle — acceptable, and avoids two
  // live WebViews fighting over the same source).
  const renderPlayer = (placement: 'inline' | 'full') => (
    <WebView
      key={placement}
      source={
        usingLocal
          ? { html: localHtml as string, baseUrl: MANUAL_VIDEO_REMOTE_BASE }
          : { uri: playerUrl as string }
      }
      style={styles.videoView}
      originWhitelist={['*']}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo
      javaScriptEnabled
      domStorageEnabled
      injectedJavaScript={usingLocal ? CLIP_HEALTH_JS : undefined}
      onMessage={(e) => {
        // Local clip rendered nothing within the health-check window → fall
        // back to the hosted copy.
        if (e.nativeEvent.data === 'clip:empty' && usingLocal && !forceRemote) {
          setForceRemote(true);
        }
      }}
      onError={() => {
        // Local clip failed to render → fall back to the hosted copy.
        if (usingLocal && !forceRemote) setForceRemote(true);
      }}
    />
  );

  // ── Save handler ──
  // Optimistic: flip locally first, call RPC, revert on error. The RPC
  // returns the new server-side state so an out-of-order tap can't leave
  // the local heart out of sync.
  const onTapSave = async () => {
    if (!video || saveBusy) return;
    setSaveBusy(true);
    const prev = saved;
    setSaved(!prev);
    try {
      const next = await toggleManualSave(video.id);
      setSaved(next);
      trackEvent(next ? 'manual_video_saved' : 'manual_video_unsaved', {
        video_id: video.id,
      });
    } catch (e: any) {
      setSaved(prev);
      // Quiet — heart un-flip is sufficient feedback. No Alert here.
      console.warn('toggle save failed', e?.message);
    } finally {
      setSaveBusy(false);
    }
  };

  // ── Share handler ──
  // Uses RN's built-in Share API (no native deps required). iOS surfaces the
  // system share sheet; we log 'ios_share_sheet' on success without knowing
  // exactly which app the user picked (Apple doesn't disclose that). The
  // landing-page URL is currently a stub (post-MVP), but the share text
  // includes the title + caption so the link itself can do work right now.
  const onTapShare = async () => {
    if (!video || shareBusy) return;
    setShareBusy(true);
    const url = manualVideoShareUrl(video.id);
    const title = video.title;
    const message = t('manual.shareMessage')
      .replace('{title}', title)
      .replace('{url}', url);
    try {
      const result = await Share.share({
        title,
        message,
        url, // iOS uses this when available; Android falls back to message
      });
      // Only log when the share actually went through. dismissedAction means
      // the user closed the sheet without picking anything.
      if (result.action === Share.sharedAction) {
        // Best-effort fire-and-forget; await catches any throws but the
        // call itself swallows network errors inside.
        await logManualShare(video.id, 'ios_share_sheet');
        trackEvent('manual_video_shared', {
          video_id: video.id,
          channel: 'ios_share_sheet',
        });
      }
    } catch (e: any) {
      Alert.alert(t('manual.shareErrorTitle'), e?.message ?? t('manual.shareErrorBody'));
    } finally {
      setShareBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>← {t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color="#D96C88" />
        </View>
      )}

      {!loading && !video && (
        <View style={styles.errorBlock}>
          <Text style={styles.errorTitle}>{t('manual.videoMissingTitle')}</Text>
          <Text style={styles.errorBody}>{t('manual.videoMissingBody')}</Text>
        </View>
      )}

      {!loading && video && (playerUrl || usingLocal) && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.videoFrame, isHtmlClip && styles.videoFramePortrait]}>
            {!fullscreen && renderPlayer('inline')}
            {/* Expand to fullscreen */}
            <TouchableOpacity
              style={styles.fsEnter}
              onPress={() => setFullscreen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('manual.fullscreenEnterA11y')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.fsEnterIcon}>⤢</Text>
            </TouchableOpacity>
          </View>

          {/* Fullscreen player — immersive Modal over the whole app. */}
          <Modal
            visible={fullscreen}
            animationType="fade"
            supportedOrientations={['portrait', 'landscape']}
            onRequestClose={() => setFullscreen(false)}
            statusBarTranslucent
          >
            <StatusBar hidden />
            <View style={styles.fsContainer}>
              {fullscreen && renderPlayer('full')}
              <TouchableOpacity
                style={styles.fsExit}
                onPress={() => setFullscreen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('manual.fullscreenExitA11y')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.fsExitIcon}>✕</Text>
              </TouchableOpacity>

              {/* Playlist controls — position counter + prev/next. */}
              {isPlaylist && (
                <>
                  <View style={styles.fsCount} pointerEvents="none">
                    <Text style={styles.fsCountText}>{index + 1} / {playlist.length}</Text>
                  </View>
                  {hasPrev && (
                    <TouchableOpacity
                      style={[styles.fsNav, styles.fsNavLeft]}
                      onPress={() => goToIndex(index - 1)}
                      accessibilityRole="button"
                      accessibilityLabel={t('manual.playlistPrevA11y')}
                      hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
                    >
                      <Text style={styles.fsNavIcon}>‹</Text>
                    </TouchableOpacity>
                  )}
                  {hasNext && (
                    <TouchableOpacity
                      style={[styles.fsNav, styles.fsNavRight]}
                      onPress={() => goToIndex(index + 1)}
                      accessibilityRole="button"
                      accessibilityLabel={t('manual.playlistNextA11y')}
                      hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
                    >
                      <Text style={styles.fsNavIcon}>›</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </Modal>

          <View style={styles.meta}>
            <Text style={styles.title}>{video.title}</Text>
            <Text style={styles.duration}>{formatDuration(video.duration_seconds)}</Text>
            <Text style={styles.description}>{video.description}</Text>

            {/* Save + Share row. Heart toggles save state, Share opens the
                iOS share sheet and logs the share with channel
                'ios_share_sheet' on success. */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={onTapSave}
                disabled={saveBusy}
                style={[styles.actionPill, saved && styles.actionPillActive]}
                accessibilityRole="button"
                accessibilityLabel={
                  saved ? t('manual.unsaveA11y') : t('manual.saveA11y')
                }
                accessibilityState={{ selected: saved, busy: saveBusy }}
              >
                <Text style={[styles.actionIcon, saved && styles.actionIconActive]}>
                  {saved ? '♥' : '♡'}
                </Text>
                <Text style={[styles.actionLabel, saved && styles.actionLabelActive]}>
                  {saved ? t('manual.saved') : t('manual.save')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onTapShare}
                disabled={shareBusy}
                style={styles.actionPill}
                accessibilityRole="button"
                accessibilityLabel={t('manual.shareA11y')}
                accessibilityState={{ busy: shareBusy }}
              >
                <Text style={styles.actionIcon}>↗</Text>
                <Text style={styles.actionLabel}>{t('manual.share')}</Text>
              </TouchableOpacity>
            </View>

            {/* Captions toggle — only renders when at least one track exists. */}
            {(video.has_captions_en || video.has_captions_es) && (
              <View style={styles.captionsBlock}>
                <Text style={styles.captionsLabel}>{t('manual.captions')}</Text>
                <View style={styles.captionsRow}>
                  <CaptionPill
                    label={t('manual.captionsOff')}
                    active={captionLang === 'off'}
                    onPress={() => setCaptionLang('off')}
                  />
                  {video.has_captions_en && (
                    <CaptionPill
                      label={t('manual.captionsEn')}
                      active={captionLang === 'en'}
                      onPress={() => setCaptionLang('en')}
                    />
                  )}
                  {video.has_captions_es && (
                    <CaptionPill
                      label={t('manual.captionsEs')}
                      active={captionLang === 'es'}
                      onPress={() => setCaptionLang('es')}
                    />
                  )}
                </View>
                {/* The Mux hosted player surfaces its own captions menu inside
                    the WebView; this row stays as a brand-aligned affordance
                    and will drive `player.subtitleTrack` after the native
                    swap. */}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function CaptionPill({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.captionPill, active && styles.captionPillActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.captionPillText, active && styles.captionPillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bark },
  header: {
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20,
    backgroundColor: COLORS.bark,
  },
  back: { fontSize: 14, color: COLORS.paper, fontFamily: FONTS.bodySemiBold },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  errorBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: {
    fontSize: 18, fontFamily: FONTS.headerBold, color: COLORS.paper, marginBottom: 8,
  },
  errorBody: {
    fontSize: 13, fontFamily: FONTS.body, color: COLORS.paper, opacity: 0.85, textAlign: 'center',
  },

  scroll: { paddingBottom: 60 },

  videoFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
  },
  // Portrait clips (1080×1920) — show a tall frame so the inline preview isn't
  // a letterboxed sliver. (Clips also auto-open fullscreen on load.)
  videoFramePortrait: { aspectRatio: 9 / 16 },
  videoView: { width: '100%', height: '100%', backgroundColor: '#000' },

  // Expand-to-fullscreen control on the inline frame (bottom-right).
  fsEnter: {
    position: 'absolute', right: 10, bottom: 10,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  fsEnterIcon: { color: '#fff', fontSize: 18, lineHeight: 20 },

  // Immersive fullscreen Modal.
  fsContainer: { flex: 1, backgroundColor: '#000' },
  fsExit: {
    position: 'absolute', top: 52, right: 18,
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  fsExitIcon: { color: '#fff', fontSize: 18, lineHeight: 20, fontWeight: '600' },

  // Playlist controls inside the fullscreen Modal.
  fsCount: {
    position: 'absolute', top: 56, alignSelf: 'center',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  fsCountText: { color: '#fff', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  fsNav: {
    position: 'absolute', top: '50%', marginTop: -24,
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  fsNavLeft: { left: 12 },
  fsNavRight: { right: 12 },
  fsNavIcon: { color: '#fff', fontSize: 30, lineHeight: 32, fontWeight: '300' },

  meta: { paddingHorizontal: 20, paddingTop: 16, backgroundColor: COLORS.cream, flex: 1 },
  title: {
    fontSize: 22, fontFamily: FONTS.headerBold, color: COLORS.bark,
    lineHeight: 28, marginBottom: 4,
  },
  duration: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold, color: '#7A4A24',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
  },
  description: {
    fontSize: 14, fontFamily: FONTS.body, color: COLORS.barkSoft,
    lineHeight: 20, marginBottom: 24,
  },

  // Save / Share row sits between description and captions. Two roomy pills
  // side-by-side, the heart pill flips to filled-cinnamon when saved so the
  // affordance is obvious without animations.
  actionRow: {
    flexDirection: 'row', gap: 12, marginBottom: 24,
  },
  actionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.sandSoft,
    backgroundColor: COLORS.paper,
  },
  actionPillActive: {
    backgroundColor: '#D96C88', borderColor: '#D96C88',
  },
  actionIcon: {
    fontSize: 16, color: COLORS.bark,
  },
  actionIconActive: { color: COLORS.paper },
  actionLabel: {
    fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
    letterSpacing: 0.2,
  },
  actionLabelActive: { color: COLORS.paper },

  captionsBlock: { marginBottom: 24 },
  captionsLabel: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, color: '#7A4A24',
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8,
  },
  captionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  captionPill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.sandSoft,
    backgroundColor: COLORS.paper,
  },
  captionPillActive: {
    backgroundColor: COLORS.coco, borderColor: COLORS.coco,
  },
  captionPillText: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
  },
  captionPillTextActive: { color: COLORS.paper },
});
