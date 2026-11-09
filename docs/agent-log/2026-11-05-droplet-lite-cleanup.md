# Droplet lite cleanup (2026-11-05)

## [08:00] Inspect before touching
- **Action:** read-only SSH: `free`, `df`, `ps --sort=-rss`, `docker ps/inspect/system df`, `systemctl`, `ss -ltnp`, `lsof +D`.
- **Why:** user asked to make the droplet lite and "never lose data" (Prime Directive 1: understand before acting).
- **Result:** RAM 783/961 MB used, no swap; none of the home dirs is a git repo; `~/wgw` holds live deploy state (app.env, compose files, backups, hotfix build inputs).
- **Lesson:** "delete and re-clone" only works when the directory is a checkout. Check `git status` and what the compose project reads before proposing it.

## [08:10] Archive, verify, then delete
- **Action:** `tar --exclude=node_modules --exclude=.next -czf ~/archive/old-dirs-20261105.tar.gz` over water-gate-way, water-web, water-mock; listed it back (52 entries; users.json, .env.local, *.pem, onnx, web2.zip, .next.zip, seed.js present); then `rm -rf` of exact paths with an abort guard on open files and on the `current` release.
- **Why:** irreversible delete (Hard Stop). Back up non-regenerable files first, verify the backup reads back, then delete only what a lockfile or git sha can rebuild.
- **Result:** deleted old dirs, `.antigravity-*`, `.npm`, `.cache`, 11 old releases (kept `current` = 20261102-63587a0). Disk 16 GB to 10 GB used; RAM available 177 to 366 MB. Containers healthy, `/login` 200.
- **Lesson:** make the delete script refuse to run when the archive is missing, a path is held open, or the path equals the live symlink target.

## Dead ends / corrections
- `ssh wgw-server` failed host-key verification; did not disable the check, used the tailnet IP from memory instead.
- `ssh meox` denied (publickey,password); asked the user instead of guessing a user.
- Memory said nginx was disabled; the server shows it enabled and listening on 80/443 (proxy to :3000 and :9001). Removed nginx from the disable list.
- `agy --continue` (217 MB) seen once was gone on re-check; nothing was killed.

## Summary
- Changed (server): removed items above; created `~/archive/old-dirs-20261105.tar.gz` (748 MB, mode 600, sha256 25838f81...c9).
- Unchanged: `~/wgw/{app.env,infra,deploy,backups,hotfix,current}`, Postgres volume, mosquitto, cloudflared, tailscaled, nginx.
- Remaining (needs sudo, owner runs): disable ModemManager, udisks2, fwupd, multipathd, pm2-cmmc; optional swapfile and journald cap.
- Top lessons:
  1. 📌 GENERAL: verify an archive by reading it back before the delete step.
  2. 📌 GENERAL: a memory note about live state ("nginx disabled") can be stale; re-measure before acting on it.
  3. Services that look idle may still front traffic (nginx on 443); check `ss -ltnp` first.
