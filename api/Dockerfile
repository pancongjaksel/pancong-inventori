# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Copy manifest dulu biar layer cache npm install gak keulang tiap ganti source code
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# Jalanin migration dulu (idempotent — cuma nerapin migration yang belum
# jalan), BARU start server. Aman buat single-instance restart; kalau nanti
# ada >1 instance API jalan bersamaan, pindahin migrate:up ke langkah
# deploy terpisah (bukan tiap container start) buat hindari race condition
# antar-instance yang jalan migration bersamaan.
#
# DATABASE_URL di-REKONSTRUKSI dari PG* env var di sini (bukan dipakai apa
# adanya dari .env) — soalnya node-pg-migrate CLI baca koneksi langsung dari
# DATABASE_URL, dan connection string di .env biasanya berisi 'localhost'
# (buat dev lokal). Di dalam container, 'localhost' nunjuk ke container itu
# sendiri, bukan ke host — jadi PGHOST (yang di-override docker-compose.yml
# ke host.docker.internal) harus menang. Susun ulang di sini biar override
# PGHOST konsisten kepakai baik oleh migration maupun oleh db/pool.js.
CMD ["sh", "-c", "export DATABASE_URL=\"postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}\" && npm run migrate:up && node server.js"]
