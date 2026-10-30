# Deploy the Rebuilt App to the Droplet (Runbook)

> Target: droplet `178.128.49.254` (map.hyxc.io, Tailscale `100.102.67.116`), user `cmmc`. Source: branch `feat/secure-rebuild`.
> Run this **before** the broker cutover in `2026-10-30-broker-lockdown.md`. The new app can talk to the broker anonymously, so the deploy does not depend on the lockdown; switch it to credentials afterwards.
> Legend: **[U]** you (sudo or console) · **[C]** Claude, read-only checks or non-sudo steps after your OK.
> Status: nothing here has been executed. Facts below were read-only checks on 2026-10-30.

## What is deployed now (verified)

| Fact | Evidence |
|------|----------|
| Old build, `BUILD_ID` dated 2026-07-30, service running since 2026-09-11. | `stat`, `systemctl show` |
| Service `water-gate`: `User=cmmc`, `WorkingDirectory=/home/cmmc/water-web/web2`, `next start -p 3000`. The unit file also contains stray pasted lines (`cat <<EOF \| sudo tee …`, `EOF`) that systemd ignores with a warning. | `systemctl cat water-gate` |
| The old app has `bcryptjs` and `jose` in its dependencies: **its own login, different from ours** (ours: scrypt + DB sessions). Its `.env.local` has `PG*`, `FASTAPI_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, no MQTT variables. | deployed `package.json`, variable names only |
| Node `v20.20.2`, npm 10.8.2, no swap, 7.6 GB free, 1 GB RAM. Next 16 needs Node ≥ 20.9, so it runs. `scripts/create-user.ts` needs Node ≥ 22.18 (type stripping), so run it from the Mac. | `node -v` |
| nginx `default`: `/` → `localhost:3000`; `/mqtt`, `/ws/`, `/api/control` → loopback backends; **`/dashboard/` is a static `alias /var/www/html/dashboard/`** that wins over Next for that path; no `X-Forwarded-*` headers at all. | `/etc/nginx/sites-enabled/default` |
| Postgres in docker `watergate-postgres` (published on 5432), data volume `watergate_db_data`. | `docker inspect` |

## Gates: do not cut over until all are answered

- **G1. Pump control path: resolved in code (2026-10-30).** The old site sent commands from the browser over anonymous MQTT, and there is no FastAPI on the droplet. `forwardCommand` now publishes the bare command to `stm32/cmd` through the server's own MQTT connection (QoS 0, never queued while offline). The Pi's `cmd_node` already consumes that topic. Needs the broker account to be allowed to write `stm32/cmd`; while the broker is still anonymous that holds by default. `sent` means the broker connection took the message; the effect shows in the status stream. Check on the first real command after cutover.
- **G2. Database collision: resolved by schema isolation.** Read-only check on 2026-10-30 (names only, no rows): database `watergate_db`, Postgres 16.14, only the `plpgsql` extension, one role `water_admin` (**superuser**, and it is the role the app uses), tables `device_command_logs`, `devices`, `users`, `water_levels`. **`public.users` already exists** (`id uuid`, `email varchar`, `name varchar`, `role varchar`, `password_hash text`, `created_at`): the old app's accounts. It has no `disabled` column and its `email` is not `citext`, so our migration's `create table if not exists users` would skip it and the new app would fail at its first sign-in query. `sessions` and `control_audit` do not exist.
  - **Decision:** our three tables go in their own schema `wgw`, and the app connects with `PGOPTIONS="-c search_path=wgw,public"`. `pg` 8.20 reads `PGOPTIONS` itself (`node_modules/pg/lib/connection-parameters.js:83`), so no code change. Unqualified `users` resolves to `wgw.users`; `water_levels` still resolves to `public`.
  - **Benefit:** the old tables are never touched, so **rolling back leaves the old app and its accounts exactly as they were**.
  - **Cost:** old accounts do not carry over. Recreate them with `scripts/create-user.ts`; their hashes (written by `bcryptjs`) cannot be checked by our scrypt code.
  - **Not read:** row counts, role values, hash format of the old `users`. Ask the owner which accounts matter.
- **G3. Rollback proven.** Take the backups in step R0 and keep the old directory untouched.
- **G4. Window.** The site is down for under a minute at R5. Pick a time when nobody needs the pumps from the web.

## R0. Backups [U], no downtime

```bash
sudo cp /etc/systemd/system/water-gate.service ~/water-gate.service.bak-20261030
sudo cp -a /etc/nginx/sites-available/default ~/nginx-default.bak-20261030   # or the real file behind sites-enabled
docker exec watergate-postgres pg_dumpall -U postgres | gzip > ~/pg-backup-20261030.sql.gz && chmod 600 ~/pg-backup-20261030.sql.gz
ls -la /var/www/html/dashboard | head      # what the static /dashboard/ block serves
```

## R1. Build on the Mac [U or C]

- [ ] `git switch feat/secure-rebuild && npm ci && npm test && npm run typecheck && npm run lint && npm run build` (all green).
- [ ] **Optional, recommended:** remove the 6 dependencies no file imports (`@ffmpeg-installer/ffmpeg`, `fluent-ffmpeg`, `jsmpeg`, `pi-camera`, `rtsp-relay`, `express`; checked with grep over `src/`, `scripts/`, `mqtt_bridge.js`). Less to install on a 1 GB droplet, fewer packages to patch. Needs your OK (changes `package.json` and the lockfile).

## R2. Ship the release [C after OK, no sudo]

Release layout, so rollback is a symlink: `/home/cmmc/wgw/releases/<date>-<sha7>/` and `/home/cmmc/wgw/current` → release.

```bash
REL=20261030-$(git rev-parse --short HEAD)
ssh cmmc@100.102.67.116 "mkdir -p ~/wgw/releases/$REL"
rsync -az --delete .next public package.json package-lock.json next.config.ts cmmc@100.102.67.116:~/wgw/releases/$REL/
ssh cmmc@100.102.67.116 "cd ~/wgw/releases/$REL && npm ci --omit=dev"
```
Only runtime files go up. `db/` and `scripts/` stay on the Mac (migration and user creation run from there).

Create `/home/cmmc/wgw/app.env` (mode 600) on the droplet. **You** type the secrets; names only here:
```
NODE_ENV=production
PGUSER=…  PGHOST=127.0.0.1  PGDATABASE=watergate_db  PGPASSWORD=…  PGPORT=5432
PGOPTIONS="-c search_path=wgw,public"     # our tables live in schema wgw (G2); quotes keep it valid for both systemd and a shell
MQTT_URL=mqtt://127.0.0.1:1883
MQTT_TOPIC_STATUS=water/gate/status

