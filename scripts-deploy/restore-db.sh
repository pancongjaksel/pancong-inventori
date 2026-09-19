#!/bin/bash
# restore-db.sh — Restore database dari file backup hasil backup-db.sh
#
# PERINGATAN: ini nimpa database yang ada sekarang. Pastikan yakin dulu
# sebelum jalanin, terutama di environment production.
#
# Pemakaian: ./restore-db.sh /path/ke/pancong_inventori_2026-08-05_1400.sql.gz

set -euo pipefail

NAMA_CONTAINER_POSTGRES="pancong_postgres"
NAMA_DATABASE="pancong_inventori"
FILE_BACKUP="${1:-}"

if [ -z "$FILE_BACKUP" ]; then
  echo "Pemakaian: $0 /path/ke/file-backup.sql.gz"
  exit 1
fi
if [ ! -f "$FILE_BACKUP" ]; then
  echo "File backup gak ditemukan: $FILE_BACKUP"
  exit 1
fi

read -p "Ini bakal NIMPA database '$NAMA_DATABASE' yang ada sekarang. Lanjut? (ketik 'ya' buat konfirmasi) " KONFIRMASI
if [ "$KONFIRMASI" != "ya" ]; then
  echo "Dibatalkan."
  exit 0
fi

echo "Restore ke database '$NAMA_DATABASE'..."
gunzip -c "$FILE_BACKUP" | docker exec -i "$NAMA_CONTAINER_POSTGRES" psql -U pancong_user -d "$NAMA_DATABASE"
echo "Restore selesai."
