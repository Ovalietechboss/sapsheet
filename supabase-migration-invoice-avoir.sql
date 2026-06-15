-- Migration : avoirs (notes de crédit).
-- Un avoir = document légal qui annule/corrige une facture déjà émise (on ne supprime/modifie
-- JAMAIS une facture émise). Il est stocké dans `invoices` avec :
--   - invoice_number = série dédiée `AV-AAAA-NNN`,
--   - total_amount NÉGATIF (montant crédité),
--   - credit_of = numéro de la facture d'origine (lien),
--   - lines (JSONB) = motif/lignes de l'avoir.
-- `credit_of` distingue un avoir d'une facture. Additif & idempotent.
-- ⚠️ À APPLIQUER PAR LE PO (Supabase → SQL Editor), avec backup.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_of TEXT; -- n° de la facture d'origine créditée
