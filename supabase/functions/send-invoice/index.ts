// Edge Function Supabase : envoi d'une facture ou d'un relevé par email via Resend.
//
// Déploiement en ligne (dashboard) : Edge Functions → send-invoice → coller ce
// code → Deploy. Le fichier reste volontairement AUTONOME (un seul fichier,
// aucun import) pour rester collable tel quel dans l'éditeur du dashboard.
//
// Secrets à définir (Edge Functions → Secrets) :
//   RESEND_API_KEY      = re_xxx
//   INVOICE_FROM_EMAIL  = "Bigorre Aide <facture@bigorre-aide.fr>"
//                         → sert désormais de REPLI : adresse utilisée pour un
//                           professionnel qui n'a pas de domaine à lui.
//
// ⚠️ INVOICE_BCC_EMAIL N'EST PLUS UTILISE — le secret peut etre supprime.
//    C'etait une adresse UNIQUE, appliquee en copie cachee a chaque envoi de
//    CHAQUE utilisateur. Tant qu'il n'y en avait qu'une, elle archivait ses
//    propres documents. Des le deuxieme, les releves de ses clients a lui
//    seraient tombes dans la boite de quelqu'un d'autre — avec le PDF, donc le
//    nom, les heures et les montants de personnes accompagnees a domicile.
//    La copie d'archive part desormais chez l'expediteur lui-meme.
//
// Le client appelle : supabase.functions.invoke('send-invoice', { body: {...} })
// Body attendu : { to, cc?, bcc?, subject, message, pdfBase64, filename, replyTo? }
//
// ─── FAC-15 : QUI EXPÉDIE, ET POURQUOI C'EST RÉSOLU ICI ─────────────────────
//
// L'adresse d'expédition et l'adresse de réponse sont déterminées PAR LE
// SERVEUR, à partir du jeton de l'appelant. Elles ne sont JAMAIS prises dans
// le corps de la requête.
//
// Ce n'est pas un détail d'implémentation, c'est la condition de sûreté : cette
// fonction est joignable avec la clé publique embarquée dans le bundle web
// (vérifié le 2026-10-08 : sans en-tête `Authorization` → 401, avec la clé
// publique → le code est atteint). Si `from` venait du corps de la requête,
// n'importe qui pourrait émettre un email depuis n'importe quel domaine
// vérifié du compte Resend — donc de fausses factures signées DKIM sous
// l'identité d'un professionnel. Résolu côté serveur, ce n'est pas possible.
//
// Conséquence voulue : un appel qui ne porte PAS la session d'un professionnel
// (clé publique seule) est refusé, alors qu'il aboutissait avant.
//
// `replyTo` reçu dans le corps n'est plus qu'un repli, pour rester compatible
// avec les téléphones restés en 1.3.x. L'inverse est vrai aussi : un client
// ancien qui n'envoie rien du tout fonctionne, puisque le serveur sait.
//
// Deux cas, un seul code (voir `buildFrom`) :
//   • le professionnel a `invoice_from_email` (domaine vérifié chez Resend)
//     → on expédie depuis SON adresse, sous son nom ;
//   • il ne l'a pas (cas d'une simple adresse Gmail ou Orange, que Resend
//     refuse comme expéditeur) → on garde l'adresse du secret de repli, mais
//     sous SON nom, avec SES réponses et SA copie d'archive.
// ────────────────────────────────────────────────────────────────────────────

