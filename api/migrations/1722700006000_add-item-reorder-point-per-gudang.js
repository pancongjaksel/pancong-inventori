/**
 * Ganti model reorder_point dari 1 kolom global per item (item.reorder_point)
 * jadi tabel terpisah PER GUDANG — kebutuhan nyata: SKU yang sama sering
 * punya ambang beda antara Gudang UGM dan Gudang Glagahsari (kadang selisih
 * jauh), jadi satu angka global gak bisa merepresentasikan itu dengan benar.
 *
 * Baris di item_reorder_point yang gak ada = belum dikonfigurasi buat
 * kombinasi item+gudang itu, sama kayak semantik NULL di kolom lama (gak
 * pernah masuk alert v_stok_menipis).
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE item_reorder_point (
        item_id         INTEGER NOT NULL REFERENCES item(id),
        gudang_id       INTEGER NOT NULL REFERENCES gudang(id),
        reorder_point   NUMERIC(12,2) NOT NULL CHECK (reorder_point >= 0),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (item_id, gudang_id)
    );
    COMMENT ON TABLE item_reorder_point IS
      'Ambang batas stok menipis PER GUDANG (bukan digabung/global) — SKU yang sama boleh punya ambang beda di tiap gudang. Baris gak ada = belum dikonfigurasi, gak masuk alert.';

    DROP VIEW v_stok_menipis;
    CREATE VIEW v_stok_menipis AS
    SELECT
        v.gudang_id,
        v.nama_gudang,
        v.item_id,
        v.kode_barang,
        v.nama_item,
        v.satuan,
        v.stok_saat_ini,
        irp.reorder_point
    FROM v_stok_gudang_saat_ini v
    JOIN item_reorder_point irp ON irp.item_id = v.item_id AND irp.gudang_id = v.gudang_id
    WHERE v.stok_saat_ini < irp.reorder_point;

    ALTER TABLE item DROP COLUMN reorder_point;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE item ADD COLUMN reorder_point NUMERIC(12,2);

    DROP VIEW v_stok_menipis;
    CREATE VIEW v_stok_menipis AS
    SELECT
        v.gudang_id,
        v.nama_gudang,
        v.item_id,
        v.kode_barang,
        v.nama_item,
        v.satuan,
        v.stok_saat_ini,
        i.reorder_point
    FROM v_stok_gudang_saat_ini v
    JOIN item i ON i.id = v.item_id
    WHERE i.reorder_point IS NOT NULL
      AND v.stok_saat_ini < i.reorder_point;

    DROP TABLE item_reorder_point;
  `);
};
