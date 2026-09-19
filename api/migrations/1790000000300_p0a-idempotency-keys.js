exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS api_idempotency (
      id BIGSERIAL PRIMARY KEY,
      idempotency_key VARCHAR(200) NOT NULL,
      actor_type VARCHAR(30) NOT NULL,
      actor_id VARCHAR(100) NOT NULL,
      endpoint VARCHAR(200) NOT NULL,
      request_hash CHAR(64) NOT NULL,
      response_status INTEGER,
      response_body JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
      UNIQUE (actor_type, actor_id, endpoint, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS api_idempotency_expiry_idx ON api_idempotency(expires_at);
  `);
};

exports.down = false;
