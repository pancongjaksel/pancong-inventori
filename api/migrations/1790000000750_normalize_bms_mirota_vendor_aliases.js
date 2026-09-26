exports.up = (pgm) => {
  pgm.sql(`
    WITH mapped AS (
      SELECT id, sumber AS sumber_sebelum,
        CASE lower(BTRIM(COALESCE(sumber, '')))
          WHEN 'cv berkah manis' THEN 'BMS'
          WHEN 'manna kampus' THEN 'Mirota'
        END AS sumber_sesudah
      FROM transaksi_masuk_nota
      WHERE jenis_penerimaan = 'pembelian'
        AND lower(BTRIM(COALESCE(sumber, ''))) IN ('cv berkah manis', 'manna kampus')
    ), updated AS (
      UPDATE transaksi_masuk_nota nota
      SET sumber = mapped.sumber_sesudah
      FROM mapped
      WHERE nota.id = mapped.id
        AND mapped.sumber_sebelum IS DISTINCT FROM mapped.sumber_sesudah
      RETURNING nota.id
    )
    INSERT INTO transaksi_masuk_sumber_audit
      (nota_id, sumber_sebelum, sumber_sesudah, diubah_oleh_user_id)
    SELECT mapped.id, mapped.sumber_sebelum, mapped.sumber_sesudah,
           (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1)
    FROM mapped JOIN updated ON updated.id = mapped.id;

    INSERT INTO vendor (nama, nama_normalized)
    VALUES ('BMS', 'bms'), ('Mirota', 'mirota')
    ON CONFLICT (nama_normalized) DO NOTHING;

    UPDATE transaksi_masuk_nota nota
    SET vendor_id = vendor.id
    FROM vendor
    WHERE nota.jenis_penerimaan = 'pembelian'
      AND lower(BTRIM(COALESCE(nota.sumber, ''))) = vendor.nama_normalized
      AND vendor.nama_normalized IN ('bms', 'mirota');

    -- Disimpan untuk jejak historis, namun tidak lagi tampil di pilihan input.
    UPDATE vendor
    SET aktif = false, updated_at = now()
    WHERE nama_normalized IN ('cv berkah manis', 'manna kampus');
  `);
};

exports.down = false;
