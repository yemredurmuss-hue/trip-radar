import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // Each test file gets its own in-memory IndexedDB.
  // Agents' worktrees live under .claude/; their copies of the tests are not this tree's.
  test: { pool: "forks", isolate: true, exclude: [...configDefaults.exclude, ".claude/**"] },
});
