exports.up = (pgm) => {
  pgm.sql(`
    -- Nota #53 bukan pembelian. Dokumen penerimaan tetap disimpan sebagai
    -- jejak audit; mutasi masuk yang salah dibalikkan dan diganti transfer
    -- historis Produksi → UGM sebanyak 12 Glaze Greentea.
    INSERT INTO koreksi_transaksi (tabel_transaksi, transaksi_asal_id, alasan, oleh_user_id)
    SELECT 'transaksi_masuk_nota', n.id,
           'Koreksi pemilik: Nota #53 seharusnya transfer 12 Glaze Greentea dari Produksi ke UGM.',
           (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1)
    FROM transaksi_masuk_nota n
    WHERE n.id = 53
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
      AND sl.referensi_id = 53
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
    WHERE id = 53;

    INSERT INTO transfer_gudang
      (item_id, gudang_asal_id, gudang_tujuan_id, jumlah, status,
       foto_bukti_kirim_url, foto_bukti_terima_url, dikirim_oleh_user_id,
       tanggal_kirim, tanggal_terima, sumber_transaksi, dibuat_oleh_role,
       dibuat_oleh_user_id, status_verifikasi, versi_transaksi,
       verifikasi_terakhir_at, verifikasi_terakhir_oleh_user_id,
       verifikasi_terakhir_oleh_role, catatan_verifikasi, bukti_verifikasi_ref)
    SELECT
      (SELECT id FROM item WHERE kode_barang = 'G-005'),
      (SELECT id FROM gudang WHERE nama = 'Produksi'),
      (SELECT id FROM gudang WHERE nama = 'UGM'),
      12, 'dikirim', n.foto_bukti_url, n.foto_bukti_url, n.diinput_oleh_user_id,
      n.created_at, n.created_at, 'koreksi_historis', n.diinput_oleh_role,
      n.diinput_oleh_user_id, 'approved', 1,
      now(), (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1), 'owner',
      'Koreksi historis Nota #53: transfer 12 Glaze Greentea dari Produksi ke UGM.',
      'koreksi-nota-53'
    FROM transaksi_masuk_nota n
    WHERE n.id = 53
      AND NOT EXISTS (
        SELECT 1 FROM transfer_gudang t WHERE t.bukti_verifikasi_ref = 'koreksi-nota-53'
      );

    -- Trigger standar membuat ledger keluar Produksi dan masuk UGM.
    UPDATE transfer_gudang
    SET status = 'diterima'
    WHERE bukti_verifikasi_ref = 'koreksi-nota-53'
      AND status = 'dikirim';
  `);
};

exports.down = false;
