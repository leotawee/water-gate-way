// Usage: node scripts/create-user.ts <email> <viewer|operator|admin>   (password via stdin, never argv)
import pg from "pg";
import { createInterface } from "node:readline";
import { hashPassword } from "../src/lib/auth/password.ts";

const ROLES = ["viewer", "operator", "admin"];
const [email, role] = process.argv.slice(2);

function die(msg: string): never {
  console.error(`[create-user] ${msg}`);
  process.exit(1);
}

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) die("invalid email");
if (!role || !ROLES.includes(role)) die(`role must be one of: ${ROLES.join(", ")}`);

function readPassword(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      process.stderr.write("Password: ");
      const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
      // WHY: suppress echo by dropping the readline's character output while the prompt is active.
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
      rl.question("", (a) => {
        rl.close();
        process.stderr.write("\n");
        resolve(a);
      });
    } else {
      const rl = createInterface({ input: process.stdin });
      rl.once("line", (a) => {
        rl.close();
        resolve(a);
      });
      rl.once("close", () => resolve(""));
    }
  });
}

const password = await readPassword();
if (password.length < 12) die("password must be at least 12 characters");

const pool = new pg.Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT) || 5432,
});
try {
  const res = await pool.query(
    "insert into users (email, password_hash, role) values ($1, $2, $3) returning id",
    [email, await hashPassword(password), role],
  );
  console.log(`[create-user] created ${role} ${email} (${res.rows[0].id})`);
} catch (e) {
  die(`insert failed: ${(e as { code?: string }).code ?? "error"}`);
} finally {
  await pool.end();
}
