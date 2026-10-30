// WHY: pure node:crypto only — scripts/create-user.ts imports this under plain `node` (no `@/` alias).
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 2 ** 17;
const R = 8;
const P = 1;
const SALT_LEN = 16;
const KEY_LEN = 64;
// scrypt needs ~128*N*r bytes (128 MiB); Node's default maxmem (32 MiB) would reject it.
const OPTS: ScryptOptions = { N, r: R, p: P, maxmem: 256 * 1024 * 1024 };

function derive(plain: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(plain.normalize("NFKC"), salt, KEY_LEN, OPTS, (e, k) => (e ? reject(e) : resolve(k))),
  );
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await derive(plain, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    const [alg, n, r, p, saltB64, hashB64, extra] = stored.split("$");
    // WHY: only accept our fixed params so a tampered row cannot pick cost (DoS) or weaken hashing.
    if (extra !== undefined || alg !== "scrypt" || n !== String(N) || r !== String(R) || p !== String(P)) return false;
    const salt = Buffer.from(saltB64 ?? "", "base64");
    const expected = Buffer.from(hashB64 ?? "", "base64");
    if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;
    const actual = await derive(plain, salt);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
