exports.up = (pgm) => {
  pgm.addColumn('stok_opname', {
    dicatat_oleh_device_id: {
      type: 'integer',
      references: '"device_gudang"',
      onDelete: 'SET NULL',
    },
  });
  pgm.alterColumn('stok_opname', 'dicatat_oleh_user_id', { notNull: false });
};

exports.down = (pgm) => {
  pgm.dropColumn('stok_opname', 'dicatat_oleh_device_id');
  pgm.alterColumn('stok_opname', 'dicatat_oleh_user_id', { notNull: true });
};
