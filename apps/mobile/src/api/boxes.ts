// Villie Boxes — stage-based curated commerce catalog + pricing.
//
// Ported from the 2026-06 design handoff (design_handoff_villie_boxes/
// villie-boxes.html `BOXES` array). This is the hardcoded seed catalog for
// the first release; move to a `villie_boxes` Supabase table later. Item
// prices/values (`v`) and add-on prices (`p`) are realistic placeholders —
// confirm against real retail before launch.
//
// Pricing logic recreated exactly from the handoff README:
//   ratio       = box.price / box.was                 (blended discount)
//   keptWas     = Σ v of included (not-removed) items
//   itemsNow    = round(keptWas × ratio)
//   addTotal    = Σ p of selected add-ons
//   cart now    = itemsNow + addTotal
//   cart was    = keptWas + addTotal
//   save        = keptWas − itemsNow
//   skippedSave = round((Σ v of removed items) × ratio)
//   bundle now  = round(Σ box.price × 0.9)   vs   Σ box.price (was)
//
// Core items are never removable (protects the box's integrity + margin).

import { supabase } from '@/lib/supabase';

// ----- types -------------------------------------------------------------

/** Tile tint key — maps to a 2-stop LinearGradient in TONE_GRADIENTS. */
export type ToneKey = 'rose' | 'honey' | 'caramel' | 'sage' | 'sky' | 'blush' | 'ink';

export interface BoxItem {
  /** Item name. */
  t: string;
  /** Quantity label, e.g. "×2", "1 pk". */
  q: string;
  /** One-line note shown under the name. */
  n: string;
  /** Tile tint. */
  tone: ToneKey;
  /** Retail value in whole dollars (the items' `v` sum to `box.was`). */
  v: number;
  /** Essential item — locked, cannot be removed in customize mode. */
  core: boolean;
}

export interface BoxAddOn {
  /** Add-on name. */
  t: string;
  /** One-line note. */
  n: string;
  /** Price in whole dollars. */
  p: number;
  /** Tile tint. */
  tone: ToneKey;
}

/** [iconName, label] — iconName maps to the app's icon set (Feather). */
export type TrustChip = [string, string];

export type BoxId = 'delivery' | 'newborn' | 'mama';

export interface Box {
  id: BoxId;
  /** Caveat "pop" word in the title, e.g. "Delivery" → "The Delivery Box". */
  pop: string;
  /** Stage label, e.g. "weeks 36+ · the big day". */
  stage: string;
  /** Short headline. */
  tagline: string;
  /** Longer description on the detail screen. */
  blurb: string;
  /** Hero gradient stops (155deg). */
  hero: readonly string[];
  /** White radial glow overlay color (rgba) for the hero. */
  glow: string;
  /** Badge label on the hero. */
  badge: string;
  /** Color for the Caveat "pop" word on this box. */
  popColor: string;
  /** Bundled box price (whole dollars). */
  price: number;
  /** Retail "was" total (whole dollars). */
  was: number;
  /** Trust chips. */
  trust: TrustChip[];
  items: BoxItem[];
  addons: BoxAddOn[];
}

// ----- gradients ---------------------------------------------------------

/** Per-tone tile gradient stops (145deg in the handoff). */
export const TONE_GRADIENTS: Record<ToneKey, readonly string[]> = {
  rose: ['#FBE0E4', '#F1B6C3'],
  honey: ['#FCEFCB', '#F0D483'],
  caramel: ['#F3E2CE', '#DBB389'],
  sage: ['#E8EBD8', '#C2CD9D'],
  sky: ['#DFE9EC', '#AEC5CD'],
  blush: ['#FCE7EB', '#F3C0CB'],
  ink: ['#6A4A30', '#3D2817'],
};

// ----- seed catalog ------------------------------------------------------

