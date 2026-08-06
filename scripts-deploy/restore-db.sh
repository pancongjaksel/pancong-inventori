#!/bin/bash
# restore-db.sh — Restore database dari file backup hasil backup-db.sh
#
# PERINGATAN: ini nimpa database yang ada sekarang. Pastikan yakin dulu
# sebelum jalanin, terutama di environment production.
#
# Pemakaian: ./restore-db.sh /path/ke/pancong_inventori_2026-08-05_1400.sql.gz

set -euo pipefail

# Sama kayak backup-db.sh — pastikan `docker` ketemu apa pun PATH pemanggilnya.
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

NAMA_CONTAINER_POSTGRES="pancong-jaksel-ims-postgres-1"
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
gunzip -c "$FILE_BACKUP" | docker exec -i "$NAMA_CONTAINER_POSTGRES" psql -U pj_user -d "$NAMA_DATABASE"
echo "Restore selesai."
