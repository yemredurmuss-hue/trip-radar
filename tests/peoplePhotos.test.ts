import { describe, expect, it } from "vitest";
import { getPeoplePhotos, personKey, setPersonPhoto } from "../src/lib/profile";
import { memoryKV } from "../src/lib/share/store";

const JPEG = "data:image/jpeg;base64,/9j/4AAQ";

describe("the photos I give the people I travel with", () => {
  it("keeps one per name, case and spaces aside, and takes it away", async () => {
    const kv = memoryKV();
    await setPersonPhoto("Sabine", JPEG, kv);
    expect((await getPeoplePhotos(kv))[personKey(" sabine ")]).toBe(JPEG);
    await setPersonPhoto("SABINE", null, kv);
    expect(await getPeoplePhotos(kv)).toEqual({});
  });
  it("refuses what isn't a small JPEG, and an empty name does nothing", async () => {
    const kv = memoryKV();
    await expect(setPersonPhoto("Sabine", "data:image/png;base64,AAA", kv)).rejects.toThrow();
    await setPersonPhoto("  ", JPEG, kv);
    expect(await getPeoplePhotos(kv)).toEqual({});
  });
  it("leaves out a stored value that isn't a photo", async () => {
    const kv = memoryKV();
    await kv.set("peoplePhotos", { sabine: JPEG, ali: "nope" });
    expect(await getPeoplePhotos(kv)).toEqual({ sabine: JPEG });
  });
});

describe("personKey", () => {
  it("is the same for a name however it's written", () => {
    expect(personKey("SABINE")).toBe("sabine");
    expect(personKey(" Sabine ")).toBe("sabine");
    expect(personKey("İPEK")).toBe(personKey("ipek"));
  });
});
