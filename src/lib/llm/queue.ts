// One line for the model's calls (0.39.4, Emre: "kategoriye basmadan AI çalışsın" — and the board fired its calls all at
// once, which a free Gemini key answers with 429): every call of getProvider's provider waits here, at most AI_PARALLEL at a
// time, the most urgent first, in this order (Emre, 2026-10-20: "sıralama doğru olsun"): "now", what the traveller waits
// on (the chat, the start chat, a category just opened); "review", the trip's suggestions review once it is made; "ahead",
// what is made ahead (the Bavul's list); "soon", every other AI job of the board (the default). A call made ahead is pulled
// to the front when its category opens (promoteAi). Only model calls wait here: the searches with a daily quota (the hotels'
// and activities' rows, SerpApi) are never asked ahead, they stay with the card that shows them. A call's own retry after
// a 429 (gemini.ts withRetry) happens inside its turn, so the line also waits it out. Only each single call is in the line, never a whole chat turn: nothing waits on itself.
import type { LlmProvider } from "./types";

export type AiPriority = "now" | "review" | "ahead" | "soon";
const RANK: Record<AiPriority, number> = { now: 0, review: 1, ahead: 2, soon: 3 };
/** How many model calls run at once (a free Gemini key's rate allows a couple; more only meets 429s). */
export const AI_PARALLEL = 2;

export interface AiCallOpts {
  priority?: AiPriority;
  /** Names a call so it can be pulled to the front while it waits (promoteAi): "pack:<trip>:<lang>". */
  key?: string;
}

interface Job {
  rank: number;
  seq: number;
  key: string | undefined;
  go: () => void;
}

let running = 0;
let seq = 0;
const waiting: Job[] = [];

function next(): void {
  while (running < AI_PARALLEL && waiting.length) {
    waiting.sort((a, b) => a.rank - b.rank || a.seq - b.seq);
    waiting.shift()!.go();
  }
}

/** Runs `call` in its turn; its answer or its error comes back as it would have. */
export function queueAi<T>(call: () => Promise<T>, opts: AiCallOpts = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    waiting.push({
      rank: RANK[opts.priority ?? "soon"],
      seq: seq++,
      key: opts.key,
      go: () => {
        running++;
        Promise.resolve()
          .then(call)
          .then(resolve, reject)
          .finally(() => {
            running--;
            next();
          });
      },
    });
    next();
  });
}

/** The waiting calls with this key go first (a category opened while its list was asked ahead). True when one was waiting. */
export function promoteAi(key: string): boolean {
  let found = false;
  for (const job of waiting) if (job.key === key) {
    job.rank = RANK.now;
    found = true;
  }
  return found;
}

/** How the line stands (tests, diagnostics). */
export const aiLine = (): { running: number; waiting: number; keys: (string | undefined)[] } => ({
  running,
  waiting: waiting.length,
  keys: [...waiting].sort((a, b) => a.rank - b.rank || a.seq - b.seq).map((j) => j.key),
});

/** The provider with each model call put in the line; what it builds by itself (contents) stays as it is. */
export function queuedProvider(p: LlmProvider, opts: AiCallOpts = {}): LlmProvider {
  return {
    id: p.id,
    extract: (capture, facts, trips) => queueAi(() => p.extract(capture, facts, trips), opts),
    generateJson: (system, prompt, schema, files, callOpts) => queueAi(() => p.generateJson(system, prompt, schema, files, callOpts), opts),
    chatStep: (history, system, tools, callOpts) => queueAi(() => p.chatStep(history, system, tools, callOpts), opts),
    userContent: (texts) => p.userContent(texts),
    assistantContent: (text) => p.assistantContent(text),
    toolResultContent: (results) => p.toolResultContent(results),
  };
}
