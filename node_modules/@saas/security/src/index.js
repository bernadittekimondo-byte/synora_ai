const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('@saas/database');

// ---------- Token Vault ----------
const ALGO = 'aes-256-gcm';

function getKey() {
  const hex = process.env.ENCRYPTION_KEY || '';
  if (hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  return Buffer.from(hex, 'hex');
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decrypt(payload) {
  const [v, ivB64, tagB64, dataB64] = payload.split(':');
  if (v !== 'v1') throw new Error('Unsupported token version');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

async function storeToken(organizationId, bundle) {
  const ref = `vault:${crypto.randomUUID()}`;
  await query(
    `INSERT INTO token_vault(ref, organization_id, ciphertext) VALUES ($1,$2,$3)`,
    [ref, organizationId, encrypt(JSON.stringify(bundle))]
  );
  return ref;
}

async function loadToken(ref) {
  const { rows } = await query(`SELECT ciphertext FROM token_vault WHERE ref = $1`, [ref]);
  if (!rows[0]) throw new Error('Token reference not found');
  return JSON.parse(decrypt(rows[0].ciphertext));
}

async function revokeToken(ref) {
  await query(`DELETE FROM token_vault WHERE ref = $1`, [ref]);
}

// ---------- Password + JWT ----------
function hashPassword(pw) { return bcrypt.hash(pw, 12); }
function verifyPassword(pw, hash) { return bcrypt.compare(pw, hash); }

function issueToken(payload, ttlSec = 60 * 60 * 24) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ttlSec });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// ---------- Audit ----------
async function audit(input) {
  try {
    await query(
      `INSERT INTO automation_audit_logs
       (organization_id, account_id, actor_type, actor_id, action, target_type, target_id, outcome, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        input.organizationId,
        input.accountId || null,
        input.actorType,
        input.actorId || null,
        input.action,
        input.targetType || null,
        input.targetId || null,
        input.outcome,
        input.details || {},
      ]
    );
  } catch (e) {
    console.error('[audit] failed', e);
  }
}

async function assertAccountAccess(auth, accountId) {
  const { rows } = await query(
    `SELECT id, organization_id, status FROM social_accounts WHERE id = $1`,
    [accountId]
  );
  if (!rows[0]) throw Object.assign(new Error('Account not found'), { status: 404 });
  if (rows[0].organization_id !== auth.organizationId) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return rows[0];
}

module.exports = {
  encrypt, decrypt,
  storeToken, loadToken, revokeToken,
  hashPassword, verifyPassword, issueToken, verifyToken,
  audit, assertAccountAccess,
};