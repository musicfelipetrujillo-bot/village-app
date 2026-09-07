// Edge Function: twilio-sms
// Internal helper — sends SMS via the Twilio REST API on behalf of other edge functions.
// POST /functions/v1/twilio-sms
// Body: { to: string, body: string }
//
// SERVICE-ROLE ONLY — and as of 2026-09-04 that is ENFORCED, not just documented.
//
// Until now the header below said "service-role only" while the handler performed no
// authorization whatsoever. `verify_jwt = true` in config.toml is NOT a substitute: the
// gateway only proves the bearer is signed by this project's JWT secret, and the anon
// publishable key is exactly such a token — it ships inside the mobile bundle and on the
// marketing site. So any user who pulled the anon key out of the app could POST here and
// send arbitrary SMS from Villie's Twilio number: toll fraud, plus smishing that arrives
// from the number our postpartum users are told to trust.
//
// `isServiceRoleRequest` closes exactly that gap — an anon token carries `role: "anon"`,
// so it fails the claim check and never reaches Twilio.
//
// gatewayVerifiesJwt: true matches `[functions.twilio-sms] verify_jwt = true` in
// supabase/config.toml. If that pin is ever changed, this argument MUST change with it.
//
// Callers (all verified to send SUPABASE_SERVICE_ROLE_KEY as the bearer):
//   room-message-scan:143 (moderator crisis alerts) · milk-safety-screener:164
//   admin-approve-specialist:82

import { isServiceRoleRequest } from '../_shared/service-role.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (!isServiceRoleRequest(req, { gatewayVerifiesJwt: true })) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { to, body } = await req.json();
    if (!to || !body) {
      return new Response(JSON.stringify({ error: 'to and body required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const from = Deno.env.get('TWILIO_PHONE_NUMBER')!;

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      },
    );

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message ?? 'Twilio error');
    }

    return new Response(JSON.stringify({ sid: data.sid, status: data.status }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
