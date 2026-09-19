exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE stok_ledger ADD COLUMN IF NOT EXISTS event_key VARCHAR(200);
    ALTER TABLE stok_ledger ADD COLUMN IF NOT EXISTS source_version INTEGER;
    CREATE UNIQUE INDEX IF NOT EXISTS stok_ledger_event_key_unique
      ON stok_ledger(event_key) WHERE event_key IS NOT NULL;
  `);
};

exports.down = false;
