const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { query } = require('@saas/database');
const { loadToken, audit } = require('@saas/security');
const { getAdapter } = require('@saas/providers');
const { checkPublishAllowed } = require('@saas/ai');

const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker('publishing', async (job) => {
  const { publicationId } = job.data;
  const { rows } = await query(
    `SELECT sp.*, sa.status as account_status, sa.provider, sa.provider_account_id,
            sa.activation_version as current_activation_version,
            sc.token_vault_ref, o.emergency_stop,
            s.daily_limit, s.quiet_hours_start, s.quiet_hours_end,
            cp.body as post_body, cp.media_urls as post_media
     FROM scheduled_publications sp
     JOIN social_accounts sa ON sa.id = sp.account_id
     JOIN social_connections sc ON sc.id = sa.connection_id
     JOIN organizations o ON o.id = sp.organization_id
     LEFT JOIN account_automation_settings s ON s.account_id = sa.id
     JOIN content_posts cp ON cp.id = sp.post_id
     WHERE sp.id = $1`,
    [publicationId]
  );
  const pub = rows[0];
  if (!pub) throw new Error('Publication not found');
  if (pub.status === 'cancelled' || pub.status === 'published') return { skipped: true, status: pub.status };

  // Fencing: stale jobs from earlier activation versions must not execute
  if (pub.activation_version !== pub.current_activation_version) {
    await query(`UPDATE scheduled_publications SET status = 'cancelled', last_error = 'Stale activation version' WHERE id = $1`, [publicationId]);
    return { skipped: true, reason: 'stale_activation' };
  }

  // Re-fetch capabilities fresh
  const caps = await query(
    `SELECT capability, granted, verified FROM social_account_capabilities WHERE account_id = $1`,
    [pub.account_id]
  );
  const capsMap = {};
  for (const c of caps.rows) capsMap[c.capability] = c.granted && c.verified;

  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const published = await query(
    `SELECT COUNT(*)::int as c FROM scheduled_publications
     WHERE account_id = $1 AND status = 'published' AND published_at >= $2`,
    [pub.account_id, todayStart.toISOString()]
  );

  const decision = checkPublishAllowed({
    capabilities: capsMap,
    accountStatus: pub.account_status,
    emergencyStop: pub.emergency_stop,
    quietHours: pub.quiet_hours_start && pub.quiet_hours_end
      ? { start: pub.quiet_hours_start, end: pub.quiet_hours_end } : null,
    dailyLimit: pub.daily_limit || 10,
    publishedToday: published.rows[0].c,
    scheduledAt: new Date(pub.scheduled_at),
  });

  if (!decision.allowed) {
    await query(
      `UPDATE scheduled_publications SET status = 'blocked', last_error = $1, updated_at = now() WHERE id = $2`,
      [decision.reason, publicationId]
    );
    await audit({
      organizationId: pub.organization_id, accountId: pub.account_id,
      actorType: 'system', action: 'publish.blocked',
      targetType: 'scheduled_publication', targetId: publicationId,
      outcome: 'blocked', details: { reason: decision.reason },
    });
    return { blocked: true, reason: decision.reason };
  }

  await query(
    `UPDATE scheduled_publications SET status = 'publishing', attempt_count = attempt_count + 1, updated_at = now() WHERE id = $1`,
    [publicationId]
  );

  const bundle = await loadToken(pub.token_vault_ref);
  const adapter = getAdapter(pub.provider);

  try {
    const result = await adapter.publish({
      providerAccountId: pub.provider_account_id,
      accessToken: bundle.accessToken,
      text: pub.post_body,
      mediaUrls: pub.post_media || [],
    });
    await query(
      `UPDATE scheduled_publications
       SET status = 'published', provider_post_id = $1, provider_response = $2,
           published_at = now(), updated_at = now()
       WHERE id = $3`,
      [result.providerPostId, result.raw, publicationId]
    );
    await audit({
      organizationId: pub.organization_id, accountId: pub.account_id,
      actorType: 'system', action: 'publish.success',
      targetType: 'scheduled_publication', targetId: publicationId,
      outcome: 'success', details: { providerPostId: result.providerPostId },
    });
    return { ok: true, providerPostId: result.providerPostId };
  } catch (err) {
    const isPermanent = /permission|unauthorized|forbidden|policy|validation/i.test(err.message || '');
    await query(
      `UPDATE scheduled_publications
       SET status = $1, last_error = $2, updated_at = now()
       WHERE id = $3`,
      [isPermanent ? 'failed' : 'scheduled', err.message, publicationId]
    );
    await audit({
      organizationId: pub.organization_id, accountId: pub.account_id,
      actorType: 'system', action: 'publish.failure',
      targetType: 'scheduled_publication', targetId: publicationId,
      outcome: 'failure', details: { message: err.message, permanent: isPermanent },
    });
    if (isPermanent) return { failed: true, message: err.message };
    throw err; // let BullMQ retry with backoff
  }
}, { connection, concurrency: 5 });

worker.on('failed', (job, err) => console.error(`[worker] job ${job && job.id} failed`, err.message));
worker.on('completed', (job) => console.log(`[worker] job ${job.id} completed`));

console.log('[worker] running');