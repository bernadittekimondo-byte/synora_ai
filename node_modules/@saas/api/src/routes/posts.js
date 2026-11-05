const express = require('express');
const crypto = require('crypto');
const { query } = require('@saas/database');
const { audit } = require('@saas/security');
const { createPostSchema, scheduleSchema, generateMediaSchema } = require('@saas/shared');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { checkPublishAllowed, generateMediaAsset } = require('@saas/ai');
const { publishingQueue } = require('../services/queue');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, title, body, hashtags, media_urls, status, created_at
     FROM content_posts WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [req.auth.organizationId]
  );
  res.json({ posts: rows });
}));

router.post('/', requireAuth, requireRole('editor'), asyncHandler(async (req, res) => {
  const data = createPostSchema.parse(req.body);
  const { rows } = await query(
    `INSERT INTO content_posts (organization_id, campaign_id, created_by, title, body, hashtags, media_urls)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.auth.organizationId, data.campaignId || null, req.auth.userId,
     data.title || null, data.body, data.hashtags || [], data.mediaUrls || []]
  );
  res.status(201).json(rows[0]);
}));

router.post('/:id/schedule', requireAuth, requireRole('editor'), asyncHandler(async (req, res) => {
  const data = scheduleSchema.parse(req.body);
  const post = await query(
    `SELECT * FROM content_posts WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.auth.organizationId]
  );
  if (!post.rows[0]) return res.status(404).json({ error: 'Post not found' });

  const org = await query(`SELECT emergency_stop FROM organizations WHERE id = $1`, [req.auth.organizationId]);
  const emergencyStop = (org.rows[0] && org.rows[0].emergency_stop) || false;

  const created = [];
  for (const accountId of data.accountIds) {
    const account = await query(
      `SELECT a.id, a.status, a.activation_version, a.organization_id,
              s.publishing_enabled, s.daily_limit, s.quiet_hours_start, s.quiet_hours_end
       FROM social_accounts a
       LEFT JOIN account_automation_settings s ON s.account_id = a.id
       WHERE a.id = $1`,
      [accountId]
    );
    const acc = account.rows[0];
    if (!acc || acc.organization_id !== req.auth.organizationId) {
      return res.status(403).json({ error: `Account ${accountId} not accessible` });
    }
    const caps = await query(
      `SELECT capability, granted, verified FROM social_account_capabilities WHERE account_id = $1`,
      [accountId]
    );
    const capsMap = {};
    for (const c of caps.rows) capsMap[c.capability] = c.granted && c.verified;

    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
    const published = await query(
      `SELECT COUNT(*)::int as c FROM scheduled_publications
       WHERE account_id = $1 AND status = 'published' AND published_at >= $2`,
      [accountId, todayStart.toISOString()]
    );

    const decision = checkPublishAllowed({
      capabilities: capsMap,
      accountStatus: acc.status,
      emergencyStop,
      quietHours: acc.quiet_hours_start && acc.quiet_hours_end
        ? { start: acc.quiet_hours_start, end: acc.quiet_hours_end } : null,
      dailyLimit: acc.daily_limit || 10,
      publishedToday: published.rows[0].c,
      scheduledAt: new Date(data.scheduledAt),
    });

    const idempotencyKey = crypto.createHash('sha256')
      .update(`${post.rows[0].id}:${accountId}:${data.scheduledAt}`).digest('hex');

    const insert = await query(
      `INSERT INTO scheduled_publications
         (organization_id, post_id, account_id, scheduled_at, status, idempotency_key, activation_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [req.auth.organizationId, post.rows[0].id, accountId, data.scheduledAt,
       decision.allowed ? 'scheduled' : 'blocked',
       idempotencyKey, acc.activation_version]
    );
    created.push({ publication: insert.rows[0], decision });

    if (decision.allowed) {
      const delay = Math.max(0, new Date(data.scheduledAt).getTime() - Date.now());
      await publishingQueue.add('publish', { publicationId: insert.rows[0].id }, {
        jobId: `pub-${insert.rows[0].id}`,
        delay,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: false,
      });
    }
  }

  await query(`UPDATE content_posts SET status = 'scheduled' WHERE id = $1`, [post.rows[0].id]);
  await audit({
    organizationId: req.auth.organizationId,
    actorType: 'user', actorId: req.auth.userId,
    action: 'post.schedule', targetType: 'post', targetId: post.rows[0].id,
    outcome: 'success', details: { accountIds: data.accountIds, scheduledAt: data.scheduledAt },
  });
  res.json({ results: created });
}));

router.post('/generate-media', requireAuth, requireRole('editor'), asyncHandler(async (req, res) => {
  const data = generateMediaSchema.parse(req.body);
  const org = await query(`SELECT name FROM organizations WHERE id = $1`, [req.auth.organizationId]);
  const companyName = org.rows[0]?.name || 'Synora';

  const asset = await generateMediaAsset({
    prompt: data.prompt,
    type: data.type,
    platform: data.platform || 'linkedin',
    companyName,
    title: data.title || '',
  });

  await audit({
    organizationId: req.auth.organizationId,
    actorType: 'user', actorId: req.auth.userId,
    action: `media.${data.type}.generated`, targetType: 'media', targetId: null,
    outcome: 'success', details: { type: data.type, prompt: data.prompt },
  });

  res.json({ asset });
}));

router.get('/scheduled', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT sp.*, cp.title as post_title, cp.body as post_body, cp.hashtags as post_hashtags,
            cp.media_urls as post_media_urls,
            sa.display_name as account_name, sa.provider
     FROM scheduled_publications sp
     JOIN content_posts cp ON cp.id = sp.post_id
     JOIN social_accounts sa ON sa.id = sp.account_id
     WHERE sp.organization_id = $1
     ORDER BY sp.scheduled_at ASC`,
    [req.auth.organizationId]
  );
  res.json({ scheduled: rows });
}));

