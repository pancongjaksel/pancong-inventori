const { pool } = require('../db/pool');
const ExcelJS = require('exceljs');

function tanggalIso(nilai) {
  if (!nilai) return null;
  if (nilai instanceof Date) return nilai.toISOString().slice(0, 10);
  return String(nilai).slice(0, 10);
}

/**
 * Rekap SO bulanan gabungan gudang + outlet, plus forecast kebutuhan
 * pembelian bulan berikutnya. Saat histori belum mencapai 3 bulan penuh,
 * perhitungannya memakai laju pemakaian harian dari seluruh histori yang
 * tersedia; setelah itu beralih otomatis ke rata-rata 3 bulan terakhir.
 * Ini query read-only, hasilnya JSON terstruktur —
 * konversi ke file .xlsx dilakukan di layer terpisah (mis. pakai `exceljs`
 * di endpoint /export, atau di-generate langsung dari frontend admin).
 *
 * "Pemakaian" didefinisikan sebagai total qty keluar dari gudang untuk
 * tujuan operasional: diambil crew (keluar_ke_crew) + terpakai produksi
 * (produksi_keluar). Barang masuk, transfer, dan koreksi TIDAK dihitung
 * sebagai pemakaian (itu perpindahan/masuk, bukan konsumsi).
 */
async function generateRekapForecast(periode) {
  const client = await pool.connect();
  try {
    // 1) Rekap opname periode ini (gudang + outlet)
    const { rows: rekapOpname } = await client.query(
      `SELECT
         so.lokasi_tipe,
         COALESCE(g.nama, o.nama) AS nama_lokasi,
         i.kode_barang,
         i.nama AS nama_item,
         i.satuan,
         so.stok_awal_periode,
         so.stok_sistem_atau_diterima,
         so.stok_fisik,
         so.selisih
       FROM stok_opname so
       JOIN item i ON i.id = so.item_id
       LEFT JOIN gudang g ON g.id = so.gudang_id
       LEFT JOIN outlet o ON o.id = so.outlet_id
       WHERE so.periode = $1 AND so.jenis_opname = 'bulanan'
       ORDER BY so.lokasi_tipe, nama_lokasi, i.kode_barang`,
      [periode]
    );

    // 2) Tentukan histori yang benar-benar tersedia. Pengambilan baru mulai
    // Agustus 2026, sehingga membagi data awal dengan 3 akan mengecilkan
    // kebutuhan beli secara keliru. Pada fase awal, pakai laju harian.
    const [tahun, bulan] = periode.split('-').map(Number);
    if (!Number.isInteger(tahun) || !Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
      throw new Error('Periode forecast tidak valid.');
    }
    const awalPeriodeBerikutnya = new Date(Date.UTC(tahun, bulan, 1)).toISOString().slice(0, 10);
    const { rows: metadataRows } = await client.query(
      `WITH batas AS (
         SELECT
           date_trunc('month', MIN(tanggal))::date AS awal_data,
           LEAST($1::date, CURRENT_DATE + 1) AS akhir_observasi
         FROM stok_ledger
         WHERE tipe_pergerakan IN ('keluar_ke_crew', 'produksi_keluar')
       )
       SELECT awal_data, akhir_observasi, (akhir_observasi - 1)::date AS tanggal_data_terakhir,
              GREATEST(0, (EXTRACT(YEAR FROM age(date_trunc('month', akhir_observasi), awal_data)) * 12
                + EXTRACT(MONTH FROM age(date_trunc('month', akhir_observasi), awal_data)))::integer) AS bulan_lengkap,
              GREATEST(0, akhir_observasi - awal_data)::integer AS hari_observasi
       FROM batas`,
      [awalPeriodeBerikutnya]
    );
    const metadata = metadataRows[0];
    const pakaiRataRata3Bulan = metadata?.awal_data && Number(metadata.bulan_lengkap) >= 3;
    const awalObservasi = tanggalIso(metadata?.awal_data);
    const akhirObservasi = tanggalIso(metadata?.akhir_observasi);
    const tanggalDataTerakhir = tanggalIso(metadata?.tanggal_data_terakhir);
    const hariObservasi = Number(metadata?.hari_observasi ?? 0);

    const { rows: rataPemakaian } = await client.query(
      `SELECT
         i.id AS item_id,
         i.kode_barang,
         i.nama AS nama_item,
         i.satuan,
         COALESCE(SUM(-sl.qty_delta), 0) /
           CASE WHEN $3::boolean THEN 3.0 ELSE NULLIF($4::numeric, 0) END *
           CASE WHEN $3::boolean THEN 1.0 ELSE $5::numeric END AS rata_pemakaian_per_bulan
       FROM item i
       LEFT JOIN stok_ledger sl
         ON sl.item_id = i.id
         AND sl.tipe_pergerakan IN ('keluar_ke_crew', 'produksi_keluar')
         AND sl.tanggal >= CASE WHEN $3::boolean THEN ($2::date - INTERVAL '3 month') ELSE $1::date END
         AND sl.tanggal < $2::date
       WHERE i.status_aktif = true
       GROUP BY i.id, i.kode_barang, i.nama, i.satuan
       ORDER BY i.kode_barang`,
      [awalObservasi ?? awalPeriodeBerikutnya, akhirObservasi ?? awalPeriodeBerikutnya, pakaiRataRata3Bulan, hariObservasi, new Date(Date.UTC(tahun, bulan + 1, 0)).getUTCDate()]
    );

    // 3) Stok gudang saat ini per item (dijumlah semua gudang) — buat hitung
    //    kebutuhan beli = rata_pemakaian - stok_saat_ini_total (floor di 0)
    const { rows: stokTotal } = await client.query(
      `SELECT item_id, SUM(stok_saat_ini) AS total FROM v_stok_gudang_saat_ini GROUP BY item_id`
    );
    const stokTotalById = new Map(stokTotal.map((r) => [r.item_id, Number(r.total)]));

    const forecastPembelian = rataPemakaian.map((r) => {
      const stokSaatIni = stokTotalById.get(r.item_id) ?? 0;
      const rataPemakaianBulan = Number(r.rata_pemakaian_per_bulan);
      const kebutuhanBeli = Math.max(0, rataPemakaianBulan - stokSaatIni);
      return {
        kodeBarang: r.kode_barang,
        namaItem: r.nama_item,
        satuan: r.satuan,
        rataPemakaian3BulanTerakhir: Number(rataPemakaianBulan.toFixed(2)),
        stokSaatIni,
        estimasiKebutuhanBeli: Number(kebutuhanBeli.toFixed(2)),
        metodeForecast: pakaiRataRata3Bulan ? 'Rata-rata pemakaian 3 bulan terakhir' : 'Laju pemakaian harian dari histori yang tersedia',
        periodeObservasi: awalObservasi && tanggalDataTerakhir ? `${awalObservasi} s.d. ${tanggalDataTerakhir}` : null,
      };
    });

    return {
      periode,
      periodeForecast: awalPeriodeBerikutnya.slice(0, 7),
      rekapOpname,
      forecastPembelian,
      metadataForecast: {
        metode: pakaiRataRata3Bulan ? 'Rata-rata pemakaian 3 bulan terakhir' : 'Laju pemakaian harian dari histori yang tersedia',
        periodeObservasi: awalObservasi && tanggalDataTerakhir ? `${awalObservasi} s.d. ${tanggalDataTerakhir}` : null,
        hariObservasi: pakaiRataRata3Bulan ? null : hariObservasi,
        cakupanStok: 'Stok gudang (stok outlet belum memiliki ledger real-time).',
      },
    };
  } finally {
    client.release();
  }
}

