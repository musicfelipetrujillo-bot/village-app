// ManualModules — the repeatable below-deck content for a Manual chapter:
//   01 Checklist  →  02 Article/Expert  →  03 Infographic
// Driven entirely by a CategoryContent (manualWeekContent), so every week +
// category renders the same structure. The infographic switches on `kind`.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Share, ScrollView, Dimensions, Linking, Alert, Modal } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { FONTS } from '@utils/constants';
import { select, tap } from '@utils/haptics';
import { isProUser, isProEnabled } from '@/lib/pro';
import DeepDiveVideoCard from './DeepDiveVideoCard';
import type { CategoryContent, Checklist, Article, Info, Helps, StoryCard } from '@/manual/manualWeekContent';

const SAGE = '#6F7A43';
const SAGE_BG = '#EAEDD8';

const INK = '#43260F';
const INKSOFT = '#7A5A3A';
const LABEL = '#A8794A';
const CREAM = '#FFFCF6';
const HAIR = 'rgba(67,38,15,0.07)';
const ACCENT = '#9E2F4C'; // repointed cinnamon->rose 2026-07-12 to match the app
const HONEY = '#A84A66';
const ROSE = '#C24A63';
const BERRY = '#9E2F4C';

type Lang = 'en' | 'es';

// villie+ specialist deep-dive videos — hidden from users until footage is
// filmed + the paywall UX ships. Flip EXPO_PUBLIC_MANUAL_DEEPDIVE_ENABLED=1
// (in apps/mobile/.env) to preview the card in dev / the simulator.
const DEEPDIVE_ENABLED = process.env.EXPO_PUBLIC_MANUAL_DEEPDIVE_ENABLED === '1';

