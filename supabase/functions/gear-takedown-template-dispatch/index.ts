// V4 Gear · Takedown template dispatch
//
// Sends one of the three pre-approved seller-facing system messages (Templates
// A / B / C from V4_GEAR_TAKEDOWN_SOP.md §7) into the seller's existing thread
// for a specific listing. Used by moderators after they've reviewed a report
// and decided to take action.
//
// This is the human-driven counterpart to migration 063's auto-withdraw RPC
// (which fires its own system message via the SLA-miss path). Both write
// `message_type='system'` rows with `sender_id=NULL`, so the seller's
// GearMessageDetailScreen renders them identically.
//
// Auth: service-role bearer. There is no admin UI yet, so this endpoint is
// invoked from Supabase Studio or `curl` by a named moderator. Every dispatch
// writes to admin_audit_log with the moderator's user_id pulled from the
// `actor_user_id` request body field — for accountability.
//
// Body shape:
//   {
//     listing_id:    "<uuid>",                   // required
//     template:      "recall" | "withdrawal" | "suspension",  // required
//     reason_short?: string,                     // required for "withdrawal"
//                                                // (one of the 5 short strings in SOP §7 Template B)
//     recall_url?:   string,                     // optional for "recall"
//     recall_number?:string,                     // optional for "recall"
//     locale?:       "en" | "es",                // default 'en'; falls back to
//                                                // users.preferred_language when
//                                                // we can read it, else 'en'
//     actor_user_id: "<uuid>",                   // moderator's user id; required
//                                                // for the audit log
//     report_id?:    "<uuid>",                   // optional cross-reference if
//                                                // this dispatch resolves a specific
//                                                // gear_listing_reports row
//   }
//
// Response: { ok, message_id, thread_id, locale }
//   message_id is null when the seller has no message thread yet for that
//   listing — in that case we still write the audit log row (so the chain of
//   custody is intact) but the seller will only see the withdrawal in their
//   MyListings view, not as a message.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Locale = 'en' | 'es';
type Template = 'recall' | 'withdrawal' | 'suspension';
type ReasonShort =
  | 'prohibited_category'
  | 'safety_hazard'
  | 'misleading_description'
  | 'counterfeit'
  | 'account_pattern';

interface Body {
  listing_id?: string;
  template?: Template;
  reason_short?: ReasonShort;
  recall_url?: string;
  recall_number?: string;
  locale?: Locale;
  actor_user_id?: string;
  report_id?: string;
}

// EN templates verbatim from V4_GEAR_TAKEDOWN_SOP.md §7.
// ES translations match the existing i18n posture (clinician-handoff grade,
// no idiomatic LATAM flavor — neutral Spanish).
function renderTemplate(args: {
  template: Template;
  locale: Locale;
  reasonShort?: ReasonShort;
  recallNumber?: string;
  recallUrl?: string;
}): string {
  const { template, locale, reasonShort, recallNumber, recallUrl } = args;
  const RN = recallNumber || 'pending';
  const RU = recallUrl || 'https://cpsc.gov/Recalls';

  const REASON_LABEL: Record<ReasonShort, { en: string; es: string }> = {
    prohibited_category: {
      en: "matches a category we don't allow",
      es: 'coincide con una categoría que no permitimos',
    },
    safety_hazard: {
      en: 'photos show a safety hazard',
      es: 'las fotos muestran un riesgo de seguridad',
    },
    misleading_description: {
      en: "description didn't match the photos",
      es: 'la descripción no coincidía con las fotos',
    },
    counterfeit: {
      en: 'signs of counterfeit goods',
      es: 'señales de productos falsificados',
    },
    account_pattern: {
      en: 'pattern of reports across your account',
      es: 'patrón de reportes en tu cuenta',
    },
  };

  if (template === 'recall') {
    if (locale === 'es') {
      return `Retiramos tu anuncio porque el artículo coincide con un retiro activo de la CPSC (${RN}). Por ley federal (CPSIA §19), los artículos retirados no pueden revenderse en Villie. Detalles: ${RU}. Esto no afecta tu cuenta.`;
    }
    return `We've withdrawn your listing because the item matches an active CPSC recall (${RN}). Recalled items can't be resold on Villie under federal law (CPSIA §19). Details: ${RU}. This isn't a strike on your account.`;
  }

  if (template === 'withdrawal') {
    const r = reasonShort ? REASON_LABEL[reasonShort] : { en: 'a moderator review', es: 'la revisión de un moderador' };
    if (locale === 'es') {
      return `Retiramos tu anuncio tras la revisión de un moderador. Razón: ${r.es}. El Adendo del Intercambio de Artículos (en tu cuenta → Cuenta y seguridad) explica las categorías no permitidas y los estándares que seguimos. Puedes publicar otros artículos cuando quieras.`;
    }
    return `We've withdrawn your listing after a moderator review. Reason: ${r.en}. Our Gear Marketplace Addendum (in your account → Account & security) explains the categories we don't allow and the listing standards we follow. You can list other items at any time.`;
  }

  // suspension
  if (locale === 'es') {
    return `Tu cuenta de vendedor en Villie está en pausa mientras revisamos un reporte. Responde a este mensaje con comprobante de compra (recibo, foto del empaque original, o captura del anuncio original) de los artículos que publicaste. Restauraremos tu cuenta dentro de 3 días hábiles después de recibir la documentación.`;
  }
  return `Your Villie seller account is paused while we look into a report. Reply to this message with proof of purchase (receipt, original packaging photo, or original listing screenshot) for the items you've listed. We'll restore your account within 3 business days of receiving documentation.`;
}

