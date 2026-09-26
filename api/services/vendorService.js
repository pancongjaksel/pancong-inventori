const { AppError } = require('../errors/AppError');

function normalisasiNamaVendor(nilai) {
  return String(nilai ?? '').trim().replace(/\s+/g, ' ');
}

async function resolveVendor(client, { vendorId, vendorBaru, sumberLegacy }) {
  if (vendorId !== undefined && vendorId !== null && vendorId !== '') {
    const { rows } = await client.query('SELECT id, nama FROM vendor WHERE id = $1 AND aktif = true', [Number(vendorId)]);
    if (!rows[0]) throw new AppError('Vendor yang dipilih tidak tersedia.', 400, 'VENDOR_TIDAK_VALID');
    return { vendorId: rows[0].id, sumber: rows[0].nama };
  }

  const nama = normalisasiNamaVendor(vendorBaru || sumberLegacy);
  if (!nama) throw new AppError('Pilih vendor atau isi nama vendor baru.', 400, 'VENDOR_WAJIB');
  if (nama.length > 150) throw new AppError('Nama vendor maksimal 150 karakter.', 400, 'VENDOR_TERLALU_PANJANG');
  const normalized = nama.toLowerCase();
  const { rows } = await client.query(
    `INSERT INTO vendor (nama, nama_normalized)
     VALUES ($1, $2)
     ON CONFLICT (nama_normalized) DO UPDATE SET updated_at = vendor.updated_at
     RETURNING id, nama`,
    [nama, normalized]
  );
  return { vendorId: rows[0].id, sumber: rows[0].nama };
}

module.exports = { resolveVendor };
