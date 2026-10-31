# Product: Water Gate Way

## What it is
Web console for Thai irrigation water gates. Each gate may carry an STM32 controller (pump, alarm, light, two IoT relay pumps), sensors (3-phase power meter, radar water level, float switches, wire-break loops, person detection) and two Tapo cameras streamed through go2rtc.

## Users and scene
- **Field officers on a phone**, standing at the gate, often in bright sunlight, one hand free. They glance at state and press pump commands.
- **Control-room staff on a desktop**, watching several readings and the cameras for long periods.
- Both matter equally. Thai is the working language.

## Roles
- viewer: sees map, readings, cameras.
- operator: also sends device commands.
- admin: also manages users and gates in /admin.

## Jobs, in priority order
1. Know, within one second, whether each device is ON, OFF or UNKNOWN (telemetry stale), and whether the gate is online.
2. Turn a device on or off and see that the command was sent and whether the device confirmed it.
3. See the water level trend and the cameras to judge the situation.
4. Find a gate on the map.
5. (Admin) manage accounts and gate records.

## Non-negotiables
- A stale reading must never look live.
- A control must never leave the user guessing which state the device is in now.
- Server enforces roles; the UI only hides what a role cannot do.