// JWT-decode based auth. See gear-moderation-pager for the rationale —
// strict-equality against SERVICE_ROLE_KEY was brittle to key rotation +
// whitespace in the GH Action repo secret. verify_jwt: true at the gateway
// validates signature; this function just confirms role=service_role.
function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const token = match[1].trim();
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return false;
    const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const payload = JSON.parse(atob(padded));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (!isServiceRoleRequest(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body: Body;
  try { body = await req.json() as Body; }
  catch { return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }); }

  if (!body.listing_id || !body.template || !body.actor_user_id) {
    return new Response(JSON.stringify({ error: 'listing_id, template, and actor_user_id required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  if (!['recall', 'withdrawal', 'suspension'].includes(body.template)) {
    return new Response(JSON.stringify({ error: 'invalid template' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  if (body.template === 'withdrawal' && !body.reason_short) {
    return new Response(JSON.stringify({ error: 'reason_short required for withdrawal template' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up the seller and resolve their preferred language.
  const { data: listing } = await supabase
    .from('gear_listings')
    .select('seller_id, title')
    .eq('id', body.listing_id)
    .maybeSingle();
  if (!listing) {
    return new Response(JSON.stringify({ error: 'listing not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let locale: Locale = body.locale ?? 'en';
  if (!body.locale) {
    const { data: seller } = await supabase
      .from('users')
      .select('preferred_language')
      .eq('id', listing.seller_id)
      .maybeSingle();
    if (seller?.preferred_language === 'es') locale = 'es';
  }

  const messageBody = renderTemplate({
    template: body.template,
    locale,
    reasonShort: body.reason_short,
    recallNumber: body.recall_number,
    recallUrl: body.recall_url,
  });

  // Find the seller's earliest message thread for this listing (matches what
  // the auto-withdraw RPC does — the first buyer who messaged them is the
  // seller's "primary" thread for the listing). If the seller hasn't received
  // any messages, message delivery is skipped; the audit-log row still lands.
  const { data: thread } = await supabase
    .from('gear_message_threads')
    .select('id')
    .eq('listing_id', body.listing_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  let messageId: string | null = null;
  if (thread) {
    const { data: msg, error: msgErr } = await supabase
      .from('gear_messages')
      .insert({
        thread_id: thread.id,
        sender_id: null,           // system message
        body: messageBody,
        message_type: 'system',
      })
      .select('id')
      .single();
    if (msgErr) {
      console.error('[gear-takedown-template-dispatch] insert message failed', msgErr);
      return new Response(JSON.stringify({ error: 'message_insert_failed', detail: msgErr.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    messageId = msg.id;
  }

  // Audit log entry — chain of custody for the FDUTPA / counsel review.
  await supabase.from('admin_audit_log').insert({
    action: 'gear_takedown_template_dispatched',
    target_table: 'gear_messages',
    target_id: messageId ?? body.listing_id,  // listing_id when no thread existed
    performed_by: body.actor_user_id,
    metadata: {
      template: body.template,
      reason_short: body.reason_short ?? null,
      recall_number: body.recall_number ?? null,
      listing_id: body.listing_id,
      seller_user_id: listing.seller_id,
      thread_id: thread?.id ?? null,
      locale,
      had_thread: !!thread,
      report_id: body.report_id ?? null,
    },
  });

  return new Response(JSON.stringify({
    ok: true,
    message_id: messageId,
    thread_id: thread?.id ?? null,
    locale,
    had_thread: !!thread,
  }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
});