/** Lecture d'un secret. Tolère l'absence de Deno (environnement de test). */
function env(name: string): string | undefined {
  // @ts-ignore — `Deno` n'existe pas sous Jest.
  if (typeof Deno !== 'undefined') return Deno.env.get(name);
  return typeof process !== 'undefined' ? process.env?.[name] : undefined;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Nettoie un nom destiné à l'en-tête `from`.
 *
 * Cette valeur vient de la base (donc de la saisie d'un utilisateur) et finit
 * dans l'en-tête d'un email : on retire ce qui pourrait en casser la structure
 * — chevrons, guillemets, virgules, points-virgules, sauts de ligne — plutôt
 * que d'échapper, parce qu'aucun de ces caractères n'a de sens dans un nom
 * commercial.
 */
export function sanitizeSenderName(raw: string | undefined | null): string {
  return String(raw ?? '')
    .replace(/[<>"',;\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 78);
}

/** Extrait l'adresse d'un `from` complet : « Nom <a@b.fr> » → « a@b.fr ». */
export function extractAddress(from: string): string {
  const m = /<([^>]+)>/.exec(from || '');
  return (m ? m[1] : from || '').trim();
}

/**
 * Compose l'en-tête `from`.
 *
 * `fallbackFrom` est renvoyé INCHANGÉ quand on n'a aucun nom à poser : le
 * comportement d'avant FAC-15 est alors reproduit à l'identique, ce qui évite
 * de changer silencieusement ce que lisent les clients d'un professionnel
 * déjà en service.
 */
export function buildFrom(
  identity: { name?: string | null; email?: string | null },
  fallbackFrom: string,
): string {
  const name = sanitizeSenderName(identity.name);
  const own = String(identity.email ?? '').trim();

  if (own) return name ? `${name} <${own}>` : own;
  if (!name) return fallbackFrom;
  return `${name} <${extractAddress(fallbackFrom)}>`;
}

/**
 * Identité de l'appelant, lue côté serveur.
 *
 * Le profil est lu AVEC le jeton de l'appelant : la RLS ne lui rend que sa
 * propre ligne, et aucune clé `service_role` n'a besoin d'entrer ici.
 *
 * Renvoie `null` si le jeton ne désigne pas un professionnel connecté (clé
 * publique seule, session expirée).
 */
async function resolveCaller(authHeader: string, apiKey: string, supabaseUrl: string) {
  // La passerelle REFUSE un appel sans en-tête `apikey` (vérifié : 401 « No API
  // key found »). On réutilise celle de l'appelant, que supabase-js envoie
  // toujours, et on ne se repose sur la variable d'environnement qu'en repli :
  // ainsi une rotation de clé côté projet ne casse pas l'envoi d'emails.
  const headers = { Authorization: authHeader, apikey: apiKey };

  const whoRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
  if (!whoRes.ok) return null;
  const who = await whoRes.json();
  if (!who?.id) return null;

  let profile: Record<string, unknown> | undefined;
  const cols = 'email,invoice_from_email,business_name,first_name,display_name';
  const profRes = await fetch(
    `${supabaseUrl}/rest/v1/users?select=${cols}&auth_id=eq.${encodeURIComponent(who.id)}&limit=1`,
    { headers },
  );
  if (profRes.ok) {
    const rows = await profRes.json();
    if (Array.isArray(rows)) profile = rows[0];
  }

  const name =
    (profile?.business_name as string) ||
    [profile?.first_name, profile?.display_name].filter(Boolean).join(' ');

  return {
    // L'adresse de CONTACT du profil, pas celle du compte de connexion : c'est
    // elle qui est imprimée sur les factures et les relevés, et elle est
    // modifiable au profil. Une réponse doit arriver là où le document dit
    // d'écrire. L'email de connexion ne sert que de filet.
    email: (profile?.email as string | undefined) || (who.email as string | undefined),
    name,
    fromEmail: profile?.invoice_from_email as string | undefined,
  };
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const RESEND_API_KEY = env('RESEND_API_KEY');
    const FALLBACK_FROM = env('INVOICE_FROM_EMAIL') || 'DomiTemps <onboarding@resend.dev>';
    const SUPABASE_URL = env('SUPABASE_URL') || '';
    const ANON_KEY = env('SUPABASE_ANON_KEY') || '';

    // L'expéditeur se déduit de l'appelant, donc l'appelant doit être connu.
    // Ce contrôle passe AVANT tout le reste : un appel anonyme n'apprend rien
    // de l'état de la configuration.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Envoi réservé à un professionnel connecté (session absente).' }, 401);
    }
    const apiKey = req.headers.get('apikey') || ANON_KEY;
    const caller = await resolveCaller(authHeader, apiKey, SUPABASE_URL);
    if (!caller) {
      return json({ error: 'Session invalide ou expirée : reconnectez-vous puis réessayez.' }, 401);
    }

    if (!RESEND_API_KEY) {
      return json({ error: 'RESEND_API_KEY non configurée (Edge Functions → Secrets).' }, 500);
    }

    const { to, cc, bcc, subject, message, pdfBase64, filename, replyTo } = await req.json();
    if (!to || !pdfBase64) {
      return json({ error: 'Champs requis manquants (to, pdfBase64).' }, 400);
    }

    const from = buildFrom({ name: caller.name, email: caller.fromEmail }, FALLBACK_FROM);
    // L'adresse de réponse est celle du compte, pas celle annoncée par le client.
    const replyAddress = caller.email || replyTo || undefined;

    // Copie d'archive : l'EXPEDITEUR lui-meme, plus un eventuel bcc passe dans
    // le body. Chacun archive ses propres envois et rien que les siens.
    const bccList = [...new Set([
      ...(replyAddress ? [replyAddress] : []),
      ...(Array.isArray(bcc) ? bcc : bcc ? [bcc] : []),
    ])].filter((a) => a !== to);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        cc: Array.isArray(cc) && cc.length ? cc : undefined,
        bcc: bccList.length ? bccList : undefined,
        reply_to: replyAddress,
        subject: subject || 'Votre facture',
        html: (message || 'Veuillez trouver votre facture en pièce jointe.').replace(/\n/g, '<br/>'),
        attachments: [{ filename: filename || 'facture.pdf', content: pdfBase64 }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      // Resend refuse un `from` dont le domaine n'est pas vérifié : c'est le
      // cas d'un `invoice_from_email` saisi au profil sans avoir fait vérifier
      // le domaine. Le message le dit, sinon le diagnostic est introuvable.
      return json({ error: data?.message || 'Échec Resend', from, detail: data }, res.status);
    }
    return json({ ok: true, id: data?.id, from });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// @ts-ignore — absent sous Jest, qui importe ce fichier pour tester les
// fonctions pures et le refus d'une requête sans session.
if (typeof Deno !== 'undefined') Deno.serve(handler);
