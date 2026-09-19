const ExcelJS = require('exceljs');
const { pool } = require('../db/pool');
const { AppError } = require('../errors/AppError');

function validasiPeriode(periode) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode || '')) {
    throw new AppError('Periode wajib berformat YYYY-MM.', 400, 'PERIODE_TIDAK_VALID');
  }
}

function gayaHeader(sheet, terakhir) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: 'FF2B2320' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0E9DA' } };
  row.alignment = { vertical: 'middle' };
  sheet.autoFilter = { from: 'A1', to: `${terakhir}1` };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/**
 * Laporan pembelian/penerimaan yang sudah sah untuk kebutuhan PPIC.
 * Harga boleh NULL pada penerimaan yang diinput crew; nilai total hanya
 * menjumlahkan baris yang memiliki harga agar angka nol tidak disalahartikan
 * sebagai harga beli sebenarnya.
 */
async function getLaporanBelanjaBulanan({ periode, gudangId }) {
  validasiPeriode(periode);
  const awalPeriode = `${periode}-01`;
  const gudangIdValid = gudangId === undefined || gudangId === null || gudangId === ''
    ? null
    : Number(gudangId);

  if (gudangIdValid !== null && (!Number.isInteger(gudangIdValid) || gudangIdValid < 1)) {
    throw new AppError('Gudang tidak valid.', 400, 'GUDANG_TIDAK_VALID');
  }

  const { rows } = await pool.query(
    `SELECT
       n.id AS nota_id,
       n.tanggal,
       g.id AS gudang_id,
       g.nama AS nama_gudang,
       COALESCE(NULLIF(BTRIM(n.sumber), ''), 'Tidak diisi') AS pemasok,
       i.kode_barang,
       i.nama AS nama_item,
       i.kategori,
       tmi.jumlah,
       tmi.satuan,
       tmi.harga_beli,
       CASE WHEN tmi.harga_beli IS NULL THEN NULL ELSE tmi.jumlah * tmi.harga_beli END AS subtotal
     FROM transaksi_masuk_nota n
     JOIN transaksi_masuk_item tmi ON tmi.nota_id = n.id
     JOIN item i ON i.id = tmi.item_id
     JOIN gudang g ON g.id = n.gudang_id
     WHERE n.status_verifikasi = 'terverifikasi'
       AND n.label_status IS DISTINCT FROM 'Dikoreksi'
       AND n.tanggal >= $1::date
       AND n.tanggal < ($1::date + INTERVAL '1 month')
       AND ($2::int IS NULL OR n.gudang_id = $2)
     ORDER BY n.tanggal, n.id, i.kode_barang`,
    [awalPeriode, gudangIdValid],
  );

  const detail = rows.map((row) => ({
    ...row,
    jumlah: Number(row.jumlah),
    harga_beli: row.harga_beli === null ? null : Number(row.harga_beli),
    subtotal: row.subtotal === null ? null : Number(row.subtotal),
  }));

  const summary = detail.reduce((acc, row) => {
    acc.jumlahBaris += 1;
    acc.notaIds.add(row.nota_id);
    if (row.subtotal === null) acc.jumlahBarisTanpaHarga += 1;
    else acc.totalBelanja += row.subtotal;
    return acc;
  }, { jumlahBaris: 0, jumlahBarisTanpaHarga: 0, totalBelanja: 0, notaIds: new Set() });

  const ringkasanPemasok = new Map();
  const ringkasanKategori = new Map();
  for (const row of detail) {
    const targetPemasok = ringkasanPemasok.get(row.pemasok) || { pemasok: row.pemasok, jumlahNota: new Set(), jumlahBaris: 0, totalBelanja: 0, jumlahBarisTanpaHarga: 0 };
    targetPemasok.jumlahNota.add(row.nota_id);
    targetPemasok.jumlahBaris += 1;
    if (row.subtotal === null) targetPemasok.jumlahBarisTanpaHarga += 1;
    else targetPemasok.totalBelanja += row.subtotal;
    ringkasanPemasok.set(row.pemasok, targetPemasok);

    const kategori = row.kategori || 'Tanpa kategori';
    const targetKategori = ringkasanKategori.get(kategori) || { kategori, jumlahBaris: 0, totalBelanja: 0, jumlahBarisTanpaHarga: 0 };
    targetKategori.jumlahBaris += 1;
    if (row.subtotal === null) targetKategori.jumlahBarisTanpaHarga += 1;
    else targetKategori.totalBelanja += row.subtotal;
    ringkasanKategori.set(kategori, targetKategori);
  }

  return {
    periode,
    detail,
    ringkasan: {
      jumlahNota: summary.notaIds.size,
      jumlahBaris: summary.jumlahBaris,
      jumlahBarisTanpaHarga: summary.jumlahBarisTanpaHarga,
      totalBelanja: summary.totalBelanja,
    },
    perPemasok: [...ringkasanPemasok.values()]
      .map(({ jumlahNota, ...row }) => ({ ...row, jumlahNota: jumlahNota.size }))
      .sort((a, b) => b.totalBelanja - a.totalBelanja || a.pemasok.localeCompare(b.pemasok)),
    perKategori: [...ringkasanKategori.values()]
      .sort((a, b) => b.totalBelanja - a.totalBelanja || a.kategori.localeCompare(b.kategori)),
  };
}

