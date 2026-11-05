const express = require('express');
const { query } = require('@saas/database');
const { audit } = require('@saas/security');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.get('/overview', requireAuth, asyncHandler(async (req, res) => {
  const orgId = req.auth.organizationId;
  const [accounts, posts, scheduled, published, pendingMod, failed, alerts] = await Promise.all([
    query(`SELECT COUNT(*)::int as c FROM social_accounts WHERE organization_id = $1 AND status = 'active'`, [orgId]),
    query(`SELECT COUNT(*)::int as c FROM content_posts WHERE organization_id = $1`, [orgId]),
    query(`SELECT COUNT(*)::int as c FROM scheduled_publications WHERE organization_id = $1 AND status = 'scheduled'`, [orgId]),
    query(`SELECT COUNT(*)::int as c FROM scheduled_publications WHERE organization_id = $1 AND status = 'published'`, [orgId]),
    query(`SELECT COUNT(*)::int as c FROM moderation_cases WHERE organization_id = $1 AND status = 'pending'`, [orgId]),
    query(`SELECT COUNT(*)::int as c FROM scheduled_publications WHERE organization_id = $1 AND status = 'failed'`, [orgId]),
    query(`SELECT COUNT(*)::int as c FROM operational_incidents WHERE organization_id = $1 AND resolved_at IS NULL`, [orgId]),
  ]);
  res.json({
    activeAgents: accounts.rows[0].c,
    posts: posts.rows[0].c,
    scheduled: scheduled.rows[0].c,
    published: published.rows[0].c,
    pendingModeration: pendingMod.rows[0].c,
    failedPublications: failed.rows[0].c,
    openIncidents: alerts.rows[0].c,
  });
}));

router.post('/emergency-stop', requireAuth, requireRole('owner'), asyncHandler(async (req, res) => {
  const enable = Boolean(req.body && req.body.enable);
  await query(`UPDATE organizations SET emergency_stop = $1, updated_at = now() WHERE id = $2`,
    [enable, req.auth.organizationId]);
  if (enable) {
    await query(
      `UPDATE scheduled_publications SET status = 'cancelled'
       WHERE organization_id = $1 AND status IN ('scheduled','queued')`,
      [req.auth.organizationId]
    );
  }
  await audit({
    organizationId: req.auth.organizationId,
    actorType: 'user', actorId: req.auth.userId,
    action: enable ? 'org.emergency_stop.enable' : 'org.emergency_stop.disable',
    outcome: 'success',
  });
  res.json({ ok: true, emergencyStop: enable });
}));

router.get('/audit', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM automation_audit_logs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 300`,
    [req.auth.organizationId]
  );
  res.json({ audit: rows });
}));

module.exports = router;