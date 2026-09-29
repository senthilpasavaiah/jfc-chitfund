-- Store WhatsApp payment-response intent separately from portal notifications.
CREATE TABLE IF NOT EXISTS whatsapp_payment_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  chit_id UUID NOT NULL REFERENCES chits(id) ON DELETE CASCADE,
  chit_month_data_id UUID NOT NULL REFERENCES chit_month_data(id) ON DELETE CASCADE,
  month_index INTEGER NOT NULL,
  chit_member_ids UUID[] NOT NULL DEFAULT '{}',
  action TEXT NOT NULL CHECK (action IN ('NOT_YET','WILL_PAY','PAY_LATER','PAID','SELECT_CONTRIBUTIONS')),
  amount NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PROCESSED','CANCELLED')),
  provider_message_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_payment_actions_member_month
  ON whatsapp_payment_actions(member_id, chit_id, month_index, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_payment_actions_status
  ON whatsapp_payment_actions(status, created_at DESC);
