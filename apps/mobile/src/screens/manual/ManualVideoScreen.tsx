// ManualVideo — full-bleed player for one Manual clip (or a chapter playlist).
//
// The clips are short, looping, portrait animations (self-hosted HTML, bundled
// offline; see localManualClips). This screen presents them edge-to-edge with
// a Stories/Reels-style overlay: a top progress bar, a close affordance, the
// title/description over a bottom scrim, and save/share + playlist controls.
//
// Design intent (the screen IS the player — no Modal, no inline/expanded
// duality):
//   • Back/close pops the screen cleanly; nothing lingers (fixes the old
//     Modal-stays-open-after-back bug).
//   • The status bar is hidden only while this screen is focused and restored
//     on blur, so leaving always resets to default.
//   • A real progress bar (synced to the clip's known duration) plus a
//     90%-completion mark gives "watching the whole video" a visible,
//     trackable meaning instead of an invisible wall-clock heuristic.
//
// Watch progress is persisted via mark_video_watched: every ~5s while playing,
// once at 90% (sets completed_at server-side, sticky), and on unmount.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share, Alert, StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
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

const ROSE = '#D96C88';

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
  const insets = useSafeAreaInsets();
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
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [forceRemote, setForceRemote] = useState(false); // local→remote fallback
  const [progress, setProgress] = useState(0);            // 0..1 for the bar
  const [watched, setWatched] = useState(false);          // crossed 90% this session

  const { trackEvent } = useAnalytics();

  // Wall-clock playback tracking. startedAtRef is (re)set when a clip begins
  // rendering; the clip loops, so the bar shows position within the current
  // loop while completion uses total elapsed.
  const startedAtRef = useRef(Date.now());
  const completionWrittenRef = useRef(false);
  const lastSaveSecRef = useRef(0);

  // Hide the status bar only while focused; restore on blur so leaving the
  // player always resets the chrome to default.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'fade');
      return () => StatusBar.setHidden(false, 'fade');
    }, []),
  );

  // Load the current clip's metadata. Resets per-clip playback tracking.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setForceRemote(false);
    setProgress(0);
    setWatched(false);
    completionWrittenRef.current = false;
    lastSaveSecRef.current = 0;
    startedAtRef.current = Date.now();
    (async () => {
      try {
        const v = await getManualVideo(audience, category, currentVideoId, lang);
        if (cancelled) return;
        setVideo(v);
        setSaved(v?.is_saved ?? false);
        setWatched(v?.is_watched ?? false);
        startedAtRef.current = Date.now();
        if (v) trackEvent('manual_video_viewed', { video_id: v.id, audience, category });
      } catch (e) {
        console.error('manual video load', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [audience, category, currentVideoId, lang]);

  // Advance/retreat within the playlist (also used by auto-advance).
  const goToIndex = (next: number) => {
    if (next < 0 || next >= playlist.length || next === index) return;
    setIndex(next); // the load effect resets all per-clip tracking
  };

  // Progress + watch-tracking loop. Drives the visible bar (position within the
  // current loop) and persists progress: every ~5s, once at 90% (completion),
  // and via the unmount effect below.
  useEffect(() => {
    if (!video) return;
    const dur = video.duration_seconds > 0 ? video.duration_seconds : 60;
    const id = setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      setProgress(Math.min(1, (elapsed % dur) / dur));

      const sec = Math.min(Math.floor(elapsed), dur);
      if (sec - lastSaveSecRef.current >= 5) {
        lastSaveSecRef.current = sec;
        markVideoWatched(video.id, sec).catch(() => {});
      }

      if (elapsed >= dur * 0.9 && !completionWrittenRef.current) {
        completionWrittenRef.current = true;
        setWatched(true);
        markVideoWatched(video.id, dur).catch(() => {});
        trackEvent('manual_video_completed', { video_id: video.id, audience, category });
        if (isPlaylist && index < playlist.length - 1) {
          // Brief beat on the completed bar, then roll to the next clip.
          setTimeout(() => goToIndex(index + 1), 600);
        }
      }
    }, 200);
    return () => clearInterval(id);
  }, [video, index]);

  // Unmount/clip-change save — captures partial views (the common case).
  useEffect(() => {
    return () => {
      if (!video) return;
      const dur = video.duration_seconds > 0 ? video.duration_seconds : 60;
      const sec = Math.max(0, Math.min(Math.floor((Date.now() - startedAtRef.current) / 1000), dur));
      if (sec > 0) markVideoWatched(video.id, sec).catch(() => {});
    };
  }, [video]);

  // HTML clips load their (offline-bundled) URL; Mux videos use the hosted
  // player. Memoized so the 200ms progress re-render doesn't re-run the
  // ~40KB string injection.
  const playerUrl = video
    ? (video.html_url
        ?? (video.mux_playback_id
              ? muxPlayerUrl(video.mux_playback_id, { autoplay: true, poster: video.poster_url })
              : null))
    : null;
  const localHtml = useMemo(
    () => (video && !forceRemote ? getLocalClipHtml(video.html_url) : null),
    [video, forceRemote],
  );
  const usingLocal = !!localHtml;
  const isHtmlClip = !!video?.html_url;

  // Mount health-check for local clips (see localManualClips): if React never
  // populates #root, fall back to the hosted copy and re-sync the start time.
  const CLIP_HEALTH_JS = `(function(){var n=0;var iv=setInterval(function(){n++;var r=document.getElementById('root');if(r&&r.childElementCount>0){clearInterval(iv);window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('clip:ok');}else if(n>=30){clearInterval(iv);window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('clip:empty');}},100);})();true;`;

  const onTapSave = async () => {
    if (!video || saveBusy) return;
    setSaveBusy(true);
    const prev = saved;
    setSaved(!prev);
    try {
      const next = await toggleManualSave(video.id);
      setSaved(next);
      trackEvent(next ? 'manual_video_saved' : 'manual_video_unsaved', { video_id: video.id });
    } catch (e: any) {
      setSaved(prev);
      console.warn('toggle save failed', e?.message);
    } finally {
      setSaveBusy(false);
    }
  };

  const onTapShare = async () => {
    if (!video || shareBusy) return;
    setShareBusy(true);
    const url = manualVideoShareUrl(video.id);
    const message = t('manual.shareMessage').replace('{title}', video.title).replace('{url}', url);
    try {
      const result = await Share.share({ title: video.title, message, url });
      if (result.action === Share.sharedAction) {
        await logManualShare(video.id, 'ios_share_sheet');
        trackEvent('manual_video_shared', { video_id: video.id, channel: 'ios_share_sheet' });
      }
    } catch (e: any) {
      Alert.alert(t('manual.shareErrorTitle'), e?.message ?? t('manual.shareErrorBody'));
    } finally {
      setShareBusy(false);
    }
  };

  // Memoized so the 200ms progress re-render never recreates the WebView
  // source (which would reload the clip mid-playback).
  const player = useMemo(() => (
    <WebView
      source={
        usingLocal
          ? { html: localHtml as string, baseUrl: MANUAL_VIDEO_REMOTE_BASE }
          : { uri: playerUrl as string }
      }
      style={styles.webview}
      originWhitelist={['*']}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      injectedJavaScript={usingLocal ? CLIP_HEALTH_JS : undefined}
      onMessage={(e) => {
        if (e.nativeEvent.data === 'clip:ok') {
          startedAtRef.current = Date.now(); // sync progress to real render start
        } else if (e.nativeEvent.data === 'clip:empty' && usingLocal && !forceRemote) {
          setForceRemote(true);
        }
      }}
      onError={() => { if (usingLocal && !forceRemote) setForceRemote(true); }}
    />
  ), [usingLocal, localHtml, playerUrl, forceRemote, CLIP_HEALTH_JS]);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={ROSE} />
        </View>
      )}

      {!loading && !video && (
        <View style={[styles.center, { padding: 24 }]}>
          <Text style={styles.errorTitle}>{t('manual.videoMissingTitle')}</Text>
          <Text style={styles.errorBody}>{t('manual.videoMissingBody')}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBtn} accessibilityRole="button">
            <Text style={styles.errorBtnText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && video && (playerUrl || usingLocal) && (
        <>
          {player}

          {/* Top scrim for control legibility over a bright clip. */}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent']}
            style={[styles.scrimTop, { height: insets.top + 96 }]}
            pointerEvents="none"
          />

          {/* Progress bar (HTML clips have a known duration; Mux carries its
              own scrubber). */}
          {isHtmlClip && (
            <View style={[styles.progressTrack, { top: insets.top + 8 }]} pointerEvents="none">
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          )}

          {/* Top row: close + position counter. */}
          <View style={[styles.topRow, { top: insets.top + 16 }]}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.iconGlyph}>⌄</Text>
            </TouchableOpacity>
            {isPlaylist && (
              <View style={styles.counterPill}>
                <Text style={styles.counterText}>{index + 1} / {playlist.length}</Text>
              </View>
            )}
          </View>

          {/* Bottom scrim with title, description, and controls. */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.82)']}
            style={[styles.scrimBottom, { paddingBottom: insets.bottom + 20 }]}
          >
            <View style={styles.metaRow}>
              {watched && <Text style={styles.watchedTag}>✓ {t('manual.watched')}</Text>}
              <Text style={styles.duration}>{formatDuration(video.duration_seconds)}</Text>
            </View>
            <Text style={styles.title}>{video.title}</Text>
            {!!video.description && (
              <Text style={styles.desc} numberOfLines={2}>{video.description}</Text>
            )}

            <View style={styles.controls}>
              <TouchableOpacity
                onPress={onTapSave}
                disabled={saveBusy}
                style={[styles.ctrlBtn, saved && styles.ctrlBtnActive]}
                accessibilityRole="button"
                accessibilityLabel={saved ? t('manual.unsaveA11y') : t('manual.saveA11y')}
                accessibilityState={{ selected: saved, busy: saveBusy }}
              >
                <Text style={[styles.ctrlIcon, saved && styles.ctrlIconActive]}>{saved ? '♥' : '♡'}</Text>
                <Text style={[styles.ctrlLabel, saved && styles.ctrlIconActive]}>
                  {saved ? t('manual.saved') : t('manual.save')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onTapShare}
                disabled={shareBusy}
                style={styles.ctrlBtn}
                accessibilityRole="button"
                accessibilityLabel={t('manual.shareA11y')}
                accessibilityState={{ busy: shareBusy }}
              >
                <Text style={styles.ctrlIcon}>↗</Text>
                <Text style={styles.ctrlLabel}>{t('manual.share')}</Text>
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              {isPlaylist && (
                <>
                  <TouchableOpacity
                    onPress={() => goToIndex(index - 1)}
                    disabled={!hasPrev}
                    style={[styles.navBtn, !hasPrev && styles.navBtnDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel={t('manual.playlistPrevA11y')}
                  >
                    <Text style={styles.navGlyph}>‹</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => goToIndex(index + 1)}
                    disabled={!hasNext}
                    style={[styles.navBtn, !hasNext && styles.navBtnDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel={t('manual.playlistNextA11y')}
                  >
                    <Text style={styles.navGlyph}>›</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </LinearGradient>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  webview: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },

  errorTitle: { fontSize: 18, fontFamily: FONTS.headerBold, color: COLORS.paper, marginBottom: 8, textAlign: 'center' },
  errorBody: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.paper, opacity: 0.85, textAlign: 'center', marginBottom: 20 },
  errorBtn: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999, backgroundColor: ROSE },
  errorBtnText: { color: '#fff', fontSize: 14, fontFamily: FONTS.bodySemiBold },

  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  scrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 40 },

  progressTrack: {
    position: 'absolute', left: 16, right: 16, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden',
  },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: '#fff' },

  topRow: {
    position: 'absolute', left: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iconGlyph: { color: '#fff', fontSize: 26, lineHeight: 28, marginTop: -4 },
  counterPill: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  counterText: { color: '#fff', fontSize: 12, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.5 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  watchedTag: {
    color: '#CDE3B5', fontSize: 11, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  duration: {
    color: 'rgba(255,255,255,0.78)', fontSize: 11, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  title: { color: '#fff', fontSize: 22, fontFamily: FONTS.headerBold, lineHeight: 28 },
  desc: { color: 'rgba(255,255,255,0.82)', fontSize: 14, fontFamily: FONTS.body, lineHeight: 20, marginTop: 6 },

  controls: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  ctrlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  ctrlBtnActive: { backgroundColor: ROSE, borderColor: ROSE },
  ctrlIcon: { color: '#fff', fontSize: 15 },
  ctrlIconActive: { color: '#fff' },
  ctrlLabel: { color: '#fff', fontSize: 13, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.2 },
  navBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  navBtnDisabled: { opacity: 0.3 },
  navGlyph: { color: '#fff', fontSize: 26, lineHeight: 28, fontWeight: '300' },
});
