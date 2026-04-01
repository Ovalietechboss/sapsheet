-- Migration : description de prestation sur timesheets
-- À exécuter dans SQL Editor de Supabase

ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS description TEXT;
