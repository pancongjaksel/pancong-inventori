exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS vendor (
      id SERIAL PRIMARY KEY,
      nama VARCHAR(150) NOT NULL,
      nama_normalized VARCHAR(150) NOT NULL UNIQUE,
      aktif BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE transaksi_masuk_nota
      ADD COLUMN IF NOT EXISTS vendor_id INTEGER REFERENCES vendor(id),
      ADD COLUMN IF NOT EXISTS jenis_penerimaan VARCHAR(30) NOT NULL DEFAULT 'pembelian';
    ALTER TABLE transaksi_masuk_nota
      DROP CONSTRAINT IF EXISTS transaksi_masuk_nota_jenis_penerimaan_check;
    ALTER TABLE transaksi_masuk_nota
      ADD CONSTRAINT transaksi_masuk_nota_jenis_penerimaan_check
      CHECK (jenis_penerimaan IN ('pembelian', 'transfer_internal'));
    CREATE INDEX IF NOT EXISTS transaksi_masuk_nota_vendor_idx ON transaksi_masuk_nota(vendor_id);
    CREATE INDEX IF NOT EXISTS transaksi_masuk_nota_jenis_idx ON transaksi_masuk_nota(jenis_penerimaan);

    CREATE TABLE IF NOT EXISTS transaksi_masuk_jenis_audit (
      id BIGSERIAL PRIMARY KEY,
      nota_id INTEGER NOT NULL REFERENCES transaksi_masuk_nota(id) ON DELETE CASCADE,
      jenis_sebelum VARCHAR(30) NOT NULL,
      jenis_sesudah VARCHAR(30) NOT NULL,
      alasan TEXT NOT NULL,
      diubah_oleh_user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    WITH internal AS (
      SELECT id, jenis_penerimaan AS jenis_sebelum
      FROM transaksi_masuk_nota
      WHERE lower(BTRIM(COALESCE(sumber, ''))) IN ('gudang kotagede', 'gudang glagasari')
        AND jenis_penerimaan <> 'transfer_internal'
    ), updated AS (
      UPDATE transaksi_masuk_nota nota
      SET jenis_penerimaan = 'transfer_internal', vendor_id = NULL
      FROM internal
      WHERE nota.id = internal.id
      RETURNING nota.id
    )
    INSERT INTO transaksi_masuk_jenis_audit
      (nota_id, jenis_sebelum, jenis_sesudah, alasan, diubah_oleh_user_id)
    SELECT internal.id, internal.jenis_sebelum, 'transfer_internal',
           'Normalisasi data lama: barang berasal dari gudang internal, bukan pembelian.',
           (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1)
    FROM internal JOIN updated ON updated.id = internal.id;

    WITH mapped AS (
      SELECT id, sumber AS sumber_sebelum,
        CASE lower(BTRIM(COALESCE(sumber, '')))
          WHEN 'bms' THEN 'BMS'
          WHEN 'bsm' THEN 'BMS'
          WHEN 'ceria' THEN 'Toko Plastik Ceria'
          WHEN 'ceria plastik' THEN 'Toko Plastik Ceria'
          WHEN 'plastik ceria' THEN 'Toko Plastik Ceria'
          WHEN 'toko plastik ceria' THEN 'Toko Plastik Ceria'
          WHEN 'nuansa jingga' THEN 'Nuansa Jingga'
          WHEN 'nuansa jingga s61' THEN 'Nuansa Jingga'
          WHEN 'pamela 2' THEN 'Pamela'
          WHEN 'pamella 2' THEN 'Pamela'
          WHEN 'pancasari' THEN 'Toko Pancasari'
          WHEN 'toko pancasari' THEN 'Toko Pancasari'
          WHEN 'samkuanpaper' THEN 'Samkuanpaper Shopee'
          WHEN 'samkupaper' THEN 'Samkuanpaper Shopee'
          WHEN 'shopee' THEN 'Koepoe Official Shopee'
          WHEN 'shopee koepoe' THEN 'Koepoe Official Shopee'
          WHEN 'koepoe official' THEN 'Koepoe Official Shopee'
          WHEN 'meses' THEN 'Toko Pancasari'
          ELSE sumber
        END AS sumber_sesudah
      FROM transaksi_masuk_nota
      WHERE jenis_penerimaan = 'pembelian'
    ), updated AS (
      UPDATE transaksi_masuk_nota nota
      SET sumber = mapped.sumber_sesudah
      FROM mapped
      WHERE nota.id = mapped.id
        AND BTRIM(COALESCE(mapped.sumber_sebelum, '')) IS DISTINCT FROM BTRIM(COALESCE(mapped.sumber_sesudah, ''))
      RETURNING nota.id
    )
    INSERT INTO transaksi_masuk_sumber_audit
      (nota_id, sumber_sebelum, sumber_sesudah, diubah_oleh_user_id)
    SELECT mapped.id, NULLIF(BTRIM(mapped.sumber_sebelum), ''), BTRIM(mapped.sumber_sesudah),
           (SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1)
    FROM mapped JOIN updated ON updated.id = mapped.id;

    INSERT INTO vendor (nama, nama_normalized)
    SELECT BTRIM(sumber), lower(regexp_replace(BTRIM(sumber), '\\s+', ' ', 'g'))
    FROM transaksi_masuk_nota
    WHERE jenis_penerimaan = 'pembelian' AND BTRIM(COALESCE(sumber, '')) <> ''
    GROUP BY BTRIM(sumber)
    ON CONFLICT (nama_normalized) DO NOTHING;

    UPDATE transaksi_masuk_nota nota
    SET vendor_id = vendor.id
    FROM vendor
    WHERE nota.jenis_penerimaan = 'pembelian'
      AND lower(regexp_replace(BTRIM(COALESCE(nota.sumber, '')), '\\s+', ' ', 'g')) = vendor.nama_normalized;
  `);
};

exports.down = false;
