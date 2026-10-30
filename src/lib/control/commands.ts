// WHY: must stay identical to VALID_COMMANDS in ai-receiver/main.py.
export const COMMANDS = ["P1", "P0", "A1", "A0", "L1", "L0", "M1", "M0", "R1", "R0", "Q1", "Q0"] as const;

export type Command = (typeof COMMANDS)[number];

const SET: ReadonlySet<string> = new Set(COMMANDS);

export function parseCommand(raw: unknown): Command | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return SET.has(c) ? (c as Command) : null;
}
