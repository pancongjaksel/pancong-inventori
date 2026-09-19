const { AppError } = require('../errors/AppError');
const { pool } = require('../db/pool');
const { buatTokenQrGudang, verifikasiTokenQrGudang } = require('../utils/deviceQrToken');
const { buatTokenDevice } = require('../utils/jwt');

/** Generate konten QR untuk 1 gudang (Admin only). QR permanen, gak expired. */
async function generateQrGudang({ gudangId, adminUserId }) {
  const { rows } = await pool.query('SELECT id, nama, tipe FROM gudang WHERE id = $1', [gudangId]);
  const gudang = rows[0];
  if (!gudang) {
    throw new AppError(`Gudang tidak ditemukan (id=${gudangId}).`, 404, 'GUDANG_TIDAK_DITEMUKAN');
  }
  if (gudang.tipe === 'hub_admin_only') {
    throw new AppError(
      `Gudang "${gudang.nama}" adalah hub admin-only, tidak butuh QR (tidak ada form crew di sana).`,
      400,
      'GUDANG_TIDAK_BUTUH_QR'
    );
  }
  const token = buatTokenQrGudang(gudangId);
  return {
    gudangId,
    namaGudang: gudang.nama,
    token,
    qrContent: `${process.env.APP_BASE_URL || 'https://app.pancongjaksel.com'}/setup-device?token=${token}`,
  };
}

/**
 * Mulai sesi crew dari hasil scan QR. TIDAK ADA LAGI insert ke database —
 * cukup verifikasi QR + terbitkan token sesi berisi nama yang diisi user.
 * Tersimpan di localStorage HP, dipakai berkali-kali sampai user ganti nama
 * manual atau clear browser data.
 */
async function mulaiSesiGudang({ token, nama, crewId }) {
  const gudangId = verifikasiTokenQrGudang(token);
  if (gudangId === null) {
    throw new AppError(
      'QR tidak valid atau rusak. Pastikan scan QR asli yang ditempel di gudang.',
      400,
      'QR_TIDAK_VALID'
    );
  }
  if (!nama || nama.trim().length === 0) {
    throw new AppError('Nama wajib diisi.', 400, 'NAMA_KOSONG');
  }

  const { rows } = await pool.query('SELECT id, nama, tipe FROM gudang WHERE id = $1', [gudangId]);
  const gudang = rows[0];
  if (!gudang || gudang.tipe === 'hub_admin_only') {
    throw new AppError('QR tidak valid — gudang tidak ditemukan atau tidak mendukung crew.', 400, 'QR_TIDAK_VALID');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let selectedCrewId = crewId ? Number(crewId) : null;
    if (selectedCrewId) {
      const { rows } = await client.query('SELECT id, nama_tampilan, aktif FROM crew WHERE id = $1 FOR UPDATE', [selectedCrewId]);
      if (!rows[0] || !rows[0].aktif) throw new AppError('Crew tidak ditemukan atau tidak aktif.', 403, 'CREW_TIDAK_AKTIF');
    } else {
      const kode = `LEGACY-${nama.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`;
      const { rows } = await client.query(
        `INSERT INTO crew (kode_internal, nama_tampilan) VALUES ($1,$2)
         ON CONFLICT (kode_internal) DO UPDATE SET updated_at = now()
         RETURNING id`, [kode, nama.trim()]);
      selectedCrewId = rows[0].id;
    }
    const { rows: sessionRows } = await client.query(
      `INSERT INTO crew_qr_session (crew_id, gudang_id) VALUES ($1,$2) RETURNING id`,
      [selectedCrewId, gudangId],
    );
    const crewSessionId = sessionRows[0].id;
    const deviceToken = buatTokenDevice({ gudangId, nama: nama.trim(), crewId: selectedCrewId, crewSessionId });
    await client.query('COMMIT');
    return { gudangId, namaGudang: gudang.nama, nama: nama.trim(), crewId: selectedCrewId, crewSessionId, deviceToken };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}

module.exports = { generateQrGudang, mulaiSesiGudang };
