# API Inventori Pancong Jaksel — Setup & Run

Kode ini sudah dicek sintaksnya (`node --check` semua file lolos) dan semua
`require()` antar-file sudah dicocokkan manual — tapi **belum pernah dites
jalan beneran** karena sandbox pembuatannya gak ada akses jaringan/DB.
Jalanin langkah di bawah ini di lingkungan kamu (Mac Mini / Docker) buat
pertama kali, dan siapin diri buat nemuin 1-2 typo/logic error kecil yang
lolos dari review manual — itu wajar untuk kode yang belum pernah dieksekusi.

## 1. Install dependency

```bash
cd api
npm install
```

## 2. Siapkan PostgreSQL

Pastikan ada instance PostgreSQL jalan (via Docker sesuai setup Inventory
Management System kamu yang udah ada, atau image `postgres:16` baru khusus
buat project ini). Bikin database kosong:

```sql
CREATE DATABASE pancong_inventori;
```

## 3. Isi environment variables

```bash
cp .env.example .env
```

Lalu isi `.env`:
- `DATABASE_URL` / `PGHOST` dst — sesuai koneksi Postgres kamu
- `JWT_SECRET` dan `DEVICE_QR_SECRET` — generate MASING-MASING (nilai beda) dengan:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `APP_BASE_URL` — URL tempat frontend nanti di-hosting (dipakai buat bikin link QR setup device)

## 4. Jalankan migration

```bash
npm run migrate:up
```

Ini jalanin 6 migration berurutan:
1. `1722700000000_baseline-schema.js` — semua tabel, enum, trigger, view dari skema awal
2. `1722700001000_add-reorder-point.js` — kolom `reorder_point` per item (alert stok menipis)
3. `1722700002000_add-auth-password.js` — kolom `password_hash` di `users`
4. `1722700003000_add-token-versi.js` — kolom `token_versi` di `users` & `device_gudang` (buat revoke sesi/device)
5. `1722700004000_add-view-stok-menipis.js` — view `v_stok_menipis`
6. `1722700005000_drop-unused-magic-link-table.js` — bersihin tabel `magic_link_token` sisa draf lama (kalau kamu baru migrate dari nol, tabelnya emang gak akan pernah kebuat karena baseline udah dibersihin — migration ini cuma relevan buat yang udah kadung jalanin baseline versi lama)

Kalau ada error di tengah jalan, **jangan lanjut** — screenshot error-nya,
itu tandanya ada masalah SQL yang perlu diperbaiki dulu.

## 5. Seed data master & user pertama

```bash
node scripts/seed-master-data.js
node scripts/buat-user-awal.js --nama "Rinto" --email rinto@pancongjaksel.com --password "ganti-ini-password-kuat" --role owner
```

`seed-master-data.js` ngisi 3 gudang, 6 outlet, dan 41 item dari
`Rekap_SKU_Pancong_Jaksel.xlsx` (termasuk catatan migrasi buat BA-004 yang
datanya sempat kosong di jurnal Juli 2026). Aman dijalankan ulang (idempotent).

`buat-user-awal.js` bikin akun login pertama — jalanin ini SEKALI aja buat
Owner, abis itu Owner bisa (nanti, kalau endpoint CRUD user udah dibuat —
lihat ROADMAP Tahap 2.5) bikin akun Admin dari dalam aplikasi.

**Ganti password placeholder:** kalau kamu sempat pakai password contoh dari
dokumen ini (`ganti-ini-password-kuat`) buat testing, GANTI dulu sebelum
dipakai beneran:

```bash
node scripts/ganti-password.js --email rinto@pancongjaksel.com --password "password-baru-yang-kuat-dan-unik"
```

## 6. Jalankan API

```bash
npm start        # production
npm run dev       # auto-restart pas ada perubahan file
```

## 7. Tes cepat alur login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rinto@pancongjaksel.com","password":"ganti-ini-password-kuat"}'
```

Response-nya ada `data.token` — pakai ini sebagai `Authorization: Bearer <token>`
di semua endpoint admin selanjutnya (atau abaikan aja kalau tes dari browser,
karena endpoint ini juga otomatis nyimpen cookie httpOnly `session`).

## 8. Tes cepat alur setup device (QR) + submit Crew

```bash
# a) Generate QR buat Gudang UGM (ganti :id sesuai id gudang UGM di DB kamu)
curl http://localhost:3000/api/device-gudang/qr/2 \
  -H "Authorization: Bearer <token dari langkah 7>"

# b) "Scan" (di real life ini discan kamera, di sini kita tempel token manual)
curl -X POST http://localhost:3000/api/device-gudang/setup \
  -H "Authorization: Bearer <token dari langkah 7>" \
  -H "Content-Type: application/json" \
  -d '{"token":"<token dari respons langkah a>","namaDevice":"HP Test 1"}'

# c) Pakai deviceToken dari respons (b) buat submit sesi pengambilan crew
curl -X POST http://localhost:3000/api/sesi-pengambilan-crew \
  -H "X-Device-Token: <deviceToken dari langkah b>" \
  -H "Content-Type: application/json" \
  -d '{"namaCrew":"Budi","outletTujuanId":1,"daftarItem":[{"itemId":1,"qty":2}]}'
```

## Testing

**Unit test** (fungsi murni, gak butuh database — 36 test, udah tervalidasi jalan):
```bash
npm test
```

**Integration test** (butuh database Postgres TERPISAH, khusus buat testing):
```bash
# Sekali aja: bikin database test + jalanin migration ke situ
createdb pancong_inventori_test   # atau lewat psql/GUI, terserah
cp .env.test.example .env.test
# isi .env.test (JWT_SECRET, DEVICE_QR_SECRET, dst — beda dari .env production)
PGDATABASE=pancong_inventori_test node-pg-migrate up

npm run test:integration
```

⚠️ **Integration test nge-TRUNCATE semua tabel** tiap kali jalan (biar tiap test mulai dari kondisi bersih) — makanya `.env.test` WAJIB nunjuk ke database terpisah, ada pengecekan otomatis di `tests/integration/helpers/setupEnv.js` yang bakal nolak jalan kalau `PGDATABASE` gak mengandung kata "test", tapi tetep hati-hati.

Test yang udah ditulis fokus ke **aturan bisnis paling kritikal**: outlet-gudang mismatch, larangan Bahan Adonan kecuali BA-008, alur verifikasi Barang Masuk (menunggu → ledger cuma masuk setelah disetujui), dan Transfer Gudang (stok cukup, 2-langkah kirim/terima, cegah terima dobel).

## Kalau ada yang error

Kode ini ditulis tanpa environment nyata buat nge-tes, jadi ada kemungkinan
kecil ada typo/logic error yang lolos. Kalau ketemu error pas `migrate:up`
atau pas hit endpoint, itu bagian yang paling wajar untuk dicek/di-debug
duluan — bawa error message-nya ke sesi berikutnya (di sini atau lewat
Claude Code) buat langsung diperbaiki.

## Yang masih PR (lihat ROADMAP_Inventori_Pancong_Jaksel.md buat detail lengkap)

- Modul Produksi & BOM (Fase 2) — sengaja ditunda
- Upload foto bukti beneran (sekarang masih kolom URL teks manual)
- Deployment production (lihat `DEPLOYMENT.md` — Docker Compose sudah dibuat, belum pernah dites jalan)
- Sebagian besar halaman frontend (Transfer, Opname, Koreksi, Laporan, Manajemen) sudah dibuat tapi belum divalidasi manual — lihat ROADMAP
