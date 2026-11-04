import { describe, expect, it } from "vitest";
import { modeView, pumpsLocked } from "./modeView";

describe("modeView", () => {
  it("stale -> unknown even when mode is known", () => {
    expect(modeView("AUTO", true)).toEqual({ tone: "unknown", label: "ไม่ทราบโหมด" });
  });

  it("mode null -> unknown", () => {
    expect(modeView(null, false)).toEqual({ tone: "unknown", label: "ไม่ทราบโหมด" });
  });

  it('AUTO -> on / "อัตโนมัติ"', () => {
    expect(modeView("AUTO", false)).toEqual({ tone: "on", label: "อัตโนมัติ" });
  });

  it('MANUAL -> warn / "ควบคุมเอง"', () => {
    expect(modeView("MANUAL", false)).toEqual({ tone: "warn", label: "ควบคุมเอง" });
  });

  it('OFF -> off / "OFF"', () => {
    expect(modeView("OFF", false)).toEqual({ tone: "off", label: "OFF" });
  });
});

describe("pumpsLocked", () => {
  it("mode OFF with fresh telemetry -> locked", () => {
    expect(pumpsLocked("OFF", false)).toBe(true);
  });

  it("mode OFF but stale -> not locked (the mode is unknown)", () => {
    expect(pumpsLocked("OFF", true)).toBe(false);
  });

  it("MANUAL and AUTO -> not locked", () => {
    expect(pumpsLocked("MANUAL", false)).toBe(false);
    expect(pumpsLocked("AUTO", false)).toBe(false);
  });

  it("unknown mode -> not locked, fresh or stale", () => {
    expect(pumpsLocked(null, false)).toBe(false);
    expect(pumpsLocked(null, true)).toBe(false);
  });
});
