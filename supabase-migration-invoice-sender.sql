-- ============================================================================
-- FAC-15 — Expéditeur email PAR UTILISATEUR (adresse d'envoi des factures)
-- ============================================================================
--
-- POURQUOI
-- L'Edge Function `send-invoice` envoie tous les emails depuis UNE adresse
-- unique, portée par le secret global INVOICE_FROM_EMAIL
-- (« Bigorre Aide <facture@bigorre-aide.fr> », domaine de la première
-- utilisatrice). Dès le deuxième professionnel, ses factures et relevés
-- partent sous l'identité commerciale de quelqu'un d'autre.
--
-- La fuite de données, elle, est déjà bouchée (2026-09-03) : la copie
-- d'archive et les réponses vont à l'expéditeur. Il ne reste que l'adresse
-- visible — c'est l'objet de cette colonne.
--
-- CE QUE LA COLONNE CONTIENT
-- L'adresse d'expédition propre au professionnel, par exemple
-- `facture@bigorre-aide.fr`. Une seule contrainte, mais elle est dure :
-- le domaine DOIT être vérifié dans le compte Resend (DKIM/SPF/DMARC), sinon
-- Resend refuse l'envoi. Une adresse Gmail ou Orange ne peut donc PAS servir
-- d'expéditeur.
--
-- Laissée VIDE (cas normal d'un professionnel sans domaine à lui) : l'envoi
-- repart sur l'adresse du secret global, mais avec SON nom affiché et ses
-- réponses — voir `buildFrom` dans l'Edge Function.
--
-- Le nom affiché n'a pas besoin d'une colonne : il est déjà déduit de
-- `business_name`, sinon de `first_name` + `display_name`, exactement comme
-- la signature des emails et le bloc « Votre contact » des PDF.
--
-- ORDRE D'APPLICATION — IMPÉRATIF
-- 1. cette migration
-- 2. renseigner `invoice_from_email` ET `business_name` de l'utilisatrice
--    historique (sinon ses clients verraient son nom là où ils lisaient
--    « Bigorre Aide » : le comportement doit rester identique pour elle)
-- 3. redéployer l'Edge Function
-- 4. déployer le front
--
-- Additive et nullable : le code déjà en production ne lit pas cette colonne
-- et continue de fonctionner à l'identique entre l'étape 1 et l'étape 3.
--
-- Rollback en bas de fichier.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS invoice_from_email text;

COMMENT ON COLUMN public.users.invoice_from_email IS
  'FAC-15 — adresse d''expédition des emails (factures, relevés). Le domaine doit être vérifié dans Resend. NULL = repli sur le secret INVOICE_FROM_EMAIL, avec le nom de ce professionnel.';

-- Garde-fou de forme : une adresse plausible, sans espace ni chevron, ou rien.
-- Les chevrons et les sauts de ligne sont refusés ici ET neutralisés dans
-- l'Edge Function : cette valeur finit dans l'en-tête `from` d'un email.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_invoice_from_email_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_invoice_from_email_check CHECK (
    invoice_from_email IS NULL
    OR invoice_from_email ~ '^[^\s<>",;@]+@[^\s<>",;@]+\.[A-Za-z]{2,}$'
  );

-- ── Vérification (doit renvoyer une ligne) ──────────────────────────────────
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'users'
--    AND column_name = 'invoice_from_email';

-- ── Étape 2 : l'utilisatrice historique garde EXACTEMENT son expéditeur ─────
-- À exécuter avant le redéploiement de l'Edge Function, en remplaçant
-- l'adresse de connexion par la bonne :
--
-- UPDATE public.users
--    SET invoice_from_email = 'facture@bigorre-aide.fr',
--        business_name = COALESCE(NULLIF(business_name, ''), 'Bigorre Aide')
--  WHERE email = '<email de connexion de la professionnelle>';

-- ── ROLLBACK ────────────────────────────────────────────────────────────────
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_invoice_from_email_check;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS invoice_from_email;
