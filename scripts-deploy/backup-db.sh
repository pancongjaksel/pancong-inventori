#!/bin/bash
# backup-db.sh — Backup harian database pancong_inventori
#
# Jalanin via docker exec ke container Postgres yang UDAH ADA (bukan bikin
# container baru), soalnya database ini numpang di instance Postgres yang
# sama dengan project IMS. Ganti NAMA_CONTAINER_POSTGRES di bawah kalau
# nama container-nya beda dari yang tercatat sekarang.

set -euo pipefail

NAMA_CONTAINER_POSTGRES="${PANCONG_POSTGRES_CONTAINER:-$(docker ps --format '{{.Names}}' | awk '/_pancong_postgres$/ { print; exit }')}"
NAMA_DATABASE="pancong_inventori"
FOLDER_BACKUP="$HOME/backup-pancong-inventori"
RCLONE_BIN="${RCLONE_BIN:-/usr/local/bin/rclone}"
RCLONE_REMOTE="${PANCONG_BACKUP_REMOTE:-pancong-gdrive:Pancong-Inventori/database}"
TANGGAL=$(date +%Y-%m-%d_%H%M)
FILE_BACKUP="$FOLDER_BACKUP/pancong_inventori_$TANGGAL.sql.gz"
FILE_SEMENTARA="$FILE_BACKUP.tmp"
DB_VERIFIKASI="pancong_backup_verify_$$"

mkdir -p "$FOLDER_BACKUP"
if [ -z "$NAMA_CONTAINER_POSTGRES" ]; then
  echo "Container PostgreSQL Pancong tidak ditemukan." >&2
  exit 1
fi

cleanup() {
  rm -f "$FILE_SEMENTARA"
  docker exec "$NAMA_CONTAINER_POSTGRES" dropdb -U pancong_user --if-exists "$DB_VERIFIKASI" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Backup database '$NAMA_DATABASE' dari container '$NAMA_CONTAINER_POSTGRES'..."
docker exec "$NAMA_CONTAINER_POSTGRES" pg_dump -U pancong_user "$NAMA_DATABASE" | gzip > "$FILE_SEMENTARA"

gzip -t "$FILE_SEMENTARA"
test -s "$FILE_SEMENTARA"

echo "Memverifikasi restore backup..."
docker exec "$NAMA_CONTAINER_POSTGRES" createdb -U pancong_user "$DB_VERIFIKASI"
gunzip -c "$FILE_SEMENTARA" | docker exec -i "$NAMA_CONTAINER_POSTGRES" psql -v ON_ERROR_STOP=1 -U pancong_user -d "$DB_VERIFIKASI" >/dev/null
docker exec "$NAMA_CONTAINER_POSTGRES" dropdb -U pancong_user "$DB_VERIFIKASI"

mv "$FILE_SEMENTARA" "$FILE_BACKUP"
trap - EXIT

echo "Selesai: $FILE_BACKUP ($(du -h "$FILE_BACKUP" | cut -f1))"

# Salin keluar VPS hanya setelah backup lokal lolos uji restore.
if [ ! -x "$RCLONE_BIN" ]; then
  echo "rclone tidak ditemukan: $RCLONE_BIN" >&2
  exit 1
fi

NAMA_FILE_BACKUP=$(basename "$FILE_BACKUP")
FILE_REMOTE="$RCLONE_REMOTE/$NAMA_FILE_BACKUP"
echo "Mengunggah backup terenkripsi-transit ke Google Drive..."
"$RCLONE_BIN" copyto --checksum "$FILE_BACKUP" "$FILE_REMOTE"

MD5_LOKAL=$(md5sum "$FILE_BACKUP" | awk '{print $1}')
MD5_REMOTE=$("$RCLONE_BIN" md5sum "$FILE_REMOTE" | awk 'NR == 1 {print $1}')
if [ -z "$MD5_REMOTE" ] || [ "$MD5_LOKAL" != "$MD5_REMOTE" ]; then
  echo "Checksum Google Drive tidak cocok; backup remote ditolak." >&2
  exit 1
fi
echo "Upload Google Drive terverifikasi: $FILE_REMOTE"

# Buang backup yang lebih tua dari 30 hari, biar folder gak numpuk terus
find "$FOLDER_BACKUP" -name "pancong_inventori_*.sql.gz" -mtime +30 -delete
echo "Backup lebih tua dari 30 hari sudah dibuang."

# Simpan salinan offsite lebih lama daripada salinan lokal.
"$RCLONE_BIN" delete --min-age 90d --include 'pancong_inventori_*.sql.gz' "$RCLONE_REMOTE"
echo "Backup Google Drive lebih tua dari 90 hari sudah dibuang."
