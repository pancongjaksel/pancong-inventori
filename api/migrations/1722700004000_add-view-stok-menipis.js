/**
 * View stok menipis (dashboard alert, PRD Fase 1). Item dengan
 * reorder_point NULL otomatis gak pernah muncul — belum dikonfigurasi admin.
 * Butuh migration add-reorder-point (1722700001000) sudah jalan duluan.
 */
exports.up = (pgm) => {
  pgm.sql(`
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
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP VIEW v_stok_menipis;`);
};
