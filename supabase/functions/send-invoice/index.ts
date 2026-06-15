// Edge Function Supabase : envoi d'une facture par email via Resend.
//
// Déploiement en ligne (dashboard) : Edge Functions → Create function → coller ce code → Deploy.
// Secrets à définir (Edge Functions → Secrets) :
//   RESEND_API_KEY      = re_xxx
//   INVOICE_FROM_EMAIL  = "Bigorre Aide <facture@bigorre-aide.fr>"
//
// Le client appelle : supabase.functions.invoke('send-invoice', { body: {...} })
// Body attendu : { to, cc?, subject, message, pdfBase64, filename }

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('INVOICE_FROM_EMAIL') || 'DomiTemps <onboarding@resend.dev>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) {
      return json({ error: 'RESEND_API_KEY non configurée (Edge Functions → Secrets).' }, 500);
    }
    const { to, cc, subject, message, pdfBase64, filename } = await req.json();
    if (!to || !pdfBase64) {
      return json({ error: 'Champs requis manquants (to, pdfBase64).' }, 400);
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        cc: Array.isArray(cc) && cc.length ? cc : undefined,
        subject: subject || 'Votre facture',
        html: (message || 'Veuillez trouver votre facture en pièce jointe.').replace(/\n/g, '<br/>'),
        attachments: [{ filename: filename || 'facture.pdf', content: pdfBase64 }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return json({ error: data?.message || 'Échec Resend', detail: data }, res.status);
    }
    return json({ ok: true, id: data?.id });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
