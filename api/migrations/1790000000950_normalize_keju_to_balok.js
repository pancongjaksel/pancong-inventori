/**
 * Keju X-004 (balok 250gr) menjadi satuan stok resmi.
 * X-002 (slop) dipertahankan sebagai arsip, lalu saldo aktifnya direklasifikasi
 * memakai dua ledger audit per gudang. Tidak ada ledger/transaksi lama diubah.
 */
exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      v_slop_id INTEGER;
      v_balok_id INTEGER;
      r RECORD;
      v_event_key TEXT;
    BEGIN
      SELECT id INTO v_slop_id FROM item WHERE kode_barang = 'X-002';
      SELECT id INTO v_balok_id FROM item WHERE kode_barang = 'X-004';
      IF v_slop_id IS NULL OR v_balok_id IS NULL THEN
        RAISE EXCEPTION 'Master Keju X-002/X-004 tidak lengkap.';
      END IF;

      INSERT INTO item_konversi_penerimaan
        (item_id, satuan_beli, satuan_beli_normalized, faktor_ke_stok)
      VALUES (v_balok_id, 'Slop', 'slop', 8)
      ON CONFLICT (item_id, satuan_beli_normalized)
      DO UPDATE SET faktor_ke_stok = EXCLUDED.faktor_ke_stok;

      FOR r IN
        SELECT gudang_id, SUM(qty_delta) AS saldo_slop
        FROM stok_ledger
        WHERE item_id = v_slop_id
        GROUP BY gudang_id
        HAVING SUM(qty_delta) <> 0
      LOOP
        v_event_key := 'konversi-keju-balok-v1-gudang-' || r.gudang_id;
        IF NOT EXISTS (SELECT 1 FROM stok_ledger WHERE event_key = v_event_key) THEN
          INSERT INTO stok_ledger
            (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal, event_key, source_version)
          VALUES
            (v_slop_id, r.gudang_id, 'konversi_satuan', -r.saldo_slop, 'konversi_satuan_keju', v_slop_id, CURRENT_DATE, v_event_key, 1),
            (v_balok_id, r.gudang_id, 'konversi_satuan', r.saldo_slop * 8, 'konversi_satuan_keju', v_slop_id, CURRENT_DATE, v_event_key || '-balok', 1);
        END IF;
      END LOOP;

      UPDATE item
      SET status_aktif = false,
          catatan_migrasi = 'Arsip satuan lama. Keju baru dicatat sebagai X-004 balok 250gr; 1 slop = 8 balok.'
      WHERE id = v_slop_id;
    END $$;
  `);
};

exports.down = false;
