exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS transaksi_masuk_qty_audit (
      id BIGSERIAL PRIMARY KEY,
      nota_id INTEGER NOT NULL REFERENCES transaksi_masuk_nota(id) ON DELETE CASCADE,
      transaksi_masuk_item_id INTEGER NOT NULL REFERENCES transaksi_masuk_item(id),
      jumlah_sebelum NUMERIC(12,2) NOT NULL,
      jumlah_sesudah NUMERIC(12,2) NOT NULL,
      diubah_oleh_user_id INTEGER REFERENCES users(id),
      alasan TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS transaksi_masuk_qty_audit_nota_idx
      ON transaksi_masuk_qty_audit(nota_id, created_at DESC);

    -- Nota 54 adalah penerimaan terverifikasi. Qty diubah dari 10 ke 100,
    -- lalu ledger ditambah 90 dengan referensi nota yang sama. Dengan begitu,
    -- jika nota dikoreksi formal kelak, seluruh 100 pcs ikut direversal.
    UPDATE transaksi_masuk_item mi
    SET jumlah = 100
    FROM item i
    WHERE mi.item_id = i.id AND mi.nota_id = 54
      AND i.kode_barang = 'P-007' AND mi.jumlah = 10;

    INSERT INTO transaksi_masuk_qty_audit
      (nota_id, transaksi_masuk_item_id, jumlah_sebelum, jumlah_sesudah, diubah_oleh_user_id, alasan)
    SELECT mi.nota_id, mi.id, 10, 100,
           (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1),
           'Koreksi pemilik: jumlah Kertas Thermal pada Nota #54 seharusnya 100 pcs.'
    FROM transaksi_masuk_item mi
    JOIN item i ON i.id = mi.item_id
    WHERE mi.nota_id = 54 AND i.kode_barang = 'P-007' AND mi.jumlah = 100
    AND NOT EXISTS (
      SELECT 1 FROM transaksi_masuk_qty_audit
      WHERE nota_id = mi.nota_id AND transaksi_masuk_item_id = mi.id AND jumlah_sebelum = 10 AND jumlah_sesudah = 100
    );

    INSERT INTO stok_ledger
      (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
    SELECT mi.item_id, n.gudang_id, 'masuk', 90, 'transaksi_masuk_nota', n.id, n.tanggal
    FROM transaksi_masuk_nota n
    JOIN transaksi_masuk_item mi ON mi.nota_id = n.id
    JOIN item i ON i.id = mi.item_id
    WHERE n.id = 54
      AND i.kode_barang = 'P-007'
      AND NOT EXISTS (
        SELECT 1 FROM stok_ledger
        WHERE item_id = mi.item_id AND gudang_id = n.gudang_id AND tipe_pergerakan = 'masuk'
          AND qty_delta = 90 AND referensi_tabel = 'transaksi_masuk_nota' AND referensi_id = n.id
      );
  `);
};

exports.down = false;
