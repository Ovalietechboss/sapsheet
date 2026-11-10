-- Migration : RESTAURE l'unicite du numero de facture, perdue en route.
--
-- `supabase-schema.sql` declarait `invoice_number TEXT UNIQUE NOT NULL`, mais la
-- migration reellement appliquee en production (supabase-migration-invoices.sql)
-- a ecrit `invoice_number TEXT NOT NULL` : la contrainte a disparu.
--
-- Consequence constatee le 2026-11-10 : DEUX factures portaient le numero
-- `FAC-2026-10-LECONTE`, l'une payee a 87,12 EUR, l'autre a 358,12 EUR. L'ecran
-- n'en montrait qu'une, le client etait facture deux fois, et plus personne ne
-- savait ou il en etait. Un numero de facture doit etre unique : c'est aussi ce
-- qu'exige l'article 242 nonies A du CGI.
--
-- L'unicite est posee sur (user_id, invoice_number) et NON sur le seul numero :
-- chaque professionnel tient sa propre serie annuelle, et deux utilisateurs
-- peuvent legitimement avoir tous les deux une facture `2026-001`.
--
-- ⚠️ À APPLIQUER PAR LE PO (Supabase → SQL Editor), avec backup.
-- ⚠️ ET APRES avoir supprime les doublons existants : la creation de l'index
--    ECHOUE s'il en reste un. La requete de controle est juste en dessous.

-- --- Controle prealable : y a-t-il encore des doublons ? ---
-- Doit renvoyer 0 ligne. Sinon, traiter chaque doublon AVANT de continuer.
--
--   SELECT user_id, invoice_number, count(*) AS nb,
--          string_agg(id || ' = ' || total_amount || ' EUR (' || status || ')', ' | ') AS lignes
--   FROM   invoices
--   GROUP  BY user_id, invoice_number
--   HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_invoices_user_number
  ON invoices(user_id, invoice_number);
