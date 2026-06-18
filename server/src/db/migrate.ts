import { pool } from './pool.js';

const MIGRATIONS = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username     VARCHAR(50)  UNIQUE NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Database instances table
CREATE TABLE IF NOT EXISTS database_instances (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                       VARCHAR(100) NOT NULL,
  status                     VARCHAR(20)  NOT NULL DEFAULT 'provisioning',
  config                     JSONB NOT NULL,
  connection_string          TEXT,
  read_replica_conn_strings  JSONB DEFAULT '[]',
  host                       VARCHAR(255),
  port                       INTEGER,
  db_name                    VARCHAR(100),
  db_username                VARCHAR(100),
  db_password                TEXT,
  kubernetes_namespace        VARCHAR(100),
  kubernetes_deployment_name  VARCHAR(100),
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON database_instances;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON database_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

async function migrate() {
  console.log('Running migrations...');
  const client = await pool.connect();
  try {
    await client.query(MIGRATIONS);
    console.log('Migrations complete');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
