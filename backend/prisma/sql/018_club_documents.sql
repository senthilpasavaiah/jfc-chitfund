-- Club-level documents (Accounts, Registration, Bylaws, etc.).
-- Safe to run repeatedly during deployment.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_category') THEN
    CREATE TYPE document_category AS ENUM ('ACCOUNTS', 'REGISTRATION', 'BYLAWS', 'OTHER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS club_documents (
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

CREATE INDEX IF NOT EXISTS idx_club_documents_category ON club_documents(category);
CREATE INDEX IF NOT EXISTS idx_club_documents_uploaded_at ON club_documents(uploaded_at DESC);
