// manualDeepDives.ts — the villie+ specialist deep-dive videos.
//
// The paid centerpiece of every Manual category. Free users get the week's
// infographics / checklist / article + the free week-overview video; the
// *filmed specialist deep-dive* (a PT showing the rollover progression, an
// IBCLC showing a proper latch, the burp positions that actually work) is
// villie+ only.
//
// This lives in its own file — separate from the ~15k-line manualWeekContent —
// so the content team can seed video metadata per week/category without
// touching the education baseline. getManualContent() attaches the resolved
// deepDive onto each CategoryContent.
//
// PLAYBACK: `playbackId` (Mux) or `videoId` (a manual_videos row) is absent
// until the video is filmed + deployed. While absent, the card renders its
// locked/tease state and taps show a "coming soon" note — no broken player.

export type DeepDive = {
  /** Filmed specialist, e.g. "Dr. Rosa Iglesias". */
  expert: string;
  /** Credential line, e.g. "Pediatric Physical Therapist". */
  role: string;
  /** The video's headline, e.g. "The rollover progression". */
  title: string;
  /** The payoff — what she'll actually learn. Sells the unlock. */
  value: string;
  /** Display runtime, e.g. "5 min". */
  duration: string;
  /** How much of the clip a free user may preview (seconds). Default 15. */
  previewSeconds?: number;
  /** Mux playback id — set once filmed. */
  playbackId?: string;
  /** manual_videos row id — alternative to playbackId. */
  videoId?: string;
  /** Poster/thumbnail URL for the still (optional). */
  posterUrl?: string;
};

type WeekDeepDives = Partial<Record<string, DeepDive>>;

// Seeded per week → category. Grow ships first (the rollover shoot), so week 16
// Grow is real copy; the rest are placeholders the content team will replace.
export const DEEP_DIVES: Record<number, WeekDeepDives> = {
  1: {
    sleep: {
      expert: 'Dr. Maya Chen', role: 'Pediatric Sleep Specialist',
      title: 'Drowsy, not asleep', duration: '4 min',
      value: 'The exact hand-off to the crib that keeps a newborn down — shown in real time.',
    },
    feed: {
      expert: 'Renata Blythe', role: 'IBCLC Lactation Consultant',
      title: 'A proper latch, fixed', duration: '6 min',
      value: 'The one latch adjustment most moms miss — see it corrected on camera.',
    },
    grow: {
      expert: 'Dr. Rosa Iglesias', role: 'Pediatric Physical Therapist',
      title: 'Tummy time, day one', duration: '4 min',
      value: 'How to set up tummy time so your newborn actually tolerates it — step by step.',
    },
    care: {
      expert: 'Nurse Priya Anand', role: 'Pediatric Nurse',
      title: 'Burping that actually works', duration: '3 min',
      value: 'Three positions + the one most people do wrong — demonstrated with a real baby.',
    },
  },
  16: {
    grow: {
      expert: 'Dr. Rosa Iglesias', role: 'Pediatric Physical Therapist',
      title: 'The rollover progression', duration: '5 min',
      value: 'The exact 3-step sequence to help your baby roll — plus the tummy-time setup that gets there faster.',
    },
  },
};

/**
 * Resolve the deep-dive for a week + category, falling back to the nearest
 * earlier seeded week (mirrors getManualContent's week fallback), then week 1.
 */
export function getDeepDive(week: number, category: string): DeepDive | undefined {
  const exact = DEEP_DIVES[week]?.[category];
  if (exact) return exact;
  for (let w = week - 1; w >= 1; w--) {
    const hit = DEEP_DIVES[w]?.[category];
    if (hit) return hit;
  }
  return DEEP_DIVES[1]?.[category];
}
