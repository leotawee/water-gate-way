# 2026-10-31 — Status check and cutover script fix

## [15:05] Status check (read-only)

- **Action:** read `Diagram/` (3 drawio files plus `overall_flow.pdf`), `IDEA.md`, the runbook log; `curl` to map.hyxc.io; read-only SSH to the droplet (service, nginx, releases, `wgw.users` count, today's deploy log and script).
- **Result:** the live site is still the old build (`water-gate.service` runs from `/home/cmmc/water-web/web2`, started 2026-09-11). The served TLS cert expired 2026-08-17. The release `20261030-7dd2edf` is staged but not live. `wgw.users` has 0 rows. The 07:53 run of `deploy-20261031.sh` issued a new Let's Encrypt cert (expires 2027-01-29) and stopped with no FATAL line; the script was edited at 07:56 and not run again.
- **Diagram vs the web:** the drawings show the hardware and IoT layout the web already covers. Three items are not built: 3-month history in the DB, push notifications to phones, alerts for theft or power loss.
- **Lesson:** 📌 GENERAL: a staged deploy script needs a dry read before its first sudo run; every `set -e` exit without a message is a blind spot.

## [15:18] Fixed the staged cutover files on the droplet (approved by Leo)

- **Action:** backed up both files as `*.bak-fix` in `~/wgw/`, copied them to the scratchpad, edited them, ran `bash -n` locally and remotely, uploaded them, and compared sha256 on both sides (they match).
- **Fixes:**
  1. `install -m 644 root:root SRC DEST` became `install -o root -g root -m 644 SRC DEST`. `install` read `root:root` as a source file, so step 4 (systemd) and step 5 (nginx) would have failed.
  2. The renewal deploy hook read domain lines from stdin. certbot passes `RENEWED_LINEAGE` in the environment and nothing on stdin, so the hook would never sync the renewed cert, and the cert would expire again in 90 days. It now checks `RENEWED_LINEAGE`.
  3. `trap 'die ...' ERR`: any unexpected failure now logs FATAL with the line number and the rollback commands, instead of exiting silently like the 07:53 run.
  4. `nginx -t || die`: a rejected config now prints the rollback steps.
  5. `nginx-default.new` had no `listen 80` block. Added the HTTP to HTTPS redirect, which the certbot `--nginx` authenticator also needs on renewal.
- **Rejected (mini-ADR):** pointing nginx straight at `/etc/letsencrypt/live/...` and dropping the copy step. It is cleaner, but it changes more of a script that is about to run with sudo. A small, checked change is safer here.
- **Not verified:** the script has not run (it needs sudo). The new nginx file has not been through `nginx -t`, because that needs root. The hook has not been tried with `certbot renew --dry-run`.
- **Lesson:** 📌 GENERAL: certbot hooks receive `RENEWED_LINEAGE` and `RENEWED_DOMAINS` as environment variables; check the hook contract before you write one.

## [15:40] First admin created (by Leo, from the Mac through an SSH tunnel)

- **Action:** opened the tunnel; Leo ran `scripts/create-user.ts` with `PGOPTIONS` search_path `wgw,public`; I checked `wgw.users` (email, role, disabled, first 8 chars of the hash) and closed the tunnel.
- **Result:** 1 admin in `wgw.users`, `disabled = f`, hash prefix `scrypt$1`. Minimum password length stays 8 (Leo's decision, the 12 to 8 edit in `create-user.ts` is still uncommitted).
- **Dead ends:** typed `<email>` literally and zsh read it as a redirect; two runs failed with `28P01` (wrong `PGPASSWORD`, typed blind with `read -rs`). Fixed by exporting the password straight from `~/wgw/app.env` over SSH.
- **Observation:** `public.users` (old app) has 7 accounts with bcrypt hashes; the new build cannot read them, so each person needs a new account.
- **Lesson:** 📌 GENERAL: a silent password prompt hides typos; pull the secret from its source instead of retyping it. `create-user.ts` also hides the Postgres error text, which made `28P01` look like an insert problem.

## [16:40] Cloudflare state check (read-only)

- **Action:** `dig` against the .io TLD, 1.1.1.1 and `elsa.ns.cloudflare.com`; `curl --resolve` through a Cloudflare edge IP; `ss` on the droplet; `nc` to port 3000 from the Mac; read `src/lib/http/clientIp.ts` and the Next 16 CLI docs.
- **Result:** the registrar now delegates `hyxc.io` to Cloudflare (`elsa`, `zod`); resolvers still cache Porkbun. Cloudflare answers `map` and `www` with its own IPs, and requests reach the droplet's nginx on 443 from Cloudflare ranges (172.70.x, 162.158.x). So `map` is a proxied A record, not a tunnel: `cloudflared` is not installed on the droplet (`inactive`, no config dir).
- **Security finding (P1):** `next start` listens on `*:3000` and the port answers from the internet (`/login` 200). The unit's `HOSTNAME=127.0.0.1` does nothing for `next start`; the CLI flag is `-H` (`node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md:122`). `clientIp()` trusts the first `X-Forwarded-For` value, so a client that calls :3000 directly picks its own IP and bypasses the login and control rate limits.
- **Second finding (P2):** behind the Cloudflare proxy, nginx overwrites `X-Forwarded-For` with `$remote_addr`, which is now a Cloudflare edge IP. Users who share an edge share one rate-limit bucket, and the audit log records Cloudflare IPs.
- **Lesson:** 📌 GENERAL: an env var that looks like a bind setting may only apply to one entry point (`HOSTNAME` is read by the standalone `server.js`, not by `next start`); check what is actually listening with `ss -ltnp`.

## [16:33] clientIp: opt-in CF-Connecting-IP for Cloudflare Tunnel (approved by Leo)

- **Action:** TDD. 4 new cases in `src/lib/http/clientIp.test.ts`, RED first (2 failed: the function ignored `cf-connecting-ip`). Then `clientIp()` reads `CF-Connecting-IP` only when `CLIENT_IP_HEADER=cf-connecting-ip`, with no fallback to `X-Forwarded-For`/`X-Real-IP` in that mode. `.env.example` documents the variable and its precondition.
- **Result:** 190/190 tests pass. Lint clean on `src/lib/http`. Typecheck: 4 errors, all in the untracked `scripts/db-inspect.ts` (not part of this change); none in `src/`.
- **Decision (mini-ADR):** an explicit env switch instead of "prefer CF-Connecting-IP when present". Rejected the automatic version: today droplet ports 443 and 3000 are open, so any client could send its own `CF-Connecting-IP` and pick its rate-limit key. The switch is turned on only after the app listens on 127.0.0.1 and only cloudflared reaches it. Rejected the fallback to XFF in tunnel mode for the same reason: behind the tunnel those headers come from the client.
- **Not done:** nothing deployed; the droplet still runs release `20261030-7dd2edf`. The :3000 exposure (P1) is still open until the unit gets `-H 127.0.0.1`.
- **Lesson:** 📌 GENERAL: a "real client IP" header is only as trustworthy as the network path; make trusting it an explicit deploy-time decision, not a default.

## [17:05] Cleanup inventory (Haiku subagent) and review

- **Action:** a Haiku subagent listed clutter in the repo and on the droplet, read-only. I spot-checked the load-bearing rows over SSH and with `curl`/`nc`.
- **Found by the review, missed by the inventory (P1):** `/etc/nginx/sites-enabled/default` is a regular file, not a symlink. The cutover script installed the new config into `sites-available/default`, so nginx still serves the OLD config. Effects, verified: `POST /api/control` returns 502 (old route to `127.0.0.1:8000`, where nothing listens), so operators cannot command the pump from the web; `/mqtt` still proxies to the anonymous broker websocket; `X-Forwarded-For` is not overwritten, so a client-supplied value (Cloudflare appends to it) still picks the rate-limit key. The script's step-6 checks only tested headers that Next.js sets itself, so they passed.
- **Confirmed open:** Postgres 5432 and Mosquitto 1883/9001/8883 answer from the internet; the broker still allows anonymous clients (P0: anyone can publish `stm32/cmd`).
- **Inventory corrections:** the junk file `domain.cert.pem;` is gone (the re-run's `rm -f` removed it); `pm2 ls` is empty, but `pm2-cmmc.service` is enabled and the saved dump may still hold old apps (not checked).
- **Lesson:** 📌 GENERAL: verify a config change by testing a behaviour only the new config produces (a route that changed), not one the app produces either way. Check `ls -la sites-enabled/` before writing to `sites-available/`.

## [17:02] Cleanup A (repo) and B (droplet ~/wgw), approved by Leo

- **Action (A):** checked each target and grepped for references (none outside the generated `.understand-anything` graph and agent logs). Deleted `scripts/.debug-*` (2) and `scripts/.probe-*` (5); moved `scripts/db-inspect.ts` to `scripts/dev/` and fixed its usage line; `git rm` the empty file `git` and the two `ai-receiver/test_tx*Backup*.py` copies; `git rm --cached` two tracked `.pyc` files (the inventory said three; only two were tracked); added `.understand-anything/` and `.superpowers/` to `.gitignore`.
- **Action (B):** on the droplet, `cmp` showed `app.env.bak-20261031` identical to `app.env`, and `diff` showed the live unit differs from `water-gate.service.new` only by `-H 127.0.0.1`; then removed `deploy-20261031.sh.bak-fix`, `nginx-default.new.bak-fix`, `app.env.bak-20261031`, `water-gate.service.new`. Kept `nginx-default.new` until the nginx symlink fix is done.
- **Result:** 190/190 tests; lint 0 errors (1 warning in `scripts/dev/db-inspect.ts`); typecheck errors only in `scripts/dev/db-inspect.ts` (4, untracked, pre-existing). `water-gate` active, site 200.
- **Not committed.** `scripts/dev/db-inspect.ts`, `Diagram/`, `IDEA.md` stay untracked pending the owner's decision.

## [17:20] "CI failing" on PR XpkungZaza/water-gate-way#1

- **Action:** read the PR checks (`gh pr checks 1 --repo XpkungZaza/water-gate-way`) and the commit statuses for `566e079`. Built the pushed commit in a clean temporary worktree (`git worktree add --detach`, `node_modules` cloned with `cp -c` because Turbopack rejects a symlinked `node_modules`), then removed the worktree.
- **Result:** the only checks are three Vercel projects (`water-gate-way`, `water-gate-way-8pi9`, `water-gate-way-webcam`), all `failure` with "Authorization required to deploy." No build ran: the PR comes from the fork `leotawee`, and Vercel waits for a member of the `xpkungzaza's projects` team to approve it. The pushed commit builds cleanly (`next build` exit 0). The repo has no GitHub Actions workflows.
- **Not done:** no code change and no push, because the failure is an approval gate outside the repo; a new push would hit the same gate.
- **Dead end:** a local `npm run build` in the working tree failed on `scripts/dev/db-inspect.ts` (untracked, not in the PR). It would break the build if committed as is.
- **Lesson:** 📌 GENERAL: read the check's description before touching code; "Authorization required" is a permission gate, not a failing build.

## [17:28] Postgres container did not come back after a reboot

- **Action:** read-only checks: `uptime` (up 1 min), `docker ps -a`, `docker inspect` restart policies, `docker logs`. Then, at Leo's request: `docker start watergate-postgres` and `docker update --restart unless-stopped watergate-postgres`.
- **Root cause:** `watergate-postgres` had `RestartPolicy=no` (noted in the lockdown plan on 2026-10-30), so it stayed `Exited (0)` after the droplet rebooted; `water-db` has `always` and came back. The shutdown was clean (`checkpoint complete`, `database system is shut down`).
- **Result:** container running, `pg_isready` accepting connections, `wgw.users` still has 1 row, `/login` via the droplet IP 200. Other services after the reboot: water-gate, nginx, mosquitto, cloudflared, tailscaled active; pm2 started nothing; Next still bound to 127.0.0.1:3000.
- **Lesson:** 📌 GENERAL: any container the service depends on needs a restart policy; check `docker inspect -f '{{.HostConfig.RestartPolicy.Name}}'` before the first reboot, not after.

## [17:45] www.hyxc.io routed through Cloudflare Tunnel (Leo signed in; I made the DNS change)

- **Action:** in the built-in browser, after Leo signed in: read the DNS records (6: A `@` to the droplet, 2 old `_acme-challenge` TXT, `_dmarc`, `*._domainkey`, SPF; no `www`), read the tunnel list (4 tunnels; `wgw-droplet` Healthy, others left untouched), then added CNAME `www` to `<wgw-droplet tunnel id>.cfargotunnel.com`, Proxied.
- **Why manual:** the tunnel route for `www.hyxc.io` existed but its DNS record was never created (first `map`, then `www` conflicted with old records, and the route UI did not create the CNAME after they were deleted).
- **Result:** `https://www.hyxc.io/login` 200, `POST /api/control` 401 (Next.js, no longer the old nginx 502), HSTS and X-Frame-Options present, tunnel counter 0 to 7 with 0 errors.
- **Open:** the droplet still runs release `20261030-7dd2edf` without `CLIENT_IP_HEADER`, so the rate-limit key is the first `X-Forwarded-For` entry, which a client can set (Cloudflare appends the real IP after it). Root `hyxc.io` still points at the droplet's nginx. Ports 80/443 are still open on the droplet.

## [18:10] Tunnel cutover finished; Postgres under docker compose (Haiku executed, I verified)

- **Cutover (Leo ran the sudo step):** `water-gate` restarted on release `20261031-566e079` (built by Haiku in a clean worktree, `node_modules` hard-linked, `CLIENT_IP_HEADER=cf-connecting-ip` added); nginx and certbot.timer disabled. Verified: 80/443/3000 closed from the internet, `www.hyxc.io/login` 200, `/api/control` 401.
- **Postgres:** backups in `~/wgw/backups` (600, `gunzip -t` OK); `water-db` stopped with `restart=no` (24 test rows, backed up, volume kept); `watergate-postgres` recreated from `~/wgw/infra/compose.yml` (project `wgw`, external volume `watergate_db_data`, `127.0.0.1:5432`, pg_isready healthcheck, 256 MiB limit, log rotation). Leo installed `docker-compose-v2` (Ubuntu ships `docker.io` without the compose plugin; Haiku stopped there as instructed). Row counts identical before and after; 5432 closed from the internet.
- **Docs:** `~/wgw/README.md` operator guide (70 lines, no secrets, no addresses except loopback).
- **Decision (mini-ADR):** compose with the existing volume declared `external` instead of a fresh volume plus restore: no data copy, rollback is renaming the old container back.
- **Lesson:** 📌 GENERAL: tell a subagent exactly where to stop (a missing tool, a failed check); it stopped at the missing compose plugin instead of installing packages.

## [18:25] Pi and droplet moved into the owner's tailnet; cameras connected

- **Action (Leo, sudo):** `sudo tailscale login --hostname water` on the Pi and `--hostname wgw-droplet` on the droplet, both into the owner's own tailnet (old Pi profile kept for rollback via `tailscale switch`); `tailscale serve --bg --tcp 1984 tcp://127.0.0.1:1984` on the Pi; `GO2RTC_URL` in `app.env` pointed at the Pi's new tailnet address; restarted `water-gate`.
- **My checks:** compared the SSH host keys at the new tailnet addresses with the known LAN/public keys before trusting them (same keys); droplet to Pi :22 open (no ACL block inside one tailnet); from the droplet `GET /api/stream.mp4?src=office1..3` on the Pi returns 200 `video/mp4` (H.264); no `go2rtc unreachable` after the restart; site 200.
- **Why this instead of a Cloudflare Tunnel on the Pi:** with both hosts in one tailnet, the camera path needs no code change, no Access token and no filter proxy; the remaining risk (go2rtc API has no auth and supports `exec:`) is limited to the owner's own devices.
- **Open:** add a tailnet ACL so only `wgw-droplet` reaches `water:1984`; MQTT broker still anonymous on public ports (lockdown can now use the new tailnet).
- **Lesson:** 📌 GENERAL: `tailscale login` adds a profile instead of replacing the node state, so moving a node between tailnets keeps a one-command rollback (`tailscale switch`).

## [19:05] Camera picture minutes behind real time: root cause found (debug, no fix yet)

- **Ledger:** (Haiku, read-only) 60 s captures on the Pi and from the droplet give 59.7 s and 58.2 s of media, the camera OSD matches the Pi's NTP clock within 0.1 s, GOP 2 s at 15 fps, no start burst, Send-Q 0: camera, go2rtc, Pi and the tailnet hop deliver in real time. (Me) a local probe page (localhost) playing go2rtc's `stream.mp4` in a plain `<video>`, the same model as `Go2RTCPlayer`, in the built-in browser.
- **Decisive run:** autoplay did not start for 26 s; during that time `buffered.end` stayed at 3.22 s (the browser stopped reading). After `play()` the video played 1:1 (34.0 s of media in 34.0 s) but from media time 0, so it stayed about 30 s behind real time for the rest of the run. The backlog sat upstream, not in the browser buffer (only about 3 s ahead), so it never caught up.
- **Root cause:** the stream path is lossless and backpressured, and the player never resyncs, so every second the `<video>` is not playing (autoplay blocked, tab in the background, a rebuffer) is added to the lag permanently until the 10-minute reconnect. A tab left in the background for 2-3 minutes gives 2-3 minutes of lag.
- **Fix direction:** reconnect instead of seeking (the backlog is upstream): reconnect when the tab becomes visible again and when wall time since the request minus `currentTime` exceeds a few seconds; stop the stream while the tab is hidden.
- **Lesson:** 📌 GENERAL: a live stream over a lossless pipe (TCP, HTTP progressive) turns every pause into permanent delay; live players need an explicit drift check that drops data or reconnects.

## [19:50] Camera lag fix shipped (release 20261031-dacd12d)

- **Change:** `Go2RTCPlayer` reconnects when lag grows more than 8 s beyond the lag at the first `playing` event, when the start itself was held back over 30 s, and drops the stream while the tab is hidden (new pure helper `src/components/liveLag.ts`, 6 tests). Haiku wrote the first version in a separate worktree; my review found it measured lag including startup, which would loop reconnects whenever startup through the proxy exceeds 8 s; I changed it to the startup baseline. 196 tests, tsc, eslint, build pass.
- **Deploy:** built in the worktree at `566e079` + fix only (the main checkout holds unreviewed admin-panel work), shipped by Haiku, restarted by Leo. Verified: process cwd is the new release, `/login` 200, `/api/control` 401, camera route 401 without a session, no errors in the log.
- **Dead end:** my "is the fix in the bundle" check grepped identifier names in minified client chunks; Haiku correctly stopped. Proof used instead: `visibilitychange` absent from the source at `566e079` and from the live chunks, present in the new chunk.
- **Not verified:** real playback after a hidden tab (needs a logged-in browser).
- **Lesson:** 📌 GENERAL: to prove a client bundle contains a change, grep for a string literal the change introduces, not an identifier (minifiers rename identifiers).

## Summary

- Changed: `~/wgw/deploy-20261031.sh` and `~/wgw/nginx-default.new` on the droplet (backups `*.bak-fix`), this log.
- Unchanged: the live service, the live nginx, the certs, the DB, and the repo code. The uncommitted `scripts/create-user.ts` change (minimum password 12 to 8) is still there and still needs a decision.
- Remaining, in order: create the first admin; Leo runs `sudo bash /home/cmmc/wgw/deploy-20261031.sh`; then `sudo certbot renew --dry-run`; clean up the junk files `/etc/ssl/certs/domain.cert.pem;` and the stray `water-gate.service*` units.
- Top 3 lessons:
  1. 📌 GENERAL: read a staged sudo script line by line before it runs; a `set -e` exit without a message hides where it stopped.
  2. 📌 GENERAL: certbot deploy hooks get environment variables, not stdin.
  3. Check which build is live before you debug a page.
- Mistakes & dead ends: I could not find why the 07:53 run stopped after the cert step. The log has no FATAL line, and the script was edited after that run. The new ERR trap will show the line if it happens again.

## [23:50] Admin panel review, legacy data import, redesign kickoff

- **Action:** reviewed P2 (actions re-check role, explicit column lists, audit holds ids only); added bcrypt 72-byte guard + test; rounded imported `real` coordinates in 002; committed P2 (`2c3d7c5`); cherry-picked camera lag fix (`fc54349`); `pg_dump` to `~/wgw/backups/pre-002-*.sql.gz` (600) then ran 002 with `psql --single-transaction -v ON_ERROR_STOP=1`.
- **Why:** Leo asked to bring the old Postgres data in; migration is additive, so running it before the code deploy cannot break the live release.
- **Result:** 292 tests pass; `wgw.gates` has gate-1..5; 6 old users imported (one email already existed, skipped). 6 accounts now hold admin; two of them look like test accounts (names kept out of the repo).
- **Lesson:** bcrypt silently truncates at 72 bytes, so two different long passwords can verify against the same hash; reject long input on the legacy path. Rejected: letting the migration map old roles 1:1 to new ones; anything other than `admin` becomes `viewer` (least privilege).
- **Next:** Haiku redesigns all pages (visual only); then review, build, deploy.

## [00:20] Redesign review and deploy of 38b7ab3

- **Action:** reviewed Haiku's redesign diff (no change under src/lib, src/hooks, src/app/api, proxy; ControlPanel `onClick`/`disabled` intact); committed `38b7ab3`; built in a clean worktree (298 tests, tsc, eslint, build pass); copied to `releases/20261031-38b7ab3`, ran `npm ci --omit=dev` there (bcryptjs is new, so hard-linking the old node_modules would miss it); smoke test on 127.0.0.1:3100; switched `current`.
- **Why:** the local build fails only on untracked `scripts/dev/db-inspect.ts`; a clean worktree builds exactly what is committed.
- **Result:** /login 200, protected pages 307 to login, /api/control 401; login page renders with the new theme. Waiting on Leo's `sudo systemctl restart water-gate`.
- **Lesson:** a release that adds a dependency cannot reuse the previous node_modules by hard link. Rejected: excluding scripts/dev in tsconfig only to make the dirty checkout build.

## [00:40] Second redesign: light instrument panel with explicit device state (GLM via opencode)

- **Action:** asked Leo 3 product questions (users: phone and desktop equally; light theme; all-Thai copy); wrote PRODUCT.md and DESIGN.md; copied LINE Seed Sans TH Rg/Bd (OFL) into src/app/fonts; briefed opencode `zai/glm-5.3-flash` (default variant; `medium` does not exist, only `low`/`high`) with the impeccable skill. Reviewed its diff: nothing under src/lib, src/hooks, src/app/api, proxy, liveLag; actions.ts changed error strings only.
- **Why:** operators could not tell on from off: a small ON/OFF pill sat beside two buttons that looked identical in every state. Now each device has a `[ปิด | เปิด]` switch whose current-state segment is filled with a check and `aria-pressed`, plus a large Thai state word; stale shows hatched "ไม่ทราบสถานะ".
- **Result:** fixed two GLM bugs: the "sending" line showed under all five devices (now only the commanded row), and the confirmation check accepted a stale value equal to the target (now requires live telemetry). 302 tests, tsc (outside scripts/dev), eslint, impeccable detector `[]`.
- **Lesson:** a state toggle must show the current state in the control itself, not only beside it. Rejected: a single toggle switch; with stale telemetry it cannot express "unknown", and a two-segment control can (neither segment filled).
