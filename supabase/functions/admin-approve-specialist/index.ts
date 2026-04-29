// Edge Function: admin-approve-specialist
// POST /functions/v1/admin-approve-specialist
// Body: { specialist_id: string, action: 'approve' | 'reject', reason?: string }
// Auth: Must be service role key (admin-only — never called from mobile)
// Sets specialist.admin_approved + notifies via Twilio SMS

import { createClient } from 'npm:@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  // Only accept service role key — no anon or user JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { specialist_id, action, reason } = await req.json();

    if (!specialist_id || !['approve', 'reject'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'specialist_id and action (approve|reject) required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch specialist + linked user phone
    const { data: specialist, error } = await supabase
      .from('specialists')
      .select('full_name, npi_number, npi_verified, user_id, users(phone, preferred_language)')
      .eq('id', specialist_id)
      .single();

    if (error || !specialist) {
      return new Response(JSON.stringify({ error: 'Specialist not found' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const approved = action === 'approve';

    // Update specialist record
    await supabase
      .from('specialists')
      .update({
        admin_approved: approved,
        admin_approved_at: new Date().toISOString(),
        admin_rejection_reason: approved ? null : (reason ?? 'Did not meet requirements'),
      })
      .eq('id', specialist_id);

    // Send Twilio SMS notification to specialist if they have a phone
    const phone = (specialist as any).users?.phone;
    if (phone) {
      const lang = (specialist as any).users?.preferred_language ?? 'en';
      const smsBody = approved
        ? (lang === 'es'
          ? `¡Hola ${specialist.full_name}! Tu perfil en The Village ha sido aprobado. Ya puedes recibir pacientes. 🌿 - The Village`
          : `Hi ${specialist.full_name}! Your Village profile has been approved. You can now receive patients. 🌿 - The Village`)
        : (lang === 'es'
          ? `Hola ${specialist.full_name}, tu perfil en The Village requiere revisión adicional. ${reason ? `Motivo: ${reason}` : ''} Contáctanos para más información.`
          : `Hi ${specialist.full_name}, your Village profile needs further review. ${reason ? `Reason: ${reason}` : ''} Please contact us for details.`);

      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ to: phone, body: smsBody }),
      });
    }

    return new Response(
      JSON.stringify({ success: true, specialist_id, action }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
