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
-- REPRISE DE L''EXISTANT — APPLIQUEE EN PROD LE 2026-11-11.
--
-- Pourquoi elle n'est plus commentee : livree desactivee le 05/11, elle n'a jamais
-- ete lancee. Pendant six jours, les 44 mois-clients deja factures de 2026 se sont
-- affiches « X EUR factures · reste X EUR » dans Bilans, et le bouton y proposait
-- d'emettre une SECONDE facture pour des heures deja reglees. Une reprise de
-- donnees ne se livre pas commentee : soit elle tourne, soit le deploiement attend.
--
-- Trois garde-fous, sans lesquels elle est dangereuse :
--   1. `NOT EXISTS` — on ne touche pas une facture qui porte deja ses pointages ;
--   2. count(...) = 1 — on refuse les mois a PLUSIEURS factures, ou le rattachement
--      serait arbitraire (cas reel : octobre 2026 d'un client, facture d'acompte
--      payee + facture de solde) ; ces mois se traitent un par un ;
--   3. clients CLASSICAL seulement — le CESU ne passe pas par `invoices`.
--
-- Verifie AVANT execution sur les donnees reelles : 42 mois au centime pres, et
-- 2 ecarts expliques par une hausse de tarif horaire (23 -> 25 EUR/h) posterieure
-- aux factures d'avril. ⚠️ Un controle qui recalcule un montant historique avec le
-- tarif ACTUEL du client produit de faux ecarts — comparer au taux implicite de la
-- facture (montant - frais) / heures.
--
-- Resultat : 115 pointages rattaches a 44 factures. Idempotent, rejouable.
-- Controles permanents : `supabase-controle-integrite.sql`.
-- ---------------------------------------------------------------------------
WITH cible AS (
  SELECT i.id AS invoice_id, i.client_id,
         i.year || '-' || lpad(i.month::text, 2, '0') AS mois
  FROM invoices i
  JOIN clients c ON c.id = i.client_id
  WHERE c.facturation_mode = 'CLASSICAL'
    AND i.credit_of IS NULL
    AND NOT EXISTS (SELECT 1 FROM timesheets x WHERE x.invoice_id = i.id)
    AND (SELECT count(*) FROM invoices i2
          WHERE i2.client_id = i.client_id AND i2.year = i.year
            AND i2.month = i.month AND i2.credit_of IS NULL) = 1
), maj AS (
  UPDATE timesheets t
  SET invoice_id = cible.invoice_id,
      updated_at = (extract(epoch from now()) * 1000)::bigint
  FROM cible
  WHERE t.client_id = cible.client_id
    AND t.invoice_id IS NULL
    AND to_char(to_timestamp(t.date_arrival / 1000) AT TIME ZONE 'Europe/Paris', 'YYYY-MM') = cible.mois
  RETURNING t.id, t.invoice_id
)
SELECT count(*) AS pointages_rattaches, count(DISTINCT invoice_id) AS factures_concernees FROM maj;
