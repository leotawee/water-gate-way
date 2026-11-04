"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Cpu, Fan, Hand, Power, PowerOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRedirectToLogin } from "@/hooks/useRedirectToLogin";
import type { Command, ModeCommand } from "@/lib/control/commands";
import { isModeCommand } from "@/lib/control/commands";
import type { GateMode, GateStatus } from "@/lib/telemetry/parseStatus";
import DeviceSwitch, { StatusLine, type SwitchStatus } from "@/components/DeviceSwitch";
import Modal from "@/components/Modal";
import { modeView } from "./modeView";

type Devices = GateStatus["devices"];
type DeviceKey = keyof Devices;
type Key = DeviceKey | "mode";

function errorText(res: Response): string {
  if (res.status === 429) return `ส่งคำสั่งบ่อยเกินไป รอ ${res.headers.get("Retry-After") ?? "สักครู่"} วินาที`;
  if (res.status === 502) return "อุปกรณ์ไม่พร้อมใช้งาน";
  if (res.status === 403) return "ไม่ได้รับอนุญาต";
  return "ส่งคำสั่งไม่สำเร็จ";
}

/** Which row a command belongs to: the first letter names the device (P1 → pump … R1 → relay1); a mode word is "mode". */
function keyOf(cmd: Command): Key {
  if (isModeCommand(cmd)) return "mode";
  switch (cmd[0]) {
    case "P":
      return "pump";
    case "A":
      return "alarm";
    case "L":
      return "light";
    default:
      return "relay1";
  }
}

/** How long to wait for the device to report the target state before saying it did not answer. */
const CONFIRM_MS = 15_000;
/** How long the "device confirmed" line stays visible before the row returns to idle. */
const CONFIRMED_MS = 3_000;
/** The server allows one command per user per second (controlByUser); stay just over it so quick taps queue instead of failing. */
const SEND_GAP_MS = 1_100;
// WHY a named helper: the purity lint cannot tell an event-handler Date.now() from a render-time one.
const nowMs = () => Date.now();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Note = { cmd: Command; phase: "waiting" | "timeout" | "confirmed"; at: number };
type Notes = Partial<Record<Key, Note>>;

const MODES: { cmd: ModeCommand; mode: GateMode; label: string; icon: LucideIcon }[] = [
  { cmd: "AUTO", mode: "AUTO", label: "อัตโนมัติ", icon: Cpu },
  { cmd: "MANUAL", mode: "MANUAL", label: "ควบคุมเอง", icon: Hand },
  { cmd: "OFF", mode: "OFF", label: "OFF", icon: PowerOff },
];

type Props = {
  devices: Devices | null;
  mode: GateMode | null;
  stale: boolean;
  /** Viewer mode: the same panel and state readouts, no command buttons, notes or fetch. */
  readOnly?: boolean;
};

/** Does the device report what this note asked for? */
function reached(note: Note, devices: Devices | null, mode: GateMode | null): boolean {
  if (isModeCommand(note.cmd)) return mode === note.cmd;
  const key = keyOf(note.cmd) as DeviceKey;
  return devices !== null && devices[key] === note.cmd.endsWith("1");
}

/** Operator/admin sends commands (server enforces it too: POST /api/control requires "operator").
 *  WHY: buttons stay enabled when stale; the server is authoritative and an operator may need to
 *  act during an outage. Each row keeps its OWN note, so a second command never erases the first
 *  row's confirmation or timeout. */
