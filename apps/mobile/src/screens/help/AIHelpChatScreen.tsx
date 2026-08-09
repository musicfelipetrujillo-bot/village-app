// Global in-app AI help chat — "Villie" — app guide + light context.
// Invoked as a modal Stack.Screen from RootNavigator. NOT tied to Connect tab.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image,
  Keyboard, Platform, ActivityIndicator,
  FlatList, Linking,
} from 'react-native';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');
import { StackActions, useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { getUpcomingBusy } from '@utils/calendar';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';
import { appHelpApi, type HelpMessage, type HelpUserContext, type CrisisResource } from '@api/appHelp';
import { navigationRef } from '@/navigation/navigationRef';

// Guided example prompts for the empty state — teach moms the bot's range across
// every capability (milk vault, development, specialists, tracking, gear). Tapping
// one sends it. NOTE: the general-help bot answers the "knowledge" ones live today;
// the data-backed ones (vault ounces, live gear search) become real once the
// tool-wiring (AI-native Phase 1) lands — until then they guide to the feature.
const SUGGESTIONS: { en: string; es: string }[] = [
  { en: 'How much milk do I have in my vault?', es: '¿Cuánta leche tengo en mi reserva?' },
  { en: 'Why is my baby suddenly waking every hour?', es: '¿Por qué mi bebé se despierta cada hora de repente?' },
  { en: 'Help me find a lactation consultant nearby', es: 'Ayúdame a encontrar una consultora de lactancia cerca' },
  { en: 'Is my baby ready to drop to two naps?', es: '¿Mi bebé ya puede pasar a dos siestas?' },
  { en: 'Find a used stroller near me', es: 'Busca una carriola usada cerca de mí' },
];
import { COLORS, FONTS } from '@utils/constants';
import { cardLift, cardLiftBorder } from '@utils/cardLift';
import { useT } from '@/i18n';

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  crisisResources?: Record<string, CrisisResource>;
  quickReplies?: string[];
  cta?: { label: string; screen: string };
  /** Params the pill passes through to runNavigate (e.g. box_checkout {box}). */
  ctaParams?: Record<string, unknown>;
}

// The model is told plain-text-only, but strip any markdown emphasis that slips
// through so the mom never sees literal ** or * asterisks in a bubble.
const stripMd = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,!?])/g, '$1$2');

// Billy-facing nav key → concrete React Navigation target. The chat is a Root-stack
// modal; the bottom tabs live under the Root screen named 'App' (see RootNavigator),
// so a cross-tab jump is a NESTED navigate: navigation.navigate('App', { screen: tab,
// params: { screen, params } }). Verified against the live navigators (2026-07-29):
// Booking→Experts, CreateListing/MyListings→Gear, BoxesHub/BabyProfileSetup→Home,
// BecomeDonorIntro/TrustBadgeBuilder→Milk, MeRoot→Profile (Me tab is registered 'Profile').
const NAV_ROUTES: Record<string, { tab?: string; screen: string; params?: Record<string, unknown> }> = {
  // Booking needs a chosen specialist, so "book me…" lands on the Care
  // directory (pick a provider → Book) rather than a param-less Booking screen.
  booking:            { tab: 'Experts', screen: 'ExpertsHome' },
  appointment_book:   { tab: 'Experts', screen: 'ExpertsHome' },
  gear_create:        { tab: 'Gear',    screen: 'CreateListing' },
  gear_boost:         { tab: 'Gear',    screen: 'MyListings' },
  box_checkout:       { tab: 'Home',    screen: 'BoxesHub' },
  become_donor:       { tab: 'Milk',    screen: 'BecomeDonorIntro' },
  donor_profile_edit: { tab: 'Milk',    screen: 'TrustBadgeBuilder' },
  account_settings:   { tab: 'Profile', screen: 'MeRoot' },
  baby_profile_setup: { tab: 'Home',    screen: 'BabyProfileSetup' },
  // The Playbook tracker lives on Insights since the Manual/Playbook toggle
  // was retired (2026-07-15) — the tracker is embedded at the top there.
  playbook:           { tab: 'Home',    screen: 'Insights' },
  // Wave 2 route batch.
  // ReviewSubmit + Messaging both require a specialistId param Billy can't
  // supply (find_specialists returns no ids) — ReviewSubmit even renders
  // spec.full_name unguarded — so, like booking above, both land on the Care
  // directory (pick a provider → review / message).
  write_review:       { tab: 'Experts', screen: 'ExpertsHome' },
  message_specialist: { tab: 'Experts', screen: 'ExpertsHome' },
  // Milk's CreateListing requires donorProfileId; DonorListingManager resolves
  // the donor profile from the store and its "+" passes the id along.
  create_milk_listing: { tab: 'Milk',   screen: 'DonorListingManager' },
  milk_messages:      { tab: 'Milk',    screen: 'MilkMessageThreads' },
  vault_create_listing: { tab: 'Milk',  screen: 'MilkVaultKeepSell' },
  // Private freezer-stash dashboard (paramless) — landing route of the Milk tab.
  milk_vault:         { tab: 'Milk',    screen: 'MilkVaultDashboard' },
  gear_status:        { tab: 'Gear',    screen: 'MyListings' },
  gear_messages:      { tab: 'Gear',    screen: 'GearMessageThreads' },
  // Reporting lives in a modal on GearListingDetail, which needs a listing id —
  // the browse list is the safe paramless entry.
  report_gear:        { tab: 'Gear',    screen: 'GearBrowse' },
  // Day Sheet caregiver handoff. The list is the safe paramless entry — a
  // Billy-drafted sheet sorts to the top (updated_at desc); DaySheetBuilder
  // without an id would start a fresh draft instead of opening Billy's.
  day_sheet:          { tab: 'Home',    screen: 'DaySheetList' },
};

