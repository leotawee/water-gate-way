"use client";

// DEMO (owner request 2026-11-10): the "AI Alarm" row replaces the read-only master-relay row.
// Behaviour: when the camera detects a person during the night window (21:00-06:00 Asia/Bangkok),
// the siren turns ON automatically (command A1 on the normal authenticated path); operator/admin
// can silence it once (A0) for maintenance - the silence latches until the person leaves the
// frame, then the system re-arms by itself.
// KNOWN LIMITATION (must move before production): this automation runs in the browser, so it only
// works while an operator/admin dashboard tab is open. The production home for the night-watch
// logic is a small worker on the droplet (subscribe the person topic, publish A1/A0, keep the
// override in the DB) or on the Pi itself.
import { useEffect, useRef, useState } from "react";
import { BellRing, Hand } from "lucide-react";
import StatePill from "@/components/StatePill";
import type { Command } from "@/lib/control/commands";

const BANGKOK_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Night watch window in Bangkok local time: 21:00 up to (not including) 06:00. */
function bangkokMinutes(now: number): number {
  const [h, m] = BANGKOK_TIME.format(new Date(now)).split(":").map(Number);
  return h * 60 + m;
}
const inNightWindow = (mins: number) => mins >= 21 * 60 || mins < 6 * 60;

type Props = {
  personCount: number | null;
  /** The siren's reported state (devices.alarm). null = unknown/stale. */
  alarm: boolean | null;
  /** false for viewers: they see the state, only operator/admin can silence. */
  canControl: boolean;
  /** Send A1 (auto) / A0 (silence) on the normal authenticated command path. */
  onCommand: (cmd: Command) => void;
};

export default function AiAlarmRow({ personCount, alarm, canControl, onCommand }: Props) {
  const [now, setNow] = useState<number | null>(null);
  const [demoAllDay, setDemoAllDay] = useState(false);
  // Detection episodes: one episode = one absent -> present transition of the person count.
  const [prevPerson, setPrevPerson] = useState(personCount !== null && personCount > 0);
  const [episode, setEpisode] = useState(0);
  // The episode that was silenced (maintenance latch); null = fully automatic.
  const [silencedEpisode, setSilencedEpisode] = useState<number | null>(null);
  // The episode already auto-fired, in a ref: firing must not wait for a re-render.
  const firedEpisode = useRef<number | null>(null);
  // The episode already auto-stopped (A0 on confirmed zero), same reason.
  const stoppedEpisode = useRef<number | null>(null);

  const person = personCount !== null && personCount > 0;

  // Clock: Bangkok-local minute readout, ticking every second (repo idiom, cf. DashboardClient useNow).
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Adjust episode state when the person count changes (react.dev "adjusting state when props change"):
  // absent -> present opens a new episode; present -> absent clears the maintenance latch (re-arm).
  if (person !== prevPerson) {
    setPrevPerson(person);
    if (person) setEpisode((e) => e + 1);
    else setSilencedEpisode(null);
  }

  const silenced = silencedEpisode === episode;
  const windowOk = demoAllDay || (now === null ? false : inNightWindow(bangkokMinutes(now)));
  const triggered = person && windowOk && !silenced;

  // The automatic siren: once per episode, unless already reported on. Unknown alarm state still
  // fires (safe direction). A ref latch keeps the command to one shot per episode.
  useEffect(() => {
    if (!triggered || !canControl || alarm === true) return;
    if (firedEpisode.current === episode) return;
    firedEpisode.current = episode;
    stoppedEpisode.current = null;
    onCommand("A1");
  }, [triggered, canControl, alarm, episode, onCommand]);

  // The automatic stop (owner request 2026-11-10): when the count returns to a CONFIRMED zero and
  // this episode auto-fired, stop the siren right away (A0) — the alarm only lasts while someone
  // is on camera. WHY personCount === 0 strictly: a null count is a stale/dropped feed, and a
  // dropped feed during a real intrusion must leave the siren on. WHY skip when silenced: the
  // human already stopped it and the latch must survive until the next episode.
  useEffect(() => {
    if (personCount !== 0) return;
    if (firedEpisode.current !== episode) return;
    if (silencedEpisode === episode) return;
    if (stoppedEpisode.current === episode) return;
    stoppedEpisode.current = episode;
    onCommand("A0");
  }, [personCount, episode, silencedEpisode, canControl, onCommand]);

  const silence = () => {
    setSilencedEpisode(episode);
    onCommand("A0");
  };
  const rearm = () => {
    firedEpisode.current = null;
    setSilencedEpisode(null);
  };

  const statePill = triggered ? (
    <StatePill tone="danger">ไซเรนเปิดอัตโนมัติ</StatePill>
  ) : silenced ? (
    <StatePill tone="warn">ปิดชั่วคราว (บำรุงรักษา)</StatePill>
  ) : windowOk ? (
    <StatePill tone="off">เฝ้าระวัง — ไม่พบคน</StatePill>
  ) : (
    <StatePill tone="off">พร้อมเฝ้าระวัง 21:00–06:00</StatePill>
  );

  const detail = triggered
    ? `ตรวจพบ ${personCount} คน จากกล้อง — ไซเรนหน้างานเปิดแล้ว`
    : person
      ? "ตรวจพบคน แต่อยู่นอกช่วงเฝ้าระวัง"
      : windowOk
        ? "ไม่พบคนจากกล้อง"
        : "ระบบจะเปิดไซเรนเมื่อตรวจพบคนในช่วง 21:00–06:00";

  return (
    <div className="py-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-(--dur-base) ${triggered ? "bg-danger-soft text-danger" : "bg-off-soft text-off"}`}>
            <BellRing className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-fg">AI Alarm</p>
            <p className="flex items-center gap-1.5 text-sm text-muted">{statePill}</p>
          </div>
        </div>

        {canControl && triggered && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={silence}
              className="inline-flex min-h-11 w-full min-w-20 items-center justify-center gap-1.5 rounded-xl border border-control bg-surface px-4 text-sm font-bold text-fg transition-colors duration-(--dur-base) hover:bg-surface-2 active:translate-y-px sm:w-auto"
            >
              <Hand className="size-4" strokeWidth={1.75} aria-hidden="true" />
              ปิดชั่วคราว
            </button>
            {silenced && (
              <button
                type="button"
                onClick={rearm}
                className="inline-flex min-h-11 w-full min-w-20 items-center justify-center rounded-xl border border-control bg-surface px-4 text-sm font-bold text-fg transition-colors duration-(--dur-base) hover:bg-surface-2 active:translate-y-px sm:w-auto"
              >
                กลับสู่อัตโนมัติ
              </button>
            )}
          </div>
        )}
      </div>

      <p className="mt-1.5 pl-[3.25rem] text-sm text-muted">{detail}</p>

      {canControl && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[3.25rem] text-sm text-muted">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={demoAllDay}
              onChange={(e) => setDemoAllDay(e.target.checked)}
              className="size-4 accent-fg"
            />
            โหมดทดลอง (demo): ไม่จำกัดช่วงเวลา
          </label>
          <span aria-hidden="true">·</span>
          <span>เวลาไทย {now === null ? "--:--" : BANGKOK_TIME.format(new Date(now))}</span>
        </p>
      )}
    </div>
  );
}
