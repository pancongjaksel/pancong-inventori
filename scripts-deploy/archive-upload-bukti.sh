#!/bin/bash
# Arsip foto bukti yang telah melewati masa aktif 1 tahun.
#
# File hanya dihapus dari VPS setelah aplikasi mampu menyajikan arsip Drive
# secara privat. Saat ini skrip sengaja melakukan archive-only agar URL
# /uploads/* yang tersimpan di transaksi tidak pernah menjadi rusak.

set -eu

UPLOAD_DIR="${PANCONG_UPLOAD_DIR:-/opt/pancong/app/api/uploads}"
RCLONE_BIN="${RCLONE_BIN:-/usr/local/bin/rclone}"
RCLONE_REMOTE="${PANCONG_UPLOAD_ARCHIVE_REMOTE:-pancong-gdrive:Pancong-Inventori/upload-archive}"
ACTIVE_DAYS="${PANCONG_UPLOAD_ACTIVE_DAYS:-365}"
MODE="${1:---archive}"

[ -d "$UPLOAD_DIR" ] || { echo "Folder upload tidak ditemukan: $UPLOAD_DIR" >&2; exit 1; }
[ -x "$RCLONE_BIN" ] || { echo "rclone tidak ditemukan: $RCLONE_BIN" >&2; exit 1; }

count=0
find "$UPLOAD_DIR" -type f -mtime "+$ACTIVE_DAYS" -print0 |
while IFS= read -r -d '' file; do
  name=$(basename "$file")
  remote="$RCLONE_REMOTE/$name"
  count=$((count + 1))

  if [ "$MODE" = "--dry-run" ]; then
    printf 'CANDIDATE %s\n' "$file"
    continue
  fi

  local_md5=$(md5sum "$file" | awk '{print $1}')
  remote_md5=$("$RCLONE_BIN" md5sum "$remote" 2>/dev/null | awk 'NR == 1 {print $1}')
  if [ -n "$remote_md5" ] && [ "$local_md5" = "$remote_md5" ]; then
    printf 'ALREADY_ARCHIVED %s\n' "$name"
    continue
  fi

  "$RCLONE_BIN" copyto --checksum "$file" "$remote"
  remote_md5=$("$RCLONE_BIN" md5sum "$remote" | awk 'NR == 1 {print $1}')
  [ -n "$remote_md5" ] && [ "$local_md5" = "$remote_md5" ] || {
    echo "Checksum arsip tidak cocok: $name" >&2
    exit 1
  }

  # Waktu arsip dipakai untuk retensi Drive 2 tahun berikutnya, bukan umur
  # file asal. Dengan begitu bukti tetap tersedia total minimal 3 tahun.
  "$RCLONE_BIN" touch "$remote"
  printf 'ARCHIVED %s\n' "$name"
done

if [ "$MODE" = "--dry-run" ]; then
  exit 0
fi

# Arsip Drive yang sudah dua tahun sejak pengarsipan boleh dibersihkan nanti.
# Belum diaktifkan sampai akses bukti dari arsip privat tersedia di aplikasi.
printf 'Archive selesai. File VPS tetap dipertahankan demi URL bukti transaksi.\n'
