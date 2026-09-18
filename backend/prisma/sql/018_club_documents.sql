-- Club-level documents (Accounts, Registration, Bylaws, etc.) - distinct
-- from the pre-existing `member_documents` table, which is per-member
-- (ID proofs etc.) and was never wired up to real storage (fileUrl assumed
-- an external host that was never decided on).
--
-- This instead follows the same pattern already proven by
-- chit_payment_proofs: the file is stored as base64 directly in Postgres
-- (file_data), with no external storage dependency - so this ships now
-- instead of waiting on an S3/Cloudinary decision that was blocking the
-- Documents page entirely (see README.md).

CREATE TYPE document_category AS ENUM ('ACCOUNTS', 'REGISTRATION', 'BYLAWS', 'OTHER');

CREATE TABLE club_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category document_category NOT NULL DEFAULT 'OTHER',
  description TEXT,
  file_name TEXT NOT NULL,
  file_mime_type TEXT NOT NULL,
  file_data TEXT NOT NULL,
  uploaded_by_id UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_club_documents_category ON club_documents(category);
CREATE INDEX idx_club_documents_uploaded_at ON club_documents(uploaded_at DESC);
