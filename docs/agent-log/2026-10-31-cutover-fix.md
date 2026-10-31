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

## Summary

- Changed: `~/wgw/deploy-20261031.sh` and `~/wgw/nginx-default.new` on the droplet (backups `*.bak-fix`), this log.
- Unchanged: the live service, the live nginx, the certs, the DB, and the repo code. The uncommitted `scripts/create-user.ts` change (minimum password 12 to 8) is still there and still needs a decision.
- Remaining, in order: create the first admin; Leo runs `sudo bash /home/cmmc/wgw/deploy-20261031.sh`; then `sudo certbot renew --dry-run`; clean up the junk files `/etc/ssl/certs/domain.cert.pem;` and the stray `water-gate.service*` units.
- Top 3 lessons:
  1. 📌 GENERAL: read a staged sudo script line by line before it runs; a `set -e` exit without a message hides where it stopped.
  2. 📌 GENERAL: certbot deploy hooks get environment variables, not stdin.
  3. Check which build is live before you debug a page.
- Mistakes & dead ends: I could not find why the 07:53 run stopped after the cert step. The log has no FATAL line, and the script was edited after that run. The new ERR trap will show the line if it happens again.
