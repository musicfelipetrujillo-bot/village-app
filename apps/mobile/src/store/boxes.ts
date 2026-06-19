// Villie Boxes — cart + customize state (zustand).
//
// Mirrors the gear store pattern. Holds the hub/detail UI toggles, the
// per-box "customize" working selections (which optional items are removed,
// which add-ons are selected), and the committed cart. Pricing is derived
// via computeBoxPricing / bundlePricing in @api/boxes — never stored.

import { create } from 'zustand';
import {
  BOXES,
  getBox,
  computeBoxPricing,
  bundlePricing,
  type BoxId,
} from '@api/boxes';

export type HubLayout = 'compact' | 'editorial';
export type ContentsLayout = 'grid' | 'list';

/** Working customize selections for one box (detail screen). */
interface BoxCustomize {
  /** Indices of removed optional items (core items can never be added here). */
  removed: number[];
  /** Indices of selected add-ons. */
  addons: number[];
}

/** A committed cart line — either a customized single box, or the bundle. */
export type CartLine =
  | { kind: 'box'; boxId: BoxId; removed: number[]; addons: number[] }
  | { kind: 'bundle' };

const emptyCustomize = (): BoxCustomize => ({ removed: [], addons: [] });

const initialCustomize = (): Record<BoxId, BoxCustomize> =>
  BOXES.reduce(
    (acc, b) => {
      acc[b.id] = emptyCustomize();
      return acc;
    },
    {} as Record<BoxId, BoxCustomize>,
  );

const toggle = (arr: number[], i: number): number[] =>
  arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i];

interface BoxesState {
  // UI toggles
  hubLayout: HubLayout;
  contentsLayout: ContentsLayout;
  /** Whether the detail screen is in "Make it yours" customize mode. */
  customizeMode: boolean;

  // selections + cart
  customize: Record<BoxId, BoxCustomize>;
  cart: CartLine[];

  // ----- actions -----
  setHubLayout: (l: HubLayout) => void;
  setContentsLayout: (l: ContentsLayout) => void;
  setCustomizeMode: (on: boolean) => void;

  /** Remove/restore an optional item (no-op on core items). */
  toggleItem: (boxId: BoxId, index: number) => void;
  /** Add/remove an add-on. */
  toggleAddon: (boxId: BoxId, index: number) => void;
  /** Reset a box's customize selections (called on open). */
  resetCustomize: (boxId: BoxId) => void;

  /** Add the current customized box to the cart. */
  addBoxToCart: (boxId: BoxId) => void;
  /** Add/remove the Full Journey bundle. */
  toggleBundle: () => void;
  removeCartLine: (index: number) => void;
  clearCart: () => void;
}

export const useBoxesStore = create<BoxesState>((set, get) => ({
  hubLayout: 'compact',
  contentsLayout: 'grid',
  customizeMode: false,
  customize: initialCustomize(),
  cart: [],

  setHubLayout: (l) => set({ hubLayout: l }),
  setContentsLayout: (l) => set({ contentsLayout: l }),
  setCustomizeMode: (on) => set({ customizeMode: on }),

  toggleItem: (boxId, index) => {
    const box = getBox(boxId);
    if (!box || box.items[index]?.core) return; // core items are locked
    set((s) => ({
      customize: {
        ...s.customize,
        [boxId]: { ...s.customize[boxId], removed: toggle(s.customize[boxId].removed, index) },
      },
    }));
  },

  toggleAddon: (boxId, index) =>
    set((s) => ({
      customize: {
        ...s.customize,
        [boxId]: { ...s.customize[boxId], addons: toggle(s.customize[boxId].addons, index) },
      },
    })),

  resetCustomize: (boxId) =>
    set((s) => ({
      customizeMode: false,
      customize: { ...s.customize, [boxId]: emptyCustomize() },
    })),

  addBoxToCart: (boxId) => {
    const c = get().customize[boxId];
    const line: CartLine = { kind: 'box', boxId, removed: [...c.removed], addons: [...c.addons] };
    set((s) => ({ cart: [...s.cart.filter((l) => !(l.kind === 'box' && l.boxId === boxId)), line] }));
  },

  toggleBundle: () =>
    set((s) => {
      const has = s.cart.some((l) => l.kind === 'bundle');
      return {
        cart: has ? s.cart.filter((l) => l.kind !== 'bundle') : [...s.cart, { kind: 'bundle' }],
      };
    }),

  removeCartLine: (index) => set((s) => ({ cart: s.cart.filter((_, i) => i !== index) })),
  clearCart: () => set({ cart: [] }),
}));

// ----- derived selectors (call outside the store) ------------------------

/** "now" total of one cart line, in whole dollars. */
export function cartLineTotal(line: CartLine): number {
  if (line.kind === 'bundle') return bundlePricing().now;
  const box = getBox(line.boxId);
  if (!box) return 0;
  return computeBoxPricing(box, new Set(line.removed), new Set(line.addons)).now;
}

/** Whole-cart "now" total, in whole dollars. */
export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + cartLineTotal(l), 0);
}

/** Whole-cart total in cents (for Stripe). */
export const cartTotalCents = (cart: CartLine[]): number => Math.round(cartTotal(cart) * 100);
