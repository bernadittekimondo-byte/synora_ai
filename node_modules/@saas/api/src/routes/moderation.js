const express = require('express');
const { query } = require('@saas/database');
const { audit } = require('@saas/security');
const { resolveModerationSchema } = require('@saas/shared');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.get('/cases', requireAuth, asyncHandler(async (req, res) => {
  const status = req.query.status || 'pending';
  const { rows } = await query(
    `SELECT mc.*, sa.display_name as account_name, sa.provider
     FROM moderation_cases mc
     JOIN social_accounts sa ON sa.id = mc.account_id
     WHERE mc.organization_id = $1 AND mc.status = $2
     ORDER BY mc.created_at DESC LIMIT 200`,
    [req.auth.organizationId, status]
  );
  res.json({ cases: rows });
}));

router.post('/cases/:id/resolve', requireAuth, requireRole('moderator'), asyncHandler(async (req, res) => {
  const data = resolveModerationSchema.parse(req.body);
  const { rows } = await query(
    `UPDATE moderation_cases
     SET status = $1, action_taken = $2, reviewer_id = $3, resolved_at = now()
     WHERE id = $4 AND organization_id = $5 RETURNING *`,
    [data.action === 'escalate' ? 'escalated' : 'resolved', data.action,
     req.auth.userId, req.params.id, req.auth.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  await audit({
    organizationId: req.auth.organizationId, accountId: rows[0].account_id,
    actorType: 'user', actorId: req.auth.userId,
    action: `moderation.${data.action}`,
    targetType: 'moderation_case', targetId: req.params.id, outcome: 'success',
    details: { notes: data.notes },
  });
  res.json(rows[0]);
}));

module.exports = router;