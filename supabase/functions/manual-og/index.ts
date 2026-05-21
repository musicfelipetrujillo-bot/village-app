// manual-og — Per-video share landing with proper OpenGraph previews.
//
// The marketing site (villieapp.com/m/?v=<id>) is on GitHub Pages, which
// can't render server-side. So when Twitter/IG/Slack/Discord/iMessage
// fetches a shared Manual video link, the static page's generic OG tags
// are all they see — the card shows the villie wordmark instead of the
// actual video thumbnail.
//
// This function fixes that. The mobile app's share URL points HERE instead
// of the static page. We branch on User-Agent:
//   - Crawler (Twitterbot, facebookexternalhit, Slackbot, Discordbot,
//     WhatsApp, Telegram, LinkedIn, etc.) → return server-rendered HTML
//     with per-video og:title, og:description, og:image, twitter:card,
//     etc. Crawler reads, generates a rich card, never sees the real
//     landing page.
//   - Real user → 302-redirect to villieapp.com/m/?v=<id> (the existing
//     static landing page). User gets the brand-aligned interactive
//     experience untouched.
//
// Trade-offs:
//   - Edge function URL in share text is ugly (functions.supabase.co/...
//     vs villieapp.com/m/). Most platforms shorten share URLs anyway,
//     and the 302 lands on villieapp.com so the user-facing domain is
//     unchanged. Worth swapping to a vanity host (Cloudflare worker
//     fronting GH Pages, custom domain on the edge function, etc.)
//     before the first real marketing push.
//   - We pay one extra fetch per share-tap (Supabase edge fn → 302 →
//     GH Pages). Tiny latency cost, real users won't notice.
//
// Anon-callable on purpose: crawlers don't send Authorization headers.
// The function reads via the service role to call the anon-callable
// RPC get_manual_video_share_meta (migration 066), which already
// enforces review_status='approved' internally.
//
// Deploy with: supabase functions deploy manual-og --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LANDING_PAGE_BASE  = 'https://villieapp.com/m/';

// Conservative crawler list. False positives are fine (a real browser
// gets server-rendered HTML — slightly heavier but still works). False
// negatives are bad (a real crawler missing the OG tags = back to the
// generic wordmark card we're trying to escape).
const CRAWLER_UA = /(bot|crawler|spider|crawling|facebookexternalhit|twitterbot|slackbot|discordbot|whatsapp|telegram|linkedinbot|skype|pinterest|embedly|preview|fetch|googleother|google-inspectiontool|bingbot|duckduckbot|applebot)/i;

function isCrawler(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return CRAWLER_UA.test(ua);
}

