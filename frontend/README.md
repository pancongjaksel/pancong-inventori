# Frontend — Inventori Pancong Jaksel

Belum pernah dites jalan beneran (sandbox pembuatan gak ada akses npm/jaringan).
Sanity check yang udah dilakuin: kurung `(){}[]` semua seimbang di tiap file
(tanda gak ada yang lupa ditutup), tapi belum tervalidasi lolos compiler
React/Vite beneran — siapin diri buat nemuin 1-2 typo kecil pas pertama kali
`npm run dev`.

## Cara jalanin

```bash
cd frontend
npm install
cp .env.example .env
# .env: isi VITE_API_BASE_URL kalau API-nya gak di localhost:3000
npm run dev
```

Buka `http://localhost:5173` di browser. **Penting:** API (`api/`) harus udah
jalan duluan di port 3000 (lihat `api/README.md`), dan `FRONTEND_URL` di
`api/.env` harus `http://localhost:5173` (biar CORS gak nolak).

## Alur yang bisa dites sekarang

1. `/login` — login pakai akun Owner/Admin yang udah kamu buat
2. `/setup-device` — generate QR buat gudang (pilih UGM/Glagahsari), atau scan QR buat masangin device
3. `/crew` — layar Crew (Ambil Barang + Barang Masuk), muncul otomatis abis setup device berhasil

## Yang perlu diperhatikan

- **QR image** di halaman Setup Device di-render lewat layanan pihak ketiga
  (`api.qrserver.com`) — butuh internet buat nampilin gambarnya (cuma pas
  Admin generate/print, bukan dipakai crew tiap hari). Kalau mau lepas dari
  ketergantungan internet ini, ganti pakai library `qrcode` (npm) yang
  generate QR langsung di browser tanpa API luar.
- Scan QR butuh **akses kamera** — browser bakal minta izin, dan di HP
  biasanya butuh HTTPS (kecuali localhost). Pas nanti deploy ke domain asli,
  pastikan pakai HTTPS.
- Login Admin & Device token disimpan di `localStorage` browser (bukan
  cookie) — supaya gampang lintas-origin pas development. Kalau HP dipakai
  gantian banyak crew tapi **beda-beda browser/incognito**, device token bisa
  ke-reset; pastikan crew selalu pakai browser yang sama di HP itu.

## Yang belum dibuat (lihat ROADMAP_Inventori_Pancong_Jaksel.md)

- Halaman Admin (dashboard, verifikasi barang masuk, opname, dll)
- Mode offline (queue submit pas sinyal lemah)
- Icon PWA asli (`icon-192.png`, `icon-512.png` di `public/` — sekarang belum ada filenya)
