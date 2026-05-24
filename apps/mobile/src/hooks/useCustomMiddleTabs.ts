// useCustomMiddleTabs — persists the user's pick for the two
// customizable middle slots in the bottom tab bar.
//
// Per the 2026-05-24 design handoff: Home / Manual / Profile are
// LOCKED in positions 1 / 2 / 5. The two middle slots (positions
// 3 + 4) come from the user's choice across:
//
//   Village · Inbox · Experts · Milk · Gear · Plans
//
// (The handoff names "Specialists / Exchange / Villie Plans" map to
// our existing tab names "Experts / Gear / Village" — there's no
// separate "Plans" tab today; Village absorbs that surface.)
//
// SETTINGS UI scope: out per the handoff. This hook only exposes the
// read + write API so a future settings screen can drive it. Defaults
// preserve current behavior: ['Village', 'Inbox'].

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'villie.tabbar.middle';

export type CustomizableTabName = 'Village' | 'Inbox' | 'Experts' | 'Milk' | 'Gear';
export type MiddleTabPair = readonly [CustomizableTabName, CustomizableTabName];

/** All tabs the user can put in the two customizable slots. */
export const CUSTOMIZABLE_TABS: readonly CustomizableTabName[] = [
  'Village', 'Inbox', 'Experts', 'Milk', 'Gear',
];

const DEFAULT_PAIR: MiddleTabPair = ['Village', 'Inbox'];

function isCustomizableTabName(s: unknown): s is CustomizableTabName {
  return typeof s === 'string' && (CUSTOMIZABLE_TABS as readonly string[]).includes(s);
}

function parsePair(raw: string | null): MiddleTabPair | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (
      Array.isArray(arr) && arr.length === 2 &&
      isCustomizableTabName(arr[0]) && isCustomizableTabName(arr[1]) &&
      arr[0] !== arr[1]
    ) {
      return [arr[0], arr[1]] as MiddleTabPair;
    }
  } catch { /* fall through to null */ }
  return null;
}

/**
 * Reads + writes the two customizable middle tab slots.
 *
 * Returns:
 *   `tabs` — current pair (defaults to ['Village', 'Inbox'])
 *   `ready` — false until AsyncStorage has been read once (so the
 *             nav doesn't flicker between default + persisted on
 *             cold boot)
 *   `setTabs(pair)` — persist a new pair; pair must be two distinct
 *                     CustomizableTabName values
 */
export function useCustomMiddleTabs() {
  const [tabs, setTabsState] = useState<MiddleTabPair>(DEFAULT_PAIR);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = parsePair(raw);
        if (!cancelled && parsed) setTabsState(parsed);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setTabs = useCallback(async (pair: MiddleTabPair) => {
    if (pair[0] === pair[1]) {
      throw new Error('useCustomMiddleTabs: the two slots must be distinct tabs');
    }
    setTabsState(pair);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pair));
  }, []);

  return { tabs, ready, setTabs };
}
