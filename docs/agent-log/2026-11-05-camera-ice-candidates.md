# Camera: WebRTC offer carried no ICE candidates (slow / failing on phones)

## Symptom and repro
- iPhone Safari on cellular: camera tiles took about 60 s to show video. Pi consumers (`/api/streams`) showed `webrtc/whep` entries with an empty `remote_addr` that go2rtc dropped after ~30 s, then `mp4` consumers (the MSE fallback) from t+62 s.
- Repro on a laptop (no phone needed): `RTCPeerConnection` in a browser, answer SDP filtered to `srflx` candidates only (emulates a client that is not on the LAN or tailnet). With the player's old wait: `offer candidates=0`, `connectionState=failed` after 15.7 s (2 of 2). With a wait for the first srflx: 3 candidates, connected in about 0.4 s (2 of 2).

## Root cause
- `Go2RTCPlayer` waited for ICE with a listener on `icegatheringstatechange` that resolved on the first change, which is `new -> gathering` (2 ms), not `complete`. The offer was sent with zero candidates.
- The relay is non-trickle, so the Pi never learned the browser address and could not punch a hole. Only clients that can reach one of the Pi's own candidates (LAN, tailnet) connected, which is why desktop on the tailnet looked fine.
- Measured in Chrome: host candidates at ~5 ms, srflx at ~50 ms, `complete` never arrives within 6 s, so "wait for complete" would burn the whole cap.
- Slow fallback was a consequence: 3 attempts x 15 s timeout plus backoff, then MSE (measured about 60 s).

## Changes
- `src/components/cameraConnect.ts` (new, pure, tested): `waitForIceCandidates` (complete, or 250 ms after first srflx, or 2.5 s cap), per-transport connect timeout and failure count (WebRTC 8 s x 2, MSE 15 s x 3), `preferredTransport` / `rememberMse` (localStorage, 10 min TTL, tolerates blocked storage).
- `Go2RTCPlayer.tsx`: uses them; starts on MSE when a recent fallback is remembered.

## Verification
- `bun run test` 442 pass (11 new), typecheck and lint clean.
- Real built module in a browser against the Pi with the srflx-only emulation: 3 of 3 cameras connected with a first frame about 0.4 s after the POST.
- NOT verified: a real iPhone on cellular (no device here), Safari-specific ICE timing, symmetric NAT / CGNAT (TURN still absent).

## Mistakes and dead ends
- First hypothesis ("failures counter resets on `visibilitychange` so MSE is never reached") was wrong: `transport` state persists across visibility changes; only a remount restarts the WebRTC attempts.
- I read the wrong go2rtc config twice (`~/go2rtc.yaml` is stale; the live one is `~/stm32_bridge/go2rtc.yml`).
- `lsof -ti :8099 | xargs kill` also matched client sockets (the desktop app). Use `-sTCP:LISTEN`. The app survived.
- DevTools was throttled to "3G", which explained the 2.6 s POST times seen on desktop; the server answers in 0.1-0.4 s.

## Lessons
1. 📌 GENERAL: a "wait for gathering" handler must check `iceGatheringState === "complete"`; the first state event is `gathering`.
2. 📌 GENERAL: with non-trickle signalling the offer must contain a srflx candidate or NAT hole punching cannot start from the answerer.
3. Build a control experiment (a known-good client) before trusting an absence in a log.

## Summary

- Changed: `src/components/cameraConnect.ts` and its test (new), `src/components/Go2RTCPlayer.tsx`, this log.
- Unchanged: relay routes, go2rtc and Pi configuration, the MSE transport itself.
- Remaining: real iPhone check; TURN for symmetric NAT / CGNAT; follow-ups from the local review are in `2026-11-05-camera-review-followups.md` (appended after the fact, the entries above are not edited).
- Key decisions: wait for the first srflx candidate instead of "complete" (which never arrives); WebRTC gets 2 short attempts before MSE; remember the fallback in `localStorage` for 10 minutes.
- Top 3 lessons: see "Lessons" above.
- Mistakes & dead ends: see "Mistakes and dead ends" above.
