const express = require('express');
const { query, withTransaction } = require('@saas/database');
const { hashPassword, verifyPassword, issueToken } = require('@saas/security');
const { signupSchema, loginSchema } = require('@saas/shared');
const { asyncHandler } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', asyncHandler(async (req, res) => {
  const data = signupSchema.parse(req.body);
  const result = await withTransaction(async (c) => {
    const u = await c.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id, email, name`,
      [data.email.toLowerCase(), await hashPassword(data.password), data.name]
    );
    const o = await c.query(
      `INSERT INTO organizations (name, slug, billing_email) VALUES ($1,$2,$3) RETURNING id`,
      [data.organizationName, data.organizationSlug, data.email.toLowerCase()]
    );
    await c.query(
      `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1,$2,'owner')`,
      [o.rows[0].id, u.rows[0].id]
    );
    return { user: u.rows[0], organizationId: o.rows[0].id };
  });
  const token = issueToken({ sub: result.user.id, org: result.organizationId, role: 'owner' });
  res.cookie('token', token, {
    httpOnly: true, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24,
  });
  res.json({ user: result.user, organizationId: result.organizationId, token });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const { rows } = await query(
    `SELECT id, email, name, password_hash FROM users WHERE email = $1`, [data.email.toLowerCase()]
  );
  if (!rows[0]) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await verifyPassword(data.password, rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const m = await query(
    `SELECT organization_id, role FROM organization_members WHERE user_id = $1 LIMIT 1`, [rows[0].id]
  );
  if (!m.rows[0]) return res.status(403).json({ error: 'No organization' });
  const token = issueToken({ sub: rows[0].id, org: m.rows[0].organization_id, role: m.rows[0].role });
  res.cookie('token', token, {
    httpOnly: true, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24,
  });
  res.json({
    user: { id: rows[0].id, email: rows[0].email, name: rows[0].name },
    organizationId: m.rows[0].organization_id,
    role: m.rows[0].role,
    token,
  });
}));

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.name, om.role, o.id as organization_id, o.name as organization_name, o.emergency_stop
     FROM users u
     JOIN organization_members om ON om.user_id = u.id
     JOIN organizations o ON o.id = om.organization_id
     WHERE u.id = $1 AND o.id = $2`,
    [req.auth.userId, req.auth.organizationId]
  );
  res.json(rows[0]);
}));

router.get('/members', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.name, om.role, om.created_at
     FROM organization_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = $1
     ORDER BY om.created_at ASC`,
    [req.auth.organizationId]
  );
  res.json({ members: rows });
}));

module.exports = router;