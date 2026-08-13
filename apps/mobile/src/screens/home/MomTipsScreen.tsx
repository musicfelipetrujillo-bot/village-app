// MomTipsScreen — "mom tips" (Mama's Corner)
//
// Replaces the "Mom hacks" row that sat behind a `soon` chip with nothing
// behind it. One tip a day, addressed to the week of HER baby's life.
//
// Same three rules as Reset & Recharge — this is Mama's Corner, and the whole
// point of the section is cutting mental load, not adding to it:
//   1. NOTHING TO SET UP — it reads her baby's week from the profile she
//      already filled in.
//   2. NOTHING TO MAINTAIN — no streaks, no "you missed yesterday", no history.
//      Day-of-year picks the tip, so opening it twice a week costs her nothing.
//   3. IT'S USEFUL IN ONE SCREEN — today's tip is the first thing she sees, at
//      full size. The rest of the week is below it, for anyone who wants more.
//
// ⚠️ EMPTY IS A LEGITIMATE STATE, NOT A BUG. The RPCs return only rows the
// clinical reviewer has approved, and the seed lands everything as 'draft'.
// Until that pass happens this screen renders the calm empty state below. Do
// NOT "fix" that by relaxing the RPC filter — the draft gate is the reason it
// is safe to ship 371 rows of daily guidance to postpartum women at all.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { BackButton } from '@components/shared/BackButton';
import { useHomeStore } from '@store/home';
import { useUserStore } from '@store/user';
import {
  getTipForToday, listTipsForWeek, CATEGORY_LABEL,
  type MomTip, type MomTipCategory,
} from '@api/momTips';

const ROSE = '#C24A63';
const INK = '#43260F', INKSOFT = '#7A5A3A', MUTED = '#A6957F';

// Category is a quiet tag, not a filter or a tab — the founder's rule from the
// Manual rework: pillar = tag, never a navigation layer.
const TONE: Record<MomTipCategory, { bg: string; fg: string }> = {
  you:   { bg: '#FDECEF', fg: '#C2556F' },
  feed:  { bg: '#FBF0D5', fg: '#B98A1E' },
  sleep: { bg: '#EAEEF4', fg: '#5E7392' },
  care:  { bg: '#EFE7DA', fg: '#8A6A55' },
  play:  { bg: '#EDF1E6', fg: '#7C8B6B' },
};

