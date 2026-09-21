-- Companion to the syncAccounting() fix in chit.service.js.
--
-- Root cause of CHIT-2026-008/009 showing incomplete income: some months
-- had `chit_month_data.accounted = TRUE` with ZERO `chit_auto_ledger` rows
-- behind them (most likely booked back when value_lakh was still unset/0,
-- before migration 014 backfilled it - a commission of `2000 * 0` books
-- nothing, but the month still got flagged "done" and was then permanently
-- skipped by the old `if (md.accounted) continue`).
--
-- syncAccounting() no longer trusts that flag alone - it now cross-checks
-- the ledger's real rows and re-books any month with none, regardless of
-- the flag. So no manual data patch is needed here; the next sync (opening
-- a chit's Income & Expenses panel, the Dashboard, or the Reports page)
-- fixes CHIT-2026-008/009/010 automatically. This migration only adds a
-- structural safety net so the same class of bug can't silently duplicate
-- ledger rows in the future:

-- 1. Defensive cleanup: if any (chit_id, month_index, category) already has
--    more than one row (shouldn't happen, but must be clean before adding
--    the unique index below), keep the earliest and drop the rest.
DELETE FROM chit_auto_ledger a
USING chit_auto_ledger b
WHERE a.chit_id = b.chit_id
  AND a.month_index = b.month_index
  AND a.category = b.category
  AND a.created_at > b.created_at;

-- 2. DB-level guarantee that a given chit/month/category can only ever be
--    booked once - a second, race-proof layer under syncAccounting()'s own
--    application-level duplicate check (ON CONFLICT DO NOTHING uses this).
CREATE UNIQUE INDEX IF NOT EXISTS idx_chit_auto_ledger_unique_entry
  ON chit_auto_ledger (chit_id, month_index, category);
