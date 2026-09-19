-- Pancong Checklist Store — migrasi backend
-- Numpang di Postgres instance IMS, tabel diprefix checklist_ biar tidak nabrak.
-- Jalankan: psql "$DATABASE_URL" -f migrations/001_init.sql

BEGIN;

CREATE TABLE IF NOT EXISTS checklist_outlets (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_items (
    id SERIAL PRIMARY KEY,
    outlet_id INTEGER NOT NULL REFERENCES checklist_outlets(id),
    tipe VARCHAR(10) NOT NULL CHECK (tipe IN ('opening','closing')),
    label TEXT NOT NULL,
    urutan INTEGER NOT NULL DEFAULT 0,
    aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_submissions (
    id SERIAL PRIMARY KEY,
    client_uuid UUID NOT NULL UNIQUE,
    outlet_id INTEGER NOT NULL REFERENCES checklist_outlets(id),
    tipe VARCHAR(10) NOT NULL CHECK (tipe IN ('opening','closing')),
    nama_crew VARCHAR(100) NOT NULL,
    completion_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_submission_items (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES checklist_submissions(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES checklist_items(id),
    checked BOOLEAN NOT NULL DEFAULT false,
    skipped BOOLEAN NOT NULL DEFAULT false,
    skip_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_checklist_submissions_outlet ON checklist_submissions(outlet_id, tipe);
CREATE INDEX IF NOT EXISTS idx_checklist_items_outlet_type ON checklist_items(outlet_id, tipe);
CREATE INDEX IF NOT EXISTS idx_checklist_submission_items_submission ON checklist_submission_items(submission_id);

COMMIT;
