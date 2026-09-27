-- Activity Log: fast admin filtering and chronological browsing.
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_user_created_at ON audit_logs(user_id, created_at DESC);
