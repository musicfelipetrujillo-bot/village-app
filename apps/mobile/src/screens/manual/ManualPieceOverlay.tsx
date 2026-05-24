// ManualPieceOverlay — fullscreen Modal that pops over the chapter
// scroll position when the user taps a non-video piece (article,
// illustration, checklist). Mirrors the handoff's PieceArticleOverlay
// pattern at manual-flow.jsx 581-680: sticky top bar with close +
// chapter/num/dur eyebrow + bookmark, then scrolling body keyed off
// the piece kind. Video pieces still route to ManualVideo (full Mux
// player + watch-tracking) since that's a separate, deeper screen.
//
// Kept as a Modal (not nav screen) so closing returns the user to the
// exact same scroll position in ManualScrollV3 — which matches the
// handoff's "the pieces visible behind continue at scroll position
// when closed" intent.

import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, FONTS } from '@utils/constants';
import { V3Card } from '@components/shared/V3Card';
import { GlassHighlight } from '@components/shared/GlassHighlight';

// Mirror the Piece union from ManualScrollV3 — exported here so the
// caller (and any future piece-detail integration) can type its props.
export type PieceArticle = {
  kind: 'article'; num: string; title: string; dur: string; excerpt: string;
};
export type PieceIllustration = {
  kind: 'illustration'; num: string; title: string; caption: string;
};
export type PieceChecklist = {
  kind: 'checklist'; num: string; title: string; steps: string[];
};
export type OverlayPiece = PieceArticle | PieceIllustration | PieceChecklist;

const T = {
  paper:     COLORS.v2_paper,
  cream:     COLORS.v2_cream,
  parchment: COLORS.v2_parchment,
  card:      COLORS.v2_card,
  butter:    COLORS.v2_butter,
  cinnamon:  COLORS.v2_cinnamon,
  cocoa:     COLORS.v2_cocoa,
  walnut:    COLORS.v2_walnut,
  amber:     COLORS.v2_amber,
  rule:      'rgba(61,31,14,0.13)',
};

const KIND_LABEL: Record<OverlayPiece['kind'], string> = {
  article:      'Read',
  illustration: 'See',
  checklist:    'Do',
};

export interface ManualPieceOverlayProps {
  visible: boolean;
  onClose: () => void;
  piece: OverlayPiece | null;
  chapter: { ch: string; cat: string; bg: string; fg: string } | null;
  /** Optional duration string shown in the eyebrow (illustration/checklist
   *  pieces don't carry one in the source data). */
  durFallback?: string;
}

