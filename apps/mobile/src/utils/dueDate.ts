// US-style MM/DD/YYYY <-> ISO YYYY-MM-DD helpers used by Onboarding and
// EditProfile so the two surfaces present the same input UX. Postgres
// `DATE` columns are canonical YYYY-MM-DD, so we always submit ISO and
// always render MM/DD in the UI.

/** Mask user typing into an MM/DD/YYYY shape. */
export function formatDueDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Loose plausibility check — only blocks the obviously-wrong shape. */
export function isPlausibleDueDate(s: string): boolean {
  if (!s) return true; // optional
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return false;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  // Bracket plausible due-date years (current year ± 2). Avoids "1999"
  // typos without imposing a strict pregnancy-window rule.
  const thisYear = new Date().getFullYear();
  return year >= thisYear - 1 && year <= thisYear + 2;
}

/** Convert masked MM/DD/YYYY → ISO YYYY-MM-DD for Postgres. Returns null on bad input. */
export function toIsoDate(s: string): string | null {
  if (!s) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

/** Convert DB ISO YYYY-MM-DD → MM/DD/YYYY for display. Empty on bad input. */
export function fromIsoDate(s: string | null | undefined): string {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return '';
  return `${m[2]}/${m[3]}/${m[1]}`;
}
