const { AppError } = require('../errors/AppError');
const { validasiAksesGudangAdmin } = require('./aksesGudangValidator');

const REGEX_PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/; // 'YYYY-MM'

function validasiFieldDasar({ itemId, stokFisik, periode }) {
  if (!itemId) throw new AppError('Item wajib dipilih.', 400, 'ITEM_KOSONG');
  if (stokFisik === undefined || stokFisik === null || stokFisik < 0) {
    throw new AppError('Stok fisik wajib diisi dan tidak boleh negatif.', 400, 'STOK_FISIK_TIDAK_VALID');
  }
  if (!periode || !REGEX_PERIODE.test(periode)) {
    throw new AppError('Periode wajib format "YYYY-MM", mis. "2026-08".', 400, 'PERIODE_TIDAK_VALID');
  }
}

/** Cegah input dobel untuk kombinasi lokasi+item+periode yang sama (mirror uq_opname_periode). */
async function validasiBelumAdaOpname(client, { lokasiTipe, gudangId, outletId, itemId, periode }) {
  const { rows } = await client.query(
    `SELECT id FROM stok_opname
     WHERE lokasi_tipe = $1
       AND gudang_id IS NOT DISTINCT FROM $2
       AND outlet_id IS NOT DISTINCT FROM $3
       AND item_id = $4
       AND periode = $5`,
    [lokasiTipe, gudangId ?? null, outletId ?? null, itemId, periode]
  );
  if (rows.length > 0) {
    throw new AppError(
      `Opname untuk item ini di periode ${periode} sudah pernah diinput. Kalau mau ` +
        `koreksi angka, hapus dulu lewat proses koreksi manual (belum ada endpoint update).`,
      409,
      'OPNAME_SUDAH_ADA'
    );
  }
}

/** Snapshot stok sistem gudang saat ini, dari view v_stok_gudang_saat_ini. */
async function hitungStokSistemGudang(client, { gudangId, itemId }) {
  const { rows } = await client.query(
    `SELECT stok_saat_ini FROM v_stok_gudang_saat_ini WHERE gudang_id = $1 AND item_id = $2`,
    [gudangId, itemId]
  );
  return Number(rows[0]?.stok_saat_ini ?? 0);
}

/** Total qty item yang diambil crew menuju outlet tsb, dalam periode berjalan. */
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

/**
 * Ambil stok_fisik hasil opname periode SEBELUMNYA sebagai stok_awal_periode
 * (carry-over, keputusan Q2). Kalau gak ada data bulan lalu (opname pertama
 * kali / baru go-live), fallback ke 0 tapi ditandai `baseline: false` supaya
 * caller/UI bisa kasih tau admin buat isi manual kalau perlu.
 */
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
  validasiBelumAdaOpname,
  validasiAksesGudangAdmin, // di-reexport biar service gak perlu import 2 file
  hitungStokSistemGudang,
  hitungTotalDiterimaOutlet,
  ambilStokAwalPeriode,
};
