// Villie Plans — curated baby-friendly parks.
//
// A hand-picked list (insider, age-appropriate — the value Google Maps can't
// give). Seeded with Miami/Coconut Grove; grow per city. Coordinates are
// best-effort and easy to correct. Age tags say who each park is best for.

export type ParkAge = 'babies' | 'toddlers' | 'big kids' | 'all ages';

// The insider intel Google can't give — what moms actually want to know.
export interface ParkIntel {
  shade?: 'full' | 'some';
  fenced?: boolean;
  benches?: boolean;
  strollerFriendly?: boolean;
  changingTable?: boolean;
  /** true = has bathrooms; false = explicitly none (shown as negative intel). */
  bathroom?: boolean;
  quiet?: boolean;
  dogPark?: boolean;
  parking?: 'easy' | 'street' | 'limited';
}

export interface Park {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  ages: ParkAge[];
  blurb: string;
  intel?: ParkIntel;
  /** Street address — used for accurate directions when the pin is approximate. */
  address?: string;
}

export const PARKS: Park[] = [
  {
    id: 'lincoln',
    name: 'Lincoln Park',
    area: 'West Grove',
    lat: 25.7316,
    lng: -80.2452,
    ages: ['babies', 'toddlers'],
    blurb: 'The if-you-know-you-know local spot — mostly the under-3 crowd. Quiet, full shade, benches, stroller-easy. Parking is tight (it’s a walk-to park for the neighborhood).',
    intel: { shade: 'full', benches: true, strollerFriendly: true, quiet: true, parking: 'limited' },
    address: '2954 Jackson Ave, Miami, FL 33133',
  },
  {
    id: 'blanche',
    name: 'Blanche Park',
    area: 'Coconut Grove',
    lat: 25.7355,
    lng: -80.2418,
    ages: ['big kids'],
    blurb: 'Shaded Grove favorite — stroller-easy and kid-friendly (also a dog park). All kids, but mainly 3+. Heads up: no bathrooms.',
    intel: { shade: 'some', strollerFriendly: true, dogPark: true, bathroom: false },
  },
  {
    id: 'peacock',
    name: 'Peacock Park',
    area: 'Coconut Grove',
    lat: 25.7259,
    lng: -80.2392,
    ages: ['big kids'],
    blurb: 'Big bayfront green with a playground — bathrooms, changing tables, and restaurants right next door. All ages welcome, but really shines for kids 3+.',
    intel: { shade: 'some', changingTable: true, bathroom: true, strollerFriendly: true },
  },
  {
    id: 'woodside',
    name: 'Woodside Park',
    area: 'The Roads',
    lat: 25.7472,
    lng: -80.2035,
    ages: ['babies', 'toddlers'],
    blurb: 'Quiet neighborhood mini-park — low-key and gentle for a first outing.',
  },
];

export const AGE_TONE: Record<ParkAge, string> = {
  babies: '#C24A63',
  toddlers: '#DA9A2C',
  'big kids': '#4E7A6A',
  'all ages': '#7B8A46',
};

/** Primary tone for a park's map pin (its youngest age tag). */
export const parkTone = (p: Park): string => AGE_TONE[p.ages[0]] ?? '#7B8A46';

/** The insider intel as scannable chips (icon + short label). */
export function intelChips(intel?: ParkIntel): { icon: string; label: string }[] {
  if (!intel) return [];
  const out: { icon: string; label: string }[] = [];
  if (intel.shade === 'full') out.push({ icon: '🌳', label: 'full shade' });
  else if (intel.shade === 'some') out.push({ icon: '🌳', label: 'good shade' });
  if (intel.fenced) out.push({ icon: '🔒', label: 'fenced' });
  if (intel.strollerFriendly) out.push({ icon: '🍼', label: 'stroller-easy' });
  if (intel.benches) out.push({ icon: '🪑', label: 'benches' });
  if (intel.changingTable) out.push({ icon: '🚼', label: 'changing table' });
  if (intel.bathroom === true) out.push({ icon: '🚻', label: 'bathrooms' });
  else if (intel.bathroom === false) out.push({ icon: '🚫', label: 'no bathrooms' });
  if (intel.dogPark) out.push({ icon: '🐶', label: 'dog park' });
  if (intel.quiet) out.push({ icon: '🤫', label: 'quiet' });
  if (intel.parking === 'easy') out.push({ icon: '🚗', label: 'easy parking' });
  else if (intel.parking === 'street') out.push({ icon: '🚗', label: 'street parking' });
  else if (intel.parking === 'limited') out.push({ icon: '🚗', label: 'limited parking' });
  return out;
}

/** An Apple/Google-friendly directions URL for a park. Prefers the street
 *  address (accurate even when the map pin is only approximate). */
export const parkDirectionsUrl = (p: Park): string =>
  p.address
    ? `https://maps.apple.com/?daddr=${encodeURIComponent(p.address)}`
    : `https://maps.apple.com/?daddr=${p.lat},${p.lng}&q=${encodeURIComponent(p.name)}`;