export default function ControlPanel({ devices, mode, stale, readOnly = false }: Props) {
  const [sending, setSending] = useState<Partial<Record<Key, Command>>>({});
  const [notes, setNotes] = useState<Notes>({});
  const [error, setError] = useState<string | null>(null);
  const [askOff, setAskOff] = useState(false);
  // A device command was tapped while the controller is in AUTO: ask before switching to MANUAL.
  const [askManual, setAskManual] = useState(false);
  const [askAlarm, setAskAlarm] = useState(false);
  const redirectToLogin = useRedirectToLogin();
  // Commands go out one at a time, SEND_GAP_MS apart. WHY: tapping two devices quickly used to fail the
  // second with "too many commands"; now it waits its turn and its row shows the spinner meanwhile.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const lastSent = useRef(0);

  const post = (cmd: Command) =>
    fetch("/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: cmd }),
    });

  async function sendCommand(cmd: Command) {
    const key = keyOf(cmd);
    if (sending[key]) return;
    setSending((s) => ({ ...s, [key]: cmd }));
    setError(null);
    setAskOff(false);
    const turn = chain.current.then(() => sleep(Math.max(0, lastSent.current + SEND_GAP_MS - nowMs())));
    chain.current = turn.then(() => {
      lastSent.current = nowMs();
    });
    try {
      await turn;
      lastSent.current = nowMs();
      let res = await post(cmd);
      if (res.status === 429) {
        // Another tab or user hit the limit: wait what the server says (capped at 5 s), try once more.
        await sleep(Math.min(5, Number(res.headers.get("Retry-After")) || 1) * 1000);
        lastSent.current = nowMs();
        res = await post(cmd);
      }
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) setError(errorText(res));
      else setNotes((n) => ({ ...n, [key]: { cmd, phase: "waiting", at: nowMs() } }));
    } catch {
      setError("ส่งคำสั่งไม่สำเร็จ");
    } finally {
      setSending((s) => {
        const rest = { ...s };
        delete rest[key];
        return rest;
      });
    }
  }

  // The device confirmed: it now reports the target, so say so briefly.
  // WHY: a stale reading may still hold an old value equal to the target; that is not a confirmation.
  // WHY: adjusted during render (React's "adjust state when props change" pattern); the phase guard makes it run once.
  if (!stale) {
    let changed = false;
    const next: Notes = { ...notes };
    for (const k of Object.keys(next) as Key[]) {
      const n = next[k];
      if (n && n.phase === "waiting" && reached(n, devices, mode)) {
        next[k] = { ...n, phase: "confirmed" };
        changed = true;
      }
    }
    if (changed) setNotes(next);
  }

  // Deadlines are absolute (note.at + window), so re-scheduling after another row changes never extends them.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const k of Object.keys(notes) as Key[]) {
      const n = notes[k];
      if (!n || n.phase === "timeout") continue;
      // waiting: absolute deadline from the send time; confirmed: a short display window from now.
      const wait = n.phase === "waiting" ? Math.max(0, n.at + CONFIRM_MS - Date.now()) : CONFIRMED_MS;
      timers.push(
        setTimeout(() => {
          setNotes((cur) => {
            const c = cur[k];
            if (!c || c.at !== n.at) return cur;
            if (c.phase === "waiting") return { ...cur, [k]: { ...c, phase: "timeout" } };
            const rest = { ...cur };
            delete rest[k];
            return rest;
          });
        }, wait),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [notes]);

  // WHY: in AUTO the controller drives the devices itself, so a device tap would do nothing and look broken.
  // Say so and offer the switch; an unknown mode (stale/missing) is not blocked, the server stays authoritative.
  const guardedSend = (cmd: Command) => {
    if (!isModeCommand(cmd) && !stale && mode === "AUTO") setAskManual(true);
    // WHY: the siren is the loudest possible failure mode; a mis-tap must not fire it. A0 stays one tap.
    else if (cmd === "A1") setAskAlarm(true);
    else void sendCommand(cmd);
  };

  const rows = [
    { key: "pump", name: "ปั๊ม 1", icon: Fan, onCmd: "P1", offCmd: "P0", state: devices?.pump ?? null, tone: "on" },
    { key: "alarm", name: "สัญญาณเตือน", icon: Bell, onCmd: "A1", offCmd: "A0", state: devices?.alarm ?? null, tone: "danger" },
    { key: "relay1", name: "ปั๊ม 2", icon: Power, onCmd: "R1", offCmd: "R0", state: devices?.relay1 ?? null, tone: "on" },
  ] as const;

  // WHY: pc2 + pc3 are the master relays; the controller ties them to its mode (ON in AUTO/MANUAL, OFF in OFF) and
  // ignores a web command for them, so they are shown but never switchable. Unknown until both are reported.
  const master = devices?.relay2 == null || devices.master1 == null ? null : devices.relay2 && devices.master1;

  const statusOf = (key: Key): SwitchStatus | null => {
    const s = sending[key];
    if (s) return { phase: "sending", cmd: s };
    const n = notes[key];
    return n ? { phase: n.phase, cmd: n.cmd } : null;
  };

  const mv = modeView(mode, stale);
  const modeStatus = readOnly ? null : statusOf("mode");
  const modeBusy = modeStatus?.phase === "sending";
  const modeLabel = (cmd: Command) => MODES.find((m) => m.cmd === cmd)?.label ?? cmd;

  return (
    <section aria-labelledby="controls-heading" className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex items-baseline justify-between gap-3 bg-brand px-5 py-3.5 text-white">
        <h2 id="controls-heading" className="text-base font-bold">
          {readOnly ? "สถานะอุปกรณ์" : "แผงควบคุม"}
        </h2>
        {/* WHY: the page header already says the link is down; here one quiet line says what it means for these switches. */}
        {stale && <span className="text-sm text-white/85">สถานะอาจไม่ตรงความจริง</span>}
      </header>

      {/* Mode: the controller's own mode. The selected option is what the device reports, not what was last clicked. */}
      <div className="border-b border-rule px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-fg">โหมดการทำงาน</h3>
          <span className="text-sm text-muted">{mv.label}</span>
        </div>

        {readOnly ? null : (
          <>
            <div role="group" aria-label="เลือกโหมดการทำงาน" className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
              {MODES.map((m) => {
                const pressed = !stale && mode === m.mode;
                const Icon = m.icon;
                return (
                  <button
                    key={m.cmd}
                    type="button"
                    aria-pressed={pressed}
                    aria-disabled={modeBusy || undefined}
                    onClick={() => {
                      if (modeBusy) return;
                      // WHY: OFF stops automatic control; ask once so a mis-tap cannot do it.
                      if (m.cmd === "OFF" && !pressed) setAskOff(true);
                      else void sendCommand(m.cmd);
                    }}
                    className={`inline-flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-sm font-bold transition-colors duration-(--dur-base) active:translate-y-px sm:flex-row sm:gap-1.5 ${
                      modeBusy ? "cursor-progress" : "cursor-pointer"
                    } ${pressed ? "bg-brand text-white" : "text-fg hover:bg-surface"}`}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {m.label}
                    {pressed && <span className="sr-only">(โหมดปัจจุบัน)</span>}
                  </button>
                );
              })}
            </div>

            <p className="mt-2 flex min-h-5 items-center gap-2 text-sm" aria-live="polite">
              {modeStatus && (
                <StatusLine
                  status={modeStatus}
                  label={`โหมด${modeLabel(modeStatus.cmd)}`}
                  onRetry={() => void sendCommand(modeStatus.cmd)}
                />
              )}
            </p>
          </>
        )}
      </div>

      <div className="divide-y divide-rule px-5">
        {rows.map((row) => (
          <DeviceSwitch
            key={row.key}
            name={row.name}
            icon={row.icon}
            state={row.state}
            stale={stale}
            onCmd={row.onCmd}
            offCmd={row.offCmd}
            status={readOnly ? null : statusOf(row.key)}
            onSend={guardedSend}
            tone={row.tone}
            readOnly={readOnly}
          />
        ))}
        {/* onCmd/offCmd are required by the props but never rendered: readOnly hides the buttons. */}
        <DeviceSwitch
          name="Master relay"
          icon={Power}
          state={master}
          stale={stale}
          onCmd="P1"
          offCmd="P0"
          status={null}
          onSend={guardedSend}
          readOnly
          note="ผูกกับโหมดการทำงาน สั่งจากเว็บไม่ได้"
        />
      </div>

      <Modal
        open={askManual}
        tone="warn"
        title="ตอนนี้อยู่โหมดอัตโนมัติ"
        onClose={() => setAskManual(false)}
        confirm={{
          label: "สลับเป็นควบคุมเอง",
          onConfirm: () => {
            setAskManual(false);
            void sendCommand("MANUAL");
          },
        }}
      >
        ระบบควบคุมอุปกรณ์เองอยู่ จึงสั่งปั๊มหรืออุปกรณ์จากหน้านี้ไม่ได้ สลับเป็นโหมดควบคุมเองหรือไม่? เมื่อสลับแล้วให้กดสั่งอุปกรณ์อีกครั้ง
      </Modal>

      <Modal
        open={askAlarm}
        tone="danger"
        title="เปิดสัญญาณเตือน?"
        onClose={() => setAskAlarm(false)}
        confirm={{
          label: "เปิดสัญญาณ",
          onConfirm: () => {
            setAskAlarm(false);
            void sendCommand("A1");
          },
        }}
      >
        ไซเรนจะดังทันทีที่หน้างาน ยืนยันเปิดหรือไม่?
      </Modal>

      <Modal
        open={askOff}
        tone="danger"
        title="สลับเป็นโหมด OFF?"
        onClose={() => setAskOff(false)}
        confirm={{
          label: "ยืนยัน OFF",
          onConfirm: () => {
            setAskOff(false);
            void sendCommand("OFF");
          },
        }}
      >
        ในโหมด OFF อุปกรณ์รายงานว่าปั๊มและรีเลย์ M1/M2 ปิดทั้งหมด (จากข้อมูลย้อนหลัง) ตรวจสอบหน้างานก่อนยืนยัน
      </Modal>

      <Modal open={error !== null} tone="danger" title="ส่งคำสั่งไม่สำเร็จ" onClose={() => setError(null)}>
        {error}
      </Modal>
    </section>
  );
}
