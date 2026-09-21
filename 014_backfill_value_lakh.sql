-- Fixes CHIT-2026-008 (and any other pre-redesign chit) showing zero
-- income. Migration 010 added `value_lakh` without backfilling it for
-- chits created before that migration ran, so their income calculations
-- (which read value_lakh, not the older chit_value column) silently
-- computed as 0.

-- 1. Backfill value_lakh from the legacy chit_value column (rupees -> lakh)
--    for any chit where it was never set.
UPDATE chits
SET value_lakh = ROUND(chit_value / 100000, 2)
WHERE value_lakh IS NULL;

-- 2. Remove the incorrect (zero-value) auto-booked ledger entries that
--    were generated while value_lakh was NULL. These are the 3 chits
--    that pre-date migration 010 (renamed by migration 013) - confirm
--    with the SELECT below before running in production if you're not
--    sure the ref_numbers still match:
--      SELECT ref_number, value_lakh FROM chits WHERE ref_number IN
--        ('CHIT-2026-008','CHIT-2026-009','CHIT-2026-010');
DELETE FROM chit_auto_ledger
WHERE chit_id IN (
  SELECT id FROM chits WHERE ref_number IN ('CHIT-2026-008', 'CHIT-2026-009', 'CHIT-2026-010')
);

-- 3. Force those chits' already-processed months to be re-accounted, so the
--    next call to syncAccounting() (e.g. opening the chit's Income &
--    Expenses panel, or loading /reports) rebuilds the ledger correctly
--    using the now-populated value_lakh.
UPDATE chit_month_data
SET accounted = FALSE
WHERE chit_id IN (
  SELECT id FROM chits WHERE ref_number IN ('CHIT-2026-008', 'CHIT-2026-009', 'CHIT-2026-010')
);