GO2RTC_URL=http://127.0.0.1:1984                  # replaced once the tailnet path exists
# MQTT_USERNAME / MQTT_PASSWORD: leave unset until the broker lockdown (anonymous today)
```

## R3. Database [U runs]

- [ ] Create the schema and apply the migration in **one transaction** with our search path. From the Mac:
```bash
ssh cmmc@100.102.67.116 "docker exec -i -e PGOPTIONS='-c search_path=wgw,public' watergate-postgres psql -1 -v ON_ERROR_STOP=1 -U water_admin -d watergate_db -c 'create schema if not exists wgw' -f -" < db/migrations/001_auth.sql
```
- [ ] Verify (names only): `... psql -U water_admin -d watergate_db -At -c "select table_schema||'.'||table_name from information_schema.tables where table_schema='wgw' order by 1"` → `wgw.control_audit`, `wgw.sessions`, `wgw.users`. Also confirm `public.users` still has its 6 original columns.
- [ ] Create the first admin from the Mac through a tunnel (Node ≥ 22.18 on the Mac; the script reads the password silently and never prints it):
```bash
ssh -N -L 5433:127.0.0.1:5432 cmmc@100.102.67.116 &
read -rs PGPASSWORD; export PGPASSWORD
PGOPTIONS='-c search_path=wgw,public' PGHOST=127.0.0.1 PGPORT=5433 PGUSER=<PGUSER> PGDATABASE=watergate_db node scripts/create-user.ts <email> admin
```
- [ ] **Hardening (recommended, same window):** the app must not connect as a superuser. A bug in any query would then reach the whole database, including `COPY ... PROGRAM` (commands inside the container). Create a limited role and put it in `app.env` instead of `water_admin`:
```sql
create role wgw_app login;           -- then \password wgw_app  (interactive, nothing in history)
grant connect on database watergate_db to wgw_app;
grant usage on schema wgw, public to wgw_app;
grant select on public.water_levels to wgw_app;
grant select, insert, update, delete on all tables in schema wgw to wgw_app;
grant usage, select on all sequences in schema wgw to wgw_app;
```

## R4. Smoke test on a side port [C, no sudo, no downtime]

```bash
ssh cmmc@100.102.67.116 'cd ~/wgw/releases/<REL> && set -a && . ~/wgw/app.env && set +a && HOSTNAME=127.0.0.1 ./node_modules/.bin/next start -p 3100'
```
Then from a second terminal: `ssh -N -L 3100:127.0.0.1:3100 cmmc@100.102.67.116`.
- [ ] `curl -si localhost:3100/login` → 200 with 5 security headers; `/api/water-level` → 401; `/api/status/stream` → 401; `/dashboard` → 307 to `/login`.
- [ ] In a browser on `http://localhost:3100`: sign in, map loads, `/dashboard?gate=gate-1` shows live numbers and the badge goes OFFLINE when the broker is stopped (do not stop the production broker; use the stale rule, 30 s without data).
- [ ] Sign-in works against `wgw.users` (this proves `PGOPTIONS` reaches the connection; if it fails with "relation users … column disabled" the old `public.users` was used instead).
- [ ] The session cookie is `Secure`: Chrome and Brave accept it on `localhost`; Safari does not.
- [ ] Stop the side process (Ctrl+C).

