import { describe, expect, it } from "vitest";
import { LONG_WAIT, mascotFace, thinkingLine } from "../src/app/thinking";

describe("the chat's thinking line (hareket dili)", () => {
  it("says what it waits on when that is known, whatever the wait", () => {
    expect(thinkingLine("web", 0)).toMatch(/Web'de arıyorum|Searching the web/);
    expect(thinkingLine("offers", LONG_WAIT * 2)).toMatch(/Fiyatlara bakıyorum|Checking prices/);
  });
  it("thinks, then says it is taking a while past the long wait", () => {
    expect(thinkingLine(null, LONG_WAIT - 1)).toMatch(/Düşünüyor|Thinking/);
    expect(thinkingLine(null, LONG_WAIT)).toMatch(/Uzun sürüyor|taking a while/);
  });
});

describe("the mascot's face in the chat", () => {
  it("works while the answer comes, smiles once it is in, looks sorry over an error, else waits", () => {
    expect(mascotFace({ working: true, justDone: false, error: true })).toBe("work");
    expect(mascotFace({ working: false, justDone: true, error: false })).toBe("done");
    expect(mascotFace({ working: false, justDone: false, error: true })).toBe("oops");
    expect(mascotFace({ working: false, justDone: false, error: false })).toBe("idle");
  });
});
