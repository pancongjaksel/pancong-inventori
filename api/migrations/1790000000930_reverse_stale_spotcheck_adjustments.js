/**
 * 1 Okt 2026: spot-check Glagahsari 15 Sep (sesi 3e4249b9...) baru diapprove
 * setelah closing 30 Sep tersedia. Delapan adjustment lama jadi mengubah stok
 * setelah baseline closing. Balikkan hanya delapan ledger tersebut, tanpa
 * menghapus riwayat sumber maupun approvalnya.
 */
exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      jumlah_kandidat INTEGER;
    BEGIN
      SELECT COUNT(*) INTO jumlah_kandidat
      FROM stok_ledger sl
      JOIN stok_opname so ON so.id = sl.referensi_id
      WHERE sl.referensi_tabel = 'stok_opname'
        AND sl.tipe_pergerakan = 'opname_penyesuaian'
        AND so.sesi_id = '3e4249b9-1bb7-42a1-b180-3f913de4a5c1'
        AND so.fase_periode = 'spot_check'
        AND so.tanggal = DATE '2026-09-15';

      IF jumlah_kandidat <> 8 THEN
        RAISE EXCEPTION 'Diharapkan 8 adjustment spot-check lama, ditemukan %; migrasi dihentikan agar tidak mengubah data lain.', jumlah_kandidat;
      END IF;
    END $$;

    INSERT INTO stok_ledger
      (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal, event_key)
    SELECT sl.item_id, sl.gudang_id, 'koreksi_reversal', -sl.qty_delta,
           'stok_opname_koreksi', sl.id, now(),
           CONCAT('reversal-stale-spotcheck-20260915-', sl.id)
    FROM stok_ledger sl
    JOIN stok_opname so ON so.id = sl.referensi_id
    WHERE sl.referensi_tabel = 'stok_opname'
      AND sl.tipe_pergerakan = 'opname_penyesuaian'
      AND so.sesi_id = '3e4249b9-1bb7-42a1-b180-3f913de4a5c1'
      AND so.fase_periode = 'spot_check'
      AND so.tanggal = DATE '2026-09-15'
      AND NOT EXISTS (
        SELECT 1 FROM stok_ledger reversal
        WHERE reversal.event_key = CONCAT('reversal-stale-spotcheck-20260915-', sl.id)
      );
  `);
};

exports.down = false;
