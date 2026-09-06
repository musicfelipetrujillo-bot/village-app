// Villie Plans — curated baby-friendly parks.
//
// A hand-picked list (insider, age-appropriate — the value Google Maps can't
// give). Seeded with Miami/Coconut Grove; grow per city. Coordinates are
// best-effort and easy to correct. Age tags say who each park is best for.

export type ParkAge = 'babies' | 'toddlers' | 'big kids' | 'all ages';

export interface Park {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  ages: ParkAge[];
  blurb: string;
}

export const PARKS: Park[] = [
  {
    id: 'blanche',
    name: 'Blanche Park',
    area: 'Coconut Grove',
    lat: 25.7355,
    lng: -80.2418,
    ages: ['babies', 'toddlers'],
    blurb: 'Shaded Grove playground with a fenced tot lot — easy and safe for the littlest ones.',
  },
  {
    id: 'peacock',
    name: 'Peacock Park',
    area: 'Coconut Grove',
    lat: 25.7259,
    lng: -80.2392,
    ages: ['all ages'],
    blurb: 'Big bayfront green with a playground, open lawn, and room to roam.',
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

/** An Apple/Google-friendly directions URL for a park. */
export const parkDirectionsUrl = (p: Park): string =>
  `https://maps.apple.com/?daddr=${p.lat},${p.lng}&q=${encodeURIComponent(p.name)}`;
