exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE stok_opname
    ADD COLUMN jenis_opname VARCHAR(20) NOT NULL DEFAULT 'bulanan'
    CHECK (jenis_opname IN ('bulanan', 'dadakan'));

    COMMENT ON COLUMN stok_opname.jenis_opname IS
      'Jenis opname: bulanan=resmi (1x/bulan, dicek per periode), dadakan=spot-check (boleh berkali-kali/bulan, dicek per tanggal). Cuma relevan buat lokasi_tipe=gudang — outlet selalu bulanan.';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE stok_opname DROP COLUMN jenis_opname;`);
};
