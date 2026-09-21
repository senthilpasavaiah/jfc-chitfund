-- PHASE 1 — Previous Management / New Management data foundation.
-- Source of truth: JFC_Santha_FINAL_Separated_Reconciled_2026.xlsx (fully
-- reconciled, transaction-level verified workbook supplied by the admin).
--
-- This migration does NOT touch a single row in donations, santha_entries,
-- expenses, or chit_profit_history - every individual historical
-- transaction stays exactly as recorded. settlement_summary is already a
-- manually-curated, fiscal-year-LEVEL reconciliation table (not a row-level
-- ledger), so refining its precision with the Excel's verified split is
-- exactly what it's for - it does not "alter historical transactions".

-- 1. Give settlement_summary the Santha/Donation/Unclassified breakdown the
--    Excel worked out (previously only the combined `santha_donation` figure
--    was stored, because the source ledger didn't clearly separate ~7,500
--    of FY 2022-23's contributions between the two categories).
ALTER TABLE settlement_summary ADD COLUMN IF NOT EXISTS santha_amount NUMERIC(14,2);
ALTER TABLE settlement_summary ADD COLUMN IF NOT EXISTS donation_amount NUMERIC(14,2);
ALTER TABLE settlement_summary ADD COLUMN IF NOT EXISTS unclassified_contribution NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Only fills rows that exist AND are still unset - safe to run more than
-- once, and never overwrites a value an admin has since edited by hand.
-- santha_amount + donation_amount + unclassified_contribution always sums
-- back to that year's existing santha_donation figure (verified against the
-- workbook's Final_Reconciliation sheet: 155000+120000+0=275000,
-- 71500+0+7500=79000, 3000+1500+0=4500).
UPDATE settlement_summary
  SET santha_amount = 155000, donation_amount = 120000, unclassified_contribution = 0
  WHERE fiscal_year_label = '21-22' AND santha_amount IS NULL;
UPDATE settlement_summary
  SET santha_amount = 71500, donation_amount = 0, unclassified_contribution = 7500
  WHERE fiscal_year_label = '22-23' AND santha_amount IS NULL;
UPDATE settlement_summary
  SET santha_amount = 3000, donation_amount = 1500, unclassified_contribution = 0
  WHERE fiscal_year_label = '23-24' AND santha_amount IS NULL;

-- 2. Dedicated, one-time Management Handover record. This is deliberately
--    its OWN table, separate from donations/santha_entries/chit_profit -
--    it is not income of any kind, just a factual record of what Previous
--    Management hand over to New Management on the cut-off date.
CREATE TABLE IF NOT EXISTS management_handover (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  source TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guarantees this can never be recorded twice, no matter how many times a
-- future migration, seed script, or admin action runs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_management_handover_single_date
  ON management_handover (handover_date);

INSERT INTO management_handover (handover_date, amount, source, description)
VALUES (
  '2026-07-01',
  634017.60,
  'Previous Management Final Settlement',
  'Opening principal handed over to New Management: Total Principal 5,01,840 + Profit (6% p.a.) 1,32,177.60 = 6,34,017.60 (displayed rounded as 6,34,018).'
)
ON CONFLICT (handover_date) DO NOTHING;
