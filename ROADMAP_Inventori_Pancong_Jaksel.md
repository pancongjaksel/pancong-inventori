# Roadmap — Aplikasi Inventori Pancong Jaksel (dari skema+API sampai siap pakai)

**Status saat ini:** Backend API lengkap untuk **6 modul Fase 1** + CRUD master data + export Excel. Frontend React PWA punya **13 halaman**: 3 halaman umum (Login, Setup Device, Ambil Barang) + 10 halaman Admin (Dashboard, Verifikasi, Transfer, Opname, Koreksi, Laporan, Item, Outlet, Device, User). Auth email+password (Admin/Owner) & auth device via QR (Crew) terpasang di semua route.

**Sudah tervalidasi END-TO-END dengan data asli** (dites langsung oleh Rint di Mac Mini): Login → Setup Device (scan QR & jalur alternatif tanpa kamera) → Ambil Barang → submit sukses → Dashboard nampilin stok real-time → Verifikasi Barang Masuk (approve → stok ke-update otomatis lewat trigger ledger, dikonfirmasi angkanya benar).

**Dibangun tapi BELUM dites jalan** (kode lolos sanity-check syntax, tapi belum pernah diklik beneran): Transfer Gudang, Stok Opname, Koreksi Transaksi, Manajemen Item/Outlet/User/Device, Laporan Forecast + download Excel.

**Dibangun tapi BELUM dites jalan** (kode lolos sanity-check syntax, tapi belum pernah diklik beneran): Transfer Gudang, Stok Opname, Koreksi Transaksi, Manajemen Item/Outlet/User/Device, Laporan Forecast + download Excel. **Testing otomatis** (36 unit test **udah tervalidasi jalan** di sandbox; 3 file integration test **kodenya selesai tapi belum pernah dieksekusi**, butuh database test terpisah). **Deployment** (Docker Compose + backup otomatis **udah dibuat, belum pernah dites jalan**).

**Belum ada sama sekali:** Modul Produksi & BOM (Fase 2 — sengaja ditunda atas permintaan Rint), HTTPS production (perlu buat scan QR dari kamera HP beneran). Lihat `api/README.md` buat cara jalanin dari nol, `DEPLOYMENT.md` buat cara deploy.

---

## Tahap 1 — Fondasi ✅ SELESAI & TERVALIDASI

| # | Kerjaan | Status |
|---|---|---|
| 1.1 | Auth email+password (Admin/Owner) & setup device via scan QR (Crew) | ✅ **Selesai & tervalidasi** |
| 1.2 | Migration `node-pg-migrate`, 6 file berurutan (termasuk cleanup tabel `magic_link_token` sisa draf lama) | ✅ **Selesai & tervalidasi** |
| 1.3 | Seed data master (3 gudang, 6 outlet, 41 item) + user Owner pertama | ✅ **Selesai & tervalidasi** |

## Tahap 2 — Backend API

| # | Kerjaan | Status |
|---|---|---|
| 2.1 | Modul Produksi & BOM (Fase 2) | ⏸️ **Ditunda sengaja** atas permintaan Rint — nanti aja |
| 2.2 | Endpoint GET (riwayat, dashboard, daftar "perlu verifikasi") buat semua modul | ✅ **Selesai** |
| 2.3 | Export rekap ke file `.xlsx` beneran (pakai `exceljs`) | ✅ **Selesai, belum dites klik** |
| 2.4 | Alert stok menipis (`reorder_point` per item + view `v_stok_menipis`) | ✅ Query & endpoint selesai — **tapi isinya masih NULL semua**, perlu diisi manual per item lewat halaman Manajemen Item |
| 2.5 | CRUD master data (item, outlet, user, device) | ✅ **Selesai, belum dites klik** — CRUD Gudang sengaja gak dibuat (cuma 3 gudang, terikat struktur bisnis, fixed by design) |

## Tahap 3 — Frontend (React PWA)

| # | Halaman | Status |
|---|---|---|
| 3.1 | Login | ✅ Tervalidasi |
| 3.2 | Setup Device (generate QR + scan + jalur tanpa kamera) | ✅ Tervalidasi |
| 3.3 | Ambil Barang (Crew) | ✅ Tervalidasi |
| 3.4 | Dashboard Admin (stok + alert menipis) | ✅ Tervalidasi |
| 3.5 | Verifikasi Barang Masuk | ✅ Tervalidasi |
| 3.6 | Transfer Gudang | 🔲 Belum dites |
| 3.7 | Stok Opname | 🔲 Belum dites |
| 3.8 | Koreksi Transaksi | 🔲 Belum dites |
| 3.9 | Laporan Forecast + download Excel | 🔲 Belum dites |
| 3.10 | Manajemen Item (termasuk isi reorder point) | 🔲 Belum dites |
| 3.11 | Manajemen Outlet | 🔲 Belum dites |
| 3.12 | Manajemen Device (cabut akses HP hilang) | 🔲 Belum dites |
| 3.13 | Manajemen User (khusus Owner) | 🔲 Belum dites |
| 3.14 | Mode offline (queue submit pas sinyal lemah) | ⏳ Belum dikerjain — Fase 3 "nice-to-have" di PRD |

