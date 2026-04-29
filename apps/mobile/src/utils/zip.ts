// US ZIP helpers shared by Onboarding + EditProfile. Validation is loose:
// reject 1–4 digits as obviously incomplete, accept 5 (or 5+4 with hyphen).
// The DB column is text, so we tolerate ZIP+4 even though no current screen
// asks for it.

export function formatZipInput(raw: string): string {
  // Allow digits + optional single hyphen between 5th and 6th digit.
  const digits = raw.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function isPlausibleZip(s: string): boolean {
  if (!s) return true; // optional field
  return /^\d{5}(-\d{4})?$/.test(s);
}
