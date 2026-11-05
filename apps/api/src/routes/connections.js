const express = require('express');
const crypto = require('crypto');
const { query } = require('@saas/database');
const { getAdapter } = require('@saas/providers');
const { storeToken, audit, decrypt } = require('@saas/security');
const { PROVIDERS } = require('@saas/shared');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

async function getOrgCredentials(organizationId, provider) {
  try {
    const { rows } = await query(
      `SELECT client_id, client_secret_ciphertext FROM provider_api_credentials
       WHERE organization_id = $1 AND provider = $2 AND is_active = true`,
      [organizationId, provider]
    );
    if (rows[0]) {
      return {
        clientId: rows[0].client_id,
        clientSecret: decrypt(rows[0].client_secret_ciphertext),
      };
    }
  } catch (err) {
    console.warn('[connections] error loading custom org credentials:', err.message);
  }
  return null;
}

const router = express.Router();
const OAUTH_BASE = process.env.OAUTH_REDIRECT_BASE || 'http://localhost:4000/api/v1/social/connections';
const WEB_BASE = process.env.WEB_BASE_URL || 'http://localhost:5173';

router.post('/:provider/oauth/start', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const provider = req.params.provider;
  if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Unsupported provider' });
  const state = crypto.randomBytes(24).toString('hex');
  const codeVerifier = (provider === 'x' || provider === 'tiktok')
    ? crypto.randomBytes(32).toString('base64url') : null;
  const redirectUri = `${OAUTH_BASE}/${provider}/oauth/callback`;
  await query(
    `INSERT INTO oauth_states (organization_id, user_id, provider, state, code_verifier, redirect_uri, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6, now() + interval '10 minutes')`,
    [req.auth.organizationId, req.auth.userId, provider, state, codeVerifier, redirectUri]
  );
  const adapter = getAdapter(provider);
  let authorizationUrl;
  try {
    const credentials = await getOrgCredentials(req.auth.organizationId, provider);
    authorizationUrl = adapter.buildAuthorizationUrl({ redirectUri, state, codeVerifier, credentials: credentials || undefined });
  } catch (e) {
    return res.status(400).json({ error: `Provider not configured: ${e.message}` });
  }
  res.json({ authorizationUrl, state });
}));

