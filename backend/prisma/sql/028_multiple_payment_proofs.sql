BEGIN;

-- A member may hold multiple contributions in one chit/month. Keep one
-- pending proof at a time, but allow separate confirmed/rejected proofs for
-- different contribution sets.
ALTER TABLE chit_payment_proofs
  DROP CONSTRAINT IF EXISTS chit_payment_proofs_chit_month_data_id_member_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_chit_payment_proofs_one_pending
  ON chit_payment_proofs(chit_month_data_id, member_id)
  WHERE status = 'pending';

COMMIT;
