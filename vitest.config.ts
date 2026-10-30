import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": abs("./src"),
      // WHY: `server-only` throws outside Next's bundler; Next ships an empty stub for tests.
      "server-only": abs("./node_modules/next/dist/compiled/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
