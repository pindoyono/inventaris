# Deploy Inventaris (inventaris.ankdev.id)

`/var/www/inventaris` adalah repo kerja sekaligus aplikasi (pola sama dengan e-vote/SIGW).

| Komponen | Lokasi |
|---|---|
| Service | `inventaris.service` → `127.0.0.1:3030`, user `inventaris`, kode hanya-baca |
| Env aplikasi | `/etc/inventaris/inventaris.env` (root:inventaris 640): `DATABASE_URL` role `inventaris_app`, `AUTH_SECRET`, `AUTH_URL`, `FILES_DIR` |
| Env migrasi | `/etc/inventaris/owner.env` (root 600): `DATABASE_URL_OWNER` role `inventaris_owner` |
| Berkas sekolah | `/var/lib/inventaris/files` |
| Backup | `inventaris-backup.timer` 03:00 → `/var/backups/inventaris` (pg_dump sebagai `postgres` karena FORCE RLS), simpan 14 hari |
| Update | `inventaris-update` / `inventaris-update --pull` (sebagai ubuntu) |
| nginx | `deploy/nginx-inventaris.conf` → `/etc/nginx/sites-available/inventaris` |

Pemasangan pertama (sekali):

```bash
sudo install -m 644 deploy/inventaris.service deploy/inventaris-backup.* /etc/systemd/system/
sudo install -m 755 deploy/inventaris-update /usr/local/bin/
sudo systemctl daemon-reload
# migrasi + data referensi ke database produksi
sudo sh -c 'set -a; . /etc/inventaris/owner.env; set +a; cd /var/www/inventaris && bun x drizzle-kit migrate && bun scripts/seed-referensi.ts'
# akun pengelola platform (password minimal 12 karakter, catat di /root/kredensial-baru.txt)
sudo sh -c 'set -a; . /etc/inventaris/owner.env; set +a; cd /var/www/inventaris && PLATFORM_USERNAME=... PLATFORM_PASSWORD=... bun scripts/platform-admin.ts'
inventaris-update
sudo systemctl enable --now inventaris.service inventaris-backup.timer
sudo cp deploy/nginx-inventaris.conf /etc/nginx/sites-available/inventaris && sudo nginx -t && sudo systemctl reload nginx
```
