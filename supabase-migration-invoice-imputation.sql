-- Migration : IMPUTATION des pointages a la facture qui les porte.
--
-- Probleme corrige (incident octobre 2026) : une facture emise en avance et deja
-- PAYEE etait ecrasee a la regeneration du mois, et son detail refacture une
-- seconde fois. Cause : rien en base ne disait qu'un pointage etait deja facture,
-- et la facture issue des pointages etait identifiee par (client, mois, annee).
--
-- Avec `invoice_id`, un pointage n'appartient qu'a UNE facture. Une nouvelle
-- facture du mois ne prend que les pointages encore libres (invoice_id IS NULL).
-- Un avoir, ou la suppression d'une facture brouillon, les libere (ON DELETE SET NULL).
--
-- Additif & idempotent. Aucune donnee existante modifiee : toutes les lignes
-- demarrent a NULL, donc « non encore facturees » — voir la note de reprise plus bas.
--
-- ⚠️ À APPLIQUER PAR LE PO (Supabase → SQL Editor), avec backup.

ALTER TABLE timesheets
  ADD COLUMN IF NOT EXISTS invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL;

-- Retrouver « ce que porte la facture X » et « ce qui reste a facturer » sans scan.
CREATE INDEX IF NOT EXISTS idx_timesheets_invoice_id ON timesheets(invoice_id);

-- Reste-a-facturer d'un client sur un mois : requete frequente de l'ecran Bilans.
CREATE INDEX IF NOT EXISTS idx_timesheets_client_libre
  ON timesheets(client_id, date_arrival)
  WHERE invoice_id IS NULL;

COMMENT ON COLUMN timesheets.invoice_id IS
  'Facture qui porte ce pointage. NULL = pas encore facture. Pose a la generation, '
  'libere par un avoir ou par la suppression d''une facture brouillon.';

-- ---------------------------------------------------------------------------
-- REPRISE DE L''EXISTANT — a lancer UNE SEULE FOIS, apres avoir lu le constat.
--
-- Laisser tous les pointages passes a NULL ferait reapparaitre des mois deja
-- regles dans le « reste a facturer ». On rattache donc chaque pointage deja
-- facture a la facture de son mois. Volontairement commente : a derouler
-- seulement quand le cas d''octobre 2026 est tranche (sinon il imputerait a la
-- facture ecrasee des heures qui doivent partir sur une seconde facture).
-- ---------------------------------------------------------------------------
-- UPDATE timesheets t
-- SET    invoice_id = i.id
-- FROM   invoices i
-- WHERE  t.invoice_id IS NULL
--   AND  i.client_id = t.client_id
--   AND  i.facturation_mode = 'CLASSICAL'
--   AND  i.credit_of IS NULL
--   AND  i.year  = extract(year  FROM to_timestamp(t.date_arrival / 1000) AT TIME ZONE 'Europe/Paris')::int
--   AND  i.month = extract(month FROM to_timestamp(t.date_arrival / 1000) AT TIME ZONE 'Europe/Paris')::int;
