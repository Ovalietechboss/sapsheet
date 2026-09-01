-- =====================================================================
-- Canal de transmission d'un document : email ou remise en main propre
--
-- ⚠️  À EXÉCUTER MANUELLEMENT dans le SQL Editor de Supabase, APRÈS backup.
-- ⚠️  ET AVANT DE DÉPLOYER LE CODE qui l'accompagne : l'application écrira
--     `sent_channel`, et PostgREST rejette toute écriture sur une colonne
--     inexistante. Migration d'abord, déploiement ensuite.
--
-- POURQUOI
-- Le suivi ne savait reconnaître qu'un envoi par email. Les documents que
-- Cathy remet en main propre restaient éternellement « Généré », sans aucun
-- moyen de rectifier — constaté le 2026-09-01 sur trois de ses clients.
--
-- Deux tables sont concernées, car les deux modes stockent leur suivi à des
-- endroits différents (c'est voulu) :
--   - relevés CESU     -> billing_period_clients
--   - factures classiques -> invoices
--
-- Cette migration est ADDITIVE : elle n'ajoute que des colonnes nullables et
-- ne modifie aucune donnée existante hormis le renseignement rétroactif
-- décrit à l'étape 3. Aucune ligne n'est supprimée.
-- =====================================================================


-- ---------------------------------------------------------------------
-- ÉTAPE 0 — CONTRÔLE PRÉALABLE (lecture seule)
-- ---------------------------------------------------------------------

-- Combien de documents sont aujourd'hui marqués envoyés ?
SELECT 'releves CESU envoyes'  AS objet, count(*) FROM public.billing_period_clients WHERE sent_at IS NOT NULL
UNION ALL
SELECT 'factures avec sent_at', count(*)          FROM public.invoices               WHERE sent_at IS NOT NULL
UNION ALL
SELECT 'factures status=sent SANS sent_at', count(*) FROM public.invoices
  WHERE status = 'sent' AND sent_at IS NULL;
-- La troisième ligne correspond aux factures créées avant le 01/09/2026, quand
-- la génération les créait directement en « sent ». On ne sait pas si elles ont
-- été transmises ni comment : elles resteront sans canal, ce qui est honnête.


-- ---------------------------------------------------------------------
-- ÉTAPE 1 — Colonne sur les relevés CESU
-- ---------------------------------------------------------------------

ALTER TABLE public.billing_period_clients
  ADD COLUMN IF NOT EXISTS sent_channel TEXT
  CHECK (sent_channel IS NULL OR sent_channel IN ('email', 'hand'));

COMMENT ON COLUMN public.billing_period_clients.sent_channel IS
  'Comment le relevé a été transmis : email (envoi depuis l''app) ou hand (remis en main propre). NULL tant qu''il n''est pas transmis.';


-- ---------------------------------------------------------------------
-- ÉTAPE 2 — Colonne sur les factures
-- ---------------------------------------------------------------------

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS sent_channel TEXT
  CHECK (sent_channel IS NULL OR sent_channel IN ('email', 'hand'));

COMMENT ON COLUMN public.invoices.sent_channel IS
  'Comment la facture a été transmise : email (envoi depuis l''app) ou hand (remise en main propre). NULL tant qu''elle n''est pas transmise.';


-- ---------------------------------------------------------------------
-- ÉTAPE 3 — Renseignement rétroactif
-- Tout ce qui porte un sent_at vient forcément de l'envoi par email : c'était
-- jusqu'ici le seul code capable de le renseigner. On peut donc l'affirmer.
-- ---------------------------------------------------------------------

UPDATE public.billing_period_clients
SET sent_channel = 'email'
WHERE sent_at IS NOT NULL AND sent_channel IS NULL;

UPDATE public.invoices
SET sent_channel = 'email'
WHERE sent_at IS NOT NULL AND sent_channel IS NULL;


-- ---------------------------------------------------------------------
-- ÉTAPE 4 — VÉRIFICATION
-- ---------------------------------------------------------------------

SELECT 'billing_period_clients' AS objet, sent_channel, count(*)
FROM public.billing_period_clients GROUP BY sent_channel
UNION ALL
SELECT 'invoices', sent_channel, count(*)
FROM public.invoices GROUP BY sent_channel
ORDER BY 1, 2;

-- Les colonnes sont-elles bien en place ?
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'sent_channel'
ORDER BY table_name;


-- =====================================================================
-- ROLLBACK
-- Sans risque : on ne retire que des colonnes ajoutées par cette migration.
-- =====================================================================
-- ALTER TABLE public.billing_period_clients DROP COLUMN IF EXISTS sent_channel;
-- ALTER TABLE public.invoices               DROP COLUMN IF EXISTS sent_channel;
