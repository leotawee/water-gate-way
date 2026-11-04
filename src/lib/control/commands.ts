// WHY: a subset of VALID_COMMANDS in ai-receiver/main.py. Q (master relay 2) and M (master relay 1 on the Pi's
// cmd_node) are left out on purpose: the masters follow the controller mode and must never be switched off from the web.
export const DEVICE_COMMANDS = ["P1", "P0", "A1", "A0", "L1", "L0", "R1", "R0"] as const;

// WHY: the Pi's cmd_node (shared/protocol.py parse_mode_command) accepts these bare strings on stm32/cmd
// and sets the controller mode; the status payload reports the mode back as the same word.
export const MODE_COMMANDS = ["AUTO", "MANUAL", "OFF"] as const;

export const COMMANDS = [...DEVICE_COMMANDS, ...MODE_COMMANDS] as const;

export type Command = (typeof COMMANDS)[number];
export type ModeCommand = (typeof MODE_COMMANDS)[number];

export function isModeCommand(c: Command): c is ModeCommand {
  return (MODE_COMMANDS as readonly string[]).includes(c);
}

const SET: ReadonlySet<string> = new Set(COMMANDS);

export function parseCommand(raw: unknown): Command | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return SET.has(c) ? (c as Command) : null;
}
