-- Migration : infos de déclaration SAP (services à la personne) au profil utilisateur.
-- Utilisées par l'attestation fiscale annuelle (art. D7233-4 §2° : n° et date d'enregistrement
-- de la déclaration). Ex. récépissé préfecture : N° SAP880186515, déclaré le 14/03/2020.
--
-- Additif & idempotent. ⚠️ À APPLIQUER PAR LE PO (avec backup préalable) — non appliqué auto.

ALTER TABLE users ADD COLUMN IF NOT EXISTS sap_declaration_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sap_declaration_date   TEXT;
