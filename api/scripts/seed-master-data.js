/**
 * Seed data master awal: 3 gudang, 6 outlet, 41 item (sesuai
 * Rekap_SKU_Pancong_Jaksel.xlsx & keputusan PRD Bagian 3 & 10).
 *
 * Idempotent — pakai ON CONFLICT DO NOTHING di kolom unique (nama gudang,
 * nama outlet, kode_barang), jadi aman dijalankan ulang kalau kepotong di
 * tengah jalan.
 *
 * Pemakaian: node scripts/seed-master-data.js
 */
require('dotenv').config();
const { pool } = require('../db/pool');

const ACCOUNTING_CODE = {
  'Bahan Adonan': '5-1101',
  Topping: '5-1102',
  Kemasan: '5-1103',
  Kebersihan: '5-1104',
};

// 41 SKU dari Rekap_SKU_Pancong_Jaksel.xlsx (status Mei–Jul 2026)
const ITEMS = [
  ['BA-001', 'Tepung Terigu', 'Bahan Adonan', 'Kg', true, null],
  ['BA-002', 'Susu UHT', 'Bahan Adonan', 'Liter', true, null],
  ['BA-003', 'Soda Kue', 'Bahan Adonan', 'Pack', true, null],
  ['BA-004', 'Baking Powder', 'Bahan Adonan', 'Pack', true,
    'Migrasi: 2 baris jurnal Juli 2026 (17/07 & 13/07) punya Nama Barang & Satuan kosong di data lama — kemungkinan salah input manual, sudah diperbaiki di sini tapi cek nota asli kalau ada keraguan.'],
  ['BA-005', 'Vanili', 'Bahan Adonan', 'Sachet', true, null],
  ['BA-006', 'Mentega MC', 'Bahan Adonan', 'Kg / Pack', true, null],
  ['BA-007', 'Gula Pasir', 'Bahan Adonan', 'Kg', true, null],
  ['BA-008', 'Pandan Pasta', 'Bahan Adonan', 'Pack', true,
    'Satu-satunya item Bahan Adonan yang BOLEH diambil outlet (lihat trigger trg_validasi_larangan_bahan_adonan).'],
  ['C-001', 'Tissue', 'Kebersihan', 'Pack', true, null],
  ['C-004', 'Trash Bag', 'Kebersihan', 'Pack', true, null],
  ['C-005', 'Sabun Cuci Piring', 'Kebersihan', 'Pack', true, null],
  ['C-007', 'Sabun Lap', 'Kebersihan', 'Pack', false, null],
  ['K-001', 'Paper Box (Grosir)', 'Kemasan', 'Pcs', true, null],
  ['K-002', 'Kresek Bening', 'Kemasan', 'Pack', true, null],
  ['K-003', 'Sarung Tangan Plastik', 'Kemasan', 'Pack', true, null],
  ['K-004', 'Karet Gelang', 'Kemasan', 'Pack', true, null],
  ['K-005', 'Plastik 2Kg Boyo', 'Kemasan', 'Pack', true, null],
  ['K-006', 'Kresek Besar Ungu', 'Kemasan', 'Pack', true, null],
  ['K-008', 'Paper Box (Satuan)', 'Kemasan', 'Pcs', true, null],
  ['K-009', 'Sendok Teh', 'Kemasan', 'Dus / Karton', true, null],
  ['P-007', 'Kertas Thermal', 'Kemasan', 'Pcs', false, null],
  ['C-002', 'Red Velvet Crumble', 'Topping', 'Karton / Bal', true, null],
  ['C-003', 'Black Biscuit', 'Topping', 'Block / Box', true, null],
  ['G-001', 'Glaze Avocado', 'Topping', 'Pail / Ember', false, null],
  ['G-002', 'Glaze Tiramisu', 'Topping', 'Pail / Ember', true, null],
  ['G-003', 'Glaze Cokelat', 'Topping', 'Pail / Ember', true, null],
  ['G-004', 'Glaze Cappuccino', 'Topping', 'Pail / Ember', true, null],
  ['G-005', 'Glaze Greentea', 'Topping', 'Pail / Ember', true, null],
  ['G-006', 'Glaze Strawberry', 'Topping', 'Pail / Ember', false, null],
  ['G-007', 'Glaze Taro', 'Topping', 'Pail / Ember', true, null],
  ['G-013', 'Prima Coklat', 'Topping', 'Pail / Ember', false, null],
  ['O-001', 'Omella', 'Topping', 'Kaleng', true, null],
  ['S-001', 'GF Choco Crunchy', 'Topping', 'Pail / Ember', true, null],
  ['S-002', 'GF Cheese Crunchy', 'Topping', 'Karton / Bal', false, null],
  ['S-003', 'Dunia Go Crunchy', 'Topping', 'Pack / Kg', true, null],
  ['S-005', 'Mentega', 'Topping', 'Pack / Kg', true, null],
  ['X-001', 'Meses', 'Topping', 'Karton / Bal', true, null],
  ['X-002', 'Keju', 'Topping', 'Pack / Kg', true, null],
  ['X-003', 'Champion/Milo', 'Topping', 'Sachet', true, null],
  ['X-005', 'Choco Chips', 'Topping', 'Dus / Karton', true, null],
  ['X-006', 'Dancow', 'Topping', 'Sachet', true, null],
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Gudang
    await client.query(`
      INSERT INTO gudang (nama, tipe) VALUES
        ('Produksi', 'hub_admin_only'),
        ('UGM', 'serving'),
        ('Glagahsari', 'serving')
      ON CONFLICT (nama) DO NOTHING;
    `);
    const { rows: gudangRows } = await client.query('SELECT id, nama FROM gudang');
    const gudangIdByNama = Object.fromEntries(gudangRows.map((g) => [g.nama, g.id]));

    // 2) Outlet — mapping gudang_asal sesuai keputusan PRD Bagian 3
    const outletList = [
      ['UGM', gudangIdByNama['UGM']],
      ['Pogung', gudangIdByNama['UGM']],
      ['Kaliurang', gudangIdByNama['UGM']],
      ['Glagahsari', gudangIdByNama['Glagahsari']],
      ['UMY', gudangIdByNama['Glagahsari']],
      ['UAD', gudangIdByNama['Glagahsari']],
    ];
    for (const [nama, gudangAsalId] of outletList) {
      await client.query(
        `INSERT INTO outlet (nama, gudang_asal_id) VALUES ($1, $2) ON CONFLICT (nama) DO NOTHING`,
        [nama, gudangAsalId]
      );
    }

    // 3) Item — gudang_default_id di-set ke Produksi (hub), gudang tempat
    //    barang PERTAMA KALI masuk sebelum didistribusikan/ada barang
    //    masuk langsung ke UGM/Glagahsari (lihat PRD 5.1b).
    const produksiId = gudangIdByNama['Produksi'];
    for (const [kode, nama, kategori, satuan, statusAktif, catatanMigrasi] of ITEMS) {
      await client.query(
        `INSERT INTO item (kode_barang, nama, kategori, satuan, accounting_code, status_aktif, gudang_default_id, catatan_migrasi)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (kode_barang) DO NOTHING`,
        [kode, nama, kategori, satuan, ACCOUNTING_CODE[kategori], statusAktif, produksiId, catatanMigrasi]
      );
    }

    await client.query('COMMIT');
    console.log(`Seed selesai: ${gudangRows.length} gudang, ${outletList.length} outlet, ${ITEMS.length} item.`);
    console.log('Reorder point BELUM di-set (semua NULL) — isi manual per item lewat SQL/endpoint CRUD (lihat ROADMAP Tahap 2.5) sebelum alert stok menipis aktif.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed gagal, semua perubahan di-rollback:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
