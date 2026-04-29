// V4 Phase B — Weekly Journey API.
// Wraps the get_weekly_journey RPC + the user_week_checklist_completions
// upsert/delete writes. Migration 036 + the proposal at
// docs/PHASE_B_WEEKLY_JOURNEY_PROPOSAL.md describe the schema.
import { supabase } from '@/lib/supabase';

export type InsightCategory =
  | 'recovery' | 'emotional' | 'sleep' | 'feeding' | 'relationships' | 'identity';
export type SupportType =
  | 'peer' | 'expert' | 'community' | 'professional';
export type ChecklistCategory =
  | 'medical' | 'practical' | 'emotional' | 'household';

export interface MaternalInsight {
  id: string;
  category: InsightCategory;
  title: string;
  body: string;
  hero_emoji: string | null;
  /** When TRUE, render the pinned crisis-resources block under the body. */
  requires_crisis_footer: boolean;
  /** Whether the rendered title/body came from the i18n side-table (vs. EN parent fallback). */
  is_translated: boolean;
}

export interface VillageSupport {
  id: string;
  support_type: SupportType;
  title: string;
  body: string;
  hero_emoji: string | null;
  cta_label: string | null;
  /** Format: '<tab>:<route>:<param?>' — e.g. 'experts:home:lactation'. */
  cta_target: string | null;
  is_translated: boolean;
}

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  item_text: string;
  is_essential: boolean;
  sort_order: number;
  /** Per-user — whether the current viewer has ticked this off. */
  completed: boolean;
  is_translated: boolean;
}

export interface WeeklyJourneyPayload {
  week_number: number;
  locale: 'en' | 'es';
  maternal_insights: MaternalInsight[];
  village_supports: VillageSupport[];
  checklists: ChecklistItem[];
}

export const weeklyJourneyApi = {
  async getWeeklyJourney(
    weekNumber: number,
    locale: 'en' | 'es' = 'en',
  ): Promise<WeeklyJourneyPayload> {
    const { data, error } = await supabase.rpc('get_weekly_journey', {
      p_week: weekNumber,
      p_locale: locale,
    });
    if (error) throw error;
    // RPC always returns an object; default-fill the arrays so callers can
    // iterate without null checks even if a week has no seeded content yet.
    const payload = (data ?? {}) as Partial<WeeklyJourneyPayload>;
    return {
      week_number: payload.week_number ?? weekNumber,
      locale: (payload.locale as 'en' | 'es') ?? locale,
      maternal_insights: payload.maternal_insights ?? [],
      village_supports: payload.village_supports ?? [],
      checklists: payload.checklists ?? [],
    };
  },

  async markChecklistComplete(checklistItemId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('not_authenticated');
    // Idempotent: UNIQUE(user_id, checklist_item_id) means a re-tick by a
    // user who already completed silently no-ops via onConflict.
    const { error } = await supabase
      .from('user_week_checklist_completions')
      .upsert(
        { user_id: user.id, checklist_item_id: checklistItemId },
        { onConflict: 'user_id,checklist_item_id' },
      );
    if (error) throw error;
  },

  async unmarkChecklistComplete(checklistItemId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('not_authenticated');
    const { error } = await supabase
      .from('user_week_checklist_completions')
      .delete()
      .eq('user_id', user.id)
      .eq('checklist_item_id', checklistItemId);
    if (error) throw error;
  },
};

// ─── deeplink helpers ────────────────────────────────────────────────────
// village_supports.cta_target uses a compact string format so content can be
// edited in Supabase Studio without a code deploy. Format:
//   '<tab>:<route>:<param?>'
// Examples:
//   'experts:home:lactation'         → Experts tab → ExpertsHome filtered to lactation
//   'milk:DonorSearchList'           → Milk tab → DonorSearchList
//   'home:DailyCheckin'              → Home tab → DailyCheckin modal
//   'community:room:postpartum'      → Connect tab → RoomChat slug=postpartum
//
// Returns a structured tuple the screen layer can dispatch via
// navigation.getParent()… without hardcoding string parsing into every caller.
export interface ParsedCta {
  tab: string;
  route: string;
  param: string | null;
}

export function parseCtaTarget(target: string | null): ParsedCta | null {
  if (!target) return null;
  const parts = target.split(':');
  if (parts.length < 2) return null;
  const [tab, route, param] = parts;
  if (!tab || !route) return null;
  return { tab, route, param: param ?? null };
}

// ─── render helpers ──────────────────────────────────────────────────────
export function insightCategoryLabel(c: InsightCategory, locale: 'en' | 'es'): string {
  const en: Record<InsightCategory, string> = {
    recovery:      'Recovery',
    emotional:     'Emotional',
    sleep:         'Sleep',
    feeding:       'Feeding',
    relationships: 'Relationships',
    identity:      'Identity',
  };
  const es: Record<InsightCategory, string> = {
    recovery:      'Recuperación',
    emotional:     'Emocional',
    sleep:         'Sueño',
    feeding:       'Alimentación',
    relationships: 'Relaciones',
    identity:      'Identidad',
  };
  return (locale === 'es' ? es : en)[c];
}

export function supportTypeLabel(t: SupportType, locale: 'en' | 'es'): string {
  const en: Record<SupportType, string> = {
    peer:         'Peer support',
    expert:       'Expert',
    community:    'Community',
    professional: 'Professional',
  };
  const es: Record<SupportType, string> = {
    peer:         'Apoyo de pares',
    expert:       'Experta',
    community:    'Comunidad',
    professional: 'Profesional',
  };
  return (locale === 'es' ? es : en)[t];
}

export function checklistCategoryLabel(c: ChecklistCategory, locale: 'en' | 'es'): string {
  const en: Record<ChecklistCategory, string> = {
    medical:   'Medical',
    practical: 'Practical',
    emotional: 'Emotional',
    household: 'Household',
  };
  const es: Record<ChecklistCategory, string> = {
    medical:   'Médico',
    practical: 'Práctico',
    emotional: 'Emocional',
    household: 'Hogar',
  };
  return (locale === 'es' ? es : en)[c];
}
