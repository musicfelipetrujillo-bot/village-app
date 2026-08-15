// Edge Function: specialist-invite-accept
// POST /functions/v1/specialist-invite-accept
//
// Public endpoint — no auth required. The invite TOKEN is the auth.
// Called by the static onboarding web page after the specialist fills the
// signup form.
//
// Flow:
//   1. Validate the invite token (alive, unused, unrevoked, unexpired).
//   2. Create the auth.users row via admin.createUser (email_confirm=true
//      since the invite link IS the email verification).
//   3. The on_auth_user_created trigger (migration 044) mirrors a public.users
//      row automatically — we do NOT insert into public.users here.
//   4. Insert into `specialists` with admin_approved=true, accepting_patients=true,
//      user_id pointing at the new auth user.
//   5. Insert side-table rows for languages/insurances if provided.
//   6. Mark the invite used_at + used_specialist_id.
//   7. Return the specialist_id + email so the web page can call
//      signInWithPassword({ email, password }) on its own to land the user
//      in a signed-in confirmation screen.
//
// Body (JSON):
//   {
//     token:          string                 // required
//     password:       string                 // required, min 8 chars
//     full_name:      string                 // required
//     credentials:    string                 // required (e.g. "MD", "IBCLC")
//     specialty:      SpecialtyType          // required (allowlist)
//     npi_number?:    string                 // optional but strongly encouraged
//     bio?:           string                 // optional, ≤2000 chars
//     photo_url?:     string                 // optional (uploaded separately to Storage)
//     phone?:         string                 // optional, kept on auth.users
//     languages?:     string[]               // optional ISO codes ['en', 'es']
//   }
//
// Returns (200):
//   { specialist_id, user_id, email }
//
// Errors:
//   400 — missing/invalid body
//   404 — token invalid / expired / used / revoked
//   409 — email collision (auth.users already exists somehow)
//   500 — DB or auth failure (best-effort rollback attempted)

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_SPECIALTIES = new Set([
  'ob_gyn', 'midwife', 'doula', 'lactation_consultant', 'pediatrician',
  'sleep_coach', 'pelvic_floor_pt', 'perinatal_dietitian', 'ppd_therapist',
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // ─── Parse + validate body ─────────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const token       = String(body.token ?? '').trim();
  const password    = String(body.password ?? '');
  const fullName    = String(body.full_name ?? '').trim();
  const credentials = String(body.credentials ?? '').trim();
  const specialty   = String(body.specialty ?? '').trim();
  const npiNumber   = body.npi_number?.trim() || null;
  const bio         = body.bio?.trim() || null;
  const photoUrl    = body.photo_url?.trim() || null;
  const phone       = body.phone?.trim() || null;
  const languages   = Array.isArray(body.languages) ? body.languages : [];

  if (!token || token.length < 32) {
    return json({ error: 'token is required' }, 400);
  }
  if (password.length < 8) {
    return json({ error: 'password must be at least 8 characters' }, 400);
  }
  if (!fullName) {
    return json({ error: 'full_name is required' }, 400);
  }
  if (!credentials) {
    return json({ error: 'credentials is required' }, 400);
  }
  if (!specialty || !ALLOWED_SPECIALTIES.has(specialty)) {
    return json({
      error: `specialty is required and must be one of: ${[...ALLOWED_SPECIALTIES].join(', ')}`,
    }, 400);
  }
  if (bio && bio.length > 2000) {
    return json({ error: 'bio max 2000 chars' }, 400);
  }

  // ─── Claim the invite ATOMICALLY ────────────────────────────────────
  // SECURITY (appsec H-3 / M-1): this used to SELECT the row, check
  // `used_at IS NULL` in JS, then do all the work, and only mark the invite
  // used at the very END — with the mark-used being non-fatal on failure. Two
  // concurrent requests carrying the same token both passed the SELECT, so one
  // invite could onboard two accounts; and any failure of the final UPDATE left
  // a live, replayable invite behind.
  //
  // Now the claim IS the check: a single conditional UPDATE. Postgres locks the
  // row for the duration, so exactly one concurrent caller can flip used_at from
  // NULL — everyone else gets zero rows back and is rejected. Nothing downstream
  // runs until we hold the claim.
  const nowIso = new Date().toISOString();
  const { data: invite, error: claimErr } = await supabase
    .from('specialist_invites')
    .update({ used_at: nowIso })
    .eq('token', token)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .select('id, email')
    .maybeSingle();

  if (claimErr) {
    console.error('specialist-invite-accept invite claim error', claimErr);
    return json({ error: 'Lookup failed' }, 500);
  }

  if (!invite) {
    // The claim matched nothing. Re-read (without the liveness filters) purely
    // to return the accurate reason — this read is diagnostic only and never
    // grants access.
    const { data: diag } = await supabase
      .from('specialist_invites')
      .select('used_at, revoked_at, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (!diag) return json({ error: 'Invite not found' }, 404);
    if (diag.revoked_at) return json({ error: 'Invite has been revoked' }, 404);
    if (diag.used_at) return json({ error: 'Invite has already been used' }, 409);
    if (new Date(diag.expires_at) <= new Date()) {
      return json({ error: 'Invite has expired' }, 404);
    }
    return json({ error: 'Invite is no longer available' }, 409);
  }

  const email = invite.email.toLowerCase();

  // We now hold the claim. If onboarding fails below, hand the invite back so a
  // transient error (email collision, DB hiccup) doesn't permanently burn the
  // recipient's only link. Best-effort: a failed release is logged, and the
  // worst case is an invite the admin has to reissue — never a reusable one.
  const releaseClaim = async (reason: string) => {
    const { error } = await supabase
      .from('specialist_invites')
      .update({ used_at: null })
      .eq('id', invite.id);
    if (error) {
      console.error(`specialist-invite-accept release-claim failed (${reason})`, error);
    }
  };

  // ─── Create auth.users (and via trigger, public.users) ──────────────
  // email_confirm=true: the invite link IS the email verification — the
  // recipient already proved they own the inbox by clicking through.
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    phone: phone ?? undefined,
    user_metadata: {
      full_name: fullName,
      role: 'specialist',
    },
  });

  if (createErr || !created?.user) {
    console.error('specialist-invite-accept createUser error', createErr);
    // Likely email collision (someone signed up with the same email between
    // invite issuance and acceptance). Surface a 409 so the web page can
    // route them to sign-in instead.
    const msg = createErr?.message ?? 'Failed to create account';
    const status = /already (registered|exists)/i.test(msg) ? 409 : 500;
    await releaseClaim('createUser failed');
    return json({ error: msg }, status);
  }

  const userId = created.user.id;

  // ─── Insert the specialists row ─────────────────────────────────────
  // admin_approved=true and accepting_patients=true per the project memory:
  // the invite is the trust signal, so we go live on completion.
  const { data: specialist, error: specialistErr } = await supabase
    .from('specialists')
    .insert({
      user_id:               userId,
      full_name:             fullName,
      credentials,
      specialty,
      npi_number:            npiNumber,        // nullable per migration 061
      npi_verified:          false,            // verification is a separate async step
      bio,
      photo_url:             photoUrl,
      admin_approved:        true,
      admin_approved_at:     new Date().toISOString(),
      accepting_patients:    true,
      telehealth_available:  false,
    })
    .select('id')
    .single();

  if (specialistErr || !specialist) {
    console.error('specialist-invite-accept specialists insert error', specialistErr);
    // Best-effort rollback of the auth user so a partial state doesn't
    // strand the invite. Swallow rollback errors — they're logged only.
    await supabase.auth.admin.deleteUser(userId).catch((e) =>
      console.error('rollback deleteUser failed', e)
    );
    await releaseClaim('specialists insert failed');
    return json({
      error: specialistErr?.message ?? 'Failed to create specialist profile',
    }, 500);
  }

  // ─── Optional: specialist_languages rows ────────────────────────────
  // Side-table inserts are best-effort — a language insert failure
  // doesn't unwind the whole onboarding. The specialist can edit
  // languages from their profile later.
  if (languages.length > 0) {
    const langRows = languages
      .filter((l: unknown): l is string => typeof l === 'string' && l.length > 0 && l.length <= 8)
      .map((language_code: string) => ({
        specialist_id: specialist.id,
        language_code: language_code.toLowerCase(),
      }));
    if (langRows.length > 0) {
      const { error: langErr } = await supabase
        .from('specialist_languages')
        .insert(langRows);
      if (langErr) console.error('specialist-invite-accept languages insert error', langErr);
    }
  }

  // ─── Link the invite to the specialist it created ───────────────────
  // `used_at` was already set by the atomic claim above, so the invite is
  // ALREADY unusable at this point — this write only records which specialist
  // consumed it. A failure here is therefore cosmetic (an unlinked audit
  // trail), not a security problem the way the old end-of-flow mark-used was.
  const { error: linkErr } = await supabase
    .from('specialist_invites')
    .update({ used_specialist_id: specialist.id })
    .eq('id', invite.id);

  if (linkErr) {
    console.error('specialist-invite-accept link-specialist error', linkErr);
  }

  return json({
    specialist_id: specialist.id,
    user_id:       userId,
    email,
  });
});
