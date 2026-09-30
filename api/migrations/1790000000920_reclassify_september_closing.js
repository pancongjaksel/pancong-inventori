exports.up = (pgm) => {
  pgm.sql(`
    -- Kedua sesi dihitung fisik pada 30 Sep, namun baru diinput 1 Okt
    -- sebelum workflow Closing Periode tersedia. Hanya metadata periode/fase
    -- yang dirapikan; snapshot stok fisik dan ledger tidak diubah.
    DO $block$
    DECLARE
      jumlah_ugm INTEGER;
      jumlah_glagahsari INTEGER;
    BEGIN
      SELECT COUNT(*) INTO jumlah_ugm
      FROM stok_opname
      WHERE sesi_id = '6042775e-d587-4b10-b6ba-0949bdd014f0';

      SELECT COUNT(*) INTO jumlah_glagahsari
      FROM stok_opname
      WHERE sesi_id = '0fdb1b0d-4f29-41b3-8977-beac82e54cbd';

      IF jumlah_ugm <> 29 OR jumlah_glagahsari <> 29 THEN
        RAISE EXCEPTION 'Sesi closing September tidak sesuai: UGM %, Glagahsari %', jumlah_ugm, jumlah_glagahsari;
      END IF;

      UPDATE stok_opname
      SET periode = '2026-09', tanggal = '2026-09-30', fase_periode = 'closing'
      WHERE sesi_id IN (
        '6042775e-d587-4b10-b6ba-0949bdd014f0',
        '0fdb1b0d-4f29-41b3-8977-beac82e54cbd'
      )
        AND status = 'menunggu'
        AND fase_periode = 'legacy';
    END
    $block$;
  `);
};

exports.down = false;
