/**
 * Migrasi closing outlet UGM September dari stok_opname (jalur lama) ke
 * opname_outlet (jalur HPP). Angka pengambilan dihitung ulang dari transaksi
 * crew dengan konversi Paper Box dan Keju. Lima item tanpa closing Agustus
 * memakai stok awal 0 berdasarkan persetujuan Owner.
 */
exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      v_opname_id INTEGER;
      v_jumlah_legacy INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_jumlah_legacy
      FROM stok_opname
      WHERE lokasi_tipe = 'outlet'
        AND outlet_id = 1
        AND periode = '2026-09'
        AND tanggal = DATE '2026-09-30'
        AND tipe_opname = 'akhir'
        AND status = 'menunggu';

      IF v_jumlah_legacy <> 26 THEN
        RAISE EXCEPTION 'Diharapkan 26 item SO Outlet UGM September yang menunggu, ditemukan %; migrasi dihentikan.', v_jumlah_legacy;
      END IF;

      SELECT id INTO v_opname_id
      FROM opname_outlet
      WHERE outlet_id = 1
        AND periode_dari = DATE '2026-09-01'
        AND periode_sampai = DATE '2026-09-30';

      IF v_opname_id IS NULL THEN
        INSERT INTO opname_outlet
          (outlet_id, tanggal_opname, periode_dari, periode_sampai, dibuat_oleh, status)
        VALUES
          (1, DATE '2026-09-30', DATE '2026-09-01', DATE '2026-09-30',
           'Migrasi SO Admin Gudang', 'menunggu_approval')
        RETURNING id INTO v_opname_id;
      END IF;

      WITH legacy AS (
        SELECT so.item_id, so.stok_fisik
        FROM stok_opname so
        WHERE so.lokasi_tipe = 'outlet'
          AND so.outlet_id = 1
          AND so.periode = '2026-09'
          AND so.tanggal = DATE '2026-09-30'
          AND so.tipe_opname = 'akhir'
          AND so.status = 'menunggu'
      ),
      pengambilan AS (
        SELECT CASE
                 WHEN i.kode_barang = 'K-001' THEN (SELECT id FROM item WHERE kode_barang = 'K-008')
                 WHEN i.kode_barang = 'X-002' THEN (SELECT id FROM item WHERE kode_barang = 'X-004')
                 ELSE spi.item_id
               END AS item_id,
               SUM(spi.qty * i.faktor_konversi) AS qty
        FROM sesi_pengambilan_crew spc
        JOIN sesi_pengambilan_item spi ON spi.sesi_id = spc.id
        JOIN item i ON i.id = spi.item_id
        WHERE spc.outlet_tujuan_id = 1
          AND spc.tanggal BETWEEN DATE '2026-09-01' AND DATE '2026-09-30'
          AND spc.label_status IS DISTINCT FROM 'Dikoreksi'
        GROUP BY 1
      ),
      closing_agustus AS (
        SELECT ooi.item_id, ooi.stok_akhir
        FROM opname_outlet oo
        JOIN opname_outlet_item ooi ON ooi.opname_id = oo.id
        WHERE oo.outlet_id = 1
          AND oo.status = 'approved'
          AND oo.tanggal_opname = DATE '2026-08-31'
      )
      INSERT INTO opname_outlet_item
        (opname_id, item_id, stok_awal, pengambilan, stok_akhir, harga, catatan)
      SELECT v_opname_id, legacy.item_id,
             COALESCE(closing_agustus.stok_akhir, 0),
             COALESCE(pengambilan.qty, 0),
             legacy.stok_fisik,
             i.harga,
             CASE
               WHEN closing_agustus.item_id IS NULL
                 THEN 'Migrasi SO September: stok awal diasumsikan 0 karena belum tercatat pada closing Agustus.'
               ELSE 'Migrasi SO September dari input Admin Gudang; pengambilan direkonsiliasi dari transaksi crew.'
             END
      FROM legacy
      JOIN item i ON i.id = legacy.item_id
      LEFT JOIN pengambilan ON pengambilan.item_id = legacy.item_id
      LEFT JOIN closing_agustus ON closing_agustus.item_id = legacy.item_id
      ON CONFLICT (opname_id, item_id) DO NOTHING;

      IF (SELECT COUNT(*) FROM opname_outlet_item WHERE opname_id = v_opname_id) <> 26 THEN
        RAISE EXCEPTION 'Migrasi HPP UGM September tidak lengkap; jumlah item bukan 26.';
      END IF;
    END $$;
  `);
};

exports.down = false;
