const { AppError } = require('../errors/AppError');

/**
 * Validasi #1 (mirror trigger trg_validasi_outlet_tujuan):
 * outlet_tujuan_id harus outlet yang memang dilayani oleh gudang_asal_id.
 *
 * Dijalankan SEBELUM insert, pakai koneksi yang sama dengan transaksi
 * (client), supaya konsisten dan gak ada race condition antara cek & insert.
 */
async function validasiOutletTujuan(client, { gudangAsalId, outletTujuanId }) {
  const { rows } = await client.query(
    'SELECT id, nama, gudang_asal_id FROM outlet WHERE id = $1',
    [outletTujuanId]
  );

  const outlet = rows[0];
  if (!outlet) {
    throw new AppError(
      `Outlet tujuan tidak ditemukan (id=${outletTujuanId}).`,
      404,
      'OUTLET_TIDAK_DITEMUKAN'
    );
  }

  if (outlet.gudang_asal_id !== gudangAsalId) {
    const { rows: gudangRows } = await client.query(
      'SELECT nama FROM gudang WHERE id = $1',
      [gudangAsalId]
    );
    const namaGudangDipakai = gudangRows[0]?.nama ?? `id=${gudangAsalId}`;

    const { rows: gudangSeharusnyaRows } = await client.query(
      'SELECT nama FROM gudang WHERE id = $1',
      [outlet.gudang_asal_id]
    );
    const namaGudangSeharusnya = gudangSeharusnyaRows[0]?.nama ?? `id=${outlet.gudang_asal_id}`;

    throw new AppError(
      `Outlet "${outlet.nama}" tidak dilayani oleh Gudang ${namaGudangDipakai}. ` +
        `Outlet ini seharusnya diambil dari Gudang ${namaGudangSeharusnya}.`,
      400,
      'OUTLET_TIDAK_SESUAI_GUDANG'
    );
  }
}

/**
 * Validasi #2 (mirror trigger trg_validasi_larangan_bahan_adonan):
 * item kategori 'Bahan Adonan' tidak boleh diambil ke outlet, kecuali BA-008.
 *
 * @param {Array<{itemId: number}>} daftarItem
 */
async function validasiLaranganBahanAdonan(client, daftarItem) {
  if (daftarItem.length === 0) {
    throw new AppError('Sesi pengambilan harus punya minimal 1 item.', 400, 'SESI_KOSONG');
  }

  const itemIds = daftarItem.map((i) => i.itemId);
  const { rows } = await client.query(
    'SELECT id, nama, kategori, kode_barang FROM item WHERE id = ANY($1::int[])',
    [itemIds]
  );

  const itemById = new Map(rows.map((r) => [r.id, r]));

  for (const { itemId } of daftarItem) {
    const item = itemById.get(itemId);
    if (!item) {
      throw new AppError(`Item tidak ditemukan (id=${itemId}).`, 404, 'ITEM_TIDAK_DITEMUKAN');
    }
    if (item.kategori === 'Bahan Adonan' && item.kode_barang !== 'BA-008') {
      throw new AppError(
        `Item "${item.nama}" (${item.kode_barang}) adalah Bahan Adonan dan tidak boleh ` +
          `diambil ke outlet — kecuali BA-008 Pandan Pasta. Hapus item ini dari daftar dulu ya.`,
        400,
        'ITEM_BAHAN_ADONAN_DILARANG'
      );
    }
  }
}

/**
 * Validasi #3: nama crew wajib diisi (bukan cuma whitespace) dan qty tiap
 * item harus > 0. Ini validasi dasar yang gak ada di trigger DB (karena
 * kolom NOT NULL / CHECK udah cukup di level constraint), tapi enak
 * dicek duluan biar pesan errornya spesifik per field.
 */
function validasiFieldDasar({ namaCrew, daftarItem }) {
  if (!namaCrew || namaCrew.trim().length === 0) {
    throw new AppError('Nama crew wajib diisi.', 400, 'NAMA_CREW_KOSONG');
  }
  for (const { qty, itemId } of daftarItem) {
    if (!(qty > 0)) {
      throw new AppError(
        `Qty untuk item id=${itemId} harus lebih dari 0.`,
        400,
        'QTY_TIDAK_VALID'
      );
    }
  }
}

module.exports = {
  validasiOutletTujuan,
  validasiLaranganBahanAdonan,
  validasiFieldDasar,
};
