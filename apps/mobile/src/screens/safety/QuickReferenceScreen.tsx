// Quick Reference — the "in an emergency" hub. Evergreen, always 1–2 taps away
// (Home tile, Manual masthead shield, Me row). NOT week-bound.
//
// Registered as a root-level modal (like AIHelpChat) so any surface can open it.
//
// SAFETY POSTURE: this is triage/orientation content — "when to call", signs to
// watch, and a childproofing checklist — NOT step-by-step medical instructions.
// The CPR/choking piece is a video slot (Felipe drops in a licensed clip); until
// then it points to calling 911, who talk you through it. Everything is framed
// "educational, not a substitute for 911 or hands-on training."
//
// ⚠️ Pre-launch: needs clinical + legal review (Risk & Compliance) and a real
// licensed CPR video. Copy is EN-only for now — bilingual (clinician-grade ES)
// is a follow-up per the discharge-handoff memory.
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useUserStore } from '@store/user';

type Lang = 'en' | 'es';

const C = {
  cream: COLORS.v2_cream, paper: COLORS.v2_paper, cocoa: COLORS.v2_cocoa, walnut: COLORS.v2_walnut,
  rose: COLORS.v2_cinnamon, roseDeep: '#C2556F', red: '#BE3A2E',
};

const ICON = {
  phone: 'M4 5c0 9 6 15 15 15a2 2 0 002-2v-3l-4-2-2 2a12 12 0 01-6-6l2-2-2-4H6a2 2 0 00-2 2z',
  flask: 'M9 3h6M10 3v5l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3M7.5 15h9',
  play: 'M8 5l11 7-11 7z',
  temp: 'M10 13V5a2 2 0 114 0v8a4 4 0 11-4 0z',
  droplet: 'M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z',
  lungs: 'M12 4v9M8 8c-3 1-4 4-4 8a2 2 0 004 0zM16 8c3 1 4 4 4 8a2 2 0 01-4 0z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  chevron: 'M9 6l6 6-6 6',
} as const;

