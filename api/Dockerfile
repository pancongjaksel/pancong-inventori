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
CMD ["sh", "-c", "npm run migrate:up && node server.js"]
