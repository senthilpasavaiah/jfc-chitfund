-- Add explicit drawer acknowledgement actions without changing payment status.
ALTER TABLE whatsapp_payment_actions
  DROP CONSTRAINT IF EXISTS whatsapp_payment_actions_action_check;

ALTER TABLE whatsapp_payment_actions
  ADD CONSTRAINT whatsapp_payment_actions_action_check
  CHECK (action IN (
    'NOT_YET','WILL_PAY','PAY_LATER','PAID','SELECT_CONTRIBUTIONS',
    'DRAWER_CONFIRM','DRAWER_DECLINE'
  ));

CREATE INDEX IF NOT EXISTS idx_whatsapp_drawer_confirmation
  ON whatsapp_payment_actions(member_id, chit_id, month_index, action, status, created_at DESC);
