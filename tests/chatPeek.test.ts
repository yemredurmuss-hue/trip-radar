// The chat drawer's handle under 860 px (v83 "860 px altı", A7): "Asistan" and the last thing said, in a few words.
import { beforeEach, describe, expect, it } from "vitest";
import { chatPeek, cutWords, plainWords, PEEK_MAX } from "../src/lib/chatPeek";
import { setLang } from "../src/lib/i18n";
import type { ChatMessage } from "../src/lib/types";

const msg = (role: ChatMessage["role"], text: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `${role}-${text.length}`, tripId: "t", role, content: null, text, choices: [], createdAt: 1, ...over,
});

beforeEach(() => setLang("tr"));

describe("chatPeek", () => {
  it("the last thing said, its markdown and links as words, on one line", () => {
    const m = [msg("user", "Kyoto için geleneksel bir yer bul"), msg("assistant", "**Gion Hatanaka** en uygunu.\nKaynak: [booking.com](https://www.booking.com/x)")];
    expect(chatPeek(m)).toBe("Gion Hatanaka en uygunu. Kaynak: booking.com");
    expect(chatPeek([...m, msg("user", "Bütçeme uyar mı?")])).toBe("Bütçeme uyar mı?");
  });

  it("a change line and a web search's late line aren't what was last said", () => {
    const m = [msg("assistant", "Üç ryokan buldum."), msg("event", "✓ Gion Hatanaka kaydedildi → Konaklama"), msg("assistant", "Web'de baktım.", { landed: true })];
    expect(chatPeek(m)).toBe("Üç ryokan buldum.");
  });

  it("nothing said yet: no line", () => {
    expect(chatPeek([])).toBeNull();
    expect(chatPeek([msg("event", "✓ Casa Azul kaydedildi")])).toBeNull();
  });

  it("a long line is cut at a word, at most 64 characters with its '…'", () => {
    const long = "Gion'da 3 ryokan buldum. En uygunu Gion Hatanaka: kahvaltı dahil ve ücretsiz iptal. Diğer ikisi Pano'da.";
    const out = chatPeek([msg("assistant", long)])!;
    expect(out).toBe("Gion'da 3 ryokan buldum. En uygunu Gion Hatanaka: kahvaltı…");
    expect(out.length).toBeLessThanOrEqual(PEEK_MAX);
    expect(cutWords("kısa")).toBe("kısa");
    // One long word: cut where it must.
    expect(cutWords("a".repeat(80), 10)).toBe(`${"a".repeat(9)}…`);
    expect(plainWords("  iki\n\nsatır  ")).toBe("iki satır");
  });
});