// Root-stack screen that hosts the bottom-tab navigator.
const TABS_ROUTE = 'App';

function runNavigate(navigation: any, action: { screen: string; params?: Record<string, unknown> }) {
  let target = NAV_ROUTES[action.screen];
  if (!target) return;
  const params: Record<string, unknown> = { ...(target.params ?? {}), ...(action.params ?? {}) };
  // Box-specific checkout: when Billy names a box (params.box), land on its
  // detail page instead of the hub ("buy the newborn box" → The Newborn Box).
  const boxKey = String(params.box ?? params.boxId ?? '').toLowerCase();
  if (action.screen === 'box_checkout' && ['delivery', 'newborn', 'mama'].includes(boxKey)) {
    target = { tab: 'Home', screen: 'BoxDetail' };
    params.boxId = boxKey;
    delete params.box;
  }
  // Dispatch at the CONTAINER level (navigationRef), not through this modal's
  // own navigation prop: a dispatch tied to a dismissing screen can be dropped.
  // React Navigation v7: navigate() PUSHES a new instance instead of going back
  // (that shipped once as "three stacked sheets"), so first popTo the ORIGINAL
  // 'App' screen (dismisses this chat modal), then navigate — now that 'App' is
  // focused, navigate updates it in place and the nested tab jump resolves.
  const nav: any = navigationRef.isReady() ? navigationRef : navigation;
  if (target.tab) {
    const { tab, screen } = target as { tab: string; screen: string };
    nav.dispatch(StackActions.popTo(TABS_ROUTE));
    // TWO-STEP jump: focus the tab first (mounts its stack at the initial
    // route), THEN push the destination. A hidden lazy tab that first mounts
    // directly onto a deep screen renders a blank scene (native-stack glitch —
    // shipped once as the "sell frozen milk → grey screen" bug). The two-step
    // also leaves the tab root under the destination so Back behaves.
    nav.navigate(TABS_ROUTE, { screen: tab });
    // Step 2 was originally a bare setTimeout(150) — the SAME duration as the
    // tab crossfade, so it landed mid-transition and got dropped ("list my
    // bouncer" reached Gear browse but never opened the New listing form).
    //
    // The first fix routed it through InteractionManager.runAfterInteractions,
    // which was WORSE: a dismissing modal holds an interaction handle, so the
    // callback can be starved indefinitely and step 2 never runs at all. That
    // regressed every destination to "pill dismisses the chat and nothing else
    // happens" (2026-08-02, all 9 routes). Never gate navigation on interaction
    // handles you don't own.
    //
    // Plain timers can't be starved. Fire once the transition is comfortably
    // done, then VERIFY we actually arrived and re-fire if not — landing on the
    // tab root instead of the destination is exactly the failure we're chasing,
    // and getCurrentRoute() tells us which happened.
    const pushDeep = () => nav.navigate(TABS_ROUTE, { screen: tab, params: { screen, params } });
    const arrived = () => navigationRef.isReady() && navigationRef.getCurrentRoute()?.name === screen;
    setTimeout(pushDeep, 260);
    setTimeout(() => { if (!arrived()) pushDeep(); }, 560);
    setTimeout(() => { if (!arrived()) pushDeep(); }, 900);
  } else {
    nav.navigate(target.screen, params);
  }
}

