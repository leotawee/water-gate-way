// Shapes derived from ai-receiver/main.py (build_unified_payload / parse_stm32_line)
// and the parsing branches in src/app/dashboard/page.tsx. Not captured from a live broker.

/** Format A: WebSocket / ai-receiver unified payload. */
export const FORMAT_A = {
  timestamp: "2026-10-30T07:00:00+00:00",
  person_count: 2,
  stm32: {
    PZEM: { voltage: 229.8, current: 1.42, power: 321.5, energy: 12.3, frequency: 50.0, pf: 0.98 },
    Radar: { distance: 1.85, detected: true },
    Floats: { upper: true, lower: false },
    WireBreak: true,
    Pumps: { pump1: true, pump2: false },
    Alarm: false,
    AI_detect: true,
  },
};

/** Format B: MQTT `stm32/status/all`. */
export const FORMAT_B = {
  pzem: { v: 230.1, i: 1.5, p: 340, freq: 49.9 },
  radar: { liquid: 3.2, air: 0.8 },
  float: { f1: true, f2: true, f3: false },
  wirebreak: { wb1: false, wb2: true },
  pump: true,
  alarm: true,
};
