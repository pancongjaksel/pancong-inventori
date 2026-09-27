exports.up = (pgm) => {
  pgm.sql(`
    -- Nota #55 berisi dua asal barang berbeda. Nota gabungan dibatalkan
    -- sebagai jejak audit, lalu Meses dipulihkan sebagai penerimaan dan
    -- Omella dipindahkan ke transfer historis UGM → Glagahsari.
    INSERT INTO koreksi_transaksi (tabel_transaksi, transaksi_asal_id, alasan, oleh_user_id)
    SELECT 'transaksi_masuk_nota', n.id,
           'Koreksi pemilik: Nota #55 dipisah. Meses tetap barang masuk, Omella adalah transfer dari UGM ke Glagahsari.',
           (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1)
    FROM transaksi_masuk_nota n
    WHERE n.id = 55
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
      AND sl.referensi_id = 55
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
    WHERE id = 55;

    -- Pengganti penerimaan hanya untuk Meses, dengan vendor dan foto asli.
    INSERT INTO transaksi_masuk_nota
      (gudang_id, sumber, vendor_id, jenis_penerimaan, foto_bukti_url,
       diinput_oleh_role, diinput_oleh_user_id, nama_crew_input,
       status_verifikasi, diverifikasi_oleh_user_id, catatan_verifikasi,
       tanggal_verifikasi, tanggal, created_at, sumber_transaksi,
       dibuat_oleh_user_id, versi_transaksi,
       verifikasi_terakhir_at, verifikasi_terakhir_oleh_user_id,
       verifikasi_terakhir_oleh_role)
    SELECT n.gudang_id, n.sumber, n.vendor_id, 'pembelian', n.foto_bukti_url,
           n.diinput_oleh_role, n.diinput_oleh_user_id, n.nama_crew_input,
           'menunggu', n.diverifikasi_oleh_user_id,
           'Koreksi historis Nota #55: hanya Meses yang merupakan barang masuk.',
           n.tanggal_verifikasi, n.tanggal, n.created_at, 'koreksi_historis',
           n.diinput_oleh_user_id, 1,
           now(), n.diverifikasi_oleh_user_id, n.diinput_oleh_role
    FROM transaksi_masuk_nota n
    WHERE n.id = 55
      AND NOT EXISTS (
        SELECT 1 FROM transaksi_masuk_nota replacement
        WHERE replacement.sumber_transaksi = 'koreksi_historis'
          AND replacement.catatan_verifikasi = 'Koreksi historis Nota #55: hanya Meses yang merupakan barang masuk.'
      );

    INSERT INTO transaksi_masuk_item (nota_id, item_id, jumlah, satuan, harga_beli)
    SELECT replacement.id, original.item_id, original.jumlah, original.satuan, original.harga_beli
    FROM transaksi_masuk_nota original
    JOIN transaksi_masuk_item source_item ON source_item.nota_id = original.id
    JOIN transaksi_masuk_nota replacement
      ON replacement.sumber_transaksi = 'koreksi_historis'
     AND replacement.catatan_verifikasi = 'Koreksi historis Nota #55: hanya Meses yang merupakan barang masuk.'
    WHERE original.id = 55
      AND source_item.item_id = (SELECT id FROM item WHERE kode_barang = 'X-001')
      AND NOT EXISTS (
        SELECT 1 FROM transaksi_masuk_item existing
        WHERE existing.nota_id = replacement.id AND existing.item_id = source_item.item_id
      );

    -- Item harus sudah ada sebelum status diverifikasi agar trigger standar
    -- mencatat ledger masuk Meses satu kali.
    UPDATE transaksi_masuk_nota
    SET status_verifikasi = 'terverifikasi'
    WHERE sumber_transaksi = 'koreksi_historis'
      AND catatan_verifikasi = 'Koreksi historis Nota #55: hanya Meses yang merupakan barang masuk.'
      AND status_verifikasi = 'menunggu'
      AND EXISTS (
        SELECT 1 FROM transaksi_masuk_item mi
        WHERE mi.nota_id = transaksi_masuk_nota.id
          AND mi.item_id = (SELECT id FROM item WHERE kode_barang = 'X-001')
      );

    INSERT INTO transfer_gudang
      (item_id, gudang_asal_id, gudang_tujuan_id, jumlah, status,
       foto_bukti_kirim_url, foto_bukti_terima_url, dikirim_oleh_user_id,
       tanggal_kirim, tanggal_terima, sumber_transaksi, dibuat_oleh_role,
       dibuat_oleh_user_id, status_verifikasi, versi_transaksi,
       verifikasi_terakhir_at, verifikasi_terakhir_oleh_user_id,
       verifikasi_terakhir_oleh_role, catatan_verifikasi, bukti_verifikasi_ref)
    SELECT
      (SELECT id FROM item WHERE kode_barang = 'O-001'),
      (SELECT id FROM gudang WHERE nama = 'UGM'),
      (SELECT id FROM gudang WHERE nama = 'Glagahsari'),
      10, 'dikirim', n.foto_bukti_url, n.foto_bukti_url, n.diinput_oleh_user_id,
      n.created_at, n.created_at, 'koreksi_historis', n.diinput_oleh_role,
      n.diinput_oleh_user_id, 'approved', 1,
      now(), (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1), 'owner',
      'Koreksi historis Nota #55: transfer 10 Omella dari UGM ke Glagahsari.',
      'koreksi-nota-55-omella'
    FROM transaksi_masuk_nota n
    WHERE n.id = 55
      AND NOT EXISTS (
        SELECT 1 FROM transfer_gudang t WHERE t.bukti_verifikasi_ref = 'koreksi-nota-55-omella'
      );

    UPDATE transfer_gudang
    SET status = 'diterima'
    WHERE bukti_verifikasi_ref = 'koreksi-nota-55-omella'
      AND status = 'dikirim';
  `);
};

exports.down = false;
