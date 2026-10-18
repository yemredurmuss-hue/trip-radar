// "İnternet yok · N sn sonra tekrar deniyorum" and the chat's banner (hareket dili, 2026-10-11): which failures are tried again by
// themselves, how long the board waits, and which errors send the traveller to Settings.
import Anthropic from "@anthropic-ai/sdk";
import { ApiError } from "@google/genai";
import { describe, expect, it } from "vitest";
import { retryDelay } from "../src/app/reconnect";
import { errorKind } from "../src/lib/llm";
import { MissingKeyError } from "../src/lib/llm/types";
import { isConnectionError, isTransient } from "../src/lib/process";

describe("tried again by itself", () => {
  it("a connection that never got out, in either language (English was never retried before)", () => {
    for (const m of ["API'ye bağlanılamadı. İnternetini kontrol et.", "Couldn't reach the API. Check your internet connection.", "Couldn't reach the Claude API. Check your internet connection."]) {
      expect(isTransient(m)).toBe(true);
      expect(isConnectionError(m)).toBe(true);
    }
  });
  it("a busy model or a spent quota, in either language, but not as a connection error (no fast retries on a quota)", () => {
    for (const m of [
      "Gemini şu an meşgul ya da geçici bir sorun var. Biraz sonra 'Tekrar dene'ye bas.",
      "Gemini is busy or having a temporary problem. Press 'Try again' in a little while.",
      "Gemini ücretsiz kotası doldu (dakikalık ya da günlük).",
      "Gemini's free quota is used up (per minute or per day).",
      "Claude hit its rate limit; try again in a moment.",
    ]) {
      expect(isTransient(m)).toBe(true);
      expect(isConnectionError(m)).toBe(false);
    }
  });
  it("never a key problem or nothing at all", () => {
    expect(isTransient("The Claude API key isn't valid. Check it in Settings.")).toBe(false);
    expect(isTransient(null)).toBe(false);
    expect(isConnectionError(undefined)).toBe(false);
  });
  it("waits 5, 10, 20, then every 30 seconds", () => {
    expect([0, 1, 2, 3, 9].map(retryDelay)).toEqual([5, 10, 20, 30, 30]);
  });
});

describe("the chat's banner", () => {
  it("Settings for no key, a bad or unallowed key, a model that is gone", () => {
    expect(errorKind(new MissingKeyError())).toBe("settings");
    expect(errorKind(new Anthropic.AuthenticationError(401, undefined, "invalid x-api-key", new Headers()))).toBe("settings");
    expect(errorKind(new Anthropic.PermissionDeniedError(403, undefined, "no access", new Headers()))).toBe("settings");
    expect(errorKind(new ApiError({ message: "API key not valid. Please pass a valid API key.", status: 400 }))).toBe("settings");
    expect(errorKind(new ApiError({ message: "models/gemini-x is not found", status: 404 }))).toBe("settings");
  });
  it("offline when the request never got out", () => {
    expect(errorKind(new Anthropic.APIConnectionError({ message: "Connection error." }))).toBe("offline");
    expect(errorKind(new TypeError("Failed to fetch"))).toBe("offline");
  });
  it("nothing for the rest: the message says it on its own line", () => {
    expect(errorKind(new ApiError({ message: "Resource exhausted", status: 429 }))).toBeNull();
    expect(errorKind(new Error("The model didn't answer in 90 seconds"))).toBeNull();
  });
});
