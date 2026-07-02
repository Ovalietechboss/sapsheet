# FAC-07 — Envoi des factures par email (Resend + Edge Function)

Le code est en place (bouton **✉️ Envoyer** dans l'onglet Factures + Edge Function
`supabase/functions/send-invoice`). Le bouton reste **inactif tant que la fonction
n'est pas déployée et la clé Resend configurée**. Étapes (~15 min, une seule fois).

## 1. Compte Resend
1. Créer un compte sur https://resend.com (offre gratuite ~3 000 mails/mois).
2. **Vérifier un domaine** (Settings → Domains) pour envoyer depuis `facture@ton-domaine.fr`.
   - Sans domaine, on peut tester avec l'adresse `onboarding@resend.dev` (envois limités, destinataire = ta propre adresse Resend).
3. **API Keys → Create API Key** → copier la clé `re_...`.

## 2. Supabase CLI (nouveau dans le flux — jusqu'ici tout était en SQL Editor)
```bash
npm install -g supabase            # ou scoop/brew
supabase login                     # ouvre le navigateur
supabase link --project-ref <REF>  # REF = ID du projet (dashboard Supabase → Settings → General)
```

## 3. Déployer la fonction + secrets
```bash
# depuis le dossier du projet (sapsheet-main\sapsheet-main)
supabase functions deploy send-invoice

supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set INVOICE_FROM_EMAIL="Cathy <facture@ton-domaine.fr>"
# (si pas de domaine vérifié, mettre : "DomiTemps <onboarding@resend.dev>")

# Copie (BCC) archivée de chaque facture/avoir envoyé — optionnel mais recommandé.
supabase secrets set INVOICE_BCC_EMAIL=copie@exemple.fr
```

## 4. Migration SQL (suivi de l'envoi)
Dans Supabase → SQL Editor (avec backup) :
```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at BIGINT;
```

## 5. Test
1. Redéployer le front (Vercel) si besoin.
2. Onglet **Factures** → une facture → **✉️ Envoyer** → confirmer le destinataire.
3. Vérifier la réception (et les logs : `supabase functions logs send-invoice`).

## Notes
- Le PDF est généré **côté client** (comme le bouton PDF) puis envoyé en pièce jointe à la fonction, qui le relaie à Resend. La fonction ne rend pas le PDF elle-même.
- Destinataire = email du client (à défaut, 1er contact) ; les autres contacts sont mis en copie (cc).
- **Copie d'archive** : si le secret `INVOICE_BCC_EMAIL` est défini, chaque envoi dépose une copie **cachée (BCC)** dans cette boîte — même corps + même PDF. Le client ne la voit pas. Vide = pas de copie.
- À l'envoi : `sent_at` est horodaté et le statut passe `brouillon → envoyée` (une facture déjà payée garde son statut).
- Sécurité : ne jamais committer la clé `re_...` (elle vit uniquement dans les secrets Supabase).