export const BOXES: Box[] = [
  {
    id: 'delivery',
    pop: 'Delivery',
    stage: 'weeks 36+ · the big day',
    tagline: "Everything you'll want at the hospital — packed and ready by the door.",
    blurb:
      'The bag you grab on the way out. Comfort for you, the first outfit for baby, and the little things nobody remembers until 2 a.m.',
    hero: ['#E27C9D', '#C23E63', '#A23456'],
    glow: 'rgba(255,255,255,0.42)',
    badge: 'L&D nurse approved',
    popColor: '#F2C84B',
    price: 128,
    was: 159,
    trust: [
      ['shield', 'Built with L&D nurses'],
      ['truck', 'Ships free by week 34'],
    ],
    items: [
      { t: 'Nursing robe', q: '×1', n: 'soft, easy to nurse in', tone: 'rose', v: 24, core: false },
      { t: 'Wireless nursing bras', q: '×2', n: 'stretchy, sleep-friendly', tone: 'blush', v: 22, core: true },
      { t: 'Going-home outfit', q: '×1', n: 'loose & comfy — for you', tone: 'caramel', v: 20, core: false },
      { t: 'Postpartum mesh undies', q: '×5', n: "yes, you'll want these", tone: 'sage', v: 12, core: true },
      { t: 'Heavy-flow maternity pads', q: '1 pk', n: 'for the first days', tone: 'rose', v: 9, core: true },
      { t: 'Toiletries + lip balm', q: '1 kit', n: 'travel size, dry hospital air', tone: 'sky', v: 11, core: false },
      { t: '10 ft phone charger', q: '×1', n: 'the outlet is never close', tone: 'ink', v: 12, core: false },
      { t: 'Snacks + straw water bottle', q: '1 set', n: 'labor is hungry work', tone: 'honey', v: 14, core: false },
      { t: 'Baby coming-home set', q: '1 set', n: 'outfit, hat & mittens', tone: 'blush', v: 18, core: true },
      { t: 'Swaddle blankets', q: '×2', n: 'for the ride home', tone: 'caramel', v: 12, core: true },
      { t: 'Cozy grip socks', q: '×1', n: 'hospital floors are cold', tone: 'sage', v: 5, core: false },
    ],
    addons: [
      { t: 'Extra swaddle set', n: 'you can never have too many', p: 16, tone: 'caramel' },
      { t: 'Nursing pillow', n: 'support from the first feed', p: 32, tone: 'blush' },
      { t: 'Silk eye mask — for mom', n: 'steal sleep when you can', p: 18, tone: 'rose' },
      { t: 'Labor-prep birth ball', n: 'ease the early hours', p: 28, tone: 'sage' },
    ],
  },
  {
    id: 'newborn',
    pop: 'Newborn',
    stage: "weeks 0–6 · baby's home",
    tagline: 'The day-one essentials for those first weeks at home.',
    blurb:
      'Set the nursery up once and breathe. Safe sleep, gentle care, and a feed plan that works whether you nurse, bottle, or both.',
    hero: ['#F4CC57', '#E0A23C', '#C8814A'],
    glow: 'rgba(255,255,255,0.5)',
    badge: 'pediatrician reviewed',
    popColor: '#C23E63',
    price: 164,
    was: 198,
    trust: [
      ['shield', 'Pediatrician reviewed'],
      ['truck', 'Ready before discharge'],
    ],
    items: [
      { t: 'Muslin swaddles', q: '×3', n: 'calm the startle reflex', tone: 'honey', v: 28, core: true },
      { t: 'Fitted crib sheets', q: '×2', n: 'firm, flat, breathable', tone: 'sky', v: 22, core: true },
      { t: 'Slow-flow bottles', q: '×3', n: 'breast-like, backup or both', tone: 'blush', v: 26, core: false },
      { t: 'Burp cloths', q: '×6', n: "you'll go through them", tone: 'caramel', v: 14, core: false },
      { t: 'Newborn diapers', q: '1 pk', n: '+ a pack of size 1', tone: 'sage', v: 18, core: true },
      { t: 'Fragrance-free wipes', q: '1 pk', n: 'gentle on new skin', tone: 'sky', v: 8, core: true },
      { t: 'Gentle wash + lotion', q: '1 set', n: 'fragrance & dye free', tone: 'honey', v: 16, core: true },
      { t: 'Hooded towels', q: '×2', n: 'for calm first baths', tone: 'blush', v: 18, core: false },
      { t: 'Pacifiers', q: '×2', n: 'two shapes to test', tone: 'rose', v: 10, core: false },
      { t: 'Nail file + thermometer', q: '1 kit', n: 'the tiny-grooming basics', tone: 'caramel', v: 12, core: false },
      { t: 'White-noise machine', q: '×1', n: 'womb-like, longer sleep', tone: 'ink', v: 26, core: false },
    ],
    addons: [
      { t: 'HD monitor upgrade', n: 'night vision + wide view', p: 40, tone: 'sky' },
      { t: 'Bottle warmer', n: 'no more cold-night waits', p: 35, tone: 'blush' },
      { t: 'Extra muslin swaddles', n: 'a fresh set, always ready', p: 18, tone: 'honey' },
      { t: 'Night-light sound machine', n: 'soothes the 3 a.m. wakes', p: 24, tone: 'caramel' },
    ],
  },
  {
    id: 'mama',
    pop: 'Mama',
    stage: 'the fourth trimester · for you',
    tagline: 'Postpartum recovery, gathered with love — because you matter too.',
    blurb:
      "The box that's just for you. Everything to soothe, heal, and feel a little more human through the tender first weeks.",
    hero: ['#F7CDD3', '#E089A0', '#B0234F'],
    glow: 'rgba(255,255,255,0.55)',
    badge: 'OB-GYN + doula designed',
    popColor: '#7A3350',
    price: 96,
    was: 118,
    trust: [
      ['heart', 'OB-GYN + doula designed'],
      ['truck', 'Free 2-day shipping'],
    ],
    items: [
      { t: 'Peri bottle', q: '×1', n: 'the real MVP', tone: 'rose', v: 8, core: true },
      { t: 'Perineal cooling pads', q: '1 pk', n: 'instant relief', tone: 'sky', v: 14, core: true },
      { t: 'Postpartum mesh undies', q: '×5', n: 'soft & high-rise', tone: 'sage', v: 12, core: true },
      { t: 'Maternity pads', q: '1 pk', n: 'for the early weeks', tone: 'blush', v: 9, core: true },
      { t: 'Lanolin nipple cream', q: '×1', n: 'safe to nurse with', tone: 'honey', v: 12, core: true },
      { t: 'Nursing pads', q: '1 set', n: 'washable + travel', tone: 'caramel', v: 12, core: false },
      { t: 'Sitz bath soak', q: '1 kit', n: 'warm, herbal, healing', tone: 'sage', v: 11, core: false },
      { t: 'Belly support band', q: '×1', n: 'gentle core support', tone: 'caramel', v: 18, core: false },
      { t: 'Stool softener', q: '1 box', n: 'trust us on this one', tone: 'sky', v: 7, core: false },
      { t: 'Electrolytes + herbal tea', q: '1 set', n: 'hydrate, mama', tone: 'rose', v: 9, core: false },
      { t: 'Affirmation cards', q: '1 deck', n: 'for the 3 a.m. nights', tone: 'blush', v: 6, core: false },
    ],
    addons: [
      { t: 'Postpartum tea bundle', n: 'a month of calm cups', p: 16, tone: 'sage' },
      { t: 'Nipple healing kit', n: 'gel pads + balm', p: 14, tone: 'blush' },
      { t: 'Sitz bath refills ×3', n: 'keep the relief coming', p: 19, tone: 'sky' },
      { t: 'Soy self-care candle', n: 'five quiet minutes', p: 22, tone: 'rose' },
    ],
  },
];