// Localized chrome (labels + fixed copy). Content itself is translated upstream
// in getManualContent(week, cat, lang); this only covers the module UI text.
const CH = {
  checklist: { en: 'do this week', es: 'para esta semana' },
  expert:    { en: 'ask the expert', es: 'pregunta al experto' },
  info:      { en: 'at a glance', es: 'de un vistazo' },
  helps:     { en: 'worth a look', es: 'vale la pena' },
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

// Each module type carries its own monochrome glyph so the stack is scannable
// (the mock's typed-card system) — calm, not colored-loud. Checklist keeps its
// rose tick; the rest read in the muted label ink.
function CheckGlyph({ color = ROSE }: { color?: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path d="M5 13l4 4L19 7" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function AskGlyph({ color = LABEL }: { color?: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.5A8 8 0 1121 12z" fill="none" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
      <Path d="M9.5 9.3a2.5 2.5 0 013.8-1.8c1.6 1 .9 2.9-.8 3.5-.6.2-1 .8-1 1.5" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Path d="M11.5 16.2h.01" fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
    </Svg>
  );
}
function GlanceGlyph({ color = LABEL }: { color?: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path d="M5 20V11M12 20V4M19 20v-6" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function LookGlyph({ color = LABEL }: { color?: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" fill="none" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
      <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" fill="none" stroke={color} strokeWidth={1.9} />
    </Svg>
  );
}

function ModuleLabel({ type, icon, divider }: { type: string; icon?: React.ReactNode; divider?: boolean }) {
  return (
    <>
      {divider ? <View style={s.modRule} /> : null}
      <View style={s.modLabel}>
        {icon ? <View style={{ marginRight: 5 }}>{icon}</View> : null}
        <Text style={s.modT}>{type.toUpperCase()}</Text>
      </View>
    </>
  );
}

function ChecklistModule({ data, lang, embedded, flat }: { data: Checklist; lang: Lang; embedded?: boolean; flat?: boolean }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  return (
    <View>
      {!embedded && <ModuleLabel type={CH.checklist[lang]} icon={<CheckGlyph />} />}
      {!embedded && <Text style={s.panelTitle}>{data.title}</Text>}
      <View style={flat ? s.flatList : s.panel}>
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
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ExpertCard({ data, lang, embedded }: { data: Article; lang: Lang; embedded?: boolean }) {
  return (
    <View style={s.tip}>
      {!embedded && <Text style={s.tipAsk}>{CH.momAsked[lang]}</Text>}
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
    </View>
  );
}

// Swipeable expert cards (3–4 per chapter). Full-width paging + dots.
function ArticleModule({ articles, lang, embedded }: { articles: Article[]; lang: Lang; embedded?: boolean }) {
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  if (!articles.length) return null;
  return (
    <View>
      {!embedded && <ModuleLabel type={CH.expert[lang]} icon={<AskGlyph />} divider />}
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {articles.length === 1 ? (
          <ExpertCard data={articles[0]} lang={lang} embedded={embedded} />
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
                  <ExpertCard data={a} lang={lang} embedded={embedded} />
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

function InfographicModule({ data, lang, embedded }: { data: Info; lang: Lang; embedded?: boolean }) {
  return (
    <View>
      {!embedded && <ModuleLabel type={CH.info[lang]} icon={<GlanceGlyph />} divider />}
      <LinearGradient colors={['#FDF0DC', '#FDECEF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.info, embedded && s.infoEmb]}>
        <Text style={s.infoTitle}>{data.title}</Text>

        {data.kind === 'wakewindows' && (() => {
          // A rising CURVE (not bars) — "awake time ramps up fast" as one shape.
          // Narrower budget when embedded in a briefing row (less container pad).
          const W = Dimensions.get('window').width - (embedded ? 104 : 80);
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
                    <Stop offset="0" stopColor="#C24A63" stopOpacity={0.32} />
                    <Stop offset="1" stopColor="#C24A63" stopOpacity={0.02} />
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
function HelpsModule({ data, lang, embedded }: { data: Helps; lang: Lang; embedded?: boolean }) {
  const open = (url: string) => { tap(); Linking.openURL(url).catch(() => {}); };
  return (
    <View>
      {!embedded && <ModuleLabel type={CH.helps[lang]} icon={<LookGlyph />} divider />}
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
      <ModuleLabel type={CH.villie[lang]} divider />
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

// Per-pillar accent for the teaching rows (dot + say line). Kept subtle so
// contrast stays high and nothing is over-bold.
const TEACH_INK: Record<string, string> = {
  sleep: '#A9692F', feed: '#9A6E12', grow: '#9E2F4C', care: '#63702F', hospital: '#8A5E38',
};
// Faint pillar wash + edge for the "read this week" card, so it reads as its
// own surface — not a continuation of the cream "this week" card.
const TEACH_TINT: Record<string, { wash: string; edge: string }> = {
  sleep:    { wash: '#FAF1E8', edge: 'rgba(169,105,47,0.22)' },
  feed:     { wash: '#FAF4E4', edge: 'rgba(154,110,18,0.22)' },
  grow:     { wash: '#FBEDF1', edge: 'rgba(158,47,76,0.20)' },
  care:     { wash: '#F2F5E8', edge: 'rgba(99,112,47,0.22)' },
  hospital: { wash: '#F9F3EC', edge: 'rgba(138,94,56,0.20)' },
};

// Editorial section header — an accent bar + label that announces a new group,
// so "this week" and "read this week" read as distinct sections.
function SectionHead({ label, accent, style }: { label: string; accent: string; style?: any }) {
  return (
    <View style={[s.secHead, style]}>
      <View style={[s.secBar, { backgroundColor: accent }]} />
      <Text style={s.secLabel}>{label}</Text>
    </View>
  );
}

// A 28px slot holding a module's typed glyph — tinted fill + a hairline ring in
// the glyph's own tone so the icon reads crisp, not floated on a pastel wash.
function BriefGlyph({ children, tint, ring }: { children: React.ReactNode; tint: string; ring: string }) {
  return <View style={[s.brGl, { backgroundColor: tint, borderColor: ring }]}>{children}</View>;
}

// One collapsible line in the briefing. Collapsed = glyph + title + a one-line
// preview; tap to reveal the detail inline. This is the whole format — you scan
// rows, and open one at a time, instead of scrolling a wall of boxes.
function BriefRow({ glyph, title, meta, first, defaultOpen, serifTitle, children }: {
  glyph: React.ReactNode; title: string; meta?: string;
  first?: boolean; defaultOpen?: boolean; serifTitle?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <View>
      {!first ? <View style={s.brDiv} /> : null}
      <TouchableOpacity
        style={s.brHead}
        activeOpacity={0.7}
        onPress={() => { select(); setOpen((o) => !o); }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
      >
        {glyph}
        <Text style={[serifTitle ? s.brTitleSerif : s.brTitle, s.brBody]} numberOfLines={1}>{title}</Text>
        {meta && !open ? <Text style={s.brMeta}>{meta}</Text> : null}
        <Text style={[s.brChev, open && s.brChevOpen]}>›</Text>
      </TouchableOpacity>
      {open ? <View style={s.brContent}>{children}</View> : null}
    </View>
  );
}

// The teaching detail (say / body / affiliate link) revealed when a read-row
// opens — same content the accordion showed, minus its own box.
function StoryBody({ card, ink, lang }: { card: StoryCard; ink: string; lang: Lang }) {
  return (
    <>
      {card.say ? <Text style={[s.stSay, { color: ink }]}>{card.say}</Text> : null}
      {card.body ? <Text style={s.stBody}>{card.body}</Text> : null}
      {card.link ? (
        <TouchableOpacity
          style={s.stLink}
          activeOpacity={0.8}
          onPress={() => Linking.openURL(card.link!.url).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel={card.link.label}
        >
          <Text style={s.stLinkGl}>{card.link.kind === 'shop' ? '🛍' : '↗'}</Text>
          <Text style={[s.stLinkT, { color: ink }]} numberOfLines={1}>{card.link.label}</Text>
        </TouchableOpacity>
      ) : null}
      {card.link?.kind === 'shop' ? (
        <Text style={s.stFtc}>
          {lang === 'es' ? 'Enlace de afiliado — podemos ganar una comisión.' : 'Affiliate link — we may earn a small commission.'}
        </Text>
      ) : null}
    </>
  );
}

// "Good to know" — a quick answer. Question is the row; tap reveals a short
// 2–3 sentence answer + who said it. NOT an article (that lives in the Buzz).
function QuickAnswer({ data, first, lang }: { data: Article; first?: boolean; lang: Lang }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      {!first ? <View style={s.qaDiv} /> : null}
      <TouchableOpacity
        style={s.qaHead}
        activeOpacity={0.7}
        onPress={() => { select(); setOpen((o) => !o); }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={data.question}
      >
        <View style={s.qaMark}><Text style={s.qaMarkT}>?</Text></View>
        <Text style={s.qaQ} numberOfLines={open ? 3 : 2}>{data.question}</Text>
        <Text style={[s.qaChev, open && s.qaChevOpen]}>›</Text>
      </TouchableOpacity>
      {open ? (
        <View style={s.qaBody}>
          <Text style={s.qaA}>{data.answer}</Text>
          <Text style={s.qaBy}>— {data.name}</Text>
        </View>
      ) : null}
    </View>
  );
}

// "Your tools" — one compact button in a single row (hybrid: everything stays
// visible, but the tools collapse to one row instead of three stacked pills).
function ToolBtn({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={s.toolBtn}
      activeOpacity={0.85}
      onPress={() => { tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={s.toolBtnGl}>{glyph}</Text>
      <Text style={s.toolBtnT} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ManualModules({ content, story, onAskVillie, lang = 'en', week, category, audience = 'baby' }: { content: CategoryContent; story?: StoryCard[]; onAskVillie?: () => void; lang?: Lang; week?: number; category?: string; audience?: 'mom' | 'baby' }) {
  const navigation = useNavigation<any>();

  // villie+ deep-dive: play (pro) / preview (tease) → the shared ClipPlayer.
  const openDeepDive = (mode: 'play' | 'preview') => {
    const dd = content.deepDive;
    if (!dd) return;
    if (!dd.playbackId && !dd.videoId) {
      Alert.alert(
        lang === 'es' ? 'Muy pronto' : 'Coming soon',
        lang === 'es'
          ? `El video de ${content.label} de esta semana se está grabando.`
          : `This week's ${content.label} video is being filmed.`,
      );
      return;
    }
    const cat = category ?? 'grow';
    const id = dd.videoId ?? `dd-${cat}-${week ?? 0}`;
    // TODO(next): pass `preview: mode === 'preview'` once ClipPlayer supports a
    // ~previewSeconds cutoff. For now both open the clip (content is pre-film).
    navigation.navigate('ManualVideo', {
      audience, category: cat, videoId: id,
      clips: [{ id, audience, category: cat, playbackId: dd.playbackId, title: dd.title, posterUrl: dd.posterUrl }],
    });
  };

  const promptPro = () => {
    // Build 14+: the real paywall (root-level modal). The Alert stays as the
    // fallback for OTA bundles where the paywall route can't sell anything
    // (no StoreKit SDK) — same copy as before.
    if (isProEnabled()) {
      let root: any = navigation;
      while (root?.getParent?.()) root = root.getParent();
      root?.navigate('Paywall', { source: 'manual_deepdive' });
      return;
    }
    Alert.alert(
      'villie pro',
      lang === 'es'
        ? 'Desbloquea todos los videos de especialistas — el agarre, los eructos, el giro — filmados paso a paso.'
        : 'Unlock every specialist deep-dive — the latch, the burp, the rollover — filmed step by step.',
      [{ text: lang === 'es' ? 'Ahora no' : 'Not now', style: 'cancel' }],
    );
  };

  // Manual = INSTRUCTION MANUAL (2026-08-12): show, don't tell. The video hero
  // lives above (ManualScrollV3, "how do I do it"). Here each block answers ONE
  // of the four questions — do this week / good to know / which tool helps — and
  // nothing is a long read (that lives in the Buzz).
  const L = (en: string, es: string) => (lang === 'es' ? es : en);
  const goHome = (screen: string, params?: any) =>
    navigation.getParent()?.navigate('Home' as never, { screen, params } as never);
  const hasKnow = content.articles.length > 0 || !!content.info;

  return (
    <View style={s.wrap}>
      {/* WHAT SHOULD I DO THIS WEEK? — the checklist, flat */}
      <SectionHead label={L('do this week', 'para esta semana')} accent="#C24A63" />
      <ChecklistModule data={content.checklist} lang={lang} embedded flat />

      {/* WHAT DO I NEED TO KNOW? — a couple quick answers + the one visual */}
      {hasKnow ? <SectionHead label={L('good to know', 'bueno saber')} accent="#BE851F" style={{ marginTop: 26 }} /> : null}
      {content.articles.length ? (
        <View style={s.qaList}>
          {content.articles.slice(0, 2).map((a, i) => (
            <QuickAnswer key={i} data={a} first={i === 0} lang={lang} />
          ))}
        </View>
      ) : null}
      {content.info ? (
        <View style={{ marginTop: content.articles.length ? 14 : 0 }}>
          <InfographicModule data={content.info} lang={lang} embedded />
        </View>
      ) : null}

      {/* WHICH TOOL HELPS ME DO IT? — links into Vili's own tools */}
      <SectionHead label={L('your tools', 'tus herramientas')} accent="#6F7A43" style={{ marginTop: 26 }} />
      <View style={s.toolRow}>
        <ToolBtn glyph="◷" label={L('Log', 'Registra')} onPress={() => goHome('Insights')} />
        <ToolBtn glyph="✦" label={L('Plan', 'Planea')} onPress={() => goHome('DayPlan')} />
        {onAskVillie ? <ToolBtn glyph="✎" label={L('Ask Vili', 'Vili')} onPress={onAskVillie} /> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 22, paddingHorizontal: 20 },

  // ── Briefing: the week as one scannable list, not a stack of boxes ──────
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 11, marginLeft: 2 },
  secBar: { width: 3.5, height: 14, borderRadius: 2 },
  secLabel: { fontFamily: FONTS.bodyBold, fontSize: 13, letterSpacing: 0.2, color: '#5A4230' },
  card: {
    backgroundColor: '#FDFAF2', borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(67,38,15,0.11)',
    shadowColor: '#43260F', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 1,
  },
  // "this week" tools = an OPEN list on the page (no fill/shadow, just top+bottom
  // hairlines) so it reads flat — a deliberate contrast to the one raised,
  // tinted "read" card below, instead of two look-alike boxes stacked.
  toolList: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(67,38,15,0.13)' },

  // do this week — flat checklist on the page (no box)
  flatList: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(67,38,15,0.13)' },

  // good to know — quick-answer rows (flat) + the one visual below
  qaList: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(67,38,15,0.13)' },
  qaDiv: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(67,38,15,0.09)', marginLeft: 38 },
  qaHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 2 },
  qaMark: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#F7DFE6', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(158,47,76,0.22)', alignItems: 'center', justifyContent: 'center' },
  qaMarkT: { fontFamily: FONTS.headerBold, fontSize: 13, color: '#9E2F4C' },
  qaQ: { flex: 1, fontFamily: FONTS.bodySemiBold, fontSize: 14, lineHeight: 19, letterSpacing: -0.1, color: INK },
  qaChev: { fontFamily: FONTS.v2_body, fontSize: 19, color: '#C6B7A2', width: 13, textAlign: 'center' },
  qaChevOpen: { color: '#9E8B72', transform: [{ rotate: '90deg' }] },
  qaBody: { paddingLeft: 36, paddingRight: 4, paddingBottom: 13, marginTop: -1 },
  qaA: { fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21, color: '#5C462F' },
  qaBy: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: '#9A8672', marginTop: 8, fontStyle: 'italic' },

  // your tools — one compact row of Vili tool buttons (distinct from the lists)
  toolRow: { flexDirection: 'row', gap: 8 },
  toolBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 13, backgroundColor: '#FBEAEF', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(158,47,76,0.15)' },
  toolBtnGl: { color: '#9E2F4C', fontSize: 15 },
  toolBtnT: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: INK },
  brDiv: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(67,38,15,0.09)', marginLeft: 55 },
  brHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 15 },
  brGl: { width: 26, height: 26, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  slot: { width: 26, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  brBody: { flex: 1, minWidth: 0 },
  brTitle: { fontFamily: FONTS.bodySemiBold, fontSize: 14.5, lineHeight: 19, letterSpacing: -0.2, color: INK },
  brTitleSerif: { fontFamily: FONTS.v3_display, fontSize: 15.5, lineHeight: 19, letterSpacing: -0.3, color: INK },
  brMeta: { fontFamily: FONTS.bodyBold, fontSize: 11.5, color: '#B7A48C', marginRight: 1 },
  brChev: { fontFamily: FONTS.v2_body, fontSize: 20, lineHeight: 20, color: '#C6B7A2', marginTop: -1, width: 13, textAlign: 'center' },
  brChevOpen: { color: '#9E8B72', transform: [{ rotate: '90deg' }] },
  brContent: { paddingHorizontal: 15, paddingBottom: 16, marginTop: -2 },

  // "read this week" cover — one card that opens the full read
  readCover: {
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 15,
    shadowColor: '#43260F', shadowOpacity: 0.09, shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 2,
  },
  readEyebrow: { fontFamily: FONTS.bodyBold, fontSize: 10.5, letterSpacing: 1.6, marginBottom: 5 },
  readTitle: { fontFamily: FONTS.v3_display, fontSize: 22, lineHeight: 26, letterSpacing: -0.5, color: INK },
  readIntro: { fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 19, color: '#6B5540', marginTop: 7 },
  readFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  readCta: { fontFamily: FONTS.bodySemiBold, fontSize: 12.5, letterSpacing: 0.2 },
  readArrow: { fontFamily: FONTS.v2_body, fontSize: 19, marginTop: -2 },

  // the full-read overlay
  rdWrap: { flex: 1, backgroundColor: '#FBF4E6' },
  rdBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(67,38,15,0.10)',
  },
  rdBarTitle: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.6, color: '#8A7357', textTransform: 'uppercase' },
  rdClose: { fontFamily: FONTS.v2_body, fontSize: 18, color: '#9E8B72' },
  rdScroll: { paddingHorizontal: 24, paddingTop: 22 },
  rdDiv: { height: StyleSheet.hairlineWidth, marginVertical: 22 },
  rdEyebrow: { fontFamily: FONTS.bodyBold, fontSize: 10.5, letterSpacing: 1.6, marginBottom: 6 },
  rdLeadTitle: { fontFamily: FONTS.v3_display, fontSize: 27, lineHeight: 31, letterSpacing: -0.6, color: INK },
  rdTitle: { fontFamily: FONTS.v3_display, fontSize: 21, lineHeight: 25, letterSpacing: -0.4, color: INK },
  rdSay: { fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 19, fontStyle: 'italic', marginTop: 6 },
  rdBody: { fontFamily: FONTS.v2_body, fontSize: 15.5, lineHeight: 24, color: '#5C462F', marginTop: 9 },
  rdLink: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginTop: 14,
    backgroundColor: '#FDF9EF', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth,
  },
  rdLinkGl: { fontSize: 13 },
  rdLinkT: { fontFamily: FONTS.bodySemiBold, fontSize: 13, letterSpacing: 0.2 },
  rdFtc: { fontFamily: FONTS.v2_body, fontSize: 10.5, color: '#9A8672', marginTop: 9, letterSpacing: 0.2 },

  // teaching detail inside an open read-row
  stSay: { fontFamily: FONTS.v2_body, fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  stBody: { fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21, color: '#6B5540', marginTop: 6 },
  stLink: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginTop: 12, backgroundColor: '#FBF4E6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.14)' },
  stLinkGl: { fontSize: 12 },
  stLinkT: { fontFamily: FONTS.bodySemiBold, fontSize: 12.5, letterSpacing: 0.2 },
  stFtc: { fontFamily: FONTS.v2_body, fontSize: 10, color: '#9A8672', marginTop: 8, letterSpacing: 0.2 },

  // ask villie — a quiet composer row, not a dark hero box
  ask: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, paddingVertical: 13, borderRadius: 14, backgroundColor: '#FBEAEF', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(158,47,76,0.15)' },
  askAv: { width: 30, height: 30, borderRadius: 15, backgroundColor: ROSE },
  askText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 14, color: '#A6957F' },
  askGo: { fontFamily: FONTS.v2_body, fontSize: 18, color: ACCENT },

  // Editorial hairline that opens each section (except the first) so the stack
  // reads as distinct beats instead of one continuous wall.
  modRule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(122,74,40,0.16)', marginBottom: 16 },
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
  avEyebrow: { fontFamily: FONTS.bodyBold, fontSize: 10, letterSpacing: 1.6, color: '#D9789A' },
  avTitle: { fontFamily: FONTS.headerBold, fontSize: 17, color: '#FFFDF8', marginTop: 6, lineHeight: 22 },
  avRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  avInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11 },
  avInputText: { fontFamily: FONTS.body, fontSize: 12.5, color: '#E9D9C8' },
  avSend: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E14A32', alignItems: 'center', justifyContent: 'center' },
  avArrow: { color: '#fff', fontSize: 20, fontFamily: FONTS.bodySemiBold, marginTop: -2 },
  avSub: { fontFamily: FONTS.body, fontSize: 10, color: '#C9B79F', marginTop: 9 },

  // checklist
  panelTitle: { fontFamily: FONTS.headerBold, fontSize: 18, lineHeight: 23, letterSpacing: -0.3, color: INK, marginBottom: 12 },
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
    backgroundColor: '#FBEAEF', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(158,47,76,0.18)',
    paddingHorizontal: 18, paddingTop: 15, paddingBottom: 16, overflow: 'hidden',
  },
  tipAsk: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: ACCENT, fontWeight: '600', marginBottom: 6 },
  tipQ: { fontFamily: FONTS.headerBold, fontSize: 18, lineHeight: 23, letterSpacing: -0.3, color: INK },
  tipQuoteRow: { flexDirection: 'row', marginTop: 10 },
  quoteMark: { fontFamily: FONTS.headerBold, fontSize: 30, lineHeight: 28, color: ACCENT, width: 20, marginTop: -2 },
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
  infoEmb: { borderRadius: 14, borderWidth: 0, padding: 12 },
  wwAxis: { flex: 1, textAlign: 'center', fontFamily: FONTS.bodySemiBold, fontSize: 9, color: '#9A8264' },
  wwNow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(224,106,136,0.25)', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, marginTop: 10 },
  wwNowDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: ACCENT },
  wwNowText: { flex: 1, fontFamily: FONTS.body, fontSize: 12.5, color: INK },
  infoTitle: { fontFamily: FONTS.headerBold, fontSize: 18, lineHeight: 23, letterSpacing: -0.3, color: INK, marginBottom: 14 },
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
