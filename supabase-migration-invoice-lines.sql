-- Migration : lignes de facture libres (factures indépendantes B2B / société).
-- Les factures issues des pointages reconstruisent leur détail depuis les timesheets ;
-- une facture INDÉPENDANTE (société, hors champ SAP) n'a pas de pointage → elle porte
-- directement ses lignes (désignation + quantité + prix unitaire HT) dans cette colonne.
--
-- Format : [{ "designation": "...", "quantity": 1, "unit_price": 100 }, ...]
-- Additif & idempotent. ⚠️ À APPLIQUER PAR LE PO (Supabase → SQL Editor), avec backup.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS lines JSONB;
