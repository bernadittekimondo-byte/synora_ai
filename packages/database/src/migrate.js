const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { getPool, query } = require('./index');

const MIGRATIONS = [
  {
    name: '001_initial_schema',
    sql: `
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        billing_email TEXT,
        plan TEXT NOT NULL DEFAULT 'free',
        emergency_stop BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS organization_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('owner','admin','editor','moderator','viewer')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(organization_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS token_vault (
        ref TEXT PRIMARY KEY,
        organization_id UUID NOT NULL,
        ciphertext TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS social_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        external_user_id TEXT NOT NULL,
        token_vault_ref TEXT NOT NULL,
        scopes TEXT[] NOT NULL DEFAULT '{}',
        expires_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(organization_id, provider, external_user_id)
      );

      CREATE TABLE IF NOT EXISTS social_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        connection_id UUID NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        account_type TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','active','paused','disconnected','suspended','error')),
        activation_version INTEGER NOT NULL DEFAULT 0,
        last_validated_at TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(provider, provider_account_id)
      );

      CREATE TABLE IF NOT EXISTS account_automation_settings (
        account_id UUID PRIMARY KEY REFERENCES social_accounts(id) ON DELETE CASCADE,
        publishing_enabled BOOLEAN NOT NULL DEFAULT false,
        moderation_enabled BOOLEAN NOT NULL DEFAULT false,
        replies_enabled BOOLEAN NOT NULL DEFAULT false,
        analytics_enabled BOOLEAN NOT NULL DEFAULT true,
        calendar_automation_enabled BOOLEAN NOT NULL DEFAULT true,
        daily_limit INTEGER NOT NULL DEFAULT 10,
        quiet_hours_start TEXT,
        quiet_hours_end TEXT,
        tone TEXT,
        custom_rules JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS social_account_capabilities (
        account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
        capability TEXT NOT NULL,
        granted BOOLEAN NOT NULL DEFAULT false,
        verified BOOLEAN NOT NULL DEFAULT false,
        verified_at TIMESTAMPTZ,
        notes TEXT,
        PRIMARY KEY (account_id, capability)
      );

      CREATE TABLE IF NOT EXISTS oauth_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        state TEXT UNIQUE NOT NULL,
        code_verifier TEXT,
        redirect_uri TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS calendar_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        location TEXT,
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ NOT NULL,
        timezone TEXT NOT NULL,
        source_provider TEXT,
        source_provider_id TEXT,
        sync_status TEXT NOT NULL DEFAULT 'manual',
        eligible_for_content BOOLEAN NOT NULL DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        objective TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        ai_metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS content_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
        created_by UUID REFERENCES users(id),
        title TEXT,
        body TEXT NOT NULL,
        media_urls TEXT[] NOT NULL DEFAULT '{}',
        hashtags TEXT[] NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft','scheduled','queued','publishing','published','failed','blocked','cancelled')),
        policy_version TEXT NOT NULL DEFAULT 'v1',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS scheduled_publications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        post_id UUID NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
        scheduled_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled'
          CHECK (status IN ('scheduled','queued','publishing','published','failed','blocked','cancelled')),
        idempotency_key TEXT UNIQUE NOT NULL,
        activation_version INTEGER NOT NULL DEFAULT 0,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TIMESTAMPTZ,
        provider_post_id TEXT,
        provider_response JSONB,
        last_error TEXT,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_sched_status_time
        ON scheduled_publications(status, scheduled_at);

      CREATE TABLE IF NOT EXISTS moderation_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
        provider_comment_id TEXT NOT NULL,
        provider_post_id TEXT,
        author_ref TEXT,
        content TEXT NOT NULL,
        classification JSONB NOT NULL DEFAULT '{}',
        risk_score NUMERIC(4,3),
        severity TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','auto_resolved','escalated','resolved','rejected')),
        suggested_action TEXT,
        action_taken TEXT,
        reviewer_id UUID REFERENCES users(id),
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(account_id, provider_comment_id)
      );

      CREATE TABLE IF NOT EXISTS automated_replies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        moderation_case_id UUID REFERENCES moderation_cases(id) ON DELETE SET NULL,
        account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
        provider_comment_id TEXT NOT NULL,
        reply_text TEXT NOT NULL,
        policy_checks JSONB NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        provider_response JSONB,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS webhook_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider TEXT NOT NULL,
        external_event_id TEXT NOT NULL,
        signature_valid BOOLEAN NOT NULL DEFAULT false,
        payload JSONB NOT NULL,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(provider, external_event_id)
      );

      CREATE TABLE IF NOT EXISTS automation_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        account_id UUID,
        actor_type TEXT NOT NULL,
        actor_id TEXT,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        outcome TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_org_time
        ON automation_audit_logs(organization_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS operational_incidents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        severity TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}',
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS provider_sync_cursors (
        account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
        resource TEXT NOT NULL,
        cursor TEXT,
        last_synced_at TIMESTAMPTZ,
        PRIMARY KEY (account_id, resource)
      );
    `,
  },
  {
    name: '002_provider_api_credentials',
    sql: `
      CREATE TABLE IF NOT EXISTS provider_api_credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        client_id TEXT NOT NULL,
        client_secret_ciphertext TEXT NOT NULL,
        extra_ciphertext TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(organization_id, provider)
      );

      CREATE INDEX IF NOT EXISTS idx_provider_creds_org
        ON provider_api_credentials(organization_id, provider);
    `,
  },
];

async function run() {
  const pool = getPool();
  for (const m of MIGRATIONS) {
    const exists = await query(`SELECT 1 FROM migrations WHERE name = $1`, [m.name]).catch(() => null);
    if (exists && exists.rowCount) {
      console.log(`[migrate] skip ${m.name}`);
      continue;
    }
    console.log(`[migrate] applying ${m.name}`);
    await pool.query('BEGIN');
    try {
      await pool.query(m.sql);
      await pool.query(`INSERT INTO migrations(name) VALUES ($1)`, [m.name]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  }
  console.log('[migrate] done');
  await pool.end();
}

if (require.main === module) {
  run().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };