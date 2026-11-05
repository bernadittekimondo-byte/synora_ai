const express = require('express');
const { query, withTransaction } = require('@saas/database');
const { loadToken, audit, assertAccountAccess } = require('@saas/security');
const { getAdapter } = require('@saas/providers');
const { CAPABILITIES, accountSettingsSchema } = require('@saas/shared');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.provider, a.provider_account_id, a.display_name, a.account_type,
            a.status, a.last_validated_at,
            s.publishing_enabled, s.moderation_enabled, s.replies_enabled,
            s.analytics_enabled, s.calendar_automation_enabled, s.daily_limit,
            s.quiet_hours_start, s.quiet_hours_end, s.tone
     FROM social_accounts a
     LEFT JOIN account_automation_settings s ON s.account_id = a.id
     WHERE a.organization_id = $1
     ORDER BY a.provider, a.display_name`,
    [req.auth.organizationId]
  );
  res.json({ accounts: rows });
}));

router.get('/:id/capabilities', requireAuth, asyncHandler(async (req, res) => {
  await assertAccountAccess(req.auth, req.params.id);
  const { rows } = await query(
    `SELECT capability, granted, verified, verified_at, notes
     FROM social_account_capabilities WHERE account_id = $1`,
    [req.params.id]
  );
  res.json({ capabilities: rows });
}));

router.patch('/:id/settings', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const account = await assertAccountAccess(req.auth, req.params.id);
  const patch = accountSettingsSchema.parse(req.body);
  const existing = await query(`SELECT 1 FROM account_automation_settings WHERE account_id = $1`, [account.id]);
  if (!existing.rows[0]) {
    await query(`INSERT INTO account_automation_settings (account_id) VALUES ($1)`, [account.id]);
  }
  const map = {
    publishingEnabled: 'publishing_enabled',
    moderationEnabled: 'moderation_enabled',
    repliesEnabled: 'replies_enabled',
    analyticsEnabled: 'analytics_enabled',
    calendarAutomationEnabled: 'calendar_automation_enabled',
    dailyLimit: 'daily_limit',
    quietHoursStart: 'quiet_hours_start',
    quietHoursEnd: 'quiet_hours_end',
    tone: 'tone',
  };
  const fields = []; const values = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    fields.push(`${map[k]} = $${values.length + 1}`);
    values.push(v);
  }
  if (fields.length) {
    values.push(account.id);
    await query(
      `UPDATE account_automation_settings SET ${fields.join(', ')}, updated_at = now() WHERE account_id = $${values.length}`,
      values
    );
  }
  await audit({
    organizationId: req.auth.organizationId, accountId: account.id,
    actorType: 'user', actorId: req.auth.userId,
    action: 'account.settings.update', outcome: 'success', details: patch,
  });
  res.json({ ok: true });
}));

router.post('/:id/test', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const account = await assertAccountAccess(req.auth, req.params.id);
  const conn = await query(
    `SELECT sc.token_vault_ref, sa.provider FROM social_accounts sa
     JOIN social_connections sc ON sc.id = sa.connection_id
     WHERE sa.id = $1`,
    [account.id]
  );
  const bundle = await loadToken(conn.rows[0].token_vault_ref);
  const adapter = getAdapter(conn.rows[0].provider);
  const result = await adapter.testConnection(bundle.accessToken, account.id);
  if (result.ok) {
    const granted = new Set(Object.entries(result.capabilities).filter(([, v]) => v).map(([k]) => k));
    for (const cap of CAPABILITIES) {
      const grantedFlag = granted.has(cap) || adapter.supportedCapabilities.includes(cap);
      await query(
        `INSERT INTO social_account_capabilities (account_id, capability, granted, verified, verified_at)
         VALUES ($1,$2,$3,$4, now())
         ON CONFLICT (account_id, capability) DO UPDATE
           SET granted = EXCLUDED.granted, verified = EXCLUDED.verified, verified_at = EXCLUDED.verified_at`,
        [account.id, cap, grantedFlag, grantedFlag]
      );
    }
    await query(`UPDATE social_accounts SET last_validated_at = now() WHERE id = $1`, [account.id]);
  }
  await audit({
    organizationId: req.auth.organizationId, accountId: account.id,
    actorType: 'user', actorId: req.auth.userId,
    action: 'account.test', outcome: result.ok ? 'success' : 'failure', details: result,
  });
  res.json(result);
}));

router.post('/:id/activate', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const account = await assertAccountAccess(req.auth, req.params.id);
  if (!['pending', 'paused', 'active'].includes(account.status)) {
    return res.status(400).json({ error: `Cannot activate account in status ${account.status}` });
  }
  const org = await query(`SELECT emergency_stop FROM organizations WHERE id = $1`, [req.auth.organizationId]);
  if (org.rows[0] && org.rows[0].emergency_stop) {
    return res.status(400).json({ error: 'Emergency stop active' });
  }
  await withTransaction(async (c) => {
    await c.query(
      `UPDATE social_accounts SET status = 'active', activation_version = activation_version + 1, updated_at = now() WHERE id = $1`,
      [account.id]
    );
  });
  await audit({
    organizationId: req.auth.organizationId, accountId: account.id,
    actorType: 'user', actorId: req.auth.userId, action: 'account.activate', outcome: 'success',
  });
  res.json({ ok: true });
}));

router.post('/:id/pause', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const account = await assertAccountAccess(req.auth, req.params.id);
  await query(
    `UPDATE social_accounts SET status = 'paused', activation_version = activation_version + 1, updated_at = now() WHERE id = $1`,
    [account.id]
  );
  await query(
    `UPDATE scheduled_publications SET status = 'cancelled'
     WHERE account_id = $1 AND status IN ('scheduled','queued')`, [account.id]
  );
  await audit({
    organizationId: req.auth.organizationId, accountId: account.id,
    actorType: 'user', actorId: req.auth.userId, action: 'account.pause', outcome: 'success',
  });
  res.json({ ok: true });
}));

router.post('/:id/disconnect', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const account = await assertAccountAccess(req.auth, req.params.id);
  await query(
    `UPDATE social_accounts SET status = 'disconnected', activation_version = activation_version + 1, updated_at = now() WHERE id = $1`,
    [account.id]
  );
  await query(
    `UPDATE scheduled_publications SET status = 'cancelled'
     WHERE account_id = $1 AND status IN ('scheduled','queued')`, [account.id]
  );
  await audit({
    organizationId: req.auth.organizationId, accountId: account.id,
    actorType: 'user', actorId: req.auth.userId, action: 'account.disconnect', outcome: 'success',
  });
  res.json({ ok: true });
}));

router.get('/:id/activity', requireAuth, asyncHandler(async (req, res) => {
  const account = await assertAccountAccess(req.auth, req.params.id);
  const { rows } = await query(
    `SELECT * FROM automation_audit_logs WHERE account_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [account.id]
  );
  res.json({ activity: rows });
}));

module.exports = router;