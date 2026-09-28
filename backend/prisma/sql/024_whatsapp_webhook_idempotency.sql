-- Prevent duplicate processing when Meta retries the same webhook message.
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_payment_actions_provider_message
  ON whatsapp_payment_actions(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

COMMENT ON INDEX uq_whatsapp_payment_actions_provider_message IS
  'Ensures the same inbound/outbound provider message id cannot create duplicate WhatsApp payment actions.';
