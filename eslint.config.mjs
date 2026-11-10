import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Root CommonJS Node scripts (e.g. mqtt_bridge.js) legitimately use require().
  {
    files: ["*.js"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // WHY argsIgnorePattern: useActionState fixes a Server Action's first parameter to the previous
  // state — an unused `_prev` is the convention, not a defect.
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone demo workspace (its Python venv ships JS bundles that are not ours to lint).
    "demo/**",
  ]),
]);

export default eslintConfig;
