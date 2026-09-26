-- PRD PRV-03, TRD Appendix B: Neon Postgres / Relay Storage Schema
-- Zero-Plaintext-at-Rest: No cleartext page content, URLs, or tool arguments stored.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  created_at BIGINT NOT NULL,
  retention_days INTEGER NOT NULL DEFAULT 30,
  deleted_at BIGINT
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  profile TEXT NOT NULL,
  pub_key TEXT NOT NULL,
  last_seen BIGINT,
  revoked_at BIGINT
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices(id),
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  scopes TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  revoked_at BIGINT
);

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  refresh_hash TEXT NOT NULL UNIQUE,
  family TEXT NOT NULL,
  scopes TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  rotated_from TEXT,
  revoked_at BIGINT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  started_at BIGINT NOT NULL,
  ended_at BIGINT,
  steps INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  aborted_reason TEXT
);

CREATE TABLE IF NOT EXISTS audit_meta (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  tool TEXT NOT NULL,
  tier INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  t BIGINT NOT NULL,
  UNIQUE(session_id, seq)
);

CREATE TABLE IF NOT EXISTS egress_log (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  origin_registrable TEXT NOT NULL,
  method TEXT,
  bytes INTEGER,
  decision TEXT NOT NULL,
  t BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_state (
  client_id TEXT PRIMARY KEY,
  window_start BIGINT NOT NULL,
  calls INTEGER NOT NULL,
  tokens INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  scopes TEXT NOT NULL,
  device_id TEXT NOT NULL,
  t BIGINT NOT NULL,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_device ON clients(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_meta(session_id, seq);
