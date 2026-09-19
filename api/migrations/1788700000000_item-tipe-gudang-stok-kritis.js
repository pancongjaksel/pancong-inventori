exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE item ADD COLUMN IF NOT EXISTS tipe_gudang CHAR(1) NOT NULL DEFAULT 'G';

    UPDATE item SET tipe_gudang = 'P'
    WHERE kode_barang IN ('BA-001','BA-002','BA-003','BA-004','BA-005','BA-006','BA-007');

    CREATE OR REPLACE VIEW v_stok_menipis AS
    SELECT v.gudang_id, v.nama_gudang, v.item_id, v.kode_barang,
           v.nama_item, v.satuan, v.stok_saat_ini, i.reorder_point
    FROM v_stok_gudang_saat_ini v
    JOIN item i ON i.id = v.item_id
    WHERE i.reorder_point IS NOT NULL
      AND v.stok_saat_ini < i.reorder_point
      AND (
        (i.tipe_gudang = 'P' AND v.gudang_id = 1)
        OR (i.tipe_gudang = 'G' AND v.gudang_id <> 1)
        OR i.tipe_gudang = 'A'
      );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE VIEW v_stok_menipis AS
    SELECT v.gudang_id, v.nama_gudang, v.item_id, v.kode_barang,
           v.nama_item, v.satuan, v.stok_saat_ini, i.reorder_point
    FROM v_stok_gudang_saat_ini v
    JOIN item i ON i.id = v.item_id
    WHERE i.reorder_point IS NOT NULL
      AND v.stok_saat_ini < i.reorder_point;

    ALTER TABLE item DROP COLUMN IF EXISTS tipe_gudang;
  `);
};
