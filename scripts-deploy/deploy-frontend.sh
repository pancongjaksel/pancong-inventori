#!/bin/sh
# Deploy frontend Pancong secara aman untuk PWA.
# Jalankan dari checkout proyek di VPS: ./scripts-deploy/deploy-frontend.sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
FRONTEND_DIR="$PROJECT_DIR/frontend"
CONTAINER_NAME="${PANCONG_FRONTEND_CONTAINER:-pancong-inventori-frontend}"
HTML_ROOT="/usr/share/nginx/html"

cd "$FRONTEND_DIR"

# Selalu gunakan API pada origin yang sama ketika membuat bundle produksi.
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org}"
npm ci --registry="$NPM_REGISTRY"
VITE_API_BASE_URL="${VITE_API_BASE_URL:-/api}" npm run build

if grep -R -q 'localhost:3000' dist; then
  echo "Deploy dibatalkan: bundle masih mengarah ke localhost:3000." >&2
  exit 1
fi

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null | grep -qx true; then
  echo "Container frontend tidak berjalan: $CONTAINER_NAME" >&2
  exit 1
fi

# Aset versi baru lebih dulu, baru entrypoint dan service worker diaktifkan.
docker cp dist/assets/. "$CONTAINER_NAME:$HTML_ROOT/assets/"
for file in dist/logo.png dist/manifest.json dist/manifest.webmanifest \
  dist/registerSW.js dist/workbox-*.js; do
  [ -f "$file" ] && docker cp "$file" "$CONTAINER_NAME:$HTML_ROOT/"
done
docker cp dist/index.html "$CONTAINER_NAME:$HTML_ROOT/index.html"
docker cp dist/sw.js "$CONTAINER_NAME:$HTML_ROOT/sw.js"

docker exec "$CONTAINER_NAME" test -f "$HTML_ROOT/sw.js"
docker exec "$CONTAINER_NAME" sh -c "grep -q '/api' $HTML_ROOT/assets/index-*.js"
echo "Deploy frontend selesai dan bundle API same-origin terverifikasi."
