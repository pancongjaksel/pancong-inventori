const { AppError } = require('../errors/AppError');
const { validasiAksesGudangAdmin } = require('./aksesGudangValidator');

function validasiFieldNota({ items, fotoBuktiUrl }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('Minimal 1 item wajib diisi.', 400, 'ITEMS_KOSONG');
  }
  for (const it of items) {
    if (!it.itemId) throw new AppError('Setiap baris wajib pilih item.', 400, 'ITEM_KOSONG');
    if (!(it.jumlah > 0)) throw new AppError('Jumlah setiap item harus lebih dari 0.', 400, 'JUMLAH_TIDAK_VALID');
    if (!it.satuan || String(it.satuan).trim().length === 0) {
      throw new AppError('Satuan setiap item wajib diisi.', 400, 'SATUAN_KOSONG');
    }
  }
  if (!fotoBuktiUrl || fotoBuktiUrl.trim().length === 0) {
    throw new AppError('Foto bukti nota wajib diunggah.', 400, 'FOTO_BUKTI_WAJIB');
  }
}

/** Harga pembelian adalah nilai finansial; nol, negatif, dan duplikasi baris
 * tidak boleh ikut tersimpan agar laporan belanja tidak menghasilkan total palsu. */
function validasiUpdateHargaNota({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('Minimal 1 harga barang wajib diisi.', 400, 'HARGA_ITEMS_KOSONG');
  }

  const itemRowIds = new Set();
  for (const item of items) {
    const itemRowId = Number(item?.itemRowId);
    const hargaBeli = Number(item?.hargaBeli);
    if (!Number.isInteger(itemRowId) || itemRowId <= 0) {
      throw new AppError('Baris barang tidak valid.', 400, 'ITEM_ROW_TIDAK_VALID');
    }
    if (!Number.isFinite(hargaBeli) || hargaBeli <= 0) {
      throw new AppError('Harga beli setiap barang harus lebih dari 0.', 400, 'HARGA_BELI_TIDAK_VALID');
    }
    if (itemRowIds.has(itemRowId)) {
      throw new AppError('Satu baris barang hanya boleh diubah sekali.', 400, 'ITEM_ROW_DUPLIKAT');
    }
    itemRowIds.add(itemRowId);
  }
}

function validasiUpdateSumberNota({ sumber }) {
  const nilai = String(sumber ?? '').trim();
  if (!nilai) {
    throw new AppError('Nama toko atau vendor wajib diisi.', 400, 'SUMBER_KOSONG');
  }
  if (nilai.length > 150) {
    throw new AppError('Nama toko atau vendor maksimal 150 karakter.', 400, 'SUMBER_TERLALU_PANJANG');
  }
  return nilai;
}

async function validasiInputAdminNota(client, { userId, gudangId }) {
  await validasiAksesGudangAdmin(client, { userId, gudangId });
}

/** Dipakai crew — nota crew gak boleh masuk ke gudang hub_admin_only (Produksi). */
async function validasiGudangBisaTerimaBarang(client, gudangId) {
  const { rows } = await client.query('SELECT id, tipe, nama FROM gudang WHERE id = $1', [gudangId]);
  const gudang = rows[0];
  if (!gudang) {
    throw new AppError(`Gudang tidak ditemukan (id=${gudangId}).`, 404, 'GUDANG_TIDAK_DITEMUKAN');
  }
  if (gudang.tipe === 'hub_admin_only') {
    throw new AppError(
      `Gudang "${gudang.nama}" adalah hub admin-only — barang masuk di sini hanya bisa diinput Admin.`,
      403,
      'GUDANG_ADMIN_ONLY'
    );
  }
}

async function validasiInputCrewNota(client, { gudangId, namaCrewInput }) {
  if (!namaCrewInput || namaCrewInput.trim().length === 0) {
    throw new AppError('Nama crew wajib diisi.', 400, 'NAMA_CREW_KOSONG');
  }
  await validasiGudangBisaTerimaBarang(client, gudangId);
}

/**
 * Device Admin Gudang — beda dari crew, gudang-nya gak nempel di token
 * (admin_gudang gak gudang-scoped), jadi gudangId datang dari body request
 * (dipilih user di form) dan divalidasi lewat validasiAksesGudangAdmin
 * (sama pola dengan stok-opname/transfer-gudang), bukan dari req.device.
 * Tidak ada batasan tipe gudang — admin_gudang boleh input ke Produksi juga.
 */
async function validasiInputAdminGudangNota(client, { userId, gudangId }) {
  await validasiAksesGudangAdmin(client, { userId, gudangId });
}

async function validasiSebelumVerifikasiNota(client, { id, aksi, adminUserId, catatan, revisiItems }) {
  const { rows } = await client.query(
    'SELECT id, gudang_id, status_verifikasi FROM transaksi_masuk_nota WHERE id = $1 FOR UPDATE',
    [id]
  );
  const nota = rows[0];

  if (!nota) {
    throw new AppError(`Nota barang masuk tidak ditemukan (id=${id}).`, 404, 'NOTA_TIDAK_DITEMUKAN');
  }
  if (nota.status_verifikasi !== 'menunggu') {
    throw new AppError(
      `Nota ini sudah diproses sebelumnya (status: ${nota.status_verifikasi}), tidak bisa diverifikasi ulang.`,
      409,
      'NOTA_SUDAH_DIPROSES'
    );
  }

  await validasiAksesGudangAdmin(client, { userId: adminUserId, gudangId: nota.gudang_id });

  if (aksi === 'revisi' && (!Array.isArray(revisiItems) || revisiItems.length === 0)) {
    throw new AppError('Minimal 1 item revisi wajib diisi.', 400, 'REVISI_ITEMS_KOSONG');
  }
  if (aksi === 'tolak' && (!catatan || catatan.trim().length === 0)) {
    throw new AppError('Alasan penolakan wajib diisi.', 400, 'ALASAN_TOLAK_WAJIB');
  }
  if (!['setujui', 'revisi', 'tolak'].includes(aksi)) {
    throw new AppError(`Aksi verifikasi tidak dikenal: "${aksi}".`, 400, 'AKSI_TIDAK_VALID');
  }

  return nota;
}

module.exports = {
  validasiFieldNota,
  validasiUpdateHargaNota,
  validasiUpdateSumberNota,
  validasiInputAdminNota,
  validasiInputCrewNota,
  validasiInputAdminGudangNota,
  validasiSebelumVerifikasiNota,
};
