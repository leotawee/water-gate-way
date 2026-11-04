// Usage: bun run scripts/render-acl.ts [--server-user <name>] [--legacy-user <name>] <gate-id>...
// Prints Mosquitto ACL text to stdout. Nothing is printed on error.
import { renderAcl } from "../src/lib/broker/acl.ts";

function die(msg: string): never {
  console.error(`[render-acl] ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const ids: string[] = [];
let serverUser: string | undefined;
let legacyUser: string | undefined;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--server-user" || a === "--legacy-user") {
    const v = args[++i];
    if (v === undefined) die(`${a} needs a value`);
    if (a === "--server-user") serverUser = v;
    else legacyUser = v;
  } else if (a.startsWith("--")) die(`unknown flag ${a}`);
  else ids.push(a);
}

// WHY: a server-only ACL applied to the broker would lock out every device.
if (ids.length === 0) die("give at least one gate id, for example: gate-1");

try {
  process.stdout.write(renderAcl(ids, serverUser, legacyUser));
} catch (e) {
  die((e as Error).message);
}
