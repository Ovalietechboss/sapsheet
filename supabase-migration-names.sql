-- Migration : ajout prénom + titre aux tables clients et mandataires
-- À exécuter dans SQL Editor de Supabase

-- Mandataires : ajouter first_name (le champ name devient le nom de famille)
ALTER TABLE mandataires ADD COLUMN IF NOT EXISTS first_name TEXT;

-- Clients : ajouter first_name et titre
ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS titre TEXT;