export const getBox = (id: BoxId): Box | undefined => BOXES.find((b) => b.id === id);

// ----- pricing -----------------------------------------------------------

/** Blended discount ratio (price ÷ was). */
export const boxRatio = (box: Box): number => box.price / box.was;

export interface BoxPricing {
  /** "now" price of the included items only (no add-ons). */
  itemsNow: number;
  /** Retail "was" of the included items. */
  keptWas: number;
  /** Sum of selected add-on prices. */
  addTotal: number;
  /** Cart "now" total (itemsNow + addTotal). */
  now: number;
  /** Cart "was" total (keptWas + addTotal). */
  was: number;
  /** Savings vs retail (keptWas − itemsNow). */
  save: number;
  /** Reassurance figure: discounted value of the items the user skipped. */
  skippedSave: number;
  /** Count of included items. */
  includedCount: number;
  /** Count of removed items. */
  removedCount: number;
  /** Total item count in the box. */
  totalCount: number;
}

const round = (n: number): number => Math.round(n);

/**
 * Compute live pricing for a box given the user's customize selections.
 * @param removed indices of removed (optional, non-core) items
 * @param addons  indices of selected add-ons
 */
export function computeBoxPricing(box: Box, removed: Set<number>, addons: Set<number>): BoxPricing {
  let keptWas = 0;
  let removedWas = 0;
  box.items.forEach((item, i) => {
    if (removed.has(i) && !item.core) removedWas += item.v;
    else keptWas += item.v;
  });
  const ratio = boxRatio(box);
  const itemsNow = round(keptWas * ratio);
  let addTotal = 0;
  box.addons.forEach((a, i) => {
    if (addons.has(i)) addTotal += a.p;
  });
  const removedCount = box.items.filter((it, i) => removed.has(i) && !it.core).length;
  return {
    itemsNow,
    keptWas,
    addTotal,
    now: itemsNow + addTotal,
    was: keptWas + addTotal,
    save: keptWas - itemsNow,
    skippedSave: round(removedWas * ratio),
    includedCount: box.items.length - removedCount,
    removedCount,
    totalCount: box.items.length,
  };
}