export default function AIHelpChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const user = useAuthStore((s) => s.user);
  const lang = (useUserStore((s) => s.profile?.preferred_language) ?? 'en') as 'en' | 'es';
  const t = useT();
  // `seed` (optional route param) prefills the composer — e.g. from the Manual's
  // "Ask Villie" card, framed with the current week + chapter so the question
  // lands with context.
  const seed: string = route.params?.seed ?? '';
  // autosend: a COMPLETE prompt (Home do-tile / suggestion) → fire it immediately
  // so the chat focuses on the request. Without it (Manual's partial prompt) the
  // seed just prefills the composer for her to finish.
  const autosend: boolean = !!route.params?.autosend;

  const [messages, setMessages] = useState<UIMessage[]>(() => [
    { id: 'greeting', role: 'assistant', content: t('help.greeting') },
  ]);
  const [draft, setDraft] = useState<string>(autosend ? '' : seed);
  const [sending, setSending] = useState(false);
  const [ctx, setCtx] = useState<HelpUserContext>({});
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [avail, setAvail] = useState<{ start: string; end: string }[] | null>(null);
  const listRef = useRef<FlatList<UIMessage>>(null);

  useEffect(() => {
    if (!user?.id) return;
    appHelpApi.fetchUserContext(user.id).then(setCtx).catch(() => {});
  }, [user?.id]);

  // Best-effort device location so the assistant's find_* tools can search nearby.
  // Permission-check only (no aggressive prompt) — if it isn't granted yet, the
  // tools return need_location and Villie asks for her ZIP instead.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({}));
        if (pos && !cancelled) setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Best-effort free/busy (times only, no titles) so Villie can answer
  // "find me something that fits my schedule". Only if calendar is already
  // connected — never prompts here.
  useEffect(() => {
    let cancelled = false;
    getUpcomingBusy().then((b) => { if (!cancelled) setAvail(b.length ? b : null); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  // Manual keyboard tracking — KeyboardAvoidingView is unreliable inside an
  // iOS native-stack MODAL (pageSheet coordinate space), which left the
  // composer buried under the keyboard while typing. Pad the container by the
  // real keyboard height instead. Android keeps the OS adjustResize behavior.
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      setKbHeight(e.endCoordinates?.height ?? 0);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const send = useCallback(async (text: string) => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);

    const userMsg: UIMessage = { id: `u-${Date.now()}`, role: 'user', content: body };
    const next = [...messages, userMsg];
    setMessages(next);
    setDraft('');

    try {
      const history: HelpMessage[] = next
        .filter((m) => m.id !== 'greeting')
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await appHelpApi.sendMessage(history, ctx, loc, avail);
      // Navigation is ALWAYS her tap, never automatic (founder call 2026-07-30:
      // auto-jumping mid-read felt like the app grabbing the wheel). A navigate
      // action without a cta gets a synthesized pill so there's always a button.
      const navAction = res.crisis ? undefined : res.navigate;
      const cta = res.crisis
        ? undefined
        : res.cta ?? (navAction
          ? { label: lang === 'es' ? 'Llévame ahí' : 'Take me there', screen: navAction.screen }
          : undefined);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: stripMd(res.reply),
          crisisResources: res.crisis ? res.crisis_resources : undefined,
          // Suppress the tap-pills in a crisis turn — the crisis card must be the
          // only thing she reaches for there.
          quickReplies: res.crisis ? undefined : res.quick_replies,
          cta,
          // Carry navigate params through the pill (e.g. box_checkout {box:'newborn'}).
          ctaParams: navAction && cta && navAction.screen === cta.screen ? navAction.params : undefined,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('help.errorGeneric');
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: t('help.errorPrefix', { msg }) },
      ]);
    } finally {
      setSending(false);
    }
  }, [messages, ctx, loc, avail, sending, t]);

  const handleSend = useCallback(() => send(draft), [send, draft]);

  // Fire a complete seeded request once, so tapping a Home do-action lands
  // straight in the answer instead of re-showing the suggestion list.
  const sentSeed = useRef(false);
  useEffect(() => {
    if (seed && autosend && !sentSeed.current) {
      sentSeed.current = true;
      send(seed);
    }
  }, [seed, autosend, send]);

  const callResource = (r: CrisisResource) => {
    if (r.phone) Linking.openURL(`tel:${r.phone}`);
    else if (r.sms) Linking.openURL(`sms:${r.sms}${r.sms_body ? `&body=${encodeURIComponent(r.sms_body)}` : ''}`);
  };

  const renderItem = ({ item, index }: { item: UIMessage; index: number }) => {
    const mine = item.role === 'user';
    // Quick-reply pills only on the LATEST message — once she taps one, it becomes
    // her sent message and a fresh assistant turn takes over, so stale pills clear.
    const showQuickReplies =
      !mine && !sending && index === messages.length - 1 &&
      Array.isArray(item.quickReplies) && item.quickReplies.length > 0;
    return (
      <View>
        <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
            <Text style={[styles.bubbleText, mine && { color: '#FFFCF6' }]}>{item.content}</Text>
          </View>
        </View>
        {showQuickReplies && (
          <View style={styles.qrWrap}>
            {item.quickReplies!.map((qr, i) => (
              <TouchableOpacity
                key={i}
                style={styles.qrPill}
                activeOpacity={0.8}
                onPress={() => send(qr)}
                accessibilityRole="button"
                accessibilityLabel={qr}
              >
                <Text style={styles.qrText}>{qr}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {!mine && item.cta && NAV_ROUTES[item.cta.screen] && (
          <View style={styles.qrWrap}>
            <TouchableOpacity
              style={styles.ctaPill}
              activeOpacity={0.85}
              onPress={() => runNavigate(navigation, { screen: item.cta!.screen, params: item.ctaParams })}
              accessibilityRole="button"
              accessibilityLabel={item.cta.label}
            >
              <Text style={styles.ctaText}>{item.cta.label} ›</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.crisisResources && (
          <View style={styles.crisisCard}>
            <Text style={styles.crisisTitle}>{t('help.crisisTitle')}</Text>
            {Object.entries(item.crisisResources).map(([key, r]) => (
              <TouchableOpacity key={key} style={styles.crisisRow} onPress={() => callResource(r)}>
                <Text style={styles.crisisName}>{r.name}</Text>
                <Text style={styles.crisisDesc}>{r.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, kbHeight > 0 && { paddingBottom: kbHeight }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerSide} accessibilityRole="button" accessibilityLabel={t('help.closeA11y')}>
          <Text style={styles.headerClose}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <View style={styles.headerTitleRow}>
            <Image source={VILLIE_BEE} style={styles.headerBee} resizeMode="contain" />
            <Text style={styles.titleHeader}>villie</Text>
          </View>
          <Text style={styles.subtitle}>{lang === 'es' ? 'tu guía 24/7' : 'your 24/7 guide'}</Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListFooterComponent={
          messages.filter((m) => m.role === 'user').length === 0 && !sending ? (
            <View style={styles.suggestWrap}>
              <Text style={styles.suggestTitle}>
                {lang === 'es' ? 'prueba preguntar' : 'try asking'}
              </Text>
              {SUGGESTIONS.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestChip}
                  activeOpacity={0.8}
                  onPress={() => send(lang === 'es' ? s.es : s.en)}
                  accessibilityRole="button"
                  accessibilityLabel={lang === 'es' ? s.es : s.en}
                >
                  <Text style={styles.suggestArrow}>›</Text>
                  <Text style={styles.suggestText}>{lang === 'es' ? s.es : s.en}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        }
      />

      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator color="#E02F5F" size="small" />
          <Text style={styles.typingText}>{t('help.typing')}</Text>
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder={t('help.composerPlaceholder')}
          placeholderTextColor="#B5A095"
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={800}
          accessibilityLabel={t('help.composerA11y')}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel={t('help.sendA11y')}
        >
          <Text style={styles.sendBtnText}>{sending ? '…' : '↑'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 14, paddingHorizontal: 12,
    backgroundColor: '#FFFDFA',
    borderBottomWidth: 1, borderBottomColor: 'rgba(122,74,40,0.08)',
  },
  headerSide: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerClose: { fontSize: 32, color: '#8A1F3E', marginTop: -6, fontFamily: FONTS.body },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerBee: { width: 20, height: 20 },
  titleHeader: { fontSize: 19, fontFamily: FONTS.bodySemiBold, color: '#3D2116', letterSpacing: 0.2 },
  subtitle: { fontSize: 11, color: '#B0855E', marginTop: 3, letterSpacing: 0.4, fontFamily: FONTS.body },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, gap: 6 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMine: { backgroundColor: '#E02F5F', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#FFFDFA', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(122,74,40,0.08)' },
  bubbleText: { fontSize: 15, color: '#3D2116', lineHeight: 21, fontFamily: FONTS.body },

  // Tap-to-send quick replies — Flo-style. Sit under Villie's latest message,
  // aligned to her (left) side, wrapping. White w/ rose outline so they read as
  // actionable, distinct from her bubble.
  qrWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginLeft: 2, marginBottom: 2 },
  qrPill: {
    backgroundColor: '#FFFDFA', borderRadius: 18, paddingHorizontal: 15, paddingVertical: 9,
    borderWidth: 1.5, borderColor: 'rgba(224,106,136,0.45)',
    shadowColor: '#B4785A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1,
  },
  qrText: { fontSize: 14, color: '#8A1F3E', fontFamily: FONTS.bodySemiBold, letterSpacing: 0.1 },

  // Deep-link CTA pill — filled (vs the outlined send-a-reply pills) so it
  // reads as "this takes you somewhere", not "this answers the question".
  ctaPill: {
    backgroundColor: '#8A1F3E', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#B4785A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 6, elevation: 2,
  },
  ctaText: { fontSize: 14, color: '#FFFCF6', fontFamily: FONTS.bodySemiBold, letterSpacing: 0.1 },

  // Crisis card — was flat blush bg, low contrast in the chat scroll.
  // Lift recipe + paper bg so it reads as a deliberate intervention.
  crisisCard: {
    marginTop: 6, marginHorizontal: 8, padding: 12, borderRadius: 12,
    backgroundColor: COLORS.v2_card,
    ...cardLiftBorder,
    ...cardLift,
  },
  crisisTitle: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: '#7A4A24', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  crisisRow: { paddingVertical: 6 },
  crisisName: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  crisisDesc: { fontSize: 13, color: COLORS.barkSoft, marginTop: 2, fontFamily: FONTS.body },

  // Guided example prompts (empty state)
  suggestWrap: { marginTop: 16, paddingHorizontal: 4, gap: 9 },
  suggestTitle: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: '#B0855E', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4, marginLeft: 4 },
  suggestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: '#FFFDFA', borderRadius: 15, paddingHorizontal: 15, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(224,106,136,0.16)',
    shadowColor: '#B4785A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 1,
  },
  suggestArrow: { fontSize: 17, color: '#E02F5F', fontFamily: FONTS.bodySemiBold, marginTop: -1 },
  suggestText: { flex: 1, fontSize: 14, color: '#5A4030', fontFamily: FONTS.bodyMedium, lineHeight: 19 },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 6 },
  typingText: { fontSize: 12, color: COLORS.textLight, fontStyle: 'italic', fontFamily: FONTS.body },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 28,
    backgroundColor: COLORS.paper,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  input: {
    flex: 1, maxHeight: 120,
    backgroundColor: COLORS.cream, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: COLORS.bark,
    fontFamily: FONTS.body,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E02F5F', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#FFFCF6', fontSize: 22, fontFamily: FONTS.bodySemiBold },
});
