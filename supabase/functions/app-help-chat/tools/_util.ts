// Shared helpers for app-help-chat tools.
export const num = (n: any) => (typeof n === 'number' ? Math.round(n * 10) / 10 : undefined);

export const DEFAULT_TZ = 'America/New_York';

// Minutes the zone is ahead of UTC at that instant (handles DST because Intl
// resolves the offset for the actual date, not a fixed rule).
function tzOffsetMinutes(date: Date, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    const p: Record<string, string> = {};
    for (const part of dtf.formatToParts(date)) if (part.type !== 'literal') p[part.type] = part.value;
    const asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    const base = Math.floor(date.getTime() / 60000) * 60000; // drop sec/ms so this is a clean minute count
    return Math.round((asIfUtc - base) / 60000);
  } catch { return 0; }
}

/**
 * The instant range covering HER local calendar day. Mobile writes log times in
 * device-local time, so "what did I log today" has to be bounded by her midnight,
 * not UTC's — otherwise a 9pm bottle in Miami lands on tomorrow.
 * (Uses the offset in effect right now; on the two DST switch days a log in the
 * shifted hour can fall one hour outside the window. Not worth more than this.)
 */
export function localDayRange(tz: string): { startIso: string; endIso: string; date: string } {
  const now = new Date();
  const off = tzOffsetMinutes(now, tz);
  const shifted = new Date(now.getTime() + off * 60000);
  const y = shifted.getUTCFullYear(), m = shifted.getUTCMonth(), d = shifted.getUTCDate();
  const startMs = Date.UTC(y, m, d, 0, 0, 0) - off * 60000;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(startMs + 86400000).toISOString(),
    date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  };
}

/** "2:15p" in her timezone — the shape the Playbook and day sheet already use. */
export function localClock(iso: string | null | undefined, tz: string): string | undefined {
  if (!iso) return undefined;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: 'numeric', minute: 'numeric' })
      .formatToParts(new Date(iso));
    let h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    const ap = h < 12 ? 'a' : 'p';
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, '0')}${ap}`;
  } catch { return undefined; }
}

export const minsBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

/**
 * The caller's user id. index.ts resolves it once per request inside the existing
 * parallel batch, so the common path costs nothing; the getUser() fallback keeps
 * every tool correct if it's ever called with a context that lacks it.
 */
export async function resolveUserId(ctx: { userId?: string | null; supabase: any }): Promise<string | null> {
  if (ctx.userId) return ctx.userId;
  const { data } = await ctx.supabase.auth.getUser();
  return data?.user?.id ?? null;
}
