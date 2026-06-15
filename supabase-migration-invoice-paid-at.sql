-- Migration : date d'encaissement des factures (`paid_at`, ms epoch).
-- La déclaration URSSAF (micro-entrepreneur) se fait sur le CA ENCAISSÉ → c'est la
-- date de PAIEMENT qui détermine le trimestre, pas la date de facture. On trace donc
-- la date d'encaissement quand une facture passe en « payée » (comme facture.net).
--
-- Additif & idempotent. ⚠️ À APPLIQUER PAR LE PO (Supabase → SQL Editor), avec backup.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at BIGINT;
