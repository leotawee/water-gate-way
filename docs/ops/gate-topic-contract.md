# Gate topic contract (one cabinet = one `gate-N`)

> Status: **contract only.** Writing it changed no machine.
> **The Pi code belongs to the hardware team. This repo does not change it.** This document tells them what the web app expects, so each cabinet can be switched over on their schedule.
> No address, credential or internal path belongs here (see `docs/IDEA.md`).

## Gate id

`gate-N` where N is 1 to 4 digits: `^gate-[0-9]{1,4}$`. The web app takes the gate id from the topic only, never from a payload. The same id is the MQTT username of that cabinet's account (see the ACL below).

## Topics

| Topic | Direction | Who publishes | Payload |
|---|---|---|---|
| `gate/<id>/status` | cabinet to web | the cabinet | The same JSON as today's `stm32/status/all`, unchanged. |
| `gate/<id>/person` | cabinet to web | the cabinet | `{ "person_count": n }` with `n` a non-negative integer. |
| `gate/<id>/cmd` | web to cabinet | the web app only | A bare string, no JSON, no newline: a two-character device command (`P1 P0 A1 A0 L1 L0 R1 R0`) or a mode word (`AUTO MANUAL OFF`). |

Legacy topics, used by the first cabinet until it moves (they map to `gate-1`):

| Legacy topic | New topic |
|---|---|
| `stm32/status/all` | `gate/gate-1/status` |
| `water/gate/person` | `gate/gate-1/person` |
| `stm32/cmd` | `gate/gate-1/cmd` |

## `TOPIC_PREFIX`

Every Pi service that touches these topics must read the environment variable `TOPIC_PREFIX` and build its topics from it, for example `TOPIC_PREFIX=gate/gate-2` gives `gate/gate-2/status`, `gate/gate-2/person`, `gate/gate-2/cmd`. One Pi process per cabinet, one prefix each. Never hard-code a gate id.

## Dual-publish period (gate-1 only)

The first cabinet already works on the legacy topics. Do not break it:

1. The hardware team makes the Pi publish **both** the legacy and the `gate/gate-1/…` topics, and subscribe to **both** `stm32/cmd` and `gate/gate-1/cmd`.
2. The web app keeps sending gate-1 commands to `stm32/cmd` while `WGW_LEGACY_TOPICS` is unset (default). Gate-2 and later always use `gate/<id>/cmd`.
3. To end the period, once the Pi publishes and subscribes the new topics: set `WGW_LEGACY_TOPICS=0` on the web app and recreate its container. Gate-1 commands now go to `gate/gate-1/cmd`.
4. After a day without traffic on the legacy topics: stop the Pi publishing them, then regenerate the ACL **without** `--legacy-user` and apply it. This removes the legacy device block and the legacy topics from the broker.

## Generate the ACL

```bash
bun run scripts/render-acl.ts --legacy-user <existing pi account> gate-1 gate-2
```

- Output is Mosquitto `acl_file` text on stdout. An invalid gate id or user name exits non-zero with a message on stderr and prints nothing to stdout.
- `--server-user <name>` overrides the web app's account (default `nextjs`).
- Every rule sits under a `user` line. Rules before the first `user` line would apply to anonymous clients.
- The server account reads `gate/+/status` and `gate/+/person`, writes `gate/+/cmd`, and keeps the legacy equivalents. It cannot write any status or person topic.
- Each gate account writes only its own `status` and `person`, and reads only its own `cmd`. No `readwrite`, `#` or `+`.
- `--legacy-user` adds one block for the existing Pi account (`readwrite` on `stm32/#`, `tank/#`, `pump/cmd`, `relay/cmd`, `mode/cmd`) so the six legacy Pi services keep working during the dual-publish period. Omit the flag at step 4 above.

## Apply it

Follow `docs/ops/pi-droplet-alignment.md`. Its ordering rule holds here: **never apply an ACL before the Pi nodes and `webrtc-bridge` use credentials.** An ACL applied earlier cuts the Pi off from the pumps. Create the per-gate broker accounts (username equal to the gate id) before the cabinet is switched to its new prefix.
