import { defineConfig } from "vitest/config";

// The chat's evals against the real model (evals/*.eval.ts): never in `npm test` nor e2e; run on purpose with a key,
// GEMINI_API_KEY=… npx vitest run --config vitest.eval.config.ts
export default defineConfig({
  test: { pool: "forks", isolate: true, include: ["evals/**/*.eval.ts"], testTimeout: 240_000, hookTimeout: 60_000, fileParallelism: false },
});
