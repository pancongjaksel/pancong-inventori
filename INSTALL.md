# Patch agregator HPP Topping

Patch ini hanya menambahkan pembaca agregat dan script sinkronisasi. Tidak ada migrasi database.

## Instalasi di VPS

Ekstrak dari `/opt/pancong/app` agar folder `api/` menyatu dengan source aktif, lalu rebuild service API:

```bash
cd /opt/pancong/app
sudo tar -xzf /tmp/inventory-hpp-patch.tar.gz
sudo docker compose up -d --build api
```

Tambahkan ke `/opt/pancong/app/api/.env` tanpa mengirim nilainya ke chat:

```text
DASHBOARD_URL=https://pancong-dashboard-k1m7zmnfn-pj-corp.vercel.app
HERMES_SYNC_PIN=<nilai yang sama dengan Preview Vercel>
```

## Validasi tanpa mengirim data

```bash
sudo docker exec pancong-inventori-api node scripts/sync-dashboard-hpp-topping.js 2026-09
```

Periksa `amount`, `transactionCount`, `missingCostCount`, dan `complete` per outlet.

## Kirim ke Preview setelah angka disetujui

```bash
sudo docker exec pancong-inventori-api node scripts/sync-dashboard-hpp-topping.js 2026-09 --send
```

Script mengabaikan sesi berlabel `Dikoreksi`, memakai qty terkini, hanya kategori `Topping`, dan menolak status lengkap jika ada topping berharga nol.
