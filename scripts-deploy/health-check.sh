#!/bin/sh
# Health check ringan untuk VPS Pancong. Exit non-zero bila perlu perhatian.
set -eu

API_CONTAINER="pancong-inventori-api"
FRONTEND_CONTAINER="pancong-inventori-frontend"
POSTGRES_CONTAINER="${PANCONG_POSTGRES_CONTAINER:-$(docker ps --format '{{.Names}}' | awk '/_pancong_postgres$/ { print; exit }')}"
BACKUP_DIR="$HOME/backup-pancong-inventori"
STATUS_FILE="$BACKUP_DIR/health-status.txt"
CONFIG_FILE="$HOME/.config/pancong-monitoring.env"
RCLONE_BIN="${RCLONE_BIN:-/usr/local/bin/rclone}"
RCLONE_REMOTE="${PANCONG_BACKUP_REMOTE:-pancong-gdrive:Pancong-Inventori/database}"
MAX_DISK_PERCENT=85
MAX_BACKUP_AGE_HOURS=26

failures=""
if [ -f "$CONFIG_FILE" ]; then
  set -a
  . "$CONFIG_FILE"
  set +a
fi
previous_status=$(cut -d' ' -f1 "$STATUS_FILE" 2>/dev/null || true)
send_email() {
  [ -n "${GMAIL_APP_PASSWORD:-}" ] || return 0
  "$(dirname "$0")/send-monitoring-email.py" "$1" "$2" || logger -t pancong-health 'Email alert gagal dikirim' || true
}
check_running() {
  if [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" != "true" ]; then
    failures="$failures container:$1"
  fi
}

check_running "$API_CONTAINER"
check_running "$FRONTEND_CONTAINER"
[ -n "$POSTGRES_CONTAINER" ] && check_running "$POSTGRES_CONTAINER" || failures="$failures postgres-container"

api_status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:3000/api/auth/me || true)
[ "$api_status" != "000" ] || failures="$failures api-unreachable"

disk_percent=$(df -P / | awk 'NR==2 { gsub(/%/, "", $5); print $5 }')
[ "$disk_percent" -lt "$MAX_DISK_PERCENT" ] || failures="$failures disk:${disk_percent}%"

latest_backup=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pancong_inventori_*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || true)
if [ -z "$latest_backup" ] || ! gzip -t "$latest_backup"; then
  failures="$failures backup-invalid"
else
  now=$(date +%s)
  modified=$(stat -c %Y "$latest_backup")
  age_hours=$(( (now - modified) / 3600 ))
  [ "$age_hours" -le "$MAX_BACKUP_AGE_HOURS" ] || failures="$failures backup-age:${age_hours}h"

  if [ ! -x "$RCLONE_BIN" ]; then
    failures="$failures offsite-backup-tool-missing"
  elif remote_files=$("$RCLONE_BIN" lsf --files-only "$RCLONE_REMOTE" 2>/dev/null); then
    printf '%s\n' "$remote_files" | grep -Fxq "${latest_backup##*/}" || failures="$failures offsite-backup-missing"
  else
    failures="$failures offsite-backup-unreachable"
  fi
fi

timestamp=$(date -Is)
if [ -n "$failures" ]; then
  printf 'FAIL %s%s\n' "$timestamp" "$failures" | tee "$STATUS_FILE" >&2
  logger -t pancong-health "FAIL$failures" || true
  [ "$previous_status" = "FAIL" ] || send_email '[Pancong] Perlu perhatian' "Health-check gagal pada $timestamp:$failures"
  exit 1
fi

printf 'OK %s api=%s disk=%s%% backup=%s\n' "$timestamp" "$api_status" "$disk_percent" "${latest_backup##*/}" > "$STATUS_FILE"
logger -t pancong-health 'OK' || true
[ "$previous_status" != "FAIL" ] || send_email '[Pancong] Sistem pulih' "Health-check kembali normal pada $timestamp."
