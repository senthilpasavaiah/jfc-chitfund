const { query } = require('../config/db');

/**
 * Records an audit trail entry. Never throws - audit logging must not
 * break the primary request if it fails, but failures are logged.
 */
async function recordAudit({ userId = null, action, entityType, entityId = null, metadata = null, ipAddress = null }) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null, ipAddress]
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to write audit log', err.message);
  }
}

module.exports = { recordAudit };