function Glyph({ d, color, size = 18, sw = 1.9 }: { d: string; color: string; size?: number; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type Topic = { key: string; icon: string; title: string; tint: string; chip: string; ink: string; lines: { b: string; t: string }[] };

const TOPICS_EN: Topic[] = [
  {
    key: 'fever', icon: ICON.temp, title: 'Fevers — when to call', tint: '#FBF1D6', chip: '#F4D98C', ink: '#7A560F',
    lines: [
      { b: 'Under 3 months', t: 'rectal 100.4°F (38°C) or higher = call now, any hour. No fever meds first.' },
      { b: '3–6 months', t: '102°F+, or fever with poor feeding / very fussy → call.' },
      { b: 'Any age — go / call urgently', t: 'fever past 3 days, hard to wake, stiff neck, or a rash that doesn’t fade when pressed.' },
    ],
  },
  {
    key: 'dehydration', icon: ICON.droplet, title: 'Dehydration — signs', tint: '#FBE7EC', chip: '#F4B7C6', ink: '#9A3B50',
    lines: [
      { b: 'Fewer wet diapers', t: 'noticeably fewer than usual, or dark urine.' },
      { b: 'Dry + no tears', t: 'dry mouth/lips, crying without tears, sunken soft spot.' },
      { b: 'Acting off', t: 'unusually sleepy or floppy → call your pediatrician; severe → ER.' },
    ],
  },
  {
    key: 'breathing', icon: ICON.lungs, title: 'Breathing — call vs. 911', tint: '#EEF0DE', chip: '#CBD49B', ink: '#3F4516',
    lines: [
      { b: 'Call now', t: 'fast breathing, grunting, nostrils flaring, or ribs pulling in (retractions).' },
      { b: 'Call 911', t: 'blue or gray lips/face, gasping, or pauses in breathing.' },
    ],
  },
  {
    key: 'childproofing', icon: ICON.shield, title: 'Childproofing', tint: '#FBEADE', chip: '#F3C2A6', ink: '#9A4E28',
    lines: [
      { b: 'Anchor it', t: 'strap furniture + TVs to the wall; keep dresser drawers latched.' },
      { b: 'Out of reach', t: 'outlet covers, blind/appliance cords up, cleaners + meds in latched high cabinets.' },
      { b: 'Gates + bare crib', t: 'gates at stairs; crib empty — nothing that can fall in.' },
      { b: 'Water', t: 'never leave baby alone near a tub, bucket, or pool — even for a second.' },
    ],
  },
];

// Spanish — clinician-grade. Icons/tints/keys carry over from the EN topics by key.
const TOPICS_ES: Topic[] = [
  {
    key: 'fever', icon: ICON.temp, title: 'Fiebre — cuándo llamar', tint: '#FBF1D6', chip: '#F4D98C', ink: '#7A560F',
    lines: [
      { b: 'Menor de 3 meses', t: '100.4°F (38°C) rectal o más = llama ya, a cualquier hora. No des antifebriles primero.' },
      { b: '3–6 meses', t: '102°F o más, o fiebre con mala alimentación / muy irritable → llama.' },
      { b: 'Cualquier edad — acude / llama de urgencia', t: 'fiebre por más de 3 días, difícil de despertar, cuello rígido, o un sarpullido que no se aclara al presionarlo.' },
    ],
  },
  {
    key: 'dehydration', icon: ICON.droplet, title: 'Deshidratación — señales', tint: '#FBE7EC', chip: '#F4B7C6', ink: '#9A3B50',
    lines: [
      { b: 'Menos pañales mojados', t: 'bastantes menos de lo habitual, u orina oscura.' },
      { b: 'Seca y sin lágrimas', t: 'boca o labios secos, llanto sin lágrimas, mollera hundida.' },
      { b: 'Decaída', t: 'inusualmente somnolienta o floja → llama a tu pediatra; si es grave → sala de urgencias.' },
    ],
  },
  {
    key: 'breathing', icon: ICON.lungs, title: 'Respiración — llamar vs. 911', tint: '#EEF0DE', chip: '#CBD49B', ink: '#3F4516',
    lines: [
      { b: 'Llama ya', t: 'respiración rápida, quejidos, aleteo de la nariz, o costillas que se hunden (retracciones).' },
      { b: 'Llama al 911', t: 'labios o cara azulados o grises, jadeo, o pausas al respirar.' },
    ],
  },
  {
    key: 'childproofing', icon: ICON.shield, title: 'A prueba de niños', tint: '#FBEADE', chip: '#F3C2A6', ink: '#9A4E28',
    lines: [
      { b: 'Ánclalo', t: 'sujeta muebles y televisores a la pared; mantén los cajones con seguro.' },
      { b: 'Fuera de alcance', t: 'protectores de enchufes, cables de persianas y electrodomésticos en alto, limpiadores y medicinas en gabinetes altos con seguro.' },
      { b: 'Rejas y cuna despejada', t: 'rejas en las escaleras; cuna vacía — nada que pueda caer dentro.' },
      { b: 'Agua', t: 'nunca dejes al bebé solo cerca de una tina, cubeta o piscina — ni un segundo.' },
    ],
  },
];

// Fixed chrome copy, bilingual.
const CT = {
  back:        { en: '‹ back', es: '‹ atrás' },
  eyebrow:     { en: 'QUICK REFERENCE', es: 'REFERENCIA RÁPIDA' },
  titlePre:    { en: 'In an ', es: 'En una ' },
  titleEm:     { en: 'emergency', es: 'emergencia' },
  call911:     { en: 'Call 911', es: 'Llama al 911' },
  call911Sub:  { en: "tap to call — then we'll guide you", es: 'toca para llamar — luego te guiamos' },
  poisonName:  { en: 'Poison Control', es: 'Control de Envenenamiento' },
  section:     { en: 'KNOW IN 60 SECONDS', es: 'LO ESENCIAL EN 60 SEGUNDOS' },
  cprTitle:    { en: 'Infant CPR & choking', es: 'RCP infantil y atragantamiento' },
  cprSub:      { en: "video coming soon — in an emergency, call 911 and they'll walk you through it", es: 'video próximamente — en una emergencia, llama al 911 y te guían paso a paso' },
  cprAlertBody: { en: 'A demonstration video is coming soon. In a choking or unresponsive emergency, call 911 now — they will talk you through CPR step by step.', es: 'Pronto habrá un video de demostración. Si el bebé se atraganta o no responde, llama al 911 ahora — te guiarán paso a paso para hacer RCP.' },
  close:       { en: 'Close', es: 'Cerrar' },
  disclaimer:  { en: 'Educational only — not a substitute for 911 or hands-on CPR training. In a real emergency, call 911 first.', es: 'Solo con fines educativos — no sustituye al 911 ni a una capacitación práctica en RCP. En una emergencia real, llama al 911 primero.' },
} as const;

export default function QuickReferenceScreen() {
  const navigation = useNavigation<any>();
  const lang = (useUserStore((st) => st.profile?.preferred_language) ?? 'en') as Lang;
  const topics = lang === 'es' ? TOPICS_ES : TOPICS_EN;
  const [open, setOpen] = useState<string | null>('fever');

  const call = (num: string) => Linking.openURL(`tel:${num}`).catch(() => {});
  const cprTap = () => Alert.alert(
    CT.cprTitle[lang],
    CT.cprAlertBody[lang],
    [{ text: CT.call911[lang], onPress: () => call('911') }, { text: CT.close[lang], style: 'cancel' }],
  );

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.headRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={CT.close[lang]}>
            <Text style={s.close}>{CT.back[lang]}</Text>
          </TouchableOpacity>
          <Glyph d={ICON.shield} color={C.red} size={16} />
        </View>

        <View style={s.eyebrowRow}><View style={s.eyebrowBar} /><Text style={s.eyebrow}>{CT.eyebrow[lang]}</Text></View>
        <Text style={s.title}>{CT.titlePre[lang]}<Text style={s.titleEm}>{CT.titleEm[lang]}</Text></Text>

        {/* Call 911 — loudest thing on the page */}
        <TouchableOpacity style={s.call911} activeOpacity={0.9} onPress={() => call('911')} accessibilityRole="button" accessibilityLabel={CT.call911[lang]}>
          <View style={s.call911Icon}><Glyph d={ICON.phone} color="#fff" size={21} /></View>
          <View style={{ flex: 1 }}><Text style={s.call911Title}>{CT.call911[lang]}</Text><Text style={s.call911Sub}>{CT.call911Sub[lang]}</Text></View>
          <Glyph d={ICON.chevron} color="#FBE0DC" size={18} />
        </TouchableOpacity>

        <TouchableOpacity style={s.poison} activeOpacity={0.85} onPress={() => call('18002221222')} accessibilityRole="button" accessibilityLabel={CT.poisonName[lang]}>
          <Glyph d={ICON.flask} color={C.walnut} size={16} />
          <Text style={s.poisonText}><Text style={{ fontFamily: FONTS.v2_bold }}>{CT.poisonName[lang]}</Text> · 1-800-222-1222</Text>
          <Glyph d={ICON.phone} color={C.roseDeep} size={15} />
        </TouchableOpacity>

        <Text style={s.sectionLabel}>{CT.section[lang]}</Text>

        {/* Infant CPR & choking — video slot (placeholder) */}
        <TouchableOpacity style={s.cprCard} activeOpacity={0.92} onPress={cprTap} accessibilityRole="button" accessibilityLabel={CT.cprTitle[lang]}>
          <View style={s.cprMedia}><View style={s.cprPlay}><Glyph d={ICON.play} color={C.roseDeep} size={20} /></View></View>
          <View style={s.cprBody}>
            <Text style={s.cprTitle}>{CT.cprTitle[lang]}</Text>
            <Text style={s.cprSub}>{CT.cprSub[lang]}</Text>
          </View>
        </TouchableOpacity>

        {/* Expandable cheat sheets */}
        {topics.map((topic) => {
          const isOpen = open === topic.key;
          return (
            <View key={topic.key} style={[s.card, { backgroundColor: topic.tint }]}>
              <TouchableOpacity
                style={s.cardHead}
                activeOpacity={0.85}
                onPress={() => setOpen(isOpen ? null : topic.key)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={topic.title}
              >
                <View style={[s.cardIcon, { backgroundColor: topic.chip }]}><Glyph d={topic.icon} color={topic.ink} size={18} /></View>
                <Text style={s.cardTitle}>{topic.title}</Text>
                <View style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}><Glyph d={ICON.chevron} color={topic.ink} size={16} /></View>
              </TouchableOpacity>
              {isOpen && (
                <View style={s.cardBody}>
                  {topic.lines.map((ln, i) => (
                    <View key={i} style={s.line}>
                      <View style={[s.dot, { backgroundColor: topic.ink }]} />
                      <Text style={s.lineText}><Text style={{ fontFamily: FONTS.v2_bold, color: topic.ink }}>{ln.b}</Text> — {ln.t}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <Text style={s.disclaimer}>{CT.disclaimer[lang]}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  scroll: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 40 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  close: { fontSize: 15, color: C.walnut, fontFamily: FONTS.v2_body, fontWeight: '500' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowBar: { width: 16, height: 1.5, backgroundColor: C.red },
  eyebrow: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 2.4, color: C.red, fontWeight: '700' },
  title: { fontFamily: FONTS.v3_display, fontSize: 30, letterSpacing: -1, color: C.cocoa, marginTop: 5 },
  titleEm: { fontFamily: FONTS.v3_display_italic, color: C.red },

  call911: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.red, borderRadius: 16, padding: 15, marginTop: 16 },
  call911Icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  call911Title: { fontFamily: FONTS.v3_display, fontSize: 20, color: '#fff' },
  call911Sub: { fontFamily: FONTS.v2_body, fontSize: 11, color: '#FBE0DC', marginTop: 1 },

  poison: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.paper, borderWidth: 1, borderColor: 'rgba(122,74,40,0.18)', borderRadius: 13, padding: 12, marginTop: 9 },
  poisonText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 12.5, color: C.cocoa },

  sectionLabel: { fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.8, color: C.walnut, marginTop: 20, marginBottom: 10 },

  cprCard: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(217,108,136,0.25)', marginBottom: 11 },
  cprMedia: { height: 92, backgroundColor: '#D96C88', alignItems: 'center', justifyContent: 'center' },
  cprPlay: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  cprBody: { padding: 12, backgroundColor: C.paper },
  cprTitle: { fontFamily: FONTS.v3_display, fontSize: 15, color: C.cocoa },
  cprSub: { fontFamily: FONTS.v2_body, fontSize: 10.5, color: C.walnut, marginTop: 2 },

  card: { borderRadius: 14, marginBottom: 9, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(61,31,14,0.08)' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  cardIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontFamily: FONTS.v3_display, fontSize: 15, color: C.cocoa },
  cardBody: { paddingHorizontal: 14, paddingBottom: 13, gap: 9 },
  line: { flexDirection: 'row', gap: 9 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  lineText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 18, color: C.cocoa },

  disclaimer: { fontFamily: FONTS.v2_body, fontSize: 10, lineHeight: 15, color: C.walnut, textAlign: 'center', marginTop: 16, paddingHorizontal: 8 },
});
