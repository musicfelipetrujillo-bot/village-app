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
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import {
  getManualVideo,
  markVideoWatched,
  muxPlayerUrl,
  formatDuration,
  type ManualVideo,
  type ManualAudience,
} from '@/api/manual';

type ParamList = {
  ManualVideo: { audience: ManualAudience; category: string; videoId: string };
};

export default function ManualVideoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ManualVideo'>>();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const { audience, category, videoId } = route.params;

  const [video, setVideo] = useState<ManualVideo | null>(null);
  const [loading, setLoading] = useState(true);
  // ES toggle defaults to user's preferred language when an ES caption track exists.
  const [captionLang, setCaptionLang] = useState<'en' | 'es' | 'off'>('off');

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
    (async () => {
      try {
        const v = await getManualVideo(audience, category, videoId, lang);
        if (cancelled) return;
        setVideo(v);
        screenMountedAtRef.current = Date.now();
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
  }, [audience, category, videoId, lang]);

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

  const playerUrl = video ? muxPlayerUrl(video.mux_playback_id, {
    autoplay: true,
    poster: video.poster_url,
  }) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>← {t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color="#C07840" />
        </View>
      )}

      {!loading && !video && (
        <View style={styles.errorBlock}>
          <Text style={styles.errorTitle}>{t('manual.videoMissingTitle')}</Text>
          <Text style={styles.errorBody}>{t('manual.videoMissingBody')}</Text>
        </View>
      )}

      {!loading && video && playerUrl && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.videoFrame}>
            <WebView
              source={{ uri: playerUrl }}
              style={styles.videoView}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo
              javaScriptEnabled
              domStorageEnabled
            />
          </View>

          <View style={styles.meta}>
            <Text style={styles.title}>{video.title}</Text>
            <Text style={styles.duration}>{formatDuration(video.duration_seconds)}</Text>
            <Text style={styles.description}>{video.description}</Text>

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
  },
  videoView: { width: '100%', height: '100%', backgroundColor: '#000' },

  meta: { paddingHorizontal: 20, paddingTop: 16, backgroundColor: COLORS.cream, flex: 1 },
  title: {
    fontSize: 22, fontFamily: FONTS.headerBold, color: COLORS.bark,
    lineHeight: 28, marginBottom: 4,
  },
  duration: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold, color: '#A77349',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
  },
  description: {
    fontSize: 14, fontFamily: FONTS.body, color: COLORS.barkSoft,
    lineHeight: 20, marginBottom: 24,
  },

  captionsBlock: { marginBottom: 24 },
  captionsLabel: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, color: '#A77349',
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
