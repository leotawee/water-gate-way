# 2026-10-30 — Camera video over HTTP (MSE/fMP4) instead of WebRTC

## [19:05] Check at the source

- **Action:** on the Pi, `curl http://127.0.0.1:1984/api/frame.jpeg?src=office1..3`, then `/api/stream.mp4?src=office1` for 4 s (temp files removed).
- **Why:** before changing code, confirm cameras work at go2rtc and that go2rtc can serve HTTP video.
- **Result:** 3/3 frames HTTP 200 (18–26 KB). `stream.mp4` answered `200 video/mp4; codecs="avc1.640029"`, chunked, starts with `ftyp`, 31 KB in 4 s.
- **Lesson:** test the producer before writing the consumer; a working source narrows any later failure to the network path.

## [19:13] Implementation (TDD)

- **Action:** wrote `src/app/api/camera/stream/route.test.ts` (15 tests, RED: route missing), then `route.ts`; rewrote `src/components/Go2RTCPlayer.tsx` to a plain `<video src>`; updated the `GO2RTC_URL` comment in `.env.example`.
- **Result:** 172/172 tests, typecheck 0 errors, `npm run lint` clean, `npm run build` OK (`ƒ /api/camera/stream`).
- **Decisions (mini-ADR):**
  - HTTP progressive MP4 instead of the WebSocket MSE API: a Next route handler streams an HTTP body natively but cannot proxy a WebSocket without extra machinery.
  - No `Origin` check on the GET (media elements send none); `Sec-Fetch-Site: cross-site` → 403, and SameSite=Lax keeps the cookie off cross-site loads.
  - Streams are cut at 10 minutes and capped at 6 per user (session re-check, protects the Pi).
  - The player marks the picture OFFLINE and reconnects when playback makes no progress for 8 s, so a frozen frame is never labelled LIVE.
- **Dead ends and fixes:** first lint run flagged `let lifetimeTimer` (prefer-const), fixed by creating the timer after `finish`. My first stall watchdog called `setAttempt` inside a `setStatus` updater, which React Strict Mode would run twice; moved the check into an effect that depends on `status`.
- **Lesson:** 📌 GENERAL: never trigger side effects inside a state updater function.

## Summary

- Changed: `src/app/api/camera/stream/route.ts` (+ test), `src/components/Go2RTCPlayer.tsx`, `.env.example`, broker-lockdown plan (camera path section).
- Unchanged: servers, `/api/camera/webrtc` (now unused, deletion needs Leo's OK).
- Remaining: tailnet ACL for droplet→Pi, `tailscale serve` on the Pi, deploy the rebuild to the droplet, real browser check. Not verified: playback in a browser, Safari support for progressive MP4, bandwidth with several viewers.
