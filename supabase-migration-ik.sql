-- Migration : indemnités kilométriques sur timesheets
-- À exécuter dans SQL Editor de Supabase

ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS ik_km DECIMAL(10,2) DEFAULT 0;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS ik_rate DECIMAL(10,4) DEFAULT 0.603;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS ik_amount DECIMAL(10,2) DEFAULT 0;