/**
 * Bikin workbook Excel (2 sheet) dari data yang sama persis dengan
 * generateRekapForecast — jadi angka di layar (JSON) dan di file Excel
 * dijamin selalu sinkron, gak ada logic yang kegandain/bisa beda.
 *
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function generateRekapForecastExcel(periode) {
  const { rekapOpname, forecastPembelian } = await generateRekapForecast(periode);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Inventori Pancong Jaksel';
  workbook.created = new Date();

  // ---------- Sheet 1: Forecast Pembelian ----------
  const sheetForecast = workbook.addWorksheet('Forecast Pembelian');
  sheetForecast.columns = [
    { header: 'Kode Barang', key: 'kodeBarang', width: 14 },
    { header: 'Nama Item', key: 'namaItem', width: 28 },
    { header: 'Satuan', key: 'satuan', width: 12 },
    { header: 'Rata-rata Pemakaian 3 Bulan', key: 'rataPemakaian3BulanTerakhir', width: 24 },
    { header: 'Stok Saat Ini', key: 'stokSaatIni', width: 14 },
    { header: 'Estimasi Kebutuhan Beli', key: 'estimasiKebutuhanBeli', width: 22 },
    { header: 'Metode Forecast', key: 'metodeForecast', width: 40 },
    { header: 'Periode Observasi', key: 'periodeObservasi', width: 26 },
  ];
  sheetForecast.getRow(1).font = { bold: true };
  sheetForecast.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0E9DA' } };
  forecastPembelian
    .slice()
    .sort((a, b) => b.estimasiKebutuhanBeli - a.estimasiKebutuhanBeli) // urut dari yang paling butuh dibeli
    .forEach((row) => {
      const excelRow = sheetForecast.addRow(row);
      if (row.estimasiKebutuhanBeli > 0) {
        excelRow.getCell('estimasiKebutuhanBeli').font = { bold: true, color: { argb: 'FFB23A34' } };
      }
    });
  sheetForecast.autoFilter = { from: 'A1', to: 'F1' };

  // ---------- Sheet 2: Rekap Opname ----------
  const sheetOpname = workbook.addWorksheet('Rekap Opname');
  sheetOpname.columns = [
    { header: 'Tipe Lokasi', key: 'lokasi_tipe', width: 12 },
    { header: 'Nama Lokasi', key: 'nama_lokasi', width: 18 },
    { header: 'Kode Barang', key: 'kode_barang', width: 14 },
    { header: 'Nama Item', key: 'nama_item', width: 28 },
    { header: 'Satuan', key: 'satuan', width: 12 },
    { header: 'Stok Awal Periode', key: 'stok_awal_periode', width: 16 },
    { header: 'Sistem/Diterima', key: 'stok_sistem_atau_diterima', width: 16 },
    { header: 'Stok Fisik', key: 'stok_fisik', width: 12 },
    { header: 'Selisih', key: 'selisih', width: 12 },
  ];
  sheetOpname.getRow(1).font = { bold: true };
  sheetOpname.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0E9DA' } };
  rekapOpname.forEach((row) => {
    const excelRow = sheetOpname.addRow(row);
    if (Number(row.selisih) !== 0) {
      excelRow.getCell('selisih').font = { bold: true, color: { argb: 'FFB23A34' } };
    }
  });
  sheetOpname.autoFilter = { from: 'A1', to: 'I1' };

  return workbook;
}

module.exports = { generateRekapForecast, generateRekapForecastExcel };
