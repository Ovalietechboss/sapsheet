// Edge Function Supabase : envoi d'une facture par email via Resend.
//
// Déploiement (voir GUIDE-EMAIL-RESEND.md) :
//   supabase functions deploy send-invoice
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set INVOICE_FROM_EMAIL="Cathy <facture@ton-domaine.fr>"
//
// Le client appelle : supabase.functions.invoke('send-invoice', { body: {...} })
// Body attendu : { to, cc?, subject, message, pdfBase64, filename }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
// FROM doit utiliser un domaine vérifié dans Resend ; à défaut, l'adresse de test onboarding@resend.dev.
const FROM = Deno.env.get('INVOICE_FROM_EMAIL') || 'DomiTemps <onboarding@resend.dev>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) {
      return json({ error: 'RESEND_API_KEY non configurée (supabase secrets set).' }, 500);
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
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
