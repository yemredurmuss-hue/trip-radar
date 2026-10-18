import { defineConfig } from "/home/user/trip-radar/node_modules/vitest/dist/config.js";
export default defineConfig({ test: { pool: "forks", include: ["*.test.ts"], testTimeout: 60000 }, server: { fs: { allow: ["/home/user/trip-radar", "/tmp/claude-0"] } } });
