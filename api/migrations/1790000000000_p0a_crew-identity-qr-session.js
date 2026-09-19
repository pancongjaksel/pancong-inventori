exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS crew (
      id SERIAL PRIMARY KEY,
      kode_internal VARCHAR(50) NOT NULL UNIQUE,
      nama_tampilan VARCHAR(100) NOT NULL,
      aktif BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS crew_qr_session (
      id SERIAL PRIMARY KEY,
      crew_id INTEGER NOT NULL REFERENCES crew(id),
      gudang_id INTEGER NOT NULL REFERENCES gudang(id),
      token_jti VARCHAR(100) UNIQUE,
      token_hash CHAR(64),
      issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      last_seen_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS crew_qr_session_active_idx
      ON crew_qr_session(crew_id, gudang_id) WHERE revoked_at IS NULL;
    ALTER TABLE sesi_pengambilan_crew ADD COLUMN IF NOT EXISTS crew_id INTEGER REFERENCES crew(id);
    ALTER TABLE sesi_pengambilan_crew ADD COLUMN IF NOT EXISTS crew_session_id INTEGER REFERENCES crew_qr_session(id);
    ALTER TABLE transaksi_masuk_nota ADD COLUMN IF NOT EXISTS dibuat_oleh_crew_id INTEGER REFERENCES crew(id);
    ALTER TABLE transaksi_masuk_nota ADD COLUMN IF NOT EXISTS crew_session_id INTEGER REFERENCES crew_qr_session(id);
    ALTER TABLE transaksi_masuk ADD COLUMN IF NOT EXISTS dibuat_oleh_crew_id INTEGER REFERENCES crew(id);
    CREATE INDEX IF NOT EXISTS sesi_pengambilan_crew_identity_idx
      ON sesi_pengambilan_crew(crew_id, gudang_asal_id, outlet_tujuan_id);
  `);
};

exports.down = false;
