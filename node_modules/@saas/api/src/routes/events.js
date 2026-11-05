const express = require('express');
const { query } = require('@saas/database');
const { audit } = require('@saas/security');
const { createEventSchema } = require('@saas/shared');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM calendar_events WHERE organization_id = $1 ORDER BY start_at DESC LIMIT 500`,
    [req.auth.organizationId]
  );
  res.json({ events: rows });
}));

router.post('/', requireAuth, requireRole('editor'), asyncHandler(async (req, res) => {
  const data = createEventSchema.parse(req.body);
  const { rows } = await query(
    `INSERT INTO calendar_events
       (organization_id, title, description, location, start_at, end_at, timezone, eligible_for_content, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.auth.organizationId, data.title, data.description || null, data.location || null,
     data.startAt, data.endAt, data.timezone, data.eligibleForContent, req.auth.userId]
  );
  await audit({
    organizationId: req.auth.organizationId,
    actorType: 'user', actorId: req.auth.userId,
    action: 'event.created', targetType: 'event', targetId: rows[0].id, outcome: 'success',
  });
  res.status(201).json(rows[0]);
}));

router.put('/:id', requireAuth, requireRole('editor'), asyncHandler(async (req, res) => {
  const data = createEventSchema.parse(req.body);
  const { rows } = await query(
    `UPDATE calendar_events
     SET title = $1, description = $2, location = $3, start_at = $4, end_at = $5,
         timezone = $6, eligible_for_content = $7, updated_at = now()
     WHERE id = $8 AND organization_id = $9
     RETURNING *`,
    [data.title, data.description || null, data.location || null,
     data.startAt, data.endAt, data.timezone, data.eligibleForContent,
     req.params.id, req.auth.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  await audit({
    organizationId: req.auth.organizationId,
    actorType: 'user', actorId: req.auth.userId,
    action: 'event.updated', targetType: 'event', targetId: rows[0].id, outcome: 'success',
  });
  res.json(rows[0]);
}));

router.delete('/:id', requireAuth, requireRole('editor'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `DELETE FROM calendar_events WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [req.params.id, req.auth.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  await audit({
    organizationId: req.auth.organizationId,
    actorType: 'user', actorId: req.auth.userId,
    action: 'event.deleted', targetType: 'event', targetId: req.params.id, outcome: 'success',
  });
  res.json({ ok: true });
}));

module.exports = router;