// Loose UUID shape check — keeps us from hitting the RPC with obviously
// malformed values. The RPC returns nothing anyway in that case, but
// failing fast is cheaper than a roundtrip.
function isLikelyUuid(s: string | null): boolean {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface VideoMeta {
  id: string;
  audience: 'mom' | 'baby';
  category: string;
  title: string;
  description: string;
  duration_seconds: number;
  thumbnail_url: string | null;
  poster_url: string | null;
  has_captions_en: boolean;
  has_captions_es: boolean;
}

function fmtDuration(s: number): string {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function buildHtml(meta: VideoMeta, originalUrl: string): string {
  const title = `${meta.title} · villie`;
  const description = meta.description || `A 2-minute video for tired parents. (${fmtDuration(meta.duration_seconds)})`;
  // og:image must be an absolute URL. Most Manual thumbnails are
  // already absolute (Pexels, Mux, etc.) but we fall back to the
  // villie wordmark if a video lacks one.
  const image = meta.thumbnail_url || 'https://villieapp.com/villie-wordmark.png';
  // The canonical URL we want crawlers + indexers to associate the
  // content with — the user-facing landing page, NOT this function.
  const canonical = `${LANDING_PAGE_BASE}?v=${meta.id}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta name="robots" content="index,follow" />
  <meta name="theme-color" content="#F4ECD8" />

  <!-- OpenGraph (Facebook, LinkedIn, Slack, Discord, iMessage, ...) -->
  <meta property="og:title"       content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type"        content="video.other" />
  <meta property="og:url"         content="${esc(canonical)}" />
  <meta property="og:image"       content="${esc(image)}" />
  <meta property="og:image:alt"   content="${esc(meta.title)}" />
  <meta property="og:image:width" content="1280" />
  <meta property="og:image:height" content="720" />
  <meta property="og:site_name"   content="villie" />
  <meta property="og:locale"      content="en_US" />
  <meta property="og:video:duration" content="${meta.duration_seconds}" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:site"        content="@villieapp" />
  <meta name="twitter:title"       content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image"       content="${esc(image)}" />
  <meta name="twitter:image:alt"   content="${esc(meta.title)}" />

  <!-- If a non-crawler somehow lands here (browser preview tooling,
       a user copy-pasting the share URL), do the same redirect the
       function would have done. Belt-and-braces. -->
  <meta http-equiv="refresh" content="0; url=${esc(canonical)}" />
  <script>window.location.replace(${JSON.stringify(canonical)});</script>
</head>
<body style="margin:0;padding:0;background:#F4ECD8;font-family:'Plus Jakarta Sans',sans-serif;color:#3D1F0E;">
  <div style="max-width:580px;margin:0 auto;padding:48px 24px;text-align:center;">
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:26px;margin:0 0 12px;">${esc(meta.title)}</h1>
    <p style="margin:0 0 24px;color:#7A4A28;">${esc(description)}</p>
    <p><a href="${esc(canonical)}" style="display:inline-block;padding:12px 22px;background:#C07840;color:#FDFBF6;text-decoration:none;border-radius:999px;">Open in villie</a></p>
  </div>
</body>
</html>`;
}

// Trim the original raw URL down to the parts a 302 would need.
function buildRedirect(videoId: string, refUrl: URL): string {
  const params = new URLSearchParams();
  params.set('v', videoId);
  // Preserve UTM params so click tracking + attribution carries
  // through to the landing page.
  for (const [k, v] of refUrl.searchParams.entries()) {
    if (k.startsWith('utm_') || k === 'src') params.set(k, v);
  }
  return `${LANDING_PAGE_BASE}?${params.toString()}`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Accept both `?v=<uuid>` (canonical) and `?id=<uuid>` (forgiving alias).
  const videoId = url.searchParams.get('v') ?? url.searchParams.get('id');

  if (!isLikelyUuid(videoId)) {
    // Bad URL — just bounce to the marketing site root. Don't 404 a
    // crawler with structured content, that wastes their budget.
    return Response.redirect('https://villieapp.com/', 302);
  }

  const ua = req.headers.get('user-agent');

  // Non-crawler → quick 302 to the static landing page. Saves us the
  // RPC call and keeps the user experience unchanged (they get the
  // brand-aligned interactive page).
  if (!isCrawler(ua)) {
    return Response.redirect(buildRedirect(videoId!, url), 302);
  }

  // Crawler → fetch metadata and return per-video OG HTML.
  // Failures fall through to a permissive 302 so a crawler glitch
  // never reads as "the link is broken" to a real visitor.
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase
      .rpc('get_manual_video_share_meta', { p_video_id: videoId });
    if (error) throw error;
    const rows = (data ?? []) as VideoMeta[];
    if (rows.length === 0) {
      return Response.redirect(buildRedirect(videoId!, url), 302);
    }
    const html = buildHtml(rows[0], req.url);
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Don't cache aggressively — videos can be unpublished or
        // re-titled, and we don't want a stale OG card to outlive an
        // edit by hours. 10 min is a reasonable balance between
        // crawler revisits and freshness.
        'Cache-Control': 'public, max-age=600, s-maxage=600',
      },
    });
  } catch (_e) {
    return Response.redirect(buildRedirect(videoId!, url), 302);
  }
});