async function generateLaporanBelanjaBulananExcel(input) {
  const laporan = await getLaporanBelanjaBulanan(input);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Inventori Pancong Jaksel';
  workbook.created = new Date();

  const sheetDetail = workbook.addWorksheet('Detail Belanja');
  sheetDetail.columns = [
    { header: 'Tanggal', key: 'tanggal', width: 14 },
    { header: 'No. Nota', key: 'nota_id', width: 12 },
    { header: 'Gudang', key: 'nama_gudang', width: 22 },
    { header: 'Pemasok', key: 'pemasok', width: 24 },
    { header: 'Kode Barang', key: 'kode_barang', width: 16 },
    { header: 'Nama Barang', key: 'nama_item', width: 30 },
    { header: 'Kategori', key: 'kategori', width: 18 },
    { header: 'Jumlah', key: 'jumlah', width: 14 },
    { header: 'Satuan', key: 'satuan', width: 12 },
    { header: 'Harga Beli', key: 'harga_beli', width: 16 },
    { header: 'Subtotal', key: 'subtotal', width: 18 },
  ];
  gayaHeader(sheetDetail, 'K');
  laporan.detail.forEach((row) => sheetDetail.addRow(row));
  sheetDetail.getColumn('H').numFmt = '#,##0.##';
  sheetDetail.getColumn('J').numFmt = '"Rp" #,##0';
  sheetDetail.getColumn('K').numFmt = '"Rp" #,##0';
  const totalRow = sheetDetail.addRow({ nama_item: 'TOTAL BELANJA (harga tersedia)', subtotal: laporan.ringkasan.totalBelanja });
  totalRow.font = { bold: true };
  totalRow.getCell('K').numFmt = '"Rp" #,##0';

  const sheetPemasok = workbook.addWorksheet('Ringkasan Pemasok');
  sheetPemasok.columns = [
    { header: 'Pemasok', key: 'pemasok', width: 28 },
    { header: 'Jumlah Nota', key: 'jumlahNota', width: 14 },
    { header: 'Baris Barang', key: 'jumlahBaris', width: 15 },
    { header: 'Baris Tanpa Harga', key: 'jumlahBarisTanpaHarga', width: 20 },
    { header: 'Total Belanja', key: 'totalBelanja', width: 20 },
  ];
  gayaHeader(sheetPemasok, 'E');
  laporan.perPemasok.forEach((row) => sheetPemasok.addRow(row));
  sheetPemasok.getColumn('E').numFmt = '"Rp" #,##0';

  const sheetKategori = workbook.addWorksheet('Ringkasan Kategori');
  sheetKategori.columns = [
    { header: 'Kategori', key: 'kategori', width: 24 },
    { header: 'Baris Barang', key: 'jumlahBaris', width: 15 },
    { header: 'Baris Tanpa Harga', key: 'jumlahBarisTanpaHarga', width: 20 },
    { header: 'Total Belanja', key: 'totalBelanja', width: 20 },
  ];
  gayaHeader(sheetKategori, 'D');
  laporan.perKategori.forEach((row) => sheetKategori.addRow(row));
  sheetKategori.getColumn('D').numFmt = '"Rp" #,##0';

  return { workbook, laporan };
}

module.exports = { getLaporanBelanjaBulanan, generateLaporanBelanjaBulananExcel };