router.put('/:id', requireAuth, requireRole('editor'), asyncHandler(async (req, res) => {
  const data = createPostSchema.parse(req.body);
  const { rows } = await query(
    `UPDATE content_posts
     SET title = $1, body = $2, hashtags = $3, media_urls = $4, updated_at = now()
     WHERE id = $5 AND organization_id = $6
     RETURNING *`,
    [data.title || null, data.body, data.hashtags || [], data.mediaUrls || [],
     req.params.id, req.auth.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
  await audit({
    organizationId: req.auth.organizationId,
    actorType: 'user', actorId: req.auth.userId,
    action: 'post.updated', targetType: 'post', targetId: rows[0].id, outcome: 'success',
  });
  res.json(rows[0]);
}));

router.delete('/:id', requireAuth, requireRole('editor'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `DELETE FROM content_posts WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [req.params.id, req.auth.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
  await query(
    `UPDATE scheduled_publications SET status = 'cancelled'
     WHERE post_id = $1 AND organization_id = $2 AND status IN ('scheduled', 'queued')`,
    [req.params.id, req.auth.organizationId]
  );
  await audit({
    organizationId: req.auth.organizationId,
    actorType: 'user', actorId: req.auth.userId,
    action: 'post.deleted', targetType: 'post', targetId: req.params.id, outcome: 'success',
  });
  res.json({ ok: true });
}));

router.delete('/scheduled/:publicationId', requireAuth, requireRole('editor'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE scheduled_publications SET status = 'cancelled', updated_at = now()
     WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [req.params.publicationId, req.auth.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Publication not found' });
  await audit({
    organizationId: req.auth.organizationId,
    actorType: 'user', actorId: req.auth.userId,
    action: 'publication.cancelled', targetType: 'publication', targetId: req.params.publicationId,
    outcome: 'success',
  });
  res.json({ ok: true });
}));

router.get('/:id/publications', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT sp.*, sa.display_name as account_name, sa.provider
     FROM scheduled_publications sp
     JOIN social_accounts sa ON sa.id = sp.account_id
     WHERE sp.post_id = $1 AND sp.organization_id = $2
     ORDER BY sp.scheduled_at DESC`,
    [req.params.id, req.auth.organizationId]
  );
  res.json({ publications: rows });
}));

module.exports = router;