/**
 * Generate PDF berisi QR setup device, siap print & tempel fisik di gudang.
 *
 * QR-nya PAKAI ULANG token & format link yang sama kayak endpoint
 * `GET /api/device-gudang/qr/:gudangId` (buatTokenQrGudang + deep link ke
 * /setup-device) — supaya QR hasil print ini beneran valid buat flow Setup
 * Device yang sudah ada, bukan QR versi lain yang gak nyambung ke apa pun.
 *
 * Sengaja CUMA generate buat gudang tipe 'serving' (UGM, Glagahsari) — Gudang
 * Produksi/Kotagede itu hub_admin_only dan gak bisa punya device_gudang sama
 * sekali (lihat trigger trg_validasi_device_bukan_produksi di skema), jadi
 * QR device buat gudang itu gak ada gunanya & bakal ditolak backend kalau
 * dipakai.
 *
 * Pemakaian: node scripts/generate-device-qr-pdf.js
 * Output: api/outputs/device-qr-registration-{timestamp}.pdf
 */
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { pool } = require('../db/pool');
const { buatTokenQrGudang } = require('../utils/deviceQrToken');

const CM_KE_POINT = 28.346; // 1 cm = 28.346 pt (satuan internal pdfkit)
const UKURAN_QR_CM = 10;

async function main() {
  const { rows: gudangServing } = await pool.query(
    `SELECT id, nama, max_device_quota FROM gudang WHERE tipe = 'serving' ORDER BY nama`
  );

  if (gudangServing.length === 0) {
    console.error('Gak ada gudang tipe "serving" di database — gak ada QR yang bisa di-generate.');
    process.exit(1);
  }

  const folderOutput = path.join(__dirname, '..', 'outputs');
  fs.mkdirSync(folderOutput, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileOutput = path.join(folderOutput, `device-qr-registration-${timestamp}.pdf`);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(fs.createWriteStream(fileOutput));

  const tanggalCetak = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  for (let i = 0; i < gudangServing.length; i++) {
    const g = gudangServing[i];
    if (i > 0) doc.addPage();

    const token = buatTokenQrGudang(g.id);
    const qrContent = `${process.env.APP_BASE_URL || 'https://app.pancongjaksel.com'}/setup-device?token=${token}`;
    const qrPngBuffer = await QRCode.toBuffer(qrContent, { type: 'png', width: 800, margin: 1 });

    const lebarHalaman = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const ukuranQrPt = UKURAN_QR_CM * CM_KE_POINT;
    const xQr = doc.page.margins.left + (lebarHalaman - ukuranQrPt) / 2;
    const yQr = 180;

    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('QR Setup Device — Inventori Pancong Jaksel', doc.page.margins.left, 80, {
        width: lebarHalaman,
        align: 'center',
      });

    doc.image(qrPngBuffer, xQr, yQr, { width: ukuranQrPt, height: ukuranQrPt });

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(`Gudang ${g.nama}`, doc.page.margins.left, yQr + ukuranQrPt + 24, {
        width: lebarHalaman,
        align: 'center',
      });
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`Kuota Device: ${g.max_device_quota}`, doc.page.margins.left, yQr + ukuranQrPt + 50, {
        width: lebarHalaman,
        align: 'center',
      });

    doc
      .fontSize(10)
      .fillColor('#666666')
      .text(
        'Scan QR ini pakai kamera di halaman "Scan QR (setup HP ini)" — atau kalau kamera gak bisa, ' +
          'Admin bisa buka link-nya langsung. Admin harus login dulu sebelum setup device baru.',
        doc.page.margins.left,
        yQr + ukuranQrPt + 80,
        { width: lebarHalaman, align: 'center' }
      );

    doc
      .fontSize(9)
      .fillColor('#999999')
      .text(`Dicetak: ${tanggalCetak}`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 20, {
        width: lebarHalaman,
        align: 'center',
      });
    doc.fillColor('#000000');
  }

  doc.end();

  await new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  console.log(`PDF berhasil dibuat: ${fileOutput}`);
  console.log(`Berisi ${gudangServing.length} halaman QR: ${gudangServing.map((g) => g.nama).join(', ')}`);
  console.log(
    'Catatan: Gudang Produksi (Kotagede) SENGAJA gak ikut — tipe hub_admin_only, ' +
      'gak bisa punya device crew sama sekali (lihat komentar di atas file ini).'
  );
}

main()
  .catch((err) => {
    console.error('Gagal generate PDF:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
