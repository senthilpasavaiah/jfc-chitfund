-- WhatsApp/payment identity hardening for multiple contributions per member.
-- Existing member-level payment rows are preserved. New payment records can be
-- tied to the exact chit_members slot without changing live data semantics.
ALTER TABLE chit_month_payments
  ADD COLUMN IF NOT EXISTS chit_member_id UUID REFERENCES chit_members(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chit_month_payments_chit_member
  ON chit_month_payments(chit_member_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chit_month_payments_month_slot
  ON chit_month_payments(chit_month_data_id, chit_member_id)
  WHERE chit_member_id IS NOT NULL;

ALTER TABLE chit_payment_proofs
  ADD COLUMN IF NOT EXISTS chit_member_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_chit_payment_proofs_chit_member_ids
  ON chit_payment_proofs USING GIN(chit_member_ids);

COMMENT ON COLUMN chit_month_payments.chit_member_id IS
  'Exact chit_members contribution/slot. NULL means legacy member-level payment.';
COMMENT ON COLUMN chit_payment_proofs.chit_member_ids IS
  'Exact contribution/slot IDs covered by this proof. Empty means legacy member-level proof.';
