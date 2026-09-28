import { defineConfig } from "vitest/config";

export default defineConfig({
  // Each test file gets its own in-memory IndexedDB.
  test: { pool: "forks", isolate: true },
});
