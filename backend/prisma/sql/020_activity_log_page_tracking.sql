-- Activity Log V3: page/session telemetry.
-- Non-blocking usage telemetry for authenticated users. No credentials or secrets are stored.
CREATE INDEX IF NOT EXISTS idx_audit_page_view_created
  ON audit_logs(created_at DESC)
  WHERE action = 'PAGE_VIEW';

CREATE INDEX IF NOT EXISTS idx_audit_page_view_user
  ON audit_logs(user_id, created_at DESC)
  WHERE action = 'PAGE_VIEW';
