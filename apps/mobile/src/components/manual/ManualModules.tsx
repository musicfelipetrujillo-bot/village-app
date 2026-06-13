// ManualModules — the repeatable below-deck content for a Manual chapter:
//   01 Checklist  →  02 Article/Expert  →  03 Infographic
// Driven entirely by a CategoryContent (manualWeekContent), so every week +
// category renders the same structure. The infographic switches on `kind`.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Share } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from '@utils/constants';
import { select, tap } from '@utils/haptics';
import type { CategoryContent, Checklist, Article, Info } from '@/manual/manualWeekContent';

const SAGE = '#6F7A43';
const SAGE_BG = '#EAEDD8';

const INK = '#43260F';
const INKSOFT = '#7A5A3A';
const LABEL = '#A8794A';
const CREAM = '#FFFCF6';
const HAIR = 'rgba(67,38,15,0.07)';
const ACCENT = '#C9824E';
const ROSE = '#D96C88';
const BERRY = '#C25A78';

function ModuleLabel({ n, type }: { n: string; type: string }) {
  return (
    <View style={s.modLabel}>
      <Text style={s.modN}>{n}</Text>
      <Text style={s.modT}>{type.toUpperCase()}</Text>
    </View>
  );
}

function ChecklistModule({ data }: { data: Checklist }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  return (
    <View>
      <ModuleLabel n="01" type="Do · checklist" />
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

function ArticleModule({ data }: { data: Article }) {
  return (
    <View>
      <ModuleLabel n="02" type="Read · expert" />
      <LinearGradient colors={['#FCEFE0', '#F4DEC8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tip}>
        <Text style={s.tipAsk}>A mom asked…</Text>
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
            <Text style={s.verifiedT}>Verified</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const STORAGE_ICON: Record<string, string> = { counter: '🌡️', fridge: '🧊', freezer: '❄️' };

function InfographicModule({ data }: { data: Info }) {
  return (
    <View>
      <ModuleLabel n="03" type="Know · infographic" />
      <View style={s.info}>
        <Text style={s.infoTitle}>{data.title}</Text>

        {data.kind === 'wakewindows' && (
          <View>
            {data.rows.map((r, i) => (
              <View key={i} style={s.ww}>
                <Text style={[s.wwAge, r.now && s.wwAgeNow]}>{r.age}{r.now ? ' · now' : ''}</Text>
                <View style={s.wwTrack}>
                  <View style={[s.wwFill, { width: `${r.pct}%` }, r.now && s.wwFillNow]} />
                </View>
                <Text style={[s.wwVal, r.now && s.wwValNow]}>{r.val}</Text>
              </View>
            ))}
          </View>
        )}

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
      </View>
    </View>
  );
}

function AskSpecialistModule({ questions }: { questions: string[] }) {
  const onShare = () => {
    tap();
    Share.share({
      message: 'Questions for my next visit:\n\n' + questions.map((q, i) => `${i + 1}. ${q}`).join('\n'),
    }).catch(() => {});
  };
  return (
    <View>
      <ModuleLabel n="04" type="Ask · your specialist" />
      <View style={s.chart}>
        <Text style={s.chartLead}>Bring these three</Text>
        {questions.map((q, i) => (
          <View key={i} style={s.qRow}>
            <Text style={s.qNum}>{i + 1}</Text>
            <Text style={s.qText}>{q}</Text>
          </View>
        ))}
        <TouchableOpacity
          style={s.shareBtn}
          activeOpacity={0.7}
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="Share these questions with your provider"
        >
          <Text style={s.shareTxt}>Share with your provider →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ManualModules({ content }: { content: CategoryContent }) {
  return (
    <View style={s.wrap}>
      <ChecklistModule data={content.checklist} />
      <ArticleModule data={content.article} />
      {content.info && <InfographicModule data={content.info} />}
      {content.specialistQs && content.specialistQs.length > 0 && (
        <AskSpecialistModule questions={content.specialistQs} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 26, gap: 26, paddingHorizontal: 20 },

  modLabel: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 },
  modN: { fontFamily: FONTS.headerBold, fontSize: 14, color: ACCENT },
  modT: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.6, color: LABEL },

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
  tipBy: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  tipAvRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  tipAv: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F7CDD3', alignItems: 'center', justifyContent: 'center' },
  tipName: { fontFamily: FONTS.bodyBold, fontSize: 14.5, color: INK },
  tipRole: { fontFamily: FONTS.body, fontSize: 12, color: INKSOFT, marginTop: 1 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(111,122,67,0.14)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  verifiedCheck: { fontSize: 10, fontWeight: '800', color: SAGE },
  verifiedT: { fontFamily: FONTS.bodyBold, fontSize: 11, color: SAGE },

  // infographic shell
  info: { backgroundColor: CREAM, borderRadius: 20, borderWidth: 1, borderColor: HAIR, padding: 20 },
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
