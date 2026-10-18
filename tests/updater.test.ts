// The Mac updater against a fake GitHub (file:// URLs): notices a new release commit right away,
// swaps the extension folder, updates itself, and does nothing when there's nothing new or no network.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve("scripts/mac/update.sh");

function fakeGitHub() {
  const root = mkdtempSync(path.join(tmpdir(), "tr-updater-"));
  const home = path.join(root, "home");
  mkdirSync(path.join(root, "zips"), { recursive: true });
  const env = {
    ...process.env,
    TRIP_RADAR_DIR: path.join(home, "TripRadar"),
    TRIP_RADAR_APP: path.join(home, "app"),
    TRIP_RADAR_REFS: `file://${path.join(root, "refs")}`,
    TRIP_RADAR_ZIPS: `file://${path.join(root, "zips")}`,
  };
  /** Publishes a release commit: its zip (as codeload serves it) and the branch pointing at it. */
  const release = (sha: string, version: string, updater = "#!/bin/bash\n# updater v2\n") => {
    const tree = path.join(root, "tree", `trip-radar-${sha}`);
    mkdirSync(path.join(tree, "extension"), { recursive: true });
    writeFileSync(path.join(tree, "extension", "manifest.json"), JSON.stringify({ name: "Trip Radar", version }, null, 2));
    writeFileSync(path.join(tree, "update.sh"), updater);
    execFileSync("zip", ["-qr", path.join(root, "zips", `${sha}.zip`), `trip-radar-${sha}`], { cwd: path.join(root, "tree") });
    renameSync(path.join(root, "zips", `${sha}.zip`), path.join(root, "zips", sha)); // codeload serves it at /zip/<sha>
    writeFileSync(
      path.join(root, "refs"),
      `001e# service=git-upload-pack\n0000015b${"a".repeat(40)} HEAD\0multi_ack thin-pack\n003f${"b".repeat(40)} refs/heads/main\n0042${sha} refs/heads/release\n0000`,
    );
  };
  const run = () => execFileSync("bash", [script], { env, encoding: "utf8" });
  const installed = () => JSON.parse(readFileSync(path.join(env.TRIP_RADAR_DIR, "manifest.json"), "utf8")).version;
  return { root, env, release, run, installed, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

describe("mac updater", () => {
  it("installs a new release as soon as the branch moves, and updates itself", () => {
    const gh = fakeGitHub();
    try {
      const first = "1".repeat(40);
      gh.release(first, "0.9.0");
      expect(gh.run()).toMatch(/updated none -> 0\.9\.0 \(1111111\)/);
      expect(gh.installed()).toBe("0.9.0");
      expect(readFileSync(path.join(gh.env.TRIP_RADAR_APP, "release.sha"), "utf8").trim()).toBe(first);
      expect(readFileSync(path.join(gh.env.TRIP_RADAR_APP, "update.sh"), "utf8")).toContain("updater v2");

      // Same commit: nothing is downloaded (the zip is gone and it still succeeds quietly).
      rmSync(path.join(gh.root, "zips", first));
      expect(gh.run()).toBe("");

      const second = "2".repeat(40);
      gh.release(second, "0.9.1", "#!/bin/bash\n# updater v3\n");
      expect(gh.run()).toMatch(/0\.9\.0 -> 0\.9\.1/);
      expect(gh.installed()).toBe("0.9.1");
      expect(readFileSync(path.join(gh.env.TRIP_RADAR_APP, "update.sh"), "utf8")).toContain("updater v3");
      expect(existsSync(`${gh.env.TRIP_RADAR_DIR}.old`)).toBe(false);
    } finally {
      gh.cleanup();
    }
  });

  it("does nothing, without failing, when GitHub can't be reached", () => {
    const gh = fakeGitHub();
    try {
      gh.release("3".repeat(40), "0.9.0");
      gh.run();
      rmSync(path.join(gh.root, "refs"));
      expect(gh.run()).toBe("");
      expect(gh.installed()).toBe("0.9.0");
    } finally {
      gh.cleanup();
    }
  });
});