export function ManualPieceOverlay({
  visible, onClose, piece, chapter, durFallback,
}: ManualPieceOverlayProps) {
  // Hooks must be called every render (can't be inside the early return
  // below). Initialize empty — gets re-derived on each render from the
  // piece prop when present.
  const [checked, setChecked] = useState<boolean[]>([]);
  React.useEffect(() => {
    if (piece?.kind === 'checklist') {
      setChecked(piece.steps.map((_, i) => i === 0));
    }
  }, [piece]);

  if (!piece || !chapter) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.shell} />
      </Modal>
    );
  }

  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, j) => (j === i ? !v : v)));

  const dur =
    piece.kind === 'article' ? piece.dur :
    (durFallback ?? '2 min');

  // Headline rendered without trailing period (the cinnamon italic dot
  // takes that slot) for the editorial cinnamon-accent recipe from the
  // handoff.
  const titleBase = piece.title.replace(/\.$/, '');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.shell}>
        {/* Sticky top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.iconBtn}
            accessibilityLabel="Close"
            activeOpacity={0.85}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path
                d="M6 6L18 18M6 18L18 6"
                stroke={T.cocoa} strokeWidth={2.4}
                fill="none" strokeLinecap="round"
              />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.topEyebrow} numberOfLines={1}>
            {chapter.ch} · {piece.num} · {dur}
          </Text>
          {/* Bookmark placeholder — wire to manual_video_saves equivalent
              when piece-level saves land (currently videos-only). */}
          <View style={styles.iconBtn}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path
                d="M19 21L12 16L5 21V5a2 2 0 012-2h10a2 2 0 012 2v16z"
                stroke={T.cocoa} strokeWidth={1.8}
                fill="none" strokeLinecap="round" strokeLinejoin="round"
              />
            </Svg>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* Tiny chapter chip — locates the piece in the manual */}
          <View style={[styles.chapterChip, { backgroundColor: chapter.bg }]}>
            <Text style={[styles.chapterChipText, { color: chapter.fg }]}>
              {chapter.ch}
            </Text>
          </View>

          {/* Eyebrow (kind + num) */}
          <Text style={styles.kindEyebrow}>
            {piece.num} · {KIND_LABEL[piece.kind]}
          </Text>

          {/* Headline with cinnamon italic period */}
          <Text style={styles.headline}>
            {titleBase}
            <Text style={styles.headlinePeriod}>.</Text>
          </Text>

          {/* Body — keyed off piece kind */}
          {piece.kind === 'article' ? (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.articleBody}>{piece.excerpt}</Text>
              {/* Closing pull-quote — placeholder until long-form copy
                  lands; gives the article-overlay surface real weight. */}
              <V3Card style={{ marginTop: 24 }} contentStyle={styles.pullQuoteInner}>
                <GlassHighlight radius={14} height={10} />
                <Text style={styles.pullEyebrow}>One thing to remember</Text>
                <Text style={styles.pullQuote}>
                  {titleBase.split(' ').slice(0, 6).join(' ')} — and the rest
                  of the week looks after itself.
                </Text>
              </V3Card>
            </View>
          ) : null}

          {piece.kind === 'illustration' ? (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.illustrationCaption}>{piece.caption}</Text>
              {/* Stub illustration body — five labeled bands so the
                  overlay reads "explorable" rather than a single line of
                  caption. Real illustration assets land in 4.5. */}
              <V3Card style={{ marginTop: 18 }} contentStyle={styles.illBodyInner}>
                {['0–3 mo', '3–6 mo', '6–9 mo', '9–12 mo', '12+ mo'].map((label, i) => {
                  const widths = ['30%', '42%', '62%', '78%', '100%'];
                  const current = i === 2;
                  return (
                    <View
                      key={label}
                      style={[
                        styles.illRow,
                        i < 4 ? styles.illRowDivider : null,
                      ]}
                    >
                      <Text style={[
                        styles.illAge, current ? styles.illAgeCurrent : null,
                      ]}>{label}</Text>
                      <View style={styles.illTrack}>
                        <View style={{
                          height: '100%', width: widths[i] as any,
                          backgroundColor: chapter.bg,
                          opacity: current ? 1 : 0.55,
                        }} />
                      </View>
                    </View>
                  );
                })}
              </V3Card>
              <Text style={styles.illustrationFootnote}>
                Bars are tuned to {chapter.ch.toLowerCase()} norms for this
                age band. Your week will look slightly different. That's
                fine.
              </Text>
            </View>
          ) : null}

          {piece.kind === 'checklist' ? (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.checklistLead}>
                Tap each step as you finish it. Saved to your week.
              </Text>
              <V3Card style={{ marginTop: 18 }} contentStyle={{ overflow: 'hidden' }}>
                {piece.steps.map((step, j) => {
                  const done = checked[j];
                  return (
                    <TouchableOpacity
                      key={j}
                      onPress={() => toggle(j)}
                      activeOpacity={0.85}
                      style={[
                        styles.checklistRow,
                        j === 0 ? null : styles.checklistRowDivider,
                        done ? { backgroundColor: T.parchment } : null,
                      ]}
                    >
                      <View style={[
                        styles.checkbox,
                        done
                          ? { backgroundColor: chapter.bg, borderColor: chapter.bg }
                          : { borderColor: T.rule },
                      ]}>
                        {done ? (
                          <Svg width={11} height={11} viewBox="0 0 24 24">
                            <Path
                              d="M5 13l4 4L19 7"
                              stroke={chapter.fg} strokeWidth={3}
                              fill="none"
                              strokeLinecap="round" strokeLinejoin="round"
                            />
                          </Svg>
                        ) : null}
                      </View>
                      <Text style={[
                        styles.checklistStep,
                        done ? styles.checklistStepDone : null,
                      ]}>{step}</Text>
                    </TouchableOpacity>
                  );
                })}
              </V3Card>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default ManualPieceOverlay;

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: T.paper },
  topBar: {
    paddingTop: 14, paddingBottom: 10,
    paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
    backgroundColor: T.paper,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: T.parchment,
    alignItems: 'center', justifyContent: 'center',
  },
  topEyebrow: {
    flex: 1, textAlign: 'center',
    fontFamily: FONTS.v2_mono, fontSize: 10, color: T.amber,
    letterSpacing: 2.2, textTransform: 'uppercase', fontWeight: '600',
  },
  body: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 48 },

  chapterChip: {
    alignSelf: 'flex-start',
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 3,
  },
  chapterChipText: {
    fontFamily: FONTS.v2_bold, fontSize: 11,
    letterSpacing: 0.4,
  },
  kindEyebrow: {
    marginTop: 16,
    fontFamily: FONTS.v2_mono, fontSize: 10, color: T.amber,
    letterSpacing: 2.2, textTransform: 'uppercase', fontWeight: '600',
  },
  headline: {
    marginTop: 8,
    fontFamily: FONTS.v3_display, fontSize: 34, lineHeight: 36,
    color: T.cocoa, letterSpacing: -1.1,
  },
  headlinePeriod: {
    fontFamily: FONTS.v3_display_italic, color: T.cinnamon,
  },

  // Article body
  articleBody: {
    fontFamily: FONTS.v2_body, fontSize: 17, lineHeight: 26,
    color: T.walnut,
  },
  pullQuoteInner: { padding: 18 },
  pullEyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 9.5, color: T.amber,
    letterSpacing: 2, textTransform: 'uppercase', fontWeight: '600',
    marginBottom: 8,
  },
  pullQuote: {
    fontFamily: FONTS.v3_display_italic, fontSize: 19, lineHeight: 26,
    color: T.cocoa, letterSpacing: -0.3,
  },

  // Illustration body
  illustrationCaption: {
    fontFamily: FONTS.v2_body, fontSize: 15.5, lineHeight: 23,
    color: T.cocoa,
  },
  illBodyInner: { paddingVertical: 8, paddingHorizontal: 16 },
  illRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
  },
  illRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  illAge: {
    width: 64,
    fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut,
  },
  illAgeCurrent: { fontWeight: '700', color: T.cocoa },
  illTrack: {
    flex: 1, height: 12, borderRadius: 2,
    backgroundColor: T.parchment, overflow: 'hidden',
  },
  illustrationFootnote: {
    marginTop: 14,
    fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 18,
    color: T.amber,
  },

  // Checklist body
  checklistLead: {
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21,
    color: T.walnut,
  },
  checklistRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  checklistRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  checklistStep: {
    flex: 1,
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 19,
    color: T.cocoa,
  },
  checklistStepDone: {
    color: T.walnut,
    textDecorationLine: 'line-through',
    textDecorationColor: T.amber,
  },
});
