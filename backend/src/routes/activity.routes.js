const express = require('express');
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/', async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 25, 10), 100);
  const offset = (page - 1) * pageSize;
  const search = String(req.query.search || '').trim();
  const action = String(req.query.action || '').trim();
  const module = String(req.query.module || '').trim();
  const userId = String(req.query.userId || '').trim();
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();

  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };

  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    where.push(`(a.action ILIKE ${p} OR a.entity_type ILIKE ${p} OR COALESCE(a.entity_id, '') ILIKE ${p}
      OR COALESCE(u.phone, '') ILIKE ${p} OR COALESCE(m.name, '') ILIKE ${p})`);
  }
  if (action) add('a.action = ?', action);
  if (module) add('a.entity_type = ?', module);
  if (userId) add('a.user_id = ?', userId);
  if (from) add('a.created_at >= ?::date', from);
  if (to) add("a.created_at < (?::date + INTERVAL '1 day')", to);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countResult = await query(
    `SELECT COUNT(*)::int AS total
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN members m ON m.user_id = u.id
       ${whereSql}`,
    params
  );

  const dataParams = [...params, pageSize, offset];
  const { rows } = await query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.ip_address, a.created_at,
            u.id AS user_id, u.phone AS actor_phone, u.role AS actor_role,
            COALESCE(m.name, CASE WHEN u.role = 'ADMIN' THEN 'Admin' ELSE u.phone END) AS actor_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN members m ON m.user_id = u.id
       ${whereSql}
      ORDER BY a.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    dataParams
  );

  const [actionsResult, modulesResult, usersResult] = await Promise.all([
    query(`SELECT DISTINCT action FROM audit_logs ORDER BY action`),
    query(`SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type`),
    query(`SELECT DISTINCT u.id, COALESCE(m.name, CASE WHEN u.role = 'ADMIN' THEN 'Admin' ELSE u.phone END) AS name
              FROM audit_logs a
              JOIN users u ON u.id = a.user_id
              LEFT JOIN members m ON m.user_id = u.id
             ORDER BY name`),
  ]);

  res.json({
    success: true,
    data: rows,
    pagination: { page, pageSize, total: countResult.rows[0].total, totalPages: Math.max(Math.ceil(countResult.rows[0].total / pageSize), 1) },
    filters: {
      actions: actionsResult.rows.map((r) => r.action),
      modules: modulesResult.rows.map((r) => r.entity_type),
      users: usersResult.rows,
    },
  });
});

module.exports = router;
