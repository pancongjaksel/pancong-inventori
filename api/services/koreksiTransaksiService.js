const { pool } = require('../db/pool');
const { validasiSebelumKoreksi } = require('../validators/koreksiTransaksiValidator');

/**
 * Koreksi/Batalkan Transaksi (5.3) — prinsip: TIDAK ADA HAPUS PERMANEN.
 * Untuk setiap baris stok_ledger yang jadi dampak transaksi asal, dibuatkan
 * baris BARU dengan qty_delta kebalikannya (tipe_pergerakan='koreksi_reversal').
 * Transaksi asal tetap ada di tabelnya, cuma ditandai label_status='Dikoreksi'.
 *
 * Kalau reversal-nya lebih dari 1 baris ledger (mis. sesi_pengambilan_crew
 * dengan banyak item, atau transfer yang udah 'diterima' punya 2 baris ledger),
 * semua baris itu direversal DALAM SATU koreksi_transaksi (1 aksi koreksi =
 * 1 alasan), makanya kolom entri_pembalik_ledger_id di koreksi_transaksi cuma
 * diisi kalau reversal-nya persis 1 baris — buat kasus banyak baris, ambil
 * daftar lengkapnya lewat: SELECT * FROM stok_ledger WHERE referensi_tabel =
 * 'koreksi_transaksi' AND referensi_id = <id koreksi>.
 */
async function koreksiTransaksi(input) {
  const { tabelTransaksi, transaksiAsalId, alasan, olehUserId } = input;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ledgerRows = await validasiSebelumKoreksi(client, {
      tabelTransaksi,
      transaksiAsalId,
      alasan,
      olehUserId,
    });

    // 1) Buat baris koreksi_transaksi dulu, biar dapet id buat referensi balik
    const { rows: koreksiRows } = await client.query(
      `INSERT INTO koreksi_transaksi (tabel_transaksi, transaksi_asal_id, alasan, oleh_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [tabelTransaksi, transaksiAsalId, alasan.trim(), olehUserId]
    );
    const koreksiId = koreksiRows[0].id;

    // 2) Untuk tiap baris ledger asal, insert baris pembalik
    const idLedgerBaru = [];
    for (const baris of ledgerRows) {
      const { rows: pembalikRows } = await client.query(
        `INSERT INTO stok_ledger (item_id, gudang_id, tipe_pergerakan, qty_delta, referensi_tabel, referensi_id, tanggal)
         VALUES ($1, $2, 'koreksi_reversal', $3, 'koreksi_transaksi', $4, now())
         RETURNING id`,
        [baris.item_id, baris.gudang_id, -baris.qty_delta, koreksiId]
      );
      idLedgerBaru.push(pembalikRows[0].id);
    }

    // 3) Kalau cuma 1 baris yang direversal, catat langsung di kolom
    //    entri_pembalik_ledger_id (kenyamanan query, lihat catatan di atas)
    if (idLedgerBaru.length === 1) {
      await client.query(
        `UPDATE koreksi_transaksi SET entri_pembalik_ledger_id = $2 WHERE id = $1`,
        [koreksiId, idLedgerBaru[0]]
      );
    }

    // 4) Tandai transaksi asal 'Dikoreksi' di tabelnya masing-masing.
    //    Nama tabel aman diselipkan langsung karena sudah divalidasi lewat
    //    whitelist TABEL_VALID di validasiSebelumKoreksi (bukan input mentah).
    await client.query(
      `UPDATE ${tabelTransaksi} SET label_status = 'Dikoreksi' WHERE id = $1`,
      [transaksiAsalId]
    );

    await client.query('COMMIT');
    return { koreksiId, jumlahLedgerDireversal: ledgerRows.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { koreksiTransaksi };