## Tahap 4 — Testing

| # | Kerjaan | Status |
|---|---|---|
| 4.1 | Unit test tiap validator (fungsi murni, gak butuh DB) | ✅ **Selesai & tervalidasi jalan** — 36 test, `npm test`. 2 file (`jwt.test.js`, `passwordHash.test.js`) belum tervalidasi jalan di sandbox pembuatan (butuh `npm install` dulu buat `jsonwebtoken`/`bcrypt`), tapi lolos syntax check |
| 4.2 | Integration test tiap service (test DB beneran) | ✅ **Kode selesai**, ⚠️ **belum pernah dites jalan** (sandbox gak ada akses DB) — 3 file: `pengambilanCrew`, `barangMasuk`, `transferGudang`. Butuh database test terpisah (`pancong_inventori_test`), lihat `api/README.md` bagian Testing |
| 4.3 | Uji skenario ujung-ke-ujung tambahan (klik manual): Transfer, Opname, Koreksi, dan 4 halaman Manajemen | 🔲 **Belum dikerjain** — ini masih jadi PR paling murah & penting buat dicoba duluan |

## Tahap 5 — Deployment (belum dikerjain sama sekali)

| # | Kerjaan | Catatan |
|---|---|---|
| 5.1 | `Dockerfile` API + `docker-compose.yml` (API + PostgreSQL + frontend) | Konsisten sama Inventory Management System yang udah jalan di Mac Mini |
| 5.2 | Environment variables production, jangan hardcode | `db/pool.js` udah baca dari `process.env`, tinggal isi `.env` production |
| 5.3 | Backup otomatis PostgreSQL (`pg_dump` terjadwal) | Belum dibahas sama sekali, gampang kelewat — penting karena ini data operasional harian |
| 5.4 | HTTPS beneran (domain asli) | Perlu supaya scan QR dari kamera HP bisa jalan (sekarang keblok karena masih `http://localhost` / IP lokal) |
| 5.5 | Rollout bertahap: mulai 1 gudang dulu (mis. Glagahsari) | Ngurangin resiko kalau ada bug yang kelewat |

---

## Rekomendasi urutan kerja selanjutnya

1. **Jalanin `npm test`** (unit test) — cepat, gak butuh setup apa-apa, langsung tau kalau ada yang aneh.
2. **Setup database test + `npm run test:integration`** — sekali setup, kepakai terus ke depannya tiap ada perubahan kode.
3. **Tes 8 halaman yang belum divalidasi manual** (Transfer, Opname, Koreksi, Laporan, 4 Manajemen) — paling murah & penting duluan sebelum nambah fitur baru lagi.
4. **Isi `reorder_point`** buat item-item yang penting (lewat halaman Manajemen Item) — biar alert stok menipis di Dashboard beneran berguna.
5. **`docker compose up -d --build`** (lihat `DEPLOYMENT.md`) — terutama setup backup otomatis (paling gampang kelewat tapi resikonya paling besar kalau kejadian).
6. **HTTPS + domain asli** — baru scan QR dari kamera HP beneran bisa dites utuh.
7. **Modul Produksi & BOM** — kapan pun Rint siap, sesuai keputusan ditunda.

---

## Keputusan desain yang sudah diambil sepanjang sesi ini

| Topik | Keputusan |
|---|---|
| Auth Admin/Owner | Email + password (bcrypt + JWT, cookie httpOnly + Bearer fallback) |
| Assignment device Crew | Scan QR fisik yang ditempel di gudang (token HMAC, gak expired, revoke via `token_versi`) |
| Migration tool | `node-pg-migrate`, 6 migration file |
| Threshold reorder point | Per item (bukan 1 angka global) |
| Kelola user baru | Khusus role Owner (Admin gak bisa bikin Admin lain) |
| CRUD Gudang | Sengaja TIDAK dibuat — cuma 3 gudang, fixed by business structure |
| Foto bukti (barang masuk/transfer) | Sementara masih kolom URL teks manual — upload file beneran belum dibangun |
| Format export forecast | Excel 2 sheet (Forecast Pembelian + Rekap Opname), rata-rata pemakaian 3 bulan terakhir |
