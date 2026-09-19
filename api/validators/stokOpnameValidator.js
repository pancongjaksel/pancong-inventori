const { AppError } = require('../errors/AppError');
const { validasiAksesGudangAdmin } = require('./aksesGudangValidator');

const REGEX_PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;
const REGEX_TANGGAL = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/; // YYYY-MM-DD
const JENIS_OPNAME = ['bulanan', 'dadakan'];

function validasiFieldDasar({ itemId, stokFisik, periode, jenisOpname }) {
  if (!itemId) throw new AppError('Item wajib dipilih.', 400, 'ITEM_KOSONG');
  if (stokFisik === undefined || stokFisik === null || stokFisik < 0) {
    throw new AppError('Stok fisik wajib diisi dan tidak boleh negatif.', 400, 'STOK_FISIK_TIDAK_VALID');
  }
  if (!periode || !REGEX_PERIODE.test(periode)) {
    throw new AppError('Periode wajib format "YYYY-MM", mis. "2026-08".', 400, 'PERIODE_TIDAK_VALID');
  }
  if (jenisOpname && !JENIS_OPNAME.includes(jenisOpname)) {
    throw new AppError(`Jenis opname harus 'bulanan' atau 'dadakan', dapat: '${jenisOpname}'.`, 400, 'JENIS_OPNAME_TIDAK_VALID');
  }
}

function validasiTanggal(tanggal, periode) {
  if (!tanggal || !REGEX_TANGGAL.test(tanggal)) {
    throw new AppError('Tanggal wajib format "YYYY-MM-DD", mis. "2026-08-07".', 400, 'TANGGAL_TIDAK_VALID');
  }
  if (periode && tanggal.slice(0, 7) !== periode) {
    throw new AppError(
      `Tanggal opname (${tanggal}) harus berada di bulan periode yang dipilih (${periode}).`,
      400,
      'TANGGAL_DILUAR_PERIODE'
    );
  }
}

async function validasiBelumAdaOpname(client, { lokasiTipe, gudangId, outletId, itemId, periode, jenisOpname, tanggal, tipeOpname }) {
  if (lokasiTipe === 'gudang') {
    const jenis = jenisOpname || 'bulanan';

    if (jenis === 'bulanan') {
      const { rows } = await client.query(
        `SELECT id FROM stok_opname
         WHERE lokasi_tipe = 'gudang' AND gudang_id = $1 AND item_id = $2
         AND periode = $3 AND jenis_opname = 'bulanan'`,
        [gudangId, itemId, periode]
      );
      if (rows.length > 0) {
        throw new AppError(
          `Opname bulanan untuk item ini di periode ${periode} sudah pernah diinput. Kalau mau koreksi angka, hapus dulu lewat proses koreksi manual.`,
          409,
          'OPNAME_SUDAH_ADA'
        );
      }
    } else {
      const { rows } = await client.query(
        `SELECT id FROM stok_opname
         WHERE lokasi_tipe = 'gudang' AND gudang_id = $1 AND item_id = $2
         AND tanggal = $3 AND jenis_opname = 'dadakan'`,
        [gudangId, itemId, tanggal]
      );
      if (rows.length > 0) {
        throw new AppError(
          `Opname dadakan untuk item ini pada tanggal ${tanggal} sudah pernah diinput. Kalau mau koreksi angka, hapus dulu lewat proses koreksi manual.`,
          409,
          'OPNAME_SUDAH_ADA'
        );
      }
    }
    return;
  }

  const tipe = tipeOpname === 'awal' ? 'awal' : 'akhir';
  const { rows } = await client.query(
    `SELECT id FROM stok_opname
     WHERE lokasi_tipe = 'outlet' AND outlet_id = $1 AND item_id = $2 AND periode = $3 AND tipe_opname = $4`,
    [outletId, itemId, periode, tipe]
  );
  if (rows.length > 0) {
    const label = tipe === 'awal' ? 'Stok Awal' : 'Stok Akhir';
    throw new AppError(
      `Opname ${label} untuk item ini di periode ${periode} sudah pernah diinput. Kalau mau koreksi angka, hapus dulu lewat proses koreksi manual.`,
      409,
      'OPNAME_SUDAH_ADA'
    );
  }
}

async function hitungStokSistemGudang(client, { gudangId, itemId }) {
  const { rows } = await client.query(
    `SELECT stok_saat_ini FROM v_stok_gudang_saat_ini WHERE gudang_id = $1 AND item_id = $2`,
    [gudangId, itemId]
  );
  return Number(rows[0]?.stok_saat_ini ?? 0);
}

async function hitungTotalDiterimaOutlet(client, { outletId, itemId, periode }) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(spi.qty), 0) AS total
     FROM sesi_pengambilan_item spi
     JOIN sesi_pengambilan_crew spc ON spc.id = spi.sesi_id
     WHERE spc.outlet_tujuan_id = $1
       AND spi.item_id = $2
       AND to_char(spc.tanggal, 'YYYY-MM') = $3`,
    [outletId, itemId, periode]
  );
  return Number(rows[0].total);
}

async function ambilStokAwalPeriode(client, { outletId, itemId, periode }) {
  const [tahun, bulan] = periode.split('-').map(Number);
  const tanggalPeriode = new Date(Date.UTC(tahun, bulan - 1, 1));
  tanggalPeriode.setUTCMonth(tanggalPeriode.getUTCMonth() - 1);
  const periodeSebelumnya = `${tanggalPeriode.getUTCFullYear()}-${String(tanggalPeriode.getUTCMonth() + 1).padStart(2, '0')}`;

  const { rows } = await client.query(
    `SELECT stok_fisik FROM stok_opname
     WHERE lokasi_tipe = 'outlet' AND outlet_id = $1 AND item_id = $2 AND periode = $3`,
    [outletId, itemId, periodeSebelumnya]
  );

  if (rows.length === 0) {
    return { stokAwal: 0, baseline: false, periodeSebelumnya };
  }
  return { stokAwal: Number(rows[0].stok_fisik), baseline: true, periodeSebelumnya };
}

module.exports = {
  validasiFieldDasar,
  validasiTanggal,
  validasiBelumAdaOpname,
  validasiAksesGudangAdmin,
  hitungStokSistemGudang,
  hitungTotalDiterimaOutlet,
  ambilStokAwalPeriode,
};
