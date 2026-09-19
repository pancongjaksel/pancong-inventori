#!/bin/sh
# Deploy API tanpa drift antara source host dan container runtime.
# Jalankan dari checkout proyek: ./scripts-deploy/deploy-api.sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_DIR"

if docker compose version >/dev/null 2>&1; then
  docker compose build api
  docker compose up -d --no-deps api
  docker compose ps api
else
  docker-compose build api
  # docker-compose v1 bisa gagal recreate image baru pada Docker modern
  # (KeyError: ContainerConfig). Hapus container API saja; database dan
  # uploads adalah volume/bind mount terpisah dan tidak ikut terhapus.
  docker-compose rm -sf api
  docker-compose up -d --no-deps api
  docker-compose ps api
fi
