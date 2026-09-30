exports.up = (pgm) => {
  pgm.sql(`
    -- Fase membedakan titik awal sistem, closing resmi, dan spot-check.
    -- Data lama tetap dipertahankan sebagai legacy agar tidak memblokir closing baru.
    ALTER TABLE stok_opname
      ADD COLUMN IF NOT EXISTS fase_periode VARCHAR(20) NOT NULL DEFAULT 'legacy';

    ALTER TABLE stok_opname
      DROP CONSTRAINT IF EXISTS chk_stok_opname_fase_periode;
    ALTER TABLE stok_opname
      ADD CONSTRAINT chk_stok_opname_fase_periode
      CHECK (fase_periode IN ('baseline', 'closing', 'spot_check', 'legacy'));

    UPDATE stok_opname
       SET fase_periode = 'baseline'
     WHERE lokasi_tipe = 'gudang'
       AND jenis_opname = 'bulanan'
       AND status = 'diapprove'
       AND tanggal = date_trunc('month', tanggal)::date;

    UPDATE stok_opname
       SET fase_periode = 'spot_check'
     WHERE lokasi_tipe = 'gudang'
       AND jenis_opname = 'dadakan';

    DROP INDEX IF EXISTS uq_opname_gudang_bulanan_periode;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_opname_gudang_closing_periode
      ON stok_opname (gudang_id, item_id, periode)
      WHERE lokasi_tipe = 'gudang' AND fase_periode = 'closing';

    CREATE UNIQUE INDEX IF NOT EXISTS uq_opname_gudang_baseline_periode
      ON stok_opname (gudang_id, item_id, periode)
      WHERE lokasi_tipe = 'gudang' AND fase_periode = 'baseline';

    -- Satu closing outlet untuk satu periode laporan, walaupun dikirim
    -- beberapa hari setelah akhir bulan.
    CREATE UNIQUE INDEX IF NOT EXISTS uq_opname_outlet_periode_laporan
      ON opname_outlet (outlet_id, periode_dari, periode_sampai);
  `);
};

exports.down = false;
