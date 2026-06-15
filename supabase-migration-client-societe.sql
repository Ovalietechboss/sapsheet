-- Migration : clients « société » (B2B hors champ SAP).
-- Cathy (auto-entrepreneur) facture, à titre exceptionnel, des SOCIÉTÉS hors du
-- périmètre Services À la Personne : pas de n° déclaration SAP, pas de crédit d'impôt,
-- mais identité légale (SIRET / TVA intra) + mentions B2B obligatoires sur la facture.
--
-- `client_type` distingue PARTICULIER (défaut, comportement actuel) de SOCIETE.
-- Additif & idempotent. ⚠️ À APPLIQUER PAR LE PO (Supabase → SQL Editor), avec backup.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type   TEXT NOT NULL DEFAULT 'PARTICULIER';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_siret TEXT;  -- SIRET de la société cliente
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_vat   TEXT;  -- N° TVA intracommunautaire (optionnel)

-- Contrainte de valeurs autorisées, posée une seule fois (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_client_type_check'
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT clients_client_type_check
      CHECK (client_type IN ('PARTICULIER', 'SOCIETE'));
  END IF;
END $$;
