-- Replaces the auction-bid chit model with the real JFC model: a draw/
-- shuffle system with a fixed declining payment schedule (matching the
-- Chit Calculator's exact formula), a reserved club month, member
-- intent requests, and an auto-booked income/expense ledger.

ALTER TABLE chits ADD COLUMN IF NOT EXISTS rate_schedule TEXT NOT NULL DEFAULT 'jfc'
  CHECK (rate_schedule IN ('standard', 'jfc'));
ALTER TABLE chits ADD COLUMN IF NOT EXISTS value_lakh NUMERIC(10,2);

-- One row per month of a chit's lifetime.
CREATE TABLE chit_month_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chit_id UUID NOT NULL REFERENCES chits(id) ON DELETE CASCADE,
  month_index INT NOT NULL, -- 0-based; index 1 is always the club's reserved month
  drawn_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  shuffled BOOLEAN NOT NULL DEFAULT FALSE,
  accounted BOOLEAN NOT NULL DEFAULT FALSE, -- true once this month's ledger entries are booked
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chit_id, month_index)
);

CREATE TABLE chit_month_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chit_month_data_id UUID NOT NULL REFERENCES chit_month_data(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(chit_month_data_id, member_id)
);

CREATE TABLE chit_month_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chit_month_data_id UUID NOT NULL REFERENCES chit_month_data(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mandatory', 'planning', 'none')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chit_month_data_id, member_id)
);

CREATE TABLE chit_auto_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chit_id UUID NOT NULL REFERENCES chits(id) ON DELETE CASCADE,
  month_index INT NOT NULL,
  month_label TEXT,
  entry_date DATE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chit_auto_ledger_chit ON chit_auto_ledger(chit_id);

-- Existing installments/auctions tables from the old auction-bid model are
-- left in place (harmless, no longer written to) rather than dropped, to
-- avoid any risk to data if something referenced them.
