exports.up = (pgm) => {
  pgm.sql(`
    -- Nota #58 dan #60 bukan pembelian. Pertahankan dokumen asal sebagai
    -- jejak audit, balikkan ledger penerimaan salah, lalu catat transfer yang
    -- benar. Stok dan laporan belanja akan mengikuti transaksi yang benar.
    INSERT INTO koreksi_transaksi (tabel_transaksi, transaksi_asal_id, alasan, oleh_user_id)
    SELECT 'transaksi_masuk_nota', n.id,
           CASE n.id
             WHEN 58 THEN 'Koreksi pemilik: Nota #58 seharusnya transfer 12 Glaze Greentea dari Produksi ke UGM.'
             WHEN 60 THEN 'Koreksi pemilik: Nota #60 seharusnya transfer 15 Kertas Thermal dari Glagahsari ke UGM.'
           END,
           (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1)
    FROM transaksi_masuk_nota n
    WHERE n.id IN (58, 60)
      AND NOT EXISTS (
        SELECT 1 FROM koreksi_transaksi k
        WHERE k.tabel_transaksi = 'transaksi_masuk_nota' AND k.transaksi_asal_id = n.id
      );

    INSERT INTO stok_ledger
      (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
    SELECT sl.item_id, sl.gudang_id, 'koreksi_reversal', -sl.qty_delta,
           'koreksi_transaksi', k.id, now()
    FROM stok_ledger sl
    JOIN koreksi_transaksi k
      ON k.tabel_transaksi = 'transaksi_masuk_nota' AND k.transaksi_asal_id = sl.referensi_id
    WHERE sl.referensi_tabel = 'transaksi_masuk_nota'
      AND sl.referensi_id IN (58, 60)
      AND NOT EXISTS (
        SELECT 1 FROM stok_ledger reversal
        WHERE reversal.referensi_tabel = 'koreksi_transaksi'
          AND reversal.referensi_id = k.id
          AND reversal.item_id = sl.item_id
          AND reversal.gudang_id = sl.gudang_id
          AND reversal.qty_delta = -sl.qty_delta
      );

    UPDATE transaksi_masuk_nota
    SET label_status = 'Dikoreksi'
    WHERE id IN (58, 60);

    INSERT INTO transfer_gudang
      (item_id, gudang_asal_id, gudang_tujuan_id, jumlah, status,
       foto_bukti_kirim_url, foto_bukti_terima_url, dikirim_oleh_user_id,
       tanggal_kirim, tanggal_terima, sumber_transaksi, dibuat_oleh_role,
       dibuat_oleh_user_id, status_verifikasi, versi_transaksi,
       verifikasi_terakhir_at, verifikasi_terakhir_oleh_user_id,
       verifikasi_terakhir_oleh_role, catatan_verifikasi, bukti_verifikasi_ref)
    SELECT
      CASE n.id WHEN 58 THEN (SELECT id FROM item WHERE kode_barang = 'G-005')
                WHEN 60 THEN (SELECT id FROM item WHERE kode_barang = 'P-007') END,
      CASE n.id WHEN 58 THEN (SELECT id FROM gudang WHERE nama = 'Produksi')
                WHEN 60 THEN (SELECT id FROM gudang WHERE nama = 'Glagahsari') END,
      (SELECT id FROM gudang WHERE nama = 'UGM'),
      CASE n.id WHEN 58 THEN 12 ELSE 15 END,
      'dikirim', n.foto_bukti_url, n.foto_bukti_url, n.diinput_oleh_user_id,
      n.created_at, n.created_at, 'koreksi_historis', n.diinput_oleh_role,
      n.diinput_oleh_user_id, 'approved', 1,
      now(), (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1), 'owner',
      CASE n.id
        WHEN 58 THEN 'Koreksi historis Nota #58: transfer 12 Glaze Greentea dari Produksi ke UGM.'
        WHEN 60 THEN 'Koreksi historis Nota #60: transfer 15 Kertas Thermal dari Glagahsari ke UGM.'
      END,
      'koreksi-nota-' || n.id
    FROM transaksi_masuk_nota n
    WHERE n.id IN (58, 60)
      AND NOT EXISTS (
        SELECT 1 FROM transfer_gudang t WHERE t.bukti_verifikasi_ref = 'koreksi-nota-' || n.id
      );

    -- Peralihan dikirim → diterima memicu ledger masuk UGM lewat trigger
    -- standar transfer. Penerima historis tidak diketahui, jadi dibiarkan NULL.
    UPDATE transfer_gudang
    SET status = 'diterima'
    WHERE bukti_verifikasi_ref IN ('koreksi-nota-58', 'koreksi-nota-60')
      AND status = 'dikirim';
  `);
};

exports.down = false;
