// Edge Function Supabase : envoi d'une facture par email via Resend.
//
// Déploiement en ligne (dashboard) : Edge Functions → Create function → coller ce code → Deploy.
// Secrets à définir (Edge Functions → Secrets) :
//   RESEND_API_KEY      = re_xxx
//   INVOICE_FROM_EMAIL  = "Bigorre Aide <facture@bigorre-aide.fr>"
//   INVOICE_BCC_EMAIL   = adresse recevant une copie (BCC) de chaque envoi — archive. Optionnel.
//
// Le client appelle : supabase.functions.invoke('send-invoice', { body: {...} })
// Body attendu : { to, cc?, bcc?, subject, message, pdfBase64, filename, replyTo? }
//
// `replyTo` = adresse du professionnel qui envoie. SANS elle, les reponses des
// mandataires partent vers l'adresse d'expedition du domaine — qui n'a pas
// forcement d'alias, auquel cas elles disparaissent sans que personne ne le
// sache (constate le 2026-09-03 : aucun alias `facture` cote ImprovMX). Avec
// elle, la reponse arrive directement chez la bonne personne, ce qui est la
// seule logique tenable des qu'il y a plusieurs utilisateurs.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('INVOICE_FROM_EMAIL') || 'DomiTemps <onboarding@resend.dev>';
// Copie cachée systématique (archive de tous les envois). Vide = pas de copie.
const BCC = Deno.env.get('INVOICE_BCC_EMAIL');

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
    const { to, cc, bcc, subject, message, pdfBase64, filename, replyTo } = await req.json();
    if (!to || !pdfBase64) {
      return json({ error: 'Champs requis manquants (to, pdfBase64).' }, 400);
    }

    // BCC = copie d'archive du secret + éventuel bcc passé dans le body, dédupliqués.
    const bccList = [...new Set([
      ...(BCC ? [BCC] : []),
      ...(Array.isArray(bcc) ? bcc : bcc ? [bcc] : []),
    ])];

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
        bcc: bccList.length ? bccList : undefined,
        reply_to: replyTo || undefined,
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
