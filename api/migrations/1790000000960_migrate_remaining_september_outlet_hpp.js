/** Migrasi SO Outlet yang dihitung 30 Sep namun diinput Admin Gudang 1 Okt. */
exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE r RECORD; v_opname_id INTEGER; v_source_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_source_count FROM stok_opname
       WHERE lokasi_tipe='outlet' AND outlet_id IN (2,4,5,13)
         AND periode='2026-10' AND tanggal=DATE '2026-10-01'
         AND tipe_opname='awal' AND status='menunggu';
      IF v_source_count <> 105 THEN RAISE EXCEPTION 'Diharapkan 105 baris SO Outlet lama, ditemukan %.', v_source_count; END IF;

      FOR r IN SELECT DISTINCT outlet_id FROM stok_opname
        WHERE lokasi_tipe='outlet' AND outlet_id IN (2,4,5,13) AND periode='2026-10'
          AND tanggal=DATE '2026-10-01' AND tipe_opname='awal' AND status='menunggu'
      LOOP
        SELECT id INTO v_opname_id FROM opname_outlet WHERE outlet_id=r.outlet_id AND periode_dari=DATE '2026-09-01' AND periode_sampai=DATE '2026-09-30';
        IF v_opname_id IS NULL THEN
          INSERT INTO opname_outlet (outlet_id,tanggal_opname,periode_dari,periode_sampai,dibuat_oleh,status)
          VALUES (r.outlet_id,DATE '2026-09-30',DATE '2026-09-01',DATE '2026-09-30','Migrasi SO Admin Gudang','menunggu_approval') RETURNING id INTO v_opname_id;
        END IF;
        WITH legacy AS (
          SELECT CASE WHEN i.kode_barang='X-002' THEN (SELECT id FROM item WHERE kode_barang='X-004') ELSE so.item_id END item_id,
                 SUM(so.stok_fisik * CASE WHEN i.kode_barang='X-002' THEN 8 ELSE 1 END) stok_fisik
          FROM stok_opname so JOIN item i ON i.id=so.item_id
          WHERE so.lokasi_tipe='outlet' AND so.outlet_id=r.outlet_id AND so.periode='2026-10' AND so.tanggal=DATE '2026-10-01' AND so.tipe_opname='awal' AND so.status='menunggu'
          GROUP BY 1
        ), ambil AS (
          SELECT CASE WHEN i.kode_barang='X-002' THEN (SELECT id FROM item WHERE kode_barang='X-004') WHEN i.kode_barang='K-001' THEN (SELECT id FROM item WHERE kode_barang='K-008') ELSE spi.item_id END item_id,
                 SUM(spi.qty * i.faktor_konversi) qty
          FROM sesi_pengambilan_crew spc JOIN sesi_pengambilan_item spi ON spi.sesi_id=spc.id JOIN item i ON i.id=spi.item_id
          WHERE spc.outlet_tujuan_id=r.outlet_id AND spc.tanggal BETWEEN DATE '2026-09-01' AND DATE '2026-09-30' AND spc.label_status IS DISTINCT FROM 'Dikoreksi' GROUP BY 1
        ), aug AS (
          SELECT oi.item_id,oi.stok_akhir FROM opname_outlet oo JOIN opname_outlet_item oi ON oi.opname_id=oo.id
          WHERE oo.outlet_id=r.outlet_id AND oo.status='approved' AND oo.tanggal_opname=DATE '2026-08-31'
        )
        INSERT INTO opname_outlet_item (opname_id,item_id,stok_awal,pengambilan,stok_akhir,harga,catatan)
        SELECT v_opname_id,l.item_id,COALESCE(a.stok_akhir,0),COALESCE(p.qty,0),l.stok_fisik,i.harga,
          CASE WHEN a.item_id IS NULL THEN 'Migrasi closing September: stok awal 0 karena tidak ada closing Agustus.' ELSE 'Migrasi closing September dari input Admin Gudang 1 Oktober.' END
        FROM legacy l JOIN item i ON i.id=l.item_id LEFT JOIN ambil p ON p.item_id=l.item_id LEFT JOIN aug a ON a.item_id=l.item_id
        ON CONFLICT (opname_id,item_id) DO NOTHING;
      END LOOP;
    END $$;
  `);
};
exports.down = false;
