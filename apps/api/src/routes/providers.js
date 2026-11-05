const express = require('express');
const { query } = require('@saas/database');
const { listProviders, isConfigured } = require('@saas/providers');
const { encrypt, decrypt, audit } = require('@saas/security');
const { PROVIDERS } = require('@saas/shared');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

// List providers and their configuration status for this tenant
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const orgId = req.auth.organizationId;
  const { rows } = await query(
    `SELECT provider, client_id, is_active, updated_at
     FROM provider_api_credentials
     WHERE organization_id = $1`,
    [orgId]
  );

  const configuredMap = {};
  const credsByProvider = {};
  for (const r of rows) {
    if (r.is_active && r.client_id) {
      configuredMap[r.provider] = true;
    }
    credsByProvider[r.provider] = {
      clientId: r.client_id,
      isActive: r.is_active,
      updatedAt: r.updated_at,
    };
  }

  const providers = listProviders(configuredMap).map((p) => {
    const cred = credsByProvider[p.name];
    return {
      ...p,
      hasCustomKeys: !!cred,
      customClientId: cred ? cred.clientId : null,
      isActive: cred ? cred.isActive : true,
      lastConfiguredAt: cred ? cred.updatedAt : null,
    };
  });

  res.json({ providers });
}));

// Save or update custom API keys for a provider
router.post('/:provider/credentials', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const provider = req.params.provider;
  if (!PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: `Unsupported provider: ${provider}` });
  }

  const { clientId, clientSecret, extra } = req.body;
  if (!clientId || !clientId.trim()) {
    return res.status(400).json({ error: 'Client ID / App Key is required' });
  }
  if (!clientSecret || !clientSecret.trim()) {
    return res.status(400).json({ error: 'Client Secret is required' });
  }

  const clientSecretCipher = encrypt(clientSecret.trim());
  const extraCipher = extra ? encrypt(JSON.stringify(extra)) : null;

  const { rows } = await query(
    `INSERT INTO provider_api_credentials
       (organization_id, provider, client_id, client_secret_ciphertext, extra_ciphertext, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, true, now())
     ON CONFLICT (organization_id, provider)
     DO UPDATE SET client_id = EXCLUDED.client_id,
                   client_secret_ciphertext = EXCLUDED.client_secret_ciphertext,
                   extra_ciphertext = EXCLUDED.extra_ciphertext,
                   is_active = true,
                   updated_at = now()
     RETURNING id, provider, client_id, is_active, updated_at`,
    [req.auth.organizationId, provider, clientId.trim(), clientSecretCipher, extraCipher]
  );

  await audit({
    organizationId: req.auth.organizationId,
    actorType: 'user',
    actorId: req.auth.userId,
    action: 'provider.credentials_updated',
    targetType: 'provider',
    targetId: provider,
    outcome: 'success',
    details: { provider, clientId: clientId.trim() },
  });

  res.json({ ok: true, credential: rows[0] });
}));

// Delete custom API keys for a provider (falls back to system env if present)
router.delete('/:provider/credentials', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const provider = req.params.provider;
  await query(
    `DELETE FROM provider_api_credentials
     WHERE organization_id = $1 AND provider = $2`,
    [req.auth.organizationId, provider]
  );

  await audit({
    organizationId: req.auth.organizationId,
    actorType: 'user',
    actorId: req.auth.userId,
    action: 'provider.credentials_deleted',
    targetType: 'provider',
    targetId: provider,
    outcome: 'success',
    details: { provider },
  });

  res.json({ ok: true });
}));

module.exports = router;