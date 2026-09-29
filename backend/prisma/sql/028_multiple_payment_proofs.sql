BEGIN;

-- A member may hold multiple contributions in one chit/month. Pending proofs
-- must be isolated by their selected contribution set, so a proof for slot A
-- does not block a separate proof for slot B.
ALTER TABLE chit_payment_proofs
  DROP CONSTRAINT IF EXISTS chit_payment_proofs_chit_month_data_id_member_id_key;

DROP INDEX IF EXISTS uq_chit_payment_proofs_one_pending;

COMMIT;
