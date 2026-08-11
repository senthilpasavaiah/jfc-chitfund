-- Funds module: Donation, Santha, historical Chit-profit, and the
-- Final Settlement ledger, imported from JFC_Santha_Settlement_2026.xlsx

CREATE TABLE donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  member_name TEXT NOT NULL, -- kept even if member_id is null (historical/former member)
  amount NUMERIC(14,2) NOT NULL,
  donated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_donations_member ON donations(member_id);

CREATE TABLE santha_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  member_name TEXT NOT NULL,
  round_label TEXT NOT NULL, -- e.g. "Santha to Ravi", "Santha to VV"
  amount NUMERIC(14,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_santha_member ON santha_entries(member_id);
CREATE INDEX idx_santha_round ON santha_entries(round_label);

-- Historical (pre-digitization) chit rounds - commission income only,
-- distinct from the live Chit module's auto-calculated dividends.
CREATE TABLE chit_profit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  fiscal_year_label TEXT NOT NULL,
  profit_amount NUMERIC(14,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The Final Settlement ledger: one row per fiscal year. Historical rows are
-- an immutable import of already-closed years; new years can be added by
-- admin going forward. Totals (Final Settlement Value etc.) are always
-- computed by SUMMING this table, never hardcoded.
CREATE TABLE settlement_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_label TEXT NOT NULL UNIQUE,
  santha_donation NUMERIC(14,2) NOT NULL DEFAULT 0,
  chit_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
  expenses NUMERIC(14,2) NOT NULL DEFAULT 0,
  principal NUMERIC(14,2) NOT NULL, -- santha_donation + chit_profit - expenses
  profit_6pct NUMERIC(14,2) NOT NULL, -- 6% p.a. accrual per your existing formula
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