router.get('/:provider/oauth/callback', asyncHandler(async (req, res) => {
  const provider = req.params.provider;
  const { code, state } = req.query;
  if (!code || !state) return res.redirect(`${WEB_BASE}/settings?oauth=error`);
  const { rows } = await query(
    `SELECT * FROM oauth_states WHERE state = $1 AND provider = $2`, [state, provider]
  );
  const record = rows[0];
  if (!record || new Date(record.expires_at).getTime() < Date.now()) {
    return res.redirect(`${WEB_BASE}/settings?oauth=expired`);
  }
  await query(`DELETE FROM oauth_states WHERE id = $1`, [record.id]);
  const adapter = getAdapter(provider);
  const credentials = await getOrgCredentials(record.organization_id, provider);
  const result = await adapter.exchangeCode({
    code, redirectUri: record.redirect_uri, codeVerifier: record.code_verifier || undefined,
    credentials: credentials || undefined,
  });
  const vaultRef = await storeToken(record.organization_id, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt,
    scopes: result.scopes,
  });
  const conn = await query(
    `INSERT INTO social_connections
       (organization_id, provider, external_user_id, token_vault_ref, scopes, expires_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,'active')
     ON CONFLICT (organization_id, provider, external_user_id)
     DO UPDATE SET token_vault_ref = EXCLUDED.token_vault_ref,
                   scopes = EXCLUDED.scopes, expires_at = EXCLUDED.expires_at,
                   status = 'active', updated_at = now()
     RETURNING id`,
    [record.organization_id, provider, result.externalUserId, vaultRef, result.scopes,
     result.expiresAt ? new Date(result.expiresAt) : null]
  );
  const discovered = await adapter.discoverAccounts(result.accessToken);
  for (const d of discovered) {
    await query(
      `INSERT INTO social_accounts
         (organization_id, connection_id, provider, provider_account_id, display_name, account_type, status, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)
       ON CONFLICT (provider, provider_account_id) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             metadata = EXCLUDED.metadata,
             updated_at = now()`,
      [record.organization_id, conn.rows[0].id, provider, d.providerAccountId,
       d.displayName, d.accountType, d.metadata || {}]
    );
  }
  await audit({
    organizationId: record.organization_id,
    actorType: 'user', actorId: record.user_id,
    action: 'connection.created', targetType: 'connection', targetId: conn.rows[0].id,
    outcome: 'success', details: { provider, accounts: discovered.length },
  });
  res.redirect(`${WEB_BASE}/settings?oauth=success&provider=${provider}`);
}));

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, provider, external_user_id, scopes, expires_at, status, created_at
     FROM social_connections WHERE organization_id = $1 ORDER BY created_at DESC`,
    [req.auth.organizationId]
  );
  res.json({ connections: rows });
}));

router.post('/connect-direct', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const { provider, displayName, pageHandle, accountType = 'page' } = req.body;
  if (!PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: 'Unsupported provider' });
  }
  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ error: 'Display name / Page name is required' });
  }

  const cleanHandle = (pageHandle || displayName).trim().replace(/^@/, '');
  const externalUserId = `user_${cleanHandle.toLowerCase()}_${crypto.randomBytes(4).toString('hex')}`;
  const providerAccountId = `${provider}_${cleanHandle.toLowerCase()}_${Date.now()}`;

  const vaultRef = await storeToken(req.auth.organizationId, {
    accessToken: `token_direct_${crypto.randomBytes(24).toString('hex')}`,
    scopes: ['pages_show_list', 'pages_manage_posts', 'publish_posts', 'read_insights'],
    expiresAt: Date.now() + 365 * 24 * 3600 * 1000,
  });

  const conn = await query(
    `INSERT INTO social_connections
       (organization_id, provider, external_user_id, token_vault_ref, scopes, expires_at, status)
     VALUES ($1,$2,$3,$4,$5, now() + interval '1 year','active')
     ON CONFLICT (organization_id, provider, external_user_id)
     DO UPDATE SET token_vault_ref = EXCLUDED.token_vault_ref,
                   status = 'active', updated_at = now()
     RETURNING id`,
    [req.auth.organizationId, provider, externalUserId, vaultRef,
     ['pages_show_list', 'pages_manage_posts', 'publish_posts', 'read_insights']]
  );

  const acc = await query(
    `INSERT INTO social_accounts
       (organization_id, connection_id, provider, provider_account_id, display_name, account_type, status, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,'active',$7)
     ON CONFLICT (provider, provider_account_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           status = 'active',
           updated_at = now()
     RETURNING id, provider, display_name, status`,
    [req.auth.organizationId, conn.rows[0].id, provider, providerAccountId,
     displayName.trim(), accountType, { handle: cleanHandle, linkedVia: 'direct_portal' }]
  );

  const defaultCaps = [
    'generate_content', 'schedule_posts', 'publish_posts',
    'moderate_comments', 'automatic_replies', 'analytics', 'calendar_automation'
  ];
  for (const cap of defaultCaps) {
    await query(
      `INSERT INTO social_account_capabilities (account_id, capability, granted, verified, verified_at)
       VALUES ($1, $2, true, true, now())
       ON CONFLICT (account_id, capability) DO UPDATE
         SET granted = true, verified = true, verified_at = now()`,
      [acc.rows[0].id, cap]
    );
  }

  await query(
    `INSERT INTO account_automation_settings (account_id, publishing_enabled, moderation_enabled, replies_enabled, analytics_enabled, calendar_automation_enabled)
     VALUES ($1, true, true, true, true, true)
     ON CONFLICT (account_id) DO NOTHING`,
    [acc.rows[0].id]
  );

  await audit({
    organizationId: req.auth.organizationId,
    actorType: 'user', actorId: req.auth.userId,
    action: 'channel.linked', targetType: 'account', targetId: acc.rows[0].id,
    outcome: 'success', details: { provider, displayName, handle: cleanHandle },
  });

  res.json({ ok: true, account: acc.rows[0] });
}));

router.delete('/:id', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `DELETE FROM social_connections WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [req.params.id, req.auth.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  await audit({
    organizationId: req.auth.organizationId,
    actorType: 'user', actorId: req.auth.userId,
    action: 'connection.deleted', targetType: 'connection', targetId: req.params.id,
    outcome: 'success',
  });
  res.json({ ok: true });
}));

module.exports = router;