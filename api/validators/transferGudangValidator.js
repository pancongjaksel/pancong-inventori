const { AppError } = require('../errors/AppError');
const { validasiAksesGudangAdmin } = require('./aksesGudangValidator');

/**
 * Validasi sebelum "Kirim" transfer (5.4, langkah 1/2):
 * - gudang asal != gudang tujuan
 * - admin punya akses ke gudang asal
 * - foto bukti kirim wajib (keputusan Q4)
 * - stok gudang asal mencukupi (dicek dari v_stok_gudang_saat_ini, bukan
 *   sekadar constraint DB, karena ini business rule bukan integrity rule)
 */
async function validasiSebelumKirim(client, { itemId, gudangAsalId, gudangTujuanId, jumlah, fotoBuktiKirimUrl, dikirimOlehUserId }) {
  if (gudangAsalId === gudangTujuanId) {
    throw new AppError('Gudang asal dan tujuan tidak boleh sama.', 400, 'GUDANG_SAMA');
  }
  if (!(jumlah > 0)) {
    throw new AppError('Jumlah transfer harus lebih dari 0.', 400, 'JUMLAH_TIDAK_VALID');
  }
  if (!fotoBuktiKirimUrl || fotoBuktiKirimUrl.trim().length === 0) {
    throw new AppError('Foto bukti kirim wajib diunggah.', 400, 'FOTO_BUKTI_WAJIB');
  }

  await validasiAksesGudangAdmin(client, { userId: dikirimOlehUserId, gudangId: gudangAsalId });

  const { rows } = await client.query(
    `SELECT stok_saat_ini FROM v_stok_gudang_saat_ini WHERE gudang_id = $1 AND item_id = $2`,
    [gudangAsalId, itemId]
  );
  const stokSaatIni = rows[0]?.stok_saat_ini ?? 0;

  if (Number(stokSaatIni) < Number(jumlah)) {
    throw new AppError(
      `Stok tidak cukup untuk transfer. Stok saat ini: ${stokSaatIni}, diminta: ${jumlah}.`,
      400,
      'STOK_TIDAK_CUKUP'
    );
  }
}

/**
 * Validasi sebelum "Terima" transfer (5.4, langkah 2/2):
 * - transfer harus ada dan berstatus 'dikirim' (belum diterima, cegah double receive)
 * - admin yang menerima punya akses ke gudang tujuan
 * - foto bukti terima wajib
 *
 * Row di-lock (`FOR UPDATE`) supaya dua orang gak bisa nge-klik "terima"
 * berbarengan untuk transfer yang sama.
 */
async function validasiSebelumTerima(client, { id, diterimaOlehUserId, fotoBuktiTerimaUrl }) {
  if (!fotoBuktiTerimaUrl || fotoBuktiTerimaUrl.trim().length === 0) {
    throw new AppError('Foto bukti terima wajib diunggah.', 400, 'FOTO_BUKTI_WAJIB');
  }

  const { rows } = await client.query(
    'SELECT id, status, gudang_tujuan_id FROM transfer_gudang WHERE id = $1 FOR UPDATE',
    [id]
  );
  const transfer = rows[0];

  if (!transfer) {
    throw new AppError(`Transfer tidak ditemukan (id=${id}).`, 404, 'TRANSFER_TIDAK_DITEMUKAN');
  }
  if (transfer.status !== 'dikirim') {
    throw new AppError(
      `Transfer ini sudah berstatus "${transfer.status}", tidak bisa diterima lagi.`,
      409,
      'TRANSFER_SUDAH_DITERIMA'
    );
  }

  await validasiAksesGudangAdmin(client, { userId: diterimaOlehUserId, gudangId: transfer.gudang_tujuan_id });

  return transfer;
}

module.exports = { validasiSebelumKirim, validasiSebelumTerima };
