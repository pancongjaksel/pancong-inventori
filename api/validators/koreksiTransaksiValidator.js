const { AppError } = require('../errors/AppError');
const { validasiAksesGudangAdmin } = require('./aksesGudangValidator');

/** Whitelist tabel yang boleh dikoreksi — dipakai juga buat cegah SQL injection
 * saat nama tabel ini diselipkan langsung ke query dinamis di service. */
const TABEL_VALID = ['transaksi_masuk', 'sesi_pengambilan_crew', 'transfer_gudang'];

/**
 * Cari baris stok_ledger yang perlu direversal untuk satu transaksi asal.
 * Beda tabel, beda cara nyambungin ke stok_ledger:
 * - transaksi_masuk & transfer_gudang: referensi langsung 1:banyak
 *   (transfer_gudang bisa punya 2 baris ledger kalau statusnya udah 'diterima':
 *   transfer_keluar + transfer_masuk — dua-duanya direversal sekaligus)
 * - sesi_pengambilan_crew: ledger-nya nempel di level item (sesi_pengambilan_item),
 *   jadi harus join dulu buat dapetin semua baris item dalam sesi itu
 */
async function cariLedgerUntukDikoreksi(client, tabelTransaksi, transaksiAsalId) {
  if (tabelTransaksi === 'transaksi_masuk' || tabelTransaksi === 'transfer_gudang') {
    const { rows } = await client.query(
      `SELECT id, item_id, gudang_id, qty_delta, tipe_pergerakan
       FROM stok_ledger
       WHERE referensi_tabel = $1 AND referensi_id = $2`,
      [tabelTransaksi, transaksiAsalId]
    );
    return rows;
  }

  // tabelTransaksi === 'sesi_pengambilan_crew'
  const { rows } = await client.query(
    `SELECT sl.id, sl.item_id, sl.gudang_id, sl.qty_delta, sl.tipe_pergerakan
     FROM stok_ledger sl
     JOIN sesi_pengambilan_item spi ON spi.id = sl.referensi_id AND sl.referensi_tabel = 'sesi_pengambilan_item'
     WHERE spi.sesi_id = $1`,
    [transaksiAsalId]
  );
  return rows;
}

/**
 * Cek apakah transaksi ini punya baris di tabelnya (exists), pakai nama
 * tabel dari whitelist TABEL_VALID saja (aman dari injection).
 */
async function transaksiAsalAda(client, tabelTransaksi, transaksiAsalId) {
  const { rows } = await client.query(
    `SELECT id FROM ${tabelTransaksi} WHERE id = $1`,
    [transaksiAsalId]
  );
  return rows.length > 0;
}

/**
 * Validasi lengkap sebelum koreksi dieksekusi. Return ledgerRows yang perlu
 * direversal, supaya service gak perlu query ulang.
 */
async function validasiSebelumKoreksi(client, { tabelTransaksi, transaksiAsalId, alasan, olehUserId }) {
  if (!TABEL_VALID.includes(tabelTransaksi)) {
    throw new AppError(
      `Tabel transaksi "${tabelTransaksi}" tidak dikenal atau tidak boleh dikoreksi lewat jalur ini.`,
      400,
      'TABEL_TIDAK_VALID'
    );
  }
  if (!alasan || alasan.trim().length === 0) {
    throw new AppError('Alasan koreksi wajib diisi.', 400, 'ALASAN_WAJIB');
  }

  const ada = await transaksiAsalAda(client, tabelTransaksi, transaksiAsalId);
  if (!ada) {
    throw new AppError(
      `Transaksi asal tidak ditemukan (${tabelTransaksi}, id=${transaksiAsalId}).`,
      404,
      'TRANSAKSI_TIDAK_DITEMUKAN'
    );
  }

  // Cegah koreksi dobel untuk transaksi yang sama
  const { rows: sudahAda } = await client.query(
    `SELECT id FROM koreksi_transaksi WHERE tabel_transaksi = $1 AND transaksi_asal_id = $2`,
    [tabelTransaksi, transaksiAsalId]
  );
  if (sudahAda.length > 0) {
    throw new AppError(
      'Transaksi ini sudah pernah dikoreksi sebelumnya, tidak bisa dikoreksi dua kali.',
      409,
      'SUDAH_DIKOREKSI'
    );
  }

  const ledgerRows = await cariLedgerUntukDikoreksi(client, tabelTransaksi, transaksiAsalId);
  if (ledgerRows.length === 0) {
    throw new AppError(
      'Transaksi ini belum/tidak berdampak ke stok (mis. barang masuk yang masih ' +
        '"menunggu" verifikasi atau sudah "ditolak"), jadi tidak ada yang perlu direversal. ' +
        'Kalau maksudnya membatalkan input crew yang masih menunggu, pakai aksi "tolak" ' +
        'di endpoint verifikasi barang masuk.',
      400,
      'TIDAK_ADA_DAMPAK_STOK'
    );
  }

  // Admin harus punya akses ke SEMUA gudang yang kena dampak reversal ini
  // (transfer_gudang bisa kena 2 gudang sekaligus: asal & tujuan)
  const gudangIdUnik = [...new Set(ledgerRows.map((r) => r.gudang_id))];
  for (const gudangId of gudangIdUnik) {
    await validasiAksesGudangAdmin(client, { userId: olehUserId, gudangId });
  }

  return ledgerRows;
}

module.exports = { TABEL_VALID, validasiSebelumKoreksi };
