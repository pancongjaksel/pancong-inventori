exports.up = (pgm) => {
  pgm.sql(`
    WITH mapped AS (
      SELECT id, sumber AS sumber_sebelum
      FROM transaksi_masuk_nota
      WHERE jenis_penerimaan = 'pembelian'
        AND lower(BTRIM(COALESCE(sumber, ''))) IN ('cv berkah manis sejahtera', 'cv. berkah manis sejahtera')
    ), updated AS (
      UPDATE transaksi_masuk_nota nota
      SET sumber = 'BMS'
      FROM mapped
      WHERE nota.id = mapped.id
      RETURNING nota.id
    )
    INSERT INTO transaksi_masuk_sumber_audit
      (nota_id, sumber_sebelum, sumber_sesudah, diubah_oleh_user_id)
    SELECT mapped.id, mapped.sumber_sebelum, 'BMS',
           (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1)
    FROM mapped JOIN updated ON updated.id = mapped.id;

    UPDATE transaksi_masuk_nota nota
    SET vendor_id = vendor.id
    FROM vendor
    WHERE nota.jenis_penerimaan = 'pembelian'
      AND nota.sumber = 'BMS'
      AND vendor.nama_normalized = 'bms';
  `);
};

exports.down = false;
