-- Payment proof workflow: a member uploads a screenshot (bank transfer/UPI/
-- SMS) for a given chit month; admin reviews and confirms, which then marks
-- chit_month_payments.paid = true. Duplicate submissions in the same month
-- are blocked at the service layer.

CREATE TABLE chit_payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chit_month_data_id UUID NOT NULL REFERENCES chit_month_data(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  image_data TEXT NOT NULL, -- base64 image data; a dedicated file storage
                            -- service (S3/Cloudinary) is the right long-term
                            -- home for this, still an open decision - see README.
  image_mime_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  submitted_by_id UUID NOT NULL REFERENCES users(id), -- who uploaded it (member OR admin on their behalf)
  reviewed_by_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chit_month_data_id, member_id)
);
CREATE INDEX idx_payment_proofs_status ON chit_payment_proofs(status);
