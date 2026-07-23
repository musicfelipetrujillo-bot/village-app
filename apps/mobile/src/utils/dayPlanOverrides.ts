// dayPlanOverrides.ts — per-block edits the mom makes to villie's SUGGESTED
// slots (nap/feed/pump). Persisted per-day + per-slot-id in AsyncStorage so they
// survive a rebuild (buildDayPlan regenerates slots with deterministic ids like
// nap-0/pump-1). Calendar slots are never editable. Keyed by local date so a new
// day starts clean.
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SlotOverride = { shiftMin?: number; dismissed?: boolean };
export type DayOverrides = Record<string, SlotOverride>;

export function dayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const storeKey = (dk: string) => `village.dayPlan.overrides.${dk}`;

export async function getOverrides(dk: string = dayKey()): Promise<DayOverrides> {
  try {
    const raw = await AsyncStorage.getItem(storeKey(dk));
    return raw ? (JSON.parse(raw) as DayOverrides) : {};
  } catch {
    return {};
  }
}

// Merge one slot's override (shiftMin accumulates; dismissed toggles). Returns
// the updated map so the caller can rebuild immediately.
export async function applyOverride(slotId: string, patch: SlotOverride, dk: string = dayKey()): Promise<DayOverrides> {
  const all = await getOverrides(dk);
  const prev = all[slotId] ?? {};
  const next: SlotOverride = { ...prev };
  if (patch.shiftMin !== undefined) next.shiftMin = (prev.shiftMin ?? 0) + patch.shiftMin;
  if (patch.dismissed !== undefined) next.dismissed = patch.dismissed;
  // Prune a no-op override so the map stays tidy.
  if (!next.dismissed && (!next.shiftMin || next.shiftMin === 0)) delete all[slotId];
  else all[slotId] = next;
  try { await AsyncStorage.setItem(storeKey(dk), JSON.stringify(all)); } catch { /* non-fatal */ }
  return all;
}

export async function clearOverrides(dk: string = dayKey()): Promise<void> {
  try { await AsyncStorage.removeItem(storeKey(dk)); } catch { /* non-fatal */ }
}
