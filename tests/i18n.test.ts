import { afterEach, describe, expect, it, vi } from "vitest";
import { L, lang, loadLang, locale, saveLang, setLang } from "../src/lib/i18n";
import { allNoText, joinNames, tallyVotes, type Vote } from "../src/lib/share/votes";

/** A chrome.storage.local that keeps values in a plain object. */
function fakeChrome(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  return {
    store,
    chrome: {
      storage: {
        local: {
          get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
          set: async (values: Record<string, unknown>) => void Object.assign(store, values),
        },
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setLang("tr");
});

describe("the language at startup", () => {
  it("follows the browser when nothing is stored: Turkish browser → Turkish", async () => {
    vi.stubGlobal("chrome", fakeChrome().chrome);
    vi.stubGlobal("navigator", { language: "tr-TR" });
    expect(await loadLang()).toBe("tr");
    expect(L("Kaydet", "Save")).toBe("Kaydet");
  });

  it("follows the browser when nothing is stored: any other browser → English", async () => {
    vi.stubGlobal("chrome", fakeChrome().chrome);
    vi.stubGlobal("navigator", { language: "de-DE" });
    expect(await loadLang()).toBe("en");
    expect(lang()).toBe("en");
    expect(L("Kaydet", "Save")).toBe("Save");
    expect(locale()).toBe("en-GB");
  });

  it("keeps a stored choice over the browser's language, and remembers a new one", async () => {
    const fake = fakeChrome({ lang: "tr" });
    vi.stubGlobal("chrome", fake.chrome);
    vi.stubGlobal("navigator", { language: "en-US" });
    expect(await loadLang()).toBe("tr");
    await saveLang("en");
    expect(fake.store.lang).toBe("en");
    setLang("tr");
    expect(await loadLang()).toBe("en");
  });

  it("falls back to the browser when there is no extension storage", async () => {
    vi.stubGlobal("chrome", undefined);
    vi.stubGlobal("navigator", { language: "en-GB" });
    expect(await loadLang()).toBe("en");
  });
});

describe("votes said for any number of people", () => {
  const v = (author: string, vote: -1 | 0 | 1): Vote => ({ itemKey: "k1", author, vote, note: null, updatedAt: "t" });

  it("two people who both said 👎", () => {
    const t = tallyVotes([v("Sabine", -1), v("Emre", -1)], "k1", "Emre");
    expect(t).toMatchObject({ allNo: true, voters: 2, line: "Emre 👎 · Sabine 👎" });
    expect(allNoText(t.voters, 2)).toBe("İkiniz de istemiyorsunuz");
    setLang("en");
    expect(allNoText(t.voters, 2)).toBe("Neither of you wants it");
  });

  it("three people who all said 👎", () => {
    const t = tallyVotes([v("Sabine", -1), v("Ali", -1), v("Emre", -1)], "k1", "Emre");
    expect(t).toMatchObject({ allNo: true, voters: 3, line: "Emre 👎 · Ali 👎 · Sabine 👎" });
    expect(allNoText(t.voters, 3)).toBe("Hiçbiriniz istemiyor");
    setLang("en");
    expect(allNoText(t.voters, 3)).toBe("None of you want it");
  });

  it("two of three said 👎 and the third hasn't voted: not 'both of you'", () => {
    const t = tallyVotes([v("Sabine", -1), v("Emre", -1)], "k1", "Emre");
    expect(allNoText(t.voters, 3)).toBe("Oy verenlerin hiçbiri istemiyor");
    setLang("en");
    expect(allNoText(t.voters, 3)).toBe("No one who voted wants it");
  });

  it("a mixed vote of three lists every name, me first", () => {
    const t = tallyVotes([v("Sabine", 1), v("Ali", -1), v("Emre", -1)], "k1", "Emre");
    expect(t).toMatchObject({ allNo: false, allYes: false, voters: 3, line: "Emre 👎 · Ali 👎 · Sabine 👍" });
  });

  it("names the others in the board's language", () => {
    expect(joinNames(["Sabine"])).toBe("Sabine");
    expect(joinNames(["Sabine", "Ali"])).toBe("Sabine ve Ali");
    expect(joinNames(["Sabine", "Ali", "Mia"])).toBe("Sabine, Ali ve Mia");
    setLang("en");
    expect(joinNames(["Sabine", "Ali"])).toBe("Sabine and Ali");
    expect(joinNames(["Sabine", "Ali", "Mia"])).toBe("Sabine, Ali and Mia");
  });
});
