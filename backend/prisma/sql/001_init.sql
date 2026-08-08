-- Jolly Friends Club - Chit Fund Management System
-- Schema translated from prisma/schema.prisma (see that file as canonical source)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE role AS ENUM ('ADMIN','MANAGER','COLLECTOR','MEMBER');
CREATE TYPE member_status AS ENUM ('ACTIVE','INACTIVE','SUSPENDED');
CREATE TYPE chit_status AS ENUM ('DRAFT','ACTIVE','CLOSED','CANCELLED');
CREATE TYPE installment_status AS ENUM ('PENDING','PAID','LATE','WAIVED');
CREATE TYPE payment_method AS ENUM ('CASH','BANK_TRANSFER','UPI','CHEQUE','OTHER');
CREATE TYPE auction_status AS ENUM ('SCHEDULED','COMPLETED','CANCELLED');
CREATE TYPE notification_channel AS ENUM ('SMS','WHATSAPP','EMAIL','PUSH');
CREATE TYPE notification_type AS ENUM ('PAYMENT_REMINDER','AUCTION_REMINDER','PAYMENT_RECEIVED','CHIT_STARTED','CHIT_CLOSED','AUCTION_WON','GENERAL');
CREATE TYPE notification_status AS ENUM ('PENDING','LOGGED','FAILED');
CREATE TYPE expense_category AS ENUM ('OFFICE','MISCELLANEOUS');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role role NOT NULL DEFAULT 'MEMBER',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pwd_reset_user ON password_reset_tokens(user_id);

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  mobile_number TEXT UNIQUE NOT NULL,
  whatsapp_number TEXT,
  email TEXT,
  permanent_address TEXT,
  current_address TEXT,
  aadhaar_encrypted TEXT,
  aadhaar_last4 TEXT,
  status member_status NOT NULL DEFAULT 'ACTIVE',
  joined_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_name ON members(name);

CREATE TABLE member_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_member_docs_member ON member_documents(member_id);

CREATE TABLE chits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  chit_value NUMERIC(14,2) NOT NULL,
  total_months INT NOT NULL,
  monthly_installment NUMERIC(14,2) NOT NULL,
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status chit_status NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chits_status ON chits(status);

CREATE TABLE chit_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chit_id UUID NOT NULL REFERENCES chits(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  slot_number INT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(chit_id, member_id)
);
CREATE INDEX idx_chit_members_chit ON chit_members(chit_id);
CREATE INDEX idx_chit_members_member ON chit_members(member_id);

CREATE TABLE installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chit_id UUID NOT NULL REFERENCES chits(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  month_number INT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  base_amount NUMERIC(14,2) NOT NULL,
  fine_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  dividend_adjustment NUMERIC(14,2) NOT NULL DEFAULT 0,
  status installment_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chit_id, member_id, month_number)
);
CREATE INDEX idx_installments_chit_month ON installments(chit_id, month_number);
CREATE INDEX idx_installments_status ON installments(status);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  amount NUMERIC(14,2) NOT NULL,
  method payment_method NOT NULL DEFAULT 'CASH',
  reference_number TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by_id UUID NOT NULL REFERENCES users(id),
  receipt_number TEXT UNIQUE NOT NULL,
  is_advance BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_member ON payments(member_id);
CREATE INDEX idx_payments_installment ON payments(installment_id);

CREATE TABLE auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chit_id UUID NOT NULL REFERENCES chits(id) ON DELETE CASCADE,
  month_number INT NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  status auction_status NOT NULL DEFAULT 'SCHEDULED',
  winner_id UUID REFERENCES members(id),
  discount_amount NUMERIC(14,2),
  dividend_per_member NUMERIC(14,2),
  organizer_commission NUMERIC(14,2),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chit_id, month_number)
);
CREATE INDEX idx_auctions_chit ON auctions(chit_id);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category expense_category NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  spent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_category ON expenses(category);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  channel notification_channel NOT NULL,
  type notification_type NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status notification_status NOT NULL DEFAULT 'LOGGED',
  created_by_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_member ON notifications(member_id);
CREATE INDEX idx_notifications_status ON notifications(status);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
