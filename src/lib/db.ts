import "server-only";
import { Pool } from "pg";

function createPool(): Pool {
  return new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: Number(process.env.PGPORT) || 5432,
  });
}

// WHY: cache on globalThis in dev so HMR does not leak a new pool per reload.
const g = globalThis as unknown as { __wgPool?: Pool };

export const db: Pool =
  process.env.NODE_ENV === "production" ? createPool() : (g.__wgPool ??= createPool());
