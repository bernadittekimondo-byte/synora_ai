const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const bcrypt = require('bcryptjs');
const { withTransaction } = require('./index');

const ADMIN_EMAIL = 'admin@mock.synora.local';
const ADMIN_PASSWORD = 'Admin@123';
const ADMIN_NAME = 'Mock Admin';
const ORGANIZATION_NAME = 'Mock Synora Organization';
const ORGANIZATION_SLUG = 'mock-synora-organization';

async function seedAdmin() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const result = await withTransaction(async (client) => {
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name
       RETURNING id`,
      [ADMIN_EMAIL, passwordHash, ADMIN_NAME]
    );
    const organizationResult = await client.query(
      `INSERT INTO organizations (name, slug, billing_email)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name, billing_email = EXCLUDED.billing_email
       RETURNING id`,
      [ORGANIZATION_NAME, ORGANIZATION_SLUG, ADMIN_EMAIL]
    );
    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'admin'`,
      [organizationResult.rows[0].id, userResult.rows[0].id]
    );
    return { userId: userResult.rows[0].id, organizationId: organizationResult.rows[0].id };
  });

  console.log(`[seed:admin] created ${ADMIN_EMAIL} for ${ORGANIZATION_NAME}`);
  console.log(`[seed:admin] password: ${ADMIN_PASSWORD}`);
  console.log(`[seed:admin] userId: ${result.userId}`);
  console.log(`[seed:admin] organizationId: ${result.organizationId}`);
}

seedAdmin()
  .catch((error) => {
    console.error('[seed:admin] failed', error);
    process.exitCode = 1;
  });
