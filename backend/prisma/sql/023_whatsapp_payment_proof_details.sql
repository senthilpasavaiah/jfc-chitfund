ALTER TABLE chit_payment_proofs
  ADD COLUMN IF NOT EXISTS utr_number TEXT,
  ADD COLUMN IF NOT EXISTS declared_amount NUMERIC(14,2);

CREATE INDEX IF NOT EXISTS idx_chit_payment_proofs_utr
  ON chit_payment_proofs(utr_number)
  WHERE utr_number IS NOT NULL;

COMMENT ON COLUMN chit_payment_proofs.utr_number IS
  'Bank/UPI transaction reference supplied with the payment proof.';
COMMENT ON COLUMN chit_payment_proofs.declared_amount IS
  'Total amount declared by the member for the selected contribution slots.';