// ManualModules — the repeatable below-deck content for a Manual chapter:
//   01 Checklist  →  02 Article/Expert  →  03 Infographic
// Driven entirely by a CategoryContent (manualWeekContent), so every week +
// category renders the same structure. The infographic switches on `kind`.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Share, ScrollView, Dimensions, Linking } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { FONTS } from '@utils/constants';
import { select, tap } from '@utils/haptics';
import type { CategoryContent, Checklist, Article, Info, Helps } from '@/manual/manualWeekContent';

const SAGE = '#6F7A43';
const SAGE_BG = '#EAEDD8';

const INK = '#43260F';
const INKSOFT = '#7A5A3A';
const LABEL = '#A8794A';
const CREAM = '#FFFCF6';
const HAIR = 'rgba(67,38,15,0.07)';
const ACCENT = '#B0234F'; // repointed cinnamon->rose 2026-07-12 to match the app
const HONEY = '#B98A1E';
const ROSE = '#E84B79';
const BERRY = '#B0234F';

type Lang = 'en' | 'es';

// Localized chrome (labels + fixed copy). Content itself is translated upstream
// in getManualContent(week, cat, lang); this only covers the module UI text.
const CH = {
  checklist: { en: 'Do · checklist', es: 'Haz · lista' },
  expert:    { en: 'Read · expert', es: 'Lee · experto' },
  info:      { en: 'Know · infographic', es: 'Entiende · infografía' },
  helps:     { en: 'Helps · tips + picks', es: 'Ayuda · tips + favoritos' },
  villie:    { en: 'Ask · villie', es: 'Pregunta · villie' },
  helpsNote: { en: 'tips + picks — not medical advice', es: 'tips + favoritos — no es consejo médico' },
  helpsDisc: { en: 'villie may earn a small commission — we only add what moms actually love.', es: 'villie puede ganar una pequeña comisión — solo agregamos lo que de verdad les encanta a las mamás.' },
  helpsShop: { en: 'shop ›', es: 'ver ›' },
  momAsked:  { en: 'A mom asked…', es: 'Una mamá preguntó…' },
  verified:  { en: 'Verified', es: 'Verificado' },
  avEyebrow: { en: 'ASK VILLIE', es: 'PREGÚNTALE A VILLIE' },
  avTitle:   { en: 'Still have a question about this week?', es: '¿Te queda alguna duda sobre esta semana?' },
  avInput:   { en: 'ask villie anything…', es: 'pregúntale a villie lo que sea…' },
  avSub:     { en: "your 24/7 guide — answers in villie's voice, not a google rabbit hole", es: 'tu guía 24/7 — respuestas en la voz de villie, sin caer en un laberinto de google' },
  avA11y:    { en: 'Ask Villie about this week', es: 'Pregúntale a Villie sobre esta semana' },
} as const;

function ModuleLabel({ n, type }: { n: string; type: string }) {
  return (
    <View style={s.modLabel}>
      <Text style={s.modN}>{n}</Text>
      <Text style={s.modT}>{type.toUpperCase()}</Text>
    </View>
  );
}

