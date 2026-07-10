// ClipPlayer — the shared full-bleed Manual video player.
//
// Extracted from ManualVideoScreen so every video surface (chapter "Play all",
// the Home "this week" row, Saved videos, and future surfaces) gets the same
// treatment: Stories/Reels-style overlay, offline-first local clips with remote
// fallback, real progress + 90% completion, auto-hiding chrome, swipe-down to
// dismiss, and swipe left/right between clips.
//
// Navigation-agnostic: takes a `clips` list + `startIndex` + `onClose`. Each
// clip carries its own (audience, category) so playlists can span chapters
// (this-week / saved). Clips are resolved via listManualVideos and cached by
// id — the whole chapter is cached on first fetch, so same-chapter playlists
// switch with no loading flash.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share, Alert, StatusBar,
  Animated, PanResponder, Dimensions, Pressable,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { useAnalytics } from '@hooks/useAnalytics';
import { getLocalClipHtml, MANUAL_VIDEO_REMOTE_BASE } from '@/manual/localManualClips';
import {
  listManualVideos,
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

// playbackId (+ title/poster/duration) lets a clip carry its Mux asset directly,
// for videos that live outside manual_videos (e.g. the week-level intro video) —
// the player then skips the listManualVideos lookup.
export type ClipRef = {
  id: string; audience: ManualAudience; category: string;
  playbackId?: string; title?: string; posterUrl?: string; durationSeconds?: number;
};

interface ClipPlayerProps {
  clips: ClipRef[];
  startIndex?: number;
  onClose: () => void;
}

export default function ClipPlayer({ clips, startIndex = 0, onClose }: ClipPlayerProps) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const { trackEvent } = useAnalytics();

  const safeClips = clips.length ? clips : [];
  const [index, setIndex] = useState(() => Math.min(Math.max(0, startIndex), Math.max(0, safeClips.length - 1)));
  const current = safeClips[Math.min(index, safeClips.length - 1)];
  const hasPrev = index > 0;
  const hasNext = index < safeClips.length - 1;
  const isPlaylist = safeClips.length > 1;

  // Resolved clips, keyed by id. Each fetch pulls a whole chapter, so a
  // same-chapter playlist is fully cached after the first load.
  const [cache, setCache] = useState<Record<string, ManualVideo>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [forceRemote, setForceRemote] = useState(false);
  const [progress, setProgress] = useState(0);
  const [watched, setWatched] = useState(false);
  const [chrome, setChrome] = useState(true);

  const startedAtRef = useRef(Date.now());
  const completionWrittenRef = useRef(false);
  const lastSaveSecRef = useRef(0);

  const video = current ? (cache[current.id] ?? null) : null;

  // Hide the status bar while the player is mounted; restore on unmount.
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    return () => StatusBar.setHidden(false, 'fade');
  }, []);

  // Resolve the current clip's chapter into the cache (covers the whole row in
  // one fetch). Skips when the clip is already cached — no spinner on switch.
  useEffect(() => {
    if (!current || cache[current.id]) { setLoading(false); return; }
    // Direct-playback clip (week-intro video — lives outside manual_videos):
    // synthesize a cache entry, no RPC lookup.
    if (current.playbackId) {
      const synth = {
        id: current.id, title: current.title ?? '',
        mux_playback_id: current.playbackId, poster_url: current.posterUrl ?? null,
        duration_seconds: current.durationSeconds ?? null,
      } as unknown as ManualVideo;
      setCache((prev) => ({ ...prev, [current.id]: synth }));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const list = await listManualVideos(current.audience, current.category, lang);
        if (cancelled) return;
        setCache((prev) => {
          const m = { ...prev };
          list.forEach((v) => { m[v.id] = v; });
          return m;
        });
      } catch (e) {
        console.error('clip load', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.audience, current?.category, lang]);

  // Per-clip reset — runs whenever the active clip resolves/changes.
  useEffect(() => {
    if (!video || !current) return;
    setForceRemote(false);
    setProgress(0);
    setWatched(video.is_watched ?? false);
    setSaved(video.is_saved ?? false);
    setChrome(true);
    completionWrittenRef.current = false;
    lastSaveSecRef.current = 0;
    startedAtRef.current = Date.now();
    trackEvent('manual_video_viewed', { video_id: video.id, audience: current.audience, category: current.category });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id]);

  // Auto-hide the overlay chrome ~3s after it appears.
  useEffect(() => {
    if (!chrome) return;
    const id = setTimeout(() => setChrome(false), 3000);
    return () => clearTimeout(id);
  }, [chrome]);

  const goToIndex = (next: number) => {
    if (next < 0 || next >= safeClips.length || next === index) return;
    setIndex(next);
  };

  // Progress + watch-tracking loop.
  useEffect(() => {
    if (!video || !current) return;
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
        trackEvent('manual_video_completed', { video_id: video.id, audience: current.audience, category: current.category });
        if (isPlaylist && index < safeClips.length - 1) {
          setTimeout(() => goToIndex(index + 1), 600);
        }
      }
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id, index]);

  // Unmount/clip-change save.
  useEffect(() => {
    return () => {
      if (!video) return;
      const dur = video.duration_seconds > 0 ? video.duration_seconds : 60;
      const sec = Math.max(0, Math.min(Math.floor((Date.now() - startedAtRef.current) / 1000), dur));
      if (sec > 0) markVideoWatched(video.id, sec).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id]);

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
          startedAtRef.current = Date.now();
        } else if (e.nativeEvent.data === 'clip:empty' && usingLocal && !forceRemote) {
          setForceRemote(true);
        }
      }}
      onError={() => { if (usingLocal && !forceRemote) setForceRemote(true); }}
    />
  ), [usingLocal, localHtml, playerUrl, forceRemote, CLIP_HEALTH_JS]);

  // Gestures: swipe down to dismiss, swipe left/right to change clip.
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const axisRef = useRef<null | 'x' | 'y'>(null);
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const navRef = useRef({ hasPrev: false, hasNext: false });
  navRef.current = { hasPrev, hasNext };
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 || g.dy > 10,
      onPanResponderGrant: () => { axisRef.current = null; },
      onPanResponderMove: (_, g) => {
        if (!axisRef.current) {
          if (Math.abs(g.dx) > Math.abs(g.dy)) axisRef.current = 'x';
          else if (g.dy > 0) axisRef.current = 'y';
          else return;
        }
        if (axisRef.current === 'x') translateX.setValue(g.dx);
        else if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        const axis = axisRef.current;
        axisRef.current = null;
        if (axis === 'y') {
          if (g.dy > 130 || g.vy > 0.6) {
            Animated.timing(translateY, { toValue: screenH, duration: 200, useNativeDriver: true }).start(() => onClose());
          } else {
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
          }
          return;
        }
        if (axis === 'x') {
          const goNext = (g.dx < -90 || g.vx < -0.5) && navRef.current.hasNext;
          const goPrev = (g.dx > 90 || g.vx > 0.5) && navRef.current.hasPrev;
          if (goNext || goPrev) {
            // Real slide: finish sliding the current clip off-screen, swap to
            // the next one, drop it just off the opposite edge, then slide it
            // in. (No more bounce-back-then-pop.)
            const dir = goNext ? -1 : 1;
            Animated.timing(translateX, { toValue: dir * screenW, duration: 160, useNativeDriver: true })
              .start(() => {
                setIndex((i) => i + (goNext ? 1 : -1));
                translateX.setValue(-dir * screenW);
                Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 0 }).start();
              });
          } else {
            // Not far enough — settle back to center.
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 2 }).start();
          }
          return;
        }
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        axisRef.current = null;
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX }, { translateY }] }]}
      {...panResponder.panHandlers}
    >
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={ROSE} />
        </View>
      )}

      {!loading && !video && (
        <View style={[styles.center, { padding: 24 }]}>
          <Text style={styles.errorTitle}>{t('manual.videoMissingTitle')}</Text>
          <Text style={styles.errorBody}>{t('manual.videoMissingBody')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.errorBtn} accessibilityRole="button">
            <Text style={styles.errorBtnText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && video && (playerUrl || usingLocal) && (
        <>
          {player}

          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setChrome((c) => !c)}
            accessibilityRole="button"
            accessibilityLabel={chrome ? t('manual.hideControlsA11y') : t('manual.showControlsA11y')}
          />

          {isHtmlClip && (
            <View style={[styles.progressTrack, { top: insets.top + 8 }]} pointerEvents="none">
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          )}

          {chrome && (
            <>
              <LinearGradient
                colors={['rgba(0,0,0,0.5)', 'transparent']}
                style={[styles.scrimTop, { height: insets.top + 96 }]}
                pointerEvents="none"
              />
              <View style={[styles.topRow, { top: insets.top + 16 }]}>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.back')}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.iconGlyph}>✕</Text>
                </TouchableOpacity>
                {isPlaylist && (
                  <View style={styles.counterPill}>
                    <Text style={styles.counterText}>{index + 1} / {safeClips.length}</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {chrome && (
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
          )}
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Neutral near-white — not the harsh black flash, not the warm/brown cream.
  // Only seen during load + the slide transition; clips fill it once painted.
  container: { flex: 1, backgroundColor: '#F7F6F4' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  webview: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F7F6F4' },

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
  iconGlyph: { color: '#fff', fontSize: 17, lineHeight: 19, fontWeight: '600' },
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
