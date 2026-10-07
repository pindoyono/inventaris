#!/bin/bash
# Update Inventaris di tempat: /var/www/inventaris adalah repo kerja sekaligus aplikasi.
# Jalankan sebagai user ubuntu:  inventaris-update          (build kode yang ada sekarang)
#                                inventaris-update --pull   (git pull dulu dari GitHub)
set -euo pipefail
APP=/var/www/inventaris
URL=https://inventaris.ankdev.id/login
cd "$APP"

if [ "$(id -un)" != "ubuntu" ]; then
    echo "Jalankan sebagai user ubuntu (bukan root)." >&2
    exit 1
fi

if [ "${1:-}" = "--pull" ]; then
    git pull --ff-only
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "Peringatan: ada perubahan yang belum di-commit; perubahan itu ikut live:"
    git status --short
fi

# Registry npm resmi (mirror di ~/.npmrc tidak melayani format permintaan Bun)
bun install --frozen-lockfile --registry https://registry.npmjs.org/

# Migrasi & data referensi memakai role pemilik (kredensial hanya dibaca root)
sudo sh -c 'set -a; . /etc/inventaris/owner.env; set +a; cd /var/www/inventaris && /usr/local/bin/bun x drizzle-kit migrate && /usr/local/bin/bun scripts/seed-referensi.ts'

# .next/cache menunjuk ke folder milik inventaris; dilepas selama build agar ubuntu bisa menulis
if [ -L .next/cache ]; then rm -f .next/cache; else rm -rf .next/cache; fi
NEXT_TELEMETRY_DISABLED=1 bun run build
rm -rf .next/cache
ln -s /var/lib/inventaris/cache/next .next/cache
# Next 16 menulis "route cache" rute statis (mis. manifest) saat berjalan; layanan hanya boleh menulis
# di /var/lib/inventaris (ProtectSystem=strict) → arahkan ke sana
sudo install -d -o inventaris -g inventaris -m 750 /var/lib/inventaris/cache/route-cache
rm -rf .next/server/route-cache
ln -s /var/lib/inventaris/cache/route-cache .next/server/route-cache

sudo find /var/lib/inventaris/cache/next /var/lib/inventaris/cache/route-cache -mindepth 1 -delete
STARTED=$(date '+%F %T')
sudo systemctl restart inventaris.service

for i in $(seq 1 30); do
    curl -s -o /dev/null http://127.0.0.1:3030/login && break
    sleep 1
done
code=$(curl -s -o /dev/null -w '%{http_code}' "$URL")
echo "Versi live: $(git log --oneline -1)  |  $URL -> HTTP $code"
[ "$code" = "200" ] || { echo "Situs tidak merespons 200, cek: sudo journalctl -u inventaris -n 50" >&2; exit 1; }

# Cegah terulang: panggil rute statis (memicu penulisan cache) lalu pastikan tidak ada galat tulis berkas
for p in /manifest.webmanifest /favicon.ico /manifest.webmanifest; do curl -s -o /dev/null "http://127.0.0.1:3030$p"; done
sleep 2
bad=$(sudo journalctl -u inventaris --since "$STARTED" --no-pager -o cat | grep -E "Failed to update prerender cache|(EROFS|EACCES|ENOENT): [^,]*, [a-z]+ '/var/www/inventaris/\.next" || true)
if [ -n "$bad" ]; then
    echo "GAGAL: aplikasi mencoba menulis ke lokasi yang tidak bisa ditulis setelah deploy:" >&2
    echo "$bad" | head -5 >&2
    exit 1
fi
echo "Cek tulis cache: OK"
