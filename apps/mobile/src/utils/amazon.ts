// Amazon Associates affiliate links for the Delivery Box hand-off.
//
// Two link shapes, both carrying our associate tag so attribution survives:
//   • product link  — amazon.com/dp/<ASIN>?tag=...      (one item, mom picks size)
//   • add-to-cart    — amazon.com/gp/aws/cart/add.html   (many items, one tap)
//
// The add-to-cart form is unofficial (Amazon moved its docs behind a
// deprecation notice), so callers must ALWAYS keep a per-item fallback — every
// cart item is also openable via buildAmazonProductUrl. Open these with
// Linking.openURL (system browser) — never an in-app WebView — or the tag can
// be dropped and the sale won't be attributed.
//
// Query strings are hand-built (not URL/URLSearchParams) to avoid React Native
// engine quirks and keep the ASIN.N / Quantity.N numbering exact.

/** Our Amazon Associates tracking tag. Env override, code default. */
export const AMAZON_ASSOCIATE_TAG =
  process.env.EXPO_PUBLIC_AMAZON_ASSOCIATE_TAG || 'villieapp-20';

const HOST = 'https://www.amazon.com';
const enc = encodeURIComponent;

/** Single product page with our tag (+ optional sub-tag for reporting). */
export function buildAmazonProductUrl(asin: string, subtag?: string): string {
  let url = `${HOST}/dp/${enc(asin)}?tag=${enc(AMAZON_ASSOCIATE_TAG)}`;
  if (subtag) url += `&ascsubtag=${enc(subtag)}`;
  return url;
}

export interface AmazonCartItem {
  asin: string;
  qty?: number;
}

/**
 * One add-to-cart URL that pre-loads every item at once. Returns null if there
 * are no items (caller should fall back to per-item links).
 */
export function buildAmazonCartUrl(items: AmazonCartItem[], subtag?: string): string | null {
  if (!items.length) return null;
  const parts = [`AssociateTag=${enc(AMAZON_ASSOCIATE_TAG)}`];
  items.forEach((it, idx) => {
    const n = idx + 1;
    parts.push(`ASIN.${n}=${enc(it.asin)}`);
    parts.push(`Quantity.${n}=${it.qty ?? 1}`);
  });
  if (subtag) parts.push(`ascsubtag=${enc(subtag)}`);
  return `${HOST}/gp/aws/cart/add.html?${parts.join('&')}`;
}

/** FTC-required disclosure — must be shown wherever we link out to Amazon. */
export const AMAZON_DISCLOSURE = 'As an Amazon Associate, Villie earns from qualifying purchases.';
