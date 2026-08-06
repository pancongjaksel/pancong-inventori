# Panduan Deployment — Inventori Pancong Jaksel

Status: **belum pernah dites jalan** (sandbox pembuatan gak ada akses Docker/jaringan). Ikutin langkah di bawah, siapin diri buat nemuin 1-2 hal kecil yang perlu disesuaikan pas dijalanin beneran.

---

## 1. Jalankan lewat Docker Compose

Dari folder root project (yang ada `docker-compose.yml`):

```bash
docker compose up -d --build
```

Ini bakal:
- Build image API (`api/Dockerfile`) — otomatis jalanin migration (`npm run migrate:up`) tiap kali container start, baru nyalain server
- Build image Frontend (`frontend/Dockerfile`) — build Vite jadi static file, disajikan lewat nginx
- Nyalain 2 container: `pancong-inventori-api` (port 3000) dan `pancong-inventori-frontend` (port 8080)
- **Keduanya `restart: unless-stopped`** — otomatis nyala lagi kalau Mac Mini restart/mati listrik, tanpa perlu `npm start` manual lagi

**PENTING sebelum jalanin:** pastikan `api/.env` udah lengkap terisi (lihat `api/.env.example`), soalnya `docker-compose.yml` baca env dari situ.

### Cek jalan atau enggak

```bash
docker compose ps          # status kedua container
docker compose logs -f api # log API kalau mau debug
```

Buka `http://localhost:8080` di browser — harusnya muncul halaman Login.

## 2. Kenapa gak ada container Postgres di compose ini

Sengaja — Postgres kamu udah jalan dari project IMS (`pancong-jaksel-ims-postgres-1`), dan database `pancong_inventori` numpang di instance yang sama. Compose ini connect ke situ lewat `host.docker.internal` (alamat khusus Docker Desktop yang nunjuk balik ke Mac Mini). Kalau nama container Postgres kamu ternyata beda, cek dulu:

```bash
docker ps --format "{{.Names}}"
```

## 3. Backup otomatis

2 script di folder `scripts-deploy/`:
- `backup-db.sh` — dump database ke file `.sql.gz`, simpan di `~/backup-pancong-inventori/`, otomatis buang yang lebih tua dari 30 hari
- `restore-db.sh` — kebalikannya, buat kondisi darurat (minta konfirmasi ketik "ya" dulu sebelum nimpa data)

**Sebelum dipakai**, cek isi `NAMA_CONTAINER_POSTGRES` di kedua script — samain sama nama container Postgres kamu yang sebenarnya (lihat langkah 2).

### Jadwalin otomatis tiap hari (jam 2 pagi, misalnya)

Buka crontab:
```bash
crontab -e
```

Tambahin baris ini (sesuaikan path ke lokasi project kamu):
```
0 2 * * * /path/ke/project/scripts-deploy/backup-db.sh >> $HOME/backup-pancong-inventori/backup.log 2>&1
```

Cek jalan atau enggak setelah beberapa hari:
```bash
ls -la ~/backup-pancong-inventori/
```

## 4. HTTPS (perlu buat scan QR dari kamera HP)

Sekarang aplikasi jalan di `http://localhost` / IP lokal — browser HP nolak akses kamera di alamat kayak gini (kecuali `localhost` di device yang sama). Buat scan QR beneran dari HP crew, butuh domain asli + HTTPS.

Opsi paling gampang buat mulai: **Cloudflare Tunnel** (gratis, gak perlu buka port router) atau **Caddy** (auto-HTTPS kalau punya domain + IP publik). Ini di luar scope sesi ini — kabarin kalau udah siap ke tahap ini, nanti dibantu setup detailnya.

## 5. Update aplikasi ke versi baru

Setelah ada perubahan kode (dari sesi berikutnya, misalnya):
```bash
docker compose up -d --build
```
Ini otomatis rebuild image yang berubah aja, restart container yang perlu, migration baru otomatis ke-apply.

## 6. Rollout bertahap (saran, bukan keharusan teknis)

Daripada langsung suruh semua outlet pakai bersamaan, PRD kita sepakat mending mulai dari **1 gudang dulu** (Glagahsari, karena Rint paling sering di situ) selama beberapa hari, baru nambah UGM kalau udah yakin lancar. Ini bukan hal teknis di compose — cukup soal kapan QR fisik ditempel & crew mulai dikasih tau buat pakai.