## R5. Cutover [U, sudo], under a minute of downtime

Write a clean unit (replaces the one with stray lines):
```
[Unit]
Description=Water Gate Way (Next.js)
After=network.target

[Service]
User=cmmc
WorkingDirectory=/home/cmmc/wgw/current
EnvironmentFile=/home/cmmc/wgw/app.env
Environment=HOSTNAME=127.0.0.1
ExecStart=/home/cmmc/wgw/current/node_modules/.bin/next start -p 3000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```
```bash
ln -sfn ~/wgw/releases/<REL> ~/wgw/current
sudo systemctl daemon-reload && sudo systemctl restart water-gate && systemctl is-active water-gate
```
`HOSTNAME=127.0.0.1` closes the public port 3000.

## R6. nginx [U, sudo]; [C drafts the exact diff first]

In the `443` server block:
- **Delete** `location /mqtt`, `location /ws/`, `location /api/control`, and the static `location /dashboard/` (after you looked at `/var/www/html/dashboard` in R0).
- **Replace** `location /` and add two streaming locations:
```nginx
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;   # overwrite, never append: the app uses it for rate limits and audit
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
    location ~ ^/api/(status|camera)/stream$ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
```
```bash
sudo nginx -t && sudo systemctl reload nginx
```
(The new app has no WebSocket, so the `Upgrade`/`Connection` lines go away.)

## R7. Verify [C, read-only, from the Mac]

- [ ] `curl -skI https://map.hyxc.io/login` → 200 and the 5 headers (`-k` until the certificate is renewed).
- [ ] `curl -sk -o /dev/null -w '%{http_code}' https://map.hyxc.io/api/water-level` → `401`; `/api/status/stream` → `401`; `/api/camera/stream?src=office1` → `401`.
- [ ] WebSocket handshake to `/mqtt` no longer returns `101`.
- [ ] `nc -z -w3 178.128.49.254 3000` → closed.
- [ ] In the browser: sign in as admin, dashboard shows live data and LIVE/OFFLINE badges. Test a control button **only** with your OK, on a safe command, then check that one row appeared in `control_audit`.

## R8. Rollback [U]

```bash
sudo cp ~/water-gate.service.bak-20261030 /etc/systemd/system/water-gate.service
sudo cp ~/nginx-default.bak-20261030 /etc/nginx/sites-available/default
sudo systemctl daemon-reload && sudo systemctl restart water-gate && sudo nginx -t && sudo systemctl reload nginx
```
The old app in `/home/cmmc/water-web/web2` is untouched, so it starts as before. The `wgw` schema stays in the database and does no harm; the old `public.users` was never touched, so the old app signs in as before.

## After the deploy

1. Broker lockdown, Phases A to D of `2026-10-30-broker-lockdown.md`. Add `MQTT_USERNAME=nextjs` and `MQTT_PASSWORD` to `app.env` and restart `water-gate` at step B4.
2. Camera video: tailnet ACL, `tailscale serve` on the Pi, then `GO2RTC_URL=http://100.90.199.55:1984` in `app.env`.
3. TLS: the certificate (`/etc/ssl/certs/domain.cert.pem`, a manual file) expired on 2026-08-17. Renew with certbot, for example `sudo certbot --nginx -d hyxc.io -d www.hyxc.io -d map.hyxc.io` (it edits the nginx file, so keep the R0 backup) and check `systemctl list-timers | grep certbot`. Browsers show "Not Secure" until then.
4. Old bookmarks `/dashboard?device=GATE-001&name=…` still open: the unknown parameters are ignored and Gate 1 is shown.

## Not verified

Row counts, role values and hash format of the old `public.users`; whether `next.config.ts` loads cleanly without the `typescript` package on the droplet (R4 proves it); the contents of `/var/www/html/dashboard`; that 1 GB RAM runs the new app next to Postgres and Mosquitto (R4 shows memory; there is no swap).