export default function MomTipsScreen() {
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const lang = useUserStore((s) => (s.profile?.preferred_language ?? 'en')) as 'en' | 'es';
  const es = lang === 'es';

  const week = babyProfile?.current_week_number ?? 0;

  const [today, setToday] = useState<MomTip | null>(null);
  const [rest, setRest] = useState<MomTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [t, all] = await Promise.all([
        getTipForToday(week, lang),
        listTipsForWeek(week, lang),
      ]);
      setToday(t);
      // Everything except the one already shown at the top.
      setRest(all.filter((r) => !t || r.day_index !== t.day_index));
    } catch {
      // A failed fetch and an unapproved-content empty are different things and
      // the copy has to tell them apart — see the two states below.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [week, lang]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <BackButton />

        <Text style={styles.eyebrow}>{es ? 'RINCÓN DE MAMÁ' : "MAMA'S CORNER"}</Text>
        <Text style={styles.title}>{es ? 'Tips de mamá' : 'Mom tips'}</Text>
        <Text style={styles.sub}>
          {es
            ? `Una idea al día, para la semana ${week} de tu bebé. Nada que mantener.`
            : `One idea a day, for your baby's week ${week}. Nothing to keep up with.`}
        </Text>

        {loading && (
          <View style={styles.quiet}>
            <ActivityIndicator color={ROSE} />
          </View>
        )}

        {!loading && failed && (
          <View style={styles.quiet}>
            <Text style={styles.quietTitle}>{es ? 'No cargó' : "That didn't load"}</Text>
            <Text style={styles.quietBody}>
              {es
                ? 'Revisa tu conexión y vuelve a entrar.'
                : 'Check your connection and come back in.'}
            </Text>
          </View>
        )}

        {/* Content exists but is awaiting clinical review. Says so plainly —
            villie's credibility with postpartum moms rests on it being obvious
            that a person checks this before it reaches her. */}
        {!loading && !failed && !today && rest.length === 0 && (
          <View style={styles.quiet}>
            <Text style={styles.quietTitle}>{es ? 'Casi listo' : 'Almost ready'}</Text>
            <Text style={styles.quietBody}>
              {es
                ? 'Los tips de esta semana están en revisión clínica. Nada llega aquí sin que alguien lo apruebe primero.'
                : "This week's tips are with our clinical reviewer. Nothing lands here until a person has approved it."}
            </Text>
          </View>
        )}

        {!loading && !failed && today && <TodayCard tip={today} es={es} />}

        {!loading && !failed && rest.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{es ? 'ESTA SEMANA' : 'THIS WEEK'}</Text>
            {rest.map((t) => <RestRow key={`${t.day_index}`} tip={t} es={es} />)}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function CategoryTag({ category, es }: { category: MomTipCategory; es: boolean }) {
  const tone = TONE[category] ?? TONE.you;
  const label = CATEGORY_LABEL[category]?.[es ? 'es' : 'en'] ?? category;
  return (
    <View style={[styles.tag, { backgroundColor: tone.bg }]}>
      <Text style={[styles.tagText, { color: tone.fg }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

function TodayCard({ tip, es }: { tip: MomTip; es: boolean }) {
  return (
    <View style={styles.todayCard}>
      <View style={styles.todayHead}>
        <Text style={styles.todayLabel}>{es ? 'HOY' : 'TODAY'}</Text>
        <CategoryTag category={tip.category} es={es} />
      </View>
      <Text style={styles.todayTitle}>{tip.title}</Text>
      <Text style={styles.todayBody}>{tip.body}</Text>
    </View>
  );
}

function RestRow({ tip, es }: { tip: MomTip; es: boolean }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowTitle}>{tip.title}</Text>
        <CategoryTag category={tip.category} es={es} />
      </View>
      <Text style={styles.rowBody}>{tip.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },

  eyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 2.2,
    color: MUTED, marginTop: 6,
  },
  title: {
    fontFamily: FONTS.v3_display, fontSize: 30, color: INK,
    letterSpacing: -0.5, marginTop: 6,
  },
  sub: {
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21,
    color: INKSOFT, marginTop: 8, marginBottom: 22,
  },

  quiet: { paddingVertical: 44, alignItems: 'center' },
  quietTitle: {
    fontFamily: FONTS.v3_display, fontSize: 18, color: INK, marginBottom: 8,
  },
  quietBody: {
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21,
    color: INKSOFT, textAlign: 'center', paddingHorizontal: 16,
  },

  // Today gets real weight — it's the reason she opened the screen.
  todayCard: {
    backgroundColor: '#FEFAF6', borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: '#F0E4D6',
  },
  todayHead: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  todayLabel: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 2.2, color: ROSE,
  },
  todayTitle: {
    fontFamily: FONTS.v3_display, fontSize: 22, color: INK,
    letterSpacing: -0.3, lineHeight: 28,
  },
  todayBody: {
    fontFamily: FONTS.v2_body, fontSize: 15, lineHeight: 24,
    color: INKSOFT, marginTop: 10,
  },

  sectionLabel: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 2.2,
    color: MUTED, marginTop: 30, marginBottom: 12,
  },
  // The rest of the week is deliberately lighter than today — same information
  // architecture as the Manual briefing: one thing at full weight, the rest quiet.
  row: {
    paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#EFE4D6',
  },
  rowHead: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 10,
  },
  rowTitle: {
    flex: 1, fontFamily: FONTS.v3_display, fontSize: 16,
    color: INK, letterSpacing: -0.2,
  },
  rowBody: {
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21,
    color: INKSOFT, marginTop: 6,
  },

  tag: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  tagText: {
    fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.2,
  },
});
