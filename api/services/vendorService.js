const { AppError } = require('../errors/AppError');

// Alias yang sudah dikonfirmasi owner. Dipakai saat vendor baru diketik agar
// variasi penulisan tidak membuat master vendor terpecah lagi.
const ALIAS_VENDOR = new Map([
  ['bms', 'BMS'],
  ['bsm', 'BMS'],
  ['cv berkah manis', 'BMS'],
  ['cv berkah manis sejahtera', 'BMS'],
  ['cv. berkah manis sejahtera', 'BMS'],
  ['manna kampus', 'Mirota'],
]);

function normalisasiNamaVendor(nilai) {
  return String(nilai ?? '').trim().replace(/\s+/g, ' ');
}

async function resolveVendor(client, { vendorId, vendorBaru, sumberLegacy }) {
  if (vendorId !== undefined && vendorId !== null && vendorId !== '') {
    const { rows } = await client.query('SELECT id, nama FROM vendor WHERE id = $1 AND aktif = true', [Number(vendorId)]);
    if (!rows[0]) throw new AppError('Vendor yang dipilih tidak tersedia.', 400, 'VENDOR_TIDAK_VALID');
    return { vendorId: rows[0].id, sumber: rows[0].nama };
  }

  const inputNama = normalisasiNamaVendor(vendorBaru || sumberLegacy);
  const nama = ALIAS_VENDOR.get(inputNama.toLowerCase()) || inputNama;
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
