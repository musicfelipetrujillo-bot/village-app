// Offline-first access to the bundled Manual clips.
//
// The animated HTML clips are embedded in the JS bundle as self-contained
// strings (see localManualClips.generated.ts, produced by
// scripts/build-manual-clips.mjs). React + ReactDOM are stored ONCE as
// MANUAL_CLIP_VENDOR and injected at the <!--VENDOR--> token here, so the 11
// clip strings don't each duplicate ~139 KB of vendor code.
//
// The player loads the local string first (works fully offline — no CDN, no
// on-device Babel) and falls back to the remote villieapp.com URL when a clip
// isn't bundled or the local load fails.
import { MANUAL_CLIP_VENDOR, MANUAL_CLIP_HTML } from './localManualClips.generated';

// Where the same clips are hosted online. Used as the WebView baseUrl (so the
// remote Google Fonts <link> resolves when online) and as the fallback origin.
export const MANUAL_VIDEO_REMOTE_BASE = 'https://villieapp.com/manual-videos/';

// `/manual-videos/<slug>.html` -> `<slug>`. Tolerates query/hash suffixes and
// absolute or relative URLs.
export function slugFromManualHtmlUrl(htmlUrl?: string | null): string | null {
  if (!htmlUrl) return null;
  const m = htmlUrl.match(/\/manual-videos\/([^/?#]+)\.html(?:[?#]|$)/);
  return m ? m[1] : null;
}

export function hasLocalClip(htmlUrl?: string | null): boolean {
  const slug = slugFromManualHtmlUrl(htmlUrl);
  return !!slug && Object.prototype.hasOwnProperty.call(MANUAL_CLIP_HTML, slug);
}

// Returns the fully self-contained HTML (vendor injected) for a bundled clip,
// or null when the clip isn't bundled. A function replacer is used for the
// token swap so `$` sequences in the minified React source aren't treated as
// replacement patterns.
export function getLocalClipHtml(htmlUrl?: string | null): string | null {
  const slug = slugFromManualHtmlUrl(htmlUrl);
  if (!slug) return null;
  const tpl = MANUAL_CLIP_HTML[slug];
  if (!tpl) return null;
  return tpl.replace('<!--VENDOR-->', () => `<script>${MANUAL_CLIP_VENDOR}</script>`);
}
