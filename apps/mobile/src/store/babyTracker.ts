// V5 Playbook — baby tracker store. Holds the live sleep/feed sessions + today's
// logs so the tracker UI (and, later, a Home "baby asleep" glance) read one
// source of truth. Mutations write through the API then re-pull today's rollup.
import { create } from 'zustand';
import {
  babyTrackerApi, type TodayLogs, type SleepLog, type FeedLog,
  type FeedMethod, type BreastSide, type DiaperKind,
} from '@api/babyTracker';

const EMPTY: TodayLogs = { sleep: [], feeds: [], diapers: [], notes: [] };

interface TrackerState {
  babyProfileId: string | null;
  activeSleep: SleepLog | null;
  activeFeed: FeedLog | null;
  today: TodayLogs;
  loading: boolean;

  refresh: (babyProfileId: string) => Promise<void>;
  startSleep: () => Promise<void>;
  stopSleep: () => Promise<void>;
  startFeed: (method: FeedMethod, side: BreastSide | null) => Promise<void>;
  stopFeed: (amountOz?: number | null) => Promise<void>;
  logBottle: (amountOz: number) => Promise<void>;
  logDiaper: (kind: DiaperKind) => Promise<void>;
  logNote: (text: string) => Promise<void>;
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

  startSleep: async () => {
    const { babyProfileId, activeSleep } = get();
    if (!babyProfileId || activeSleep) return;
    const row = await babyTrackerApi.startSleep(babyProfileId);
    if (row) set({ activeSleep: row });
    if (babyProfileId) get().refresh(babyProfileId);
  },

  stopSleep: async () => {
    const { babyProfileId, activeSleep } = get();
    if (!activeSleep) return;
    await babyTrackerApi.stopSleep(activeSleep.id);
    set({ activeSleep: null });
    if (babyProfileId) get().refresh(babyProfileId);
  },

  startFeed: async (method, side) => {
    const { babyProfileId, activeFeed } = get();
    if (!babyProfileId || activeFeed) return;
    const row = await babyTrackerApi.startFeed(babyProfileId, method, side);
    if (row) set({ activeFeed: row });
    if (babyProfileId) get().refresh(babyProfileId);
  },

  stopFeed: async (amountOz) => {
    const { babyProfileId, activeFeed } = get();
    if (!activeFeed) return;
    await babyTrackerApi.stopFeed(activeFeed.id, undefined, amountOz ?? null);
    set({ activeFeed: null });
    if (babyProfileId) get().refresh(babyProfileId);
  },

  logBottle: async (amountOz) => {
    const { babyProfileId } = get();
    if (!babyProfileId) return;
    await babyTrackerApi.logBottle(babyProfileId, amountOz);
    get().refresh(babyProfileId);
  },

  logDiaper: async (kind) => {
    const { babyProfileId } = get();
    if (!babyProfileId) return;
    await babyTrackerApi.logDiaper(babyProfileId, kind);
    get().refresh(babyProfileId);
  },

  logNote: async (text) => {
    const { babyProfileId } = get();
    if (!babyProfileId || !text.trim()) return;
    await babyTrackerApi.logNote(babyProfileId, text.trim());
    get().refresh(babyProfileId);
  },
}));
