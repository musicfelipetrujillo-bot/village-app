// V5 Playbook — baby tracker store. Holds the live sleep/feed sessions + today's
// logs so the tracker UI (and, later, a Home "baby asleep" glance) read one
// source of truth. Mutations write through the API then re-pull today's rollup.
import { create } from 'zustand';
import {
  babyTrackerApi, type TodayLogs, type SleepLog, type FeedLog,
  type FeedMethod, type BreastSide, type DiaperKind, type ParseResult,
  type LogEntry, type MutationResult,
} from '@api/babyTracker';

const EMPTY: TodayLogs = { sleep: [], feeds: [], diapers: [], notes: [] };

interface TrackerState {
  babyProfileId: string | null;
  activeSleep: SleepLog | null;
  activeFeed: FeedLog | null;
  today: TodayLogs;
  loading: boolean;

  refresh: (babyProfileId: string) => Promise<void>;
  // `at` back-dates the entry; omitted means now.
  startSleep: (at?: string) => Promise<void>;
  stopSleep: (at?: string) => Promise<void>;
  startFeed: (method: FeedMethod, side: BreastSide | null, at?: string) => Promise<void>;
  stopFeed: (amountOz?: number | null, at?: string) => Promise<void>;
  logBottle: (amountOz: number, at?: string) => Promise<void>;
  logDiaper: (kind: DiaperKind, at?: string) => Promise<void>;
  logNote: (text: string) => Promise<void>;
  parseNote: (text: string) => Promise<ParseResult | null>;

  updateEntry: (entry: LogEntry, patch: Record<string, unknown>) => Promise<MutationResult>;
  deleteEntry: (entry: LogEntry) => Promise<MutationResult>;
}

export const useTrackerStore = create<TrackerState>((set, get) => ({
  babyProfileId: null,
  activeSleep: null,
  activeFeed: null,
  today: EMPTY,
  loading: false,

  refresh: async (babyProfileId) => {
    set({ babyProfileId, loading: true });
    const [activeSleep, activeFeed, today] = await Promise.all([
      babyTrackerApi.getActiveSleep(),
      babyTrackerApi.getActiveFeed(),
      babyTrackerApi.getToday(),
    ]);
    set({ activeSleep, activeFeed, today, loading: false });
  },

  startSleep: async (at) => {
    const { babyProfileId, activeSleep } = get();
    if (!babyProfileId || activeSleep) return;
    const row = await babyTrackerApi.startSleep(babyProfileId, at);
    if (row) set({ activeSleep: row });
    get().refresh(babyProfileId);
  },

  stopSleep: async (at) => {
    const { babyProfileId, activeSleep } = get();
    if (!activeSleep) return;
    await babyTrackerApi.stopSleep(activeSleep.id, at);
    set({ activeSleep: null });
    if (babyProfileId) get().refresh(babyProfileId);
  },

  startFeed: async (method, side, at) => {
    const { babyProfileId, activeFeed } = get();
    if (!babyProfileId || activeFeed) return;
    const row = await babyTrackerApi.startFeed(babyProfileId, method, side, at);
    if (row) set({ activeFeed: row });
    get().refresh(babyProfileId);
  },

  stopFeed: async (amountOz, at) => {
    const { babyProfileId, activeFeed } = get();
    if (!activeFeed) return;
    // Only a bottle carries ounces. Passing `undefined` for a breast feed
    // leaves the column untouched rather than nulling whatever is there —
    // playbook-parse-note can put amount_oz on a breast row, and stopping the
    // timer should not erase it.
    await babyTrackerApi.stopFeed(
      activeFeed.id, at,
      activeFeed.method === 'bottle' ? amountOz ?? null : undefined,
    );
    set({ activeFeed: null });
    if (babyProfileId) get().refresh(babyProfileId);
  },

  logBottle: async (amountOz, at) => {
    const { babyProfileId } = get();
    if (!babyProfileId) return;
    await babyTrackerApi.logBottle(babyProfileId, amountOz, at);
    get().refresh(babyProfileId);
  },

  logDiaper: async (kind, at) => {
    const { babyProfileId } = get();
    if (!babyProfileId) return;
    await babyTrackerApi.logDiaper(babyProfileId, kind, at);
    get().refresh(babyProfileId);
  },

  logNote: async (text) => {
    const { babyProfileId } = get();
    if (!babyProfileId || !text.trim()) return;
    await babyTrackerApi.logNote(babyProfileId, text.trim());
    get().refresh(babyProfileId);
  },

  parseNote: async (text) => {
    const { babyProfileId } = get();
    if (!babyProfileId || !text.trim()) return null;
    const res = await babyTrackerApi.parseNote(babyProfileId, text.trim());
    get().refresh(babyProfileId);
    return res;
  },

  updateEntry: async (entry, patch) => {
    const { babyProfileId } = get();
    let res: MutationResult;
    switch (entry.kind) {
      case 'sleep':  res = await babyTrackerApi.updateSleep(entry.row.id, patch); break;
      case 'feed':   res = await babyTrackerApi.updateFeed(entry.row.id, patch); break;
      case 'diaper': res = await babyTrackerApi.updateDiaper(entry.row.id, patch); break;
      case 'note':   res = await babyTrackerApi.updateNote(entry.row.id, patch); break;
    }
    if (res.ok && babyProfileId) await get().refresh(babyProfileId);
    return res;
  },

  deleteEntry: async (entry) => {
    const { babyProfileId } = get();
    const res = await babyTrackerApi.deleteEntry(entry.kind, entry.row.id);
    if (res.ok && babyProfileId) await get().refresh(babyProfileId);
    return res;
  },
}));
