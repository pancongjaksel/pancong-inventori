#!/bin/bash
# backup-db.sh — Backup harian database pancong_inventori
#
# Jalanin via docker exec ke container Postgres yang UDAH ADA (bukan bikin
# container baru), soalnya database ini numpang di instance Postgres yang
# sama dengan project IMS. Ganti NAMA_CONTAINER_POSTGRES di bawah kalau
# nama container-nya beda dari yang tercatat sekarang.

set -euo pipefail

# cron jalan dengan PATH minimal (biasanya cuma /usr/bin:/bin) yang gak
# nyakup lokasi binary Docker Desktop (/usr/local/bin atau /opt/homebrew/bin
# di Apple Silicon) — tambahin manual di sini biar `docker` ketemu, apa pun
# PATH yang dikasih pemanggilnya (interaktif ATAU cron).
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

NAMA_CONTAINER_POSTGRES="pancong-jaksel-ims-postgres-1"
NAMA_DATABASE="pancong_inventori"
FOLDER_BACKUP="$HOME/backup-pancong-inventori"
TANGGAL=$(date +%Y-%m-%d_%H%M)
FILE_BACKUP="$FOLDER_BACKUP/pancong_inventori_$TANGGAL.sql.gz"

mkdir -p "$FOLDER_BACKUP"

echo "Backup database '$NAMA_DATABASE' dari container '$NAMA_CONTAINER_POSTGRES'..."
docker exec "$NAMA_CONTAINER_POSTGRES" pg_dump -U pj_user "$NAMA_DATABASE" | gzip > "$FILE_BACKUP"

echo "Selesai: $FILE_BACKUP ($(du -h "$FILE_BACKUP" | cut -f1))"

# Buang backup yang lebih tua dari 30 hari, biar folder gak numpuk terus
find "$FOLDER_BACKUP" -name "pancong_inventori_*.sql.gz" -mtime +30 -delete
echo "Backup lebih tua dari 30 hari sudah dibuang."
