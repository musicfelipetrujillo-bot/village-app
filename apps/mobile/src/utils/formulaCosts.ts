// Feeding-cost planner — data + math.
//
// Prices are $ per PREPARED ounce, as tight historical ranges (2025 US retail;
// store brands cheapest, specialty/hypoallergenic priciest). They're estimates
// the mom can nudge, never scraped live prices. Brand NAMES only — no logos
// (trademark). Sources: retail price-per-ounce comparisons, Jan 2025.

export interface CostRange {
  low: number;
  high: number;
}

export interface FormulaBrand {
  id: string;
  name: string;
  /** small descriptor under the name */
  tier: string;
  /** monogram tile color (no logo) */
  tone: string;
  perOzLow: number;
  perOzHigh: number;
}

// Tight per-prepared-ounce ranges (dollars).
export const FORMULA_BRANDS: FormulaBrand[] = [
  { id: 'store',       name: 'Store brand',   tier: 'Kirkland · Parent’s Choice · Up&Up', tone: '#7B8A46', perOzLow: 0.10, perOzHigh: 0.15 },
  { id: 'gerber',      name: 'Gerber',        tier: 'Good Start',            tone: '#DA9A2C', perOzLow: 0.16, perOzHigh: 0.24 },
  { id: 'enfamil',     name: 'Enfamil',       tier: 'NeuroPro',              tone: '#3E6DAE', perOzLow: 0.20, perOzHigh: 0.28 },
  { id: 'similac',     name: 'Similac',       tier: '360 Total Care',        tone: '#E07B39', perOzLow: 0.20, perOzHigh: 0.28 },
  { id: 'earths_best', name: "Earth’s Best",  tier: 'organic',               tone: '#6E8B3D', perOzLow: 0.22, perOzHigh: 0.30 },
  { id: 'kendamil',    name: 'Kendamil',      tier: 'organic',               tone: '#4E7A6A', perOzLow: 0.25, perOzHigh: 0.35 },
  { id: 'bobbie',      name: 'Bobbie',        tier: 'organic',               tone: '#C24A63', perOzLow: 0.28, perOzHigh: 0.38 },
  { id: 'specialty',   name: 'Specialty',     tier: 'Alimentum · Nutramigen', tone: '#8A4A5C', perOzLow: 0.40, perOzHigh: 0.60 },
  { id: 'other',       name: 'Other',         tier: 'set your own price',     tone: '#8A6A55', perOzLow: 0.18, perOzHigh: 0.30 },
];

// Donor / bought breast milk — informal peer (cash P2P) varies most; wide-ish
// on purpose. Own milk ≈ free (pump supplies negligible over a month).
export const DONOR_MILK_PER_OZ: CostRange = { low: 1.0, high: 2.5 };
export const OWN_MILK_PER_OZ = 0;

export const DAYS_PER_MONTH = 30.4;

const r = (low: number, high: number): CostRange => ({ low, high });
const add = (a: CostRange, b: CostRange): CostRange => r(a.low + b.low, a.high + b.high);

/** "$140" (rounded to nearest $5 for a calmer number). */
export const money = (n: number): string => `$${(Math.round(n / 5) * 5).toLocaleString('en-US')}`;
/** "$140–$170", or "$0" when free, or a single value when low≈high. */
export function rangeLabel(c: CostRange): string {
  if (c.low === 0 && c.high === 0) return '$0';
  const lo = money(c.low);
  const hi = money(c.high);
  return lo === hi ? lo : `${lo}–${hi}`;
}

export interface Scenario {
  key: string;
  label: string;
  note?: string;
  monthly: CostRange;
}

/**
 * Every scenario's monthly cost for the given ounces/day + chosen formula, so
 * the mom can compare. `comboFormulaShare` is the fraction (0..1) of a combo
 * day that comes from formula (the rest is milk).
 */
export function feedingScenarios(input: {
  ozPerDay: number;
  brand: FormulaBrand;
  comboFormulaShare: number;
}): Scenario[] {
  const M = DAYS_PER_MONTH;
  const oz = Math.max(0, input.ozPerDay);
  const b = input.brand;
  const fMonthly = (share = 1): CostRange => r(oz * share * b.perOzLow * M, oz * share * b.perOzHigh * M);
  const dMonthly = (share = 1): CostRange => r(oz * share * DONOR_MILK_PER_OZ.low * M, oz * share * DONOR_MILK_PER_OZ.high * M);
  const fShare = Math.min(1, Math.max(0, input.comboFormulaShare));
  const mShare = 1 - fShare;
  const pct = Math.round(fShare * 100);
  return [
    { key: 'own',        label: 'Your own milk only',           note: 'pumping / nursing — about free', monthly: r(0, 0) },
    { key: 'combo_own',  label: 'Your milk + formula',          note: `${pct}% formula`,                monthly: fMonthly(fShare) },
    { key: 'formula',    label: 'Formula only',                 note: b.name,                            monthly: fMonthly(1) },
    { key: 'combo_donor',label: 'Donor milk + formula',         note: `${pct}% formula`,                 monthly: add(fMonthly(fShare), dMonthly(mShare)) },
    { key: 'donor',      label: 'Donor milk only',              note: 'bought / peer milk',              monthly: dMonthly(1) },
  ];
}

/** First-year outlook: full-year formula vs nursing until `switchMonth`. */
export function yearOutlook(ozPerDay: number, brand: FormulaBrand, switchMonth: number): {
  fullYear: CostRange;
  nurseThenSwitch: CostRange;
} {
  const M = DAYS_PER_MONTH;
  const monthly = r(ozPerDay * brand.perOzLow * M, ozPerDay * brand.perOzHigh * M);
  const remaining = Math.max(0, 12 - Math.min(12, switchMonth));
  return {
    fullYear: r(monthly.low * 12, monthly.high * 12),
    nurseThenSwitch: r(monthly.low * remaining, monthly.high * remaining),
  };
}