function ChecklistModule({ data, lang }: { data: Checklist; lang: Lang }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  return (
    <View>
      <ModuleLabel n="03" type={CH.checklist[lang]} />
      <Text style={s.panelTitle}>{data.title}</Text>
      <View style={s.panel}>
        {data.items.map((it, i) => {
          const on = !!done[i];
          return (
            <TouchableOpacity
              key={i}
              style={[s.ci, i > 0 && s.ciBorder]}
              activeOpacity={0.7}
              onPress={() => { select(); setDone((d) => ({ ...d, [i]: !d[i] })); }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={it.label}
            >
              <View style={[s.bx, on && s.bxOn]}>{on && <Text style={s.bxCheck}>✓</Text>}</View>
              <Text style={s.ciText}>
                <Text style={[s.ciLabel, on && s.ciLabelOn]}>{it.label}</Text>
                {it.note ? <Text style={s.ciNote}>  — {it.note}</Text> : null}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ExpertCard({ data, lang }: { data: Article; lang: Lang }) {
  return (
    <LinearGradient colors={['#FCEFE0', '#F4DEC8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tip}>
      <Text style={s.tipAsk}>{CH.momAsked[lang]}</Text>
      <Text style={s.tipQ}>{data.question}</Text>
      <View style={s.tipQuoteRow}>
        <Text style={s.quoteMark}>“</Text>
        <Text style={s.tipA}>{data.answer}</Text>
      </View>
      <View style={s.tipDivider} />
      <View style={s.tipBy}>
        <View style={s.tipAvRing}>
          <View style={s.tipAv}><Text style={{ fontSize: 19 }}>{data.emoji}</Text></View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.tipName}>{data.name}</Text>
          <Text style={s.tipRole}>{data.role}</Text>
        </View>
        <View style={s.verified}>
          <Text style={s.verifiedCheck}>✓</Text>
          <Text style={s.verifiedT}>{CH.verified[lang]}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

// Swipeable expert cards (3–4 per chapter). Full-width paging + dots.
function ArticleModule({ articles, lang }: { articles: Article[]; lang: Lang }) {
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  if (!articles.length) return null;
  return (
    <View>
      <ModuleLabel n="02" type={CH.expert[lang]} />
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {articles.length === 1 ? (
          <ExpertCard data={articles[0]} lang={lang} />
        ) : w > 0 ? (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const next = Math.round(e.nativeEvent.contentOffset.x / w);
                if (next !== idx) { setIdx(next); select(); }
              }}
            >
              {articles.map((a, i) => (
                <View key={i} style={{ width: w }}>
                  <ExpertCard data={a} lang={lang} />
                </View>
              ))}
            </ScrollView>
            <View style={s.artDots}>
              {articles.map((_, i) => (
                <View key={i} style={[s.artDot, i === idx && s.artDotOn]} />
              ))}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const STORAGE_ICON: Record<string, string> = { counter: '🌡️', fridge: '🧊', freezer: '❄️' };

function InfographicModule({ data, lang }: { data: Info; lang: Lang }) {
  return (
    <View>
      <ModuleLabel n="01" type={CH.info[lang]} />
      <LinearGradient colors={['#FDF0DC', '#FDECEF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.info}>
        <Text style={s.infoTitle}>{data.title}</Text>

        {data.kind === 'wakewindows' && (() => {
          // A rising CURVE (not bars) — "awake time ramps up fast" as one shape.
          const W = Dimensions.get('window').width - 80;
          const H = 128, pad = 16;
          const maxPct = Math.max(...data.rows.map((r) => r.pct), 1);
          const pts = data.rows.map((r, i) => ({
            x: pad + (data.rows.length > 1 ? i / (data.rows.length - 1) : 0.5) * (W - 2 * pad),
            y: pad + (1 - r.pct / maxPct) * (H - 2 * pad - 4),
            now: r.now,
          }));
          const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
          const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - pad} L${pts[0].x.toFixed(1)},${H - pad} Z`;
          const nowP = pts.find((p) => p.now);
          const nowRow = data.rows.find((r) => r.now);
          return (
            <View>
              <Svg width={W} height={H}>
                <Defs>
                  <SvgGrad id="wwArea" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#E84B79" stopOpacity={0.32} />
                    <Stop offset="1" stopColor="#E84B79" stopOpacity={0.02} />
                  </SvgGrad>
                </Defs>
                <Path d={area} fill="url(#wwArea)" />
                <Path d={line} stroke={ACCENT} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {nowP ? <Circle cx={nowP.x} cy={nowP.y} r={5.5} fill={ACCENT} stroke="#FFFFFF" strokeWidth={2.5} /> : null}
              </Svg>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                {data.rows.map((r, i) => <Text key={i} style={s.wwAxis} numberOfLines={1}>{r.age}</Text>)}
              </View>
              {nowRow ? (
                <View style={s.wwNow}>
                  <View style={s.wwNowDot} />
                  <Text style={s.wwNowText}>
                    {lang === 'es' ? `Aquí — ${nowRow.age}: ${nowRow.val}` : `You're here — ${nowRow.age}: ${nowRow.val}`}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })()}

        {data.kind === 'milkstorage' && (
          <View style={s.cols}>
            {data.cols.map((c, i) => (
              <View key={i} style={s.col}>
                <Text style={s.colIcon}>{STORAGE_ICON[c.icon] ?? '•'}</Text>
                <Text style={s.colV}>{c.v}</Text>
                <Text style={s.colU}>{c.u}</Text>
                <Text style={s.colW}>{c.w}</Text>
              </View>
            ))}
          </View>
        )}

        {data.kind === 'milestones' && (
          <View>
            {data.items.map((m, i) => (
              <View key={i} style={s.ms}>
                <View style={[s.msDot, m.now && s.msDotNow]} />
                <Text style={[s.msAge, m.now && s.msAgeNow]}>{m.age}</Text>
                <Text style={s.msLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
        )}

        {data.kind === 'diapercolor' && (
          <View>
            {data.cols.map((c, i) => (
              <View key={i} style={s.dc}>
                <View style={[s.dcSwatch, { backgroundColor: c.sw }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.dcDay}>{c.d}</Text>
                  <Text style={s.dcDesc}>{c.ds}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {data.kind === 'fives' && (
          <View style={s.fives}>
            {data.items.map((f, i) => (
              <View key={i} style={s.five}>
                <View style={s.fiveNum}><Text style={s.fiveNumT}>{i + 1}</Text></View>
                <Text style={s.fiveLabel}>{f}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.infoFoot}>{data.foot}</Text>
      </LinearGradient>
    </View>
  );
}

// Things that help — the honest commerce lane, split OUT of the story deck so a
// product recommendation never masquerades as education. Tips first (optional),
// then curated picks, with an FTC disclosure line. Products open in the browser.
function HelpsModule({ data, lang }: { data: Helps; lang: Lang }) {
  const open = (url: string) => { tap(); Linking.openURL(url).catch(() => {}); };
  return (
    <View>
      <ModuleLabel n="04" type={CH.helps[lang]} />
      <View style={s.helps}>
        <Text style={s.helpsNote}>{CH.helpsNote[lang]}</Text>
        {!!data.tips?.length && (
          <View style={s.helpsTips}>
            {data.tips.map((tip, i) => (
              <View key={i} style={s.helpsTipRow}>
                <Text style={s.helpsSpark}>✦</Text>
                <Text style={s.helpsTipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}
        {data.picks.map((p, i) => (
          <TouchableOpacity
            key={i}
            style={[s.helpsPick, (i > 0 || !!data.tips?.length) && s.helpsPickBorder]}
            activeOpacity={0.85}
            onPress={() => open(p.url)}
            accessibilityRole="link"
            accessibilityLabel={p.label}
          >
            <View style={s.helpsThumb} />
            <View style={s.helpsPickText}>
              <Text style={s.helpsPickLabel}>{p.label}</Text>
              {!!p.tag && <Text style={s.helpsPickTag}>{p.tag}</Text>}
            </View>
            <Text style={s.helpsShop}>{CH.helpsShop[lang]}</Text>
          </TouchableOpacity>
        ))}
        <Text style={s.helpsDisc}>{CH.helpsDisc[lang]}</Text>
      </View>
    </View>
  );
}

// Ask Villie — an active door into the in-app AI guide, seeded with this week's
// chapter (replaces the passive "bring these three questions" list). Works for
// every week with no per-week authoring.
function AskVillieModule({ onPress, lang }: { onPress: () => void; lang: Lang }) {
  return (
    <View>
      <ModuleLabel n="05" type={CH.villie[lang]} />
      <TouchableOpacity
        style={s.av}
        activeOpacity={0.92}
        onPress={() => { tap(); onPress(); }}
        accessibilityRole="button"
        accessibilityLabel={CH.avA11y[lang]}
      >
        <Text style={s.avEyebrow}>{CH.avEyebrow[lang]}</Text>
        <Text style={s.avTitle}>{CH.avTitle[lang]}</Text>
        <View style={s.avRow}>
          <View style={s.avInput}><Text style={s.avInputText}>{CH.avInput[lang]}</Text></View>
          <View style={s.avSend}><Text style={s.avArrow}>→</Text></View>
        </View>
        <Text style={s.avSub}>{CH.avSub[lang]}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ManualModules({ content, onAskVillie, lang = 'en' }: { content: CategoryContent; onAskVillie?: () => void; lang?: Lang }) {
  return (
    <View style={s.wrap}>
      {content.info && <InfographicModule data={content.info} lang={lang} />}
      <ArticleModule articles={content.articles} lang={lang} />
      <ChecklistModule data={content.checklist} lang={lang} />
      {!!content.helps?.picks.length && <HelpsModule data={content.helps} lang={lang} />}
      {onAskVillie && <AskVillieModule onPress={onAskVillie} lang={lang} />}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 26, gap: 26, paddingHorizontal: 20 },

  modLabel: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 },
  modN: { fontFamily: FONTS.headerBold, fontSize: 14, color: ACCENT },
  modT: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.6, color: LABEL },

  // things that help — honey-tinted, dashed border so it reads as a distinct
  // "picks" lane, unmistakably NOT one of the cream education cards.
  helps: { backgroundColor: '#FDF7E8', borderRadius: 20, borderWidth: 1, borderColor: '#E7CE9A', borderStyle: 'dashed', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 15 },
  helpsNote: { fontFamily: FONTS.body, fontSize: 11.5, color: '#9A7B3A', marginBottom: 10 },
  helpsTips: { marginBottom: 4 },
  helpsTipRow: { flexDirection: 'row', gap: 8, marginBottom: 7 },
  helpsSpark: { fontFamily: FONTS.bodyBold, fontSize: 13, color: HONEY, marginTop: 1 },
  helpsTipText: { flex: 1, fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 19, color: '#5C3B2A' },
  helpsPick: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  helpsPickBorder: { borderTopWidth: 1, borderTopColor: '#EFDDB4' },
  helpsThumb: { width: 44, height: 44, borderRadius: 11, backgroundColor: '#F3D9DF' },
  helpsPickText: { flex: 1 },
  helpsPickLabel: { fontFamily: FONTS.bodyBold, fontSize: 14, color: INK },
  helpsPickTag: { fontFamily: FONTS.body, fontSize: 11.5, color: INKSOFT, marginTop: 1, textTransform: 'lowercase' },
  helpsShop: { fontFamily: FONTS.bodyBold, fontSize: 12.5, color: HONEY },
  helpsDisc: { fontFamily: FONTS.body, fontSize: 10, color: '#A0895F', marginTop: 11 },

  // ask villie
  av: { backgroundColor: '#43260F', borderRadius: 20, padding: 16 },
  avEyebrow: { fontFamily: FONTS.bodyBold, fontSize: 10, letterSpacing: 1.6, color: '#F4C868' },
  avTitle: { fontFamily: FONTS.headerBold, fontSize: 17, color: '#FFFDF8', marginTop: 6, lineHeight: 22 },
  avRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  avInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11 },
  avInputText: { fontFamily: FONTS.body, fontSize: 12.5, color: '#E9D9C8' },
  avSend: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E84B79', alignItems: 'center', justifyContent: 'center' },
  avArrow: { color: '#fff', fontSize: 20, fontFamily: FONTS.bodySemiBold, marginTop: -2 },
  avSub: { fontFamily: FONTS.body, fontSize: 10, color: '#C9B79F', marginTop: 9 },

  // checklist
  panelTitle: { fontFamily: FONTS.headerBold, fontSize: 24, letterSpacing: -0.4, color: INK, marginBottom: 12 },
  panel: { backgroundColor: CREAM, borderRadius: 20, borderWidth: 1, borderColor: HAIR, overflow: 'hidden' },
  ci: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, paddingHorizontal: 18 },
  ciBorder: { borderTopWidth: 1, borderTopColor: HAIR },
  bx: { width: 25, height: 25, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(67,38,15,0.22)', alignItems: 'center', justifyContent: 'center' },
  bxOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  bxCheck: { color: '#fff', fontSize: 13, fontWeight: '800' },
  ciText: { flex: 1, lineHeight: 21 },
  ciLabel: { fontFamily: FONTS.bodySemiBold, fontSize: 15.5, color: INK },
  ciLabelOn: { textDecorationLine: 'line-through', color: ACCENT },
  ciNote: { fontFamily: FONTS.body, fontSize: 13, color: INKSOFT },

  // article / expert (editorial pull-quote card)
  tip: {
    borderRadius: 22, borderWidth: 1, borderColor: 'rgba(190,133,31,0.20)',
    paddingHorizontal: 22, paddingTop: 16, paddingBottom: 18, overflow: 'hidden',
    shadowColor: '#43260F', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 10 }, shadowRadius: 22, elevation: 2,
  },
  tipAsk: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: ACCENT, marginBottom: 6 },
  tipQ: { fontFamily: FONTS.headerBold, fontSize: 22, lineHeight: 26, letterSpacing: -0.4, color: INK },
  tipQuoteRow: { flexDirection: 'row', marginTop: 12 },
  quoteMark: { fontFamily: FONTS.headerBold, fontSize: 46, lineHeight: 42, color: ACCENT, width: 28, marginTop: -4 },
  tipA: { flex: 1, fontFamily: FONTS.body, fontSize: 15.5, lineHeight: 24, color: INK },
  tipDivider: { height: 1, backgroundColor: 'rgba(67,38,15,0.1)', marginTop: 16 },
  artDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 },
  artDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: 'rgba(67,38,15,0.18)' },
  artDotOn: { width: 18, backgroundColor: ACCENT },
  tipBy: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  tipAvRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  tipAv: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F7CDD3', alignItems: 'center', justifyContent: 'center' },
  tipName: { fontFamily: FONTS.bodyBold, fontSize: 14.5, color: INK },
  tipRole: { fontFamily: FONTS.body, fontSize: 12, color: INKSOFT, marginTop: 1 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBEFD0', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  verifiedCheck: { fontSize: 10, fontWeight: '800', color: HONEY },
  verifiedT: { fontFamily: FONTS.bodyBold, fontSize: 11, color: HONEY },

  // infographic shell — distinct tinted card + curve viz so it reads as a data
  // graphic, not another checklist.
  info: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(224,106,136,0.18)', padding: 20 },
  wwAxis: { flex: 1, textAlign: 'center', fontFamily: FONTS.bodySemiBold, fontSize: 9, color: '#9A8264' },
  wwNow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(224,106,136,0.25)', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, marginTop: 10 },
  wwNowDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: ACCENT },
  wwNowText: { flex: 1, fontFamily: FONTS.body, fontSize: 12.5, color: INK },
  infoTitle: { fontFamily: FONTS.headerBold, fontSize: 20, letterSpacing: -0.3, color: INK, marginBottom: 14 },
  infoFoot: { fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, color: INKSOFT, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: HAIR },

  // wake windows
  ww: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 13 },
  wwAge: { width: 118, fontFamily: FONTS.bodySemiBold, fontSize: 13, color: INKSOFT },
  wwAgeNow: { color: INK },
  wwTrack: { flex: 1, height: 16, borderRadius: 999, backgroundColor: 'rgba(67,38,15,0.08)', overflow: 'hidden' },
  wwFill: { height: '100%', borderRadius: 999, backgroundColor: ACCENT },
  wwFillNow: { backgroundColor: ROSE },
  wwVal: { width: 78, textAlign: 'right', fontFamily: FONTS.bodyBold, fontSize: 12.5, color: INK },
  wwValNow: { color: ROSE },

  // milk storage (3 columns)
  cols: { flexDirection: 'row', gap: 10 },
  col: { flex: 1, backgroundColor: 'rgba(67,38,15,0.04)', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  colIcon: { fontSize: 22, marginBottom: 6 },
  colV: { fontFamily: FONTS.headerBold, fontSize: 30, color: INK, lineHeight: 32 },
  colU: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: INKSOFT },
  colW: { fontFamily: FONTS.bodyBold, fontSize: 12, color: ACCENT, marginTop: 6, letterSpacing: 0.4 },

  // milestones
  ms: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  msDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: 'rgba(67,38,15,0.2)' },
  msDotNow: { backgroundColor: ROSE },
  msAge: { width: 56, fontFamily: FONTS.bodyBold, fontSize: 12.5, color: INKSOFT },
  msAgeNow: { color: ROSE },
  msLabel: { flex: 1, fontFamily: FONTS.bodySemiBold, fontSize: 15, color: INK },

  // diaper color
  dc: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 9 },
  dcSwatch: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: HAIR },
  dcDay: { fontFamily: FONTS.bodyBold, fontSize: 14, color: INK },
  dcDesc: { fontFamily: FONTS.body, fontSize: 13, color: INKSOFT },

  // Ask your specialist (sage "clinical chart" card)
  chart: { backgroundColor: SAGE_BG, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(63,69,22,0.12)', padding: 20 },
  chartLead: { fontFamily: FONTS.bodyBold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: SAGE, marginBottom: 12 },
  qRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  qNum: { fontFamily: FONTS.headerBold, fontSize: 15, color: SAGE, width: 16 },
  qText: { flex: 1, fontFamily: FONTS.bodySemiBold, fontSize: 15, lineHeight: 21, color: INK },
  shareBtn: { marginTop: 12, alignSelf: 'flex-start', borderWidth: 1.5, borderColor: SAGE, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  shareTxt: { fontFamily: FONTS.bodyBold, fontSize: 13.5, color: SAGE },

  // 5 S's
  fives: { gap: 10 },
  five: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fiveNum: { width: 28, height: 28, borderRadius: 999, backgroundColor: 'rgba(217,108,136,0.14)', alignItems: 'center', justifyContent: 'center' },
  fiveNumT: { fontFamily: FONTS.headerBold, fontSize: 13, color: BERRY },
  fiveLabel: { fontFamily: FONTS.bodySemiBold, fontSize: 16, color: INK },
});
