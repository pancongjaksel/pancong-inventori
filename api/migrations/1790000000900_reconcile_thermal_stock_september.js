exports.up = (pgm) => {
  pgm.sql(`
    -- Rekonsiliasi fisik yang dikonfirmasi pemilik untuk Kertas Thermal (P-007).
    -- Semua perubahan dibuat idempoten dan meninggalkan jejak audit/ledger.
    CREATE TABLE IF NOT EXISTS stok_opname_koreksi_audit (
      id SERIAL PRIMARY KEY,
      stok_opname_id INTEGER NOT NULL REFERENCES stok_opname(id),
      stok_fisik_sebelum NUMERIC(12,2) NOT NULL,
      stok_fisik_sesudah NUMERIC(12,2) NOT NULL,
      qty_delta_ledger NUMERIC(12,2) NOT NULL,
      alasan TEXT NOT NULL,
      diubah_oleh_user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    INSERT INTO stok_opname_koreksi_audit
      (stok_opname_id, stok_fisik_sebelum, stok_fisik_sesudah, qty_delta_ledger, alasan, diubah_oleh_user_id)
    SELECT so.id, so.stok_fisik,
           CASE so.id WHEN 185 THEN 50 ELSE 16 END,
           CASE so.id WHEN 185 THEN 45 ELSE 15 END,
           'Koreksi pemilik: stok awal Kertas Thermal diverifikasi fisik.',
           (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1)
    FROM stok_opname so
    JOIN item i ON i.id = so.item_id
    WHERE i.kode_barang = 'P-007'
      AND ((so.id = 185 AND so.stok_fisik = 5) OR (so.id = 211 AND so.stok_fisik = 1))
      AND NOT EXISTS (
        SELECT 1 FROM stok_opname_koreksi_audit audit
        WHERE audit.stok_opname_id = so.id
          AND audit.stok_fisik_sesudah = CASE so.id WHEN 185 THEN 50 ELSE 16 END
      );

    UPDATE stok_opname
    SET stok_fisik = CASE id WHEN 185 THEN 50 WHEN 211 THEN 16 END
    WHERE (id = 185 AND stok_fisik = 5) OR (id = 211 AND stok_fisik = 1);

    INSERT INTO stok_ledger
      (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal, event_key)
    SELECT so.item_id, so.gudang_id, 'opname_penyesuaian',
           CASE so.id WHEN 185 THEN 45 ELSE 15 END,
           'stok_opname', so.id, now(),
           CONCAT('koreksi-opname-thermal-', so.id, '-20260928')
    FROM stok_opname so
    JOIN item i ON i.id = so.item_id
    WHERE so.id IN (185, 211) AND i.kode_barang = 'P-007'
      AND NOT EXISTS (
        SELECT 1 FROM stok_ledger sl
        WHERE sl.event_key = CONCAT('koreksi-opname-thermal-', so.id, '-20260928')
      );

    -- Pengambilan Hafni 28 September: fisik 20 pcs, sebelumnya tercatat 2 pcs.
    UPDATE sesi_pengambilan_item
    SET qty = 20,
        qty_asli = COALESCE(qty_asli, qty),
        dikoreksi_oleh = 'Owner',
        dikoreksi_at = now()
    WHERE id = 1386 AND qty = 2;

    UPDATE stok_ledger
    SET qty_delta = -20
    WHERE referensi_tabel = 'sesi_pengambilan_item'
      AND referensi_id = 1386
      AND tipe_pergerakan = 'keluar_ke_crew'
      AND qty_delta = -2;

    -- Transfer #38 tidak terjadi. Pertahankan riwayat transfer, beri label Dikoreksi,
    -- dan netralkan kedua ledger-nya melalui koreksi formal.
    DO $$
    DECLARE
      v_koreksi_id INTEGER;
      v_owner_id INTEGER;
    BEGIN
      SELECT id INTO v_owner_id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1;
      SELECT id INTO v_koreksi_id
      FROM koreksi_transaksi
      WHERE tabel_transaksi = 'transfer_gudang' AND transaksi_asal_id = 38
      ORDER BY id LIMIT 1;

      IF v_koreksi_id IS NULL THEN
        INSERT INTO koreksi_transaksi (tabel_transaksi, transaksi_asal_id, alasan, oleh_user_id)
        VALUES ('transfer_gudang', 38, 'Koreksi pemilik: transfer Kertas Thermal Glagahsari ke UGM tidak terjadi secara fisik.', v_owner_id)
        RETURNING id INTO v_koreksi_id;
      END IF;

      INSERT INTO stok_ledger
        (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal, event_key)
      SELECT sl.item_id, sl.gudang_id, 'koreksi_reversal', -sl.qty_delta,
             'koreksi_transaksi', v_koreksi_id, now(),
             CONCAT('koreksi-transfer-38-thermal-', sl.id)
      FROM stok_ledger sl
      WHERE sl.referensi_tabel = 'transfer_gudang'
        AND sl.referensi_id = 38
        AND NOT EXISTS (
          SELECT 1 FROM stok_ledger reversal
          WHERE reversal.event_key = CONCAT('koreksi-transfer-38-thermal-', sl.id)
        );

      UPDATE transfer_gudang SET label_status = 'Dikoreksi' WHERE id = 38;
    END $$;
  `);
};

exports.down = false;
