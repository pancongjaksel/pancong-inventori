/**
 * Threshold reorder point PER ITEM (keputusan: bukan angka global).
 * NULL berarti belum di-set — dashboard alert stok menipis (PRD Fase 1)
 * cuma cek item yang reorder_point-nya udah diisi, biar gak nge-alert
 * item yang emang belum pernah dikonfigurasi.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE item ADD COLUMN reorder_point NUMERIC(12,2);
    COMMENT ON COLUMN item.reorder_point IS
      'Ambang batas stok menipis per item (di level gudang, dijumlah semua gudang). NULL = belum dikonfigurasi, tidak masuk alert.';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE item DROP COLUMN reorder_point;`);
};