/** Full Journey bundle: 10% off the summed box prices. */
export function bundlePricing(): { now: number; was: number; save: number } {
  const was = BOXES.reduce((s, b) => s + b.price, 0);
  const now = round(was * 0.9);
  return { now, was, save: was - now };
}

/** "$128", "$1,164". */
export const formatPrice = (dollars: number): string => `$${Math.round(dollars).toLocaleString('en-US')}`;

// ----- checkout (Stripe) -------------------------------------------------
// Wired in Stage 4 to the `boxes-create-payment-intent` edge function +
// `orders` table. Mirrors the Specialist-booking PaymentScreen flow.

export interface BoxOrderLine {
  box_id: BoxId;
  /** Indices of removed items (for the order record). */
  removed: number[];
  /** Indices of selected add-ons. */
  addons: number[];
}

export interface BoxShipping {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
}

export interface CreateBoxIntentInput {
  lines: BoxOrderLine[];
  /** Whether the Full Journey bundle is included. */
  bundle: boolean;
  shipping: BoxShipping;
}

export interface CreateBoxIntentResult {
  client_secret: string;
  payment_intent_id: string;
  order_id: string;
  /** Server-authoritative charge amount in cents (do not trust client math). */
  amount_cents: number;
}

export type BoxOrderStatus = 'pending_payment' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded';

export interface BoxOrderItemRow {
  box_id: BoxId;
  removed_indices: number[];
  addon_indices: number[];
  line_amount_cents: number;
}

export interface BoxOrderRow {
  id: string;
  status: BoxOrderStatus;
  is_bundle: boolean;
  amount_cents: number;
  subtotal_cents: number;
  created_at: string;
  paid_at: string | null;
  ship_name: string | null;
  ship_city: string | null;
  ship_state: string | null;
  items: BoxOrderItemRow[];
}

/** Human label + tone for an order status pill. */
export const ORDER_STATUS_META: Record<BoxOrderStatus, { label: string; done: boolean }> = {
  pending_payment: { label: 'Processing', done: false },
  paid:            { label: 'Paid',       done: true },
  fulfilled:       { label: 'Shipped',    done: true },
  cancelled:       { label: 'Cancelled',  done: false },
  refunded:        { label: 'Refunded',   done: false },
};

export const boxesApi = {
  /** Create a Stripe PaymentIntent + draft order for the cart. */
  async createPaymentIntent(input: CreateBoxIntentInput): Promise<CreateBoxIntentResult> {
    const { data, error } = await supabase.functions.invoke('boxes-create-payment-intent', {
      body: input,
    });
    if (error) throw new Error(error.message);
    return data as CreateBoxIntentResult;
  },

  /** The signed-in user's box orders (newest first), with their line items. */
  async listMyOrders(): Promise<BoxOrderRow[]> {
    const { data, error } = await supabase
      .from('villie_box_orders')
      .select(
        'id,status,is_bundle,amount_cents,subtotal_cents,created_at,paid_at,ship_name,ship_city,ship_state,' +
        'items:villie_box_order_items(box_id,removed_indices,addon_indices,line_amount_cents)',
      )
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as BoxOrderRow[];
  },
};
