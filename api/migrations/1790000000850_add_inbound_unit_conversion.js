exports.up = (pgm) => {
  pgm.sql(`
    -- Jumlah pada nota adalah satuan beli; jumlah_stok adalah satuan master
    -- yang dipakai gudang, crew, dan ledger. Keduanya sama kecuali ada
    -- konversi penerimaan yang terdaftar.
    ALTER TABLE transaksi_masuk_item
      ADD COLUMN IF NOT EXISTS jumlah_stok NUMERIC(12,2);
    UPDATE transaksi_masuk_item
    SET jumlah_stok = jumlah
    WHERE jumlah_stok IS NULL;
    ALTER TABLE transaksi_masuk_item
      ALTER COLUMN jumlah_stok SET NOT NULL;
    ALTER TABLE transaksi_masuk_item
      DROP CONSTRAINT IF EXISTS chk_item_jumlah_stok_positif;
    ALTER TABLE transaksi_masuk_item
      ADD CONSTRAINT chk_item_jumlah_stok_positif CHECK (jumlah_stok > 0);

    CREATE TABLE IF NOT EXISTS item_konversi_penerimaan (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
      satuan_beli VARCHAR(30) NOT NULL,
      satuan_beli_normalized VARCHAR(30) NOT NULL,
      faktor_ke_stok NUMERIC(12,4) NOT NULL CHECK (faktor_ke_stok > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (item_id, satuan_beli_normalized)
    );

    INSERT INTO item_konversi_penerimaan (item_id, satuan_beli, satuan_beli_normalized, faktor_ke_stok)
    SELECT id, 'Pack', 'pack', 6
    FROM item
    WHERE kode_barang = 'BA-008'
    ON CONFLICT (item_id, satuan_beli_normalized) DO UPDATE
      SET satuan_beli = EXCLUDED.satuan_beli, faktor_ke_stok = EXCLUDED.faktor_ke_stok;

    -- Nota #86: 6 pack Pandan Pasta bernilai Rp204.000, tetapi stoknya 36 botol.
    UPDATE transaksi_masuk_item mi
    SET jumlah_stok = 36
    FROM item i
    WHERE mi.nota_id = 86 AND mi.item_id = i.id AND i.kode_barang = 'BA-008'
      AND mi.jumlah = 6;

    INSERT INTO stok_ledger
      (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
    SELECT mi.item_id, n.gudang_id, 'masuk', 30, 'transaksi_masuk_nota', n.id, n.tanggal
    FROM transaksi_masuk_nota n
    JOIN transaksi_masuk_item mi ON mi.nota_id = n.id
    JOIN item i ON i.id = mi.item_id
    WHERE n.id = 86 AND i.kode_barang = 'BA-008'
      AND NOT EXISTS (
        SELECT 1 FROM stok_ledger sl
        WHERE sl.item_id = mi.item_id AND sl.gudang_id = n.gudang_id
          AND sl.tipe_pergerakan = 'masuk' AND sl.qty_delta = 30
          AND sl.referensi_tabel = 'transaksi_masuk_nota' AND sl.referensi_id = n.id
      );

    CREATE OR REPLACE FUNCTION fn_transaksi_masuk_nota_ke_ledger()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      IF NEW.status_verifikasi = 'terverifikasi'
         AND (TG_OP = 'INSERT' OR OLD.status_verifikasi IS DISTINCT FROM 'terverifikasi') THEN
        INSERT INTO stok_ledger (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
        SELECT tmi.item_id, NEW.gudang_id, 'masuk', tmi.jumlah_stok, 'transaksi_masuk_nota', NEW.id, NEW.tanggal
        FROM transaksi_masuk_item tmi
        WHERE tmi.nota_id = NEW.id;
      END IF;
      RETURN NEW;
    END;
    $function$;
  `);
};

exports.down = false;
