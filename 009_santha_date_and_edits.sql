-- Adds a proper date column to santha_entries (previously the frontend was
-- awkwardly stuffing a date string into "notes" - fixing that properly).
ALTER TABLE santha_entries ADD COLUMN IF NOT EXISTS entry_date TIMESTAMPTZ;
