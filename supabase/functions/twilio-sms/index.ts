// Edge Function: twilio-sms
// Internal helper — called by appointment-reminder to send SMS via Twilio REST API
// POST /functions/v1/twilio-sms
// Body: { to: string, body: string }
// This is service-role only — not called from mobile directly

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
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
