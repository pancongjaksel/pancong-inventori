/** Preserve the operational unit chosen when a transfer is recorded. */
exports.up = (pgm) => {
  pgm.addColumns('transfer_gudang', {
    jumlah_input: { type: 'numeric' },
    satuan_input: { type: 'text' },
  }, { ifNotExists: true });
  pgm.sql(`
    UPDATE transfer_gudang tg
    SET jumlah_input = COALESCE(tg.jumlah_input, tg.jumlah),
        satuan_input = COALESCE(tg.satuan_input, i.satuan)
    FROM item i
    WHERE i.id = tg.item_id
      AND (tg.jumlah_input IS NULL OR tg.satuan_input IS NULL);
  `);
};
exports.down = false;
