// The English board shows no Turkish (0.39.0, Emre: "İngilizce kısmında da İngilizce olmayan şeyleri tespit et"): every
// string the code holds that reads as Turkish is either inside L("tr", "en"), one of a pair written side by side
// (["Biniş başladı", "Boarding"], { tr, en }, count(n, "gece", "night")), or in a file that only reads with it (the
// chat's word lists, the model prompts). The source is parsed, so comments never count.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseAst } from "rolldown/parseAst";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "src");

/** A word written in Turkish: a lower-case one with a Turkish letter ("İstanbul", "Şule" are names), or a Turkish-only word. */
const TR_LETTERS = /(?<![\p{L}])\p{Ll}*[çğıöşü]\p{L}*/u;
const TR_WORDS = /(?<![\p{L}])(ve|bir|için|ile|yok|gece|gün|kişi|ekle|kaydet|kapat|geri|tamam|iptal|seç|daha|şimdi|burada|hepsi|tümü)(?![\p{L}])/u;
const turkish = (text: string) => TR_LETTERS.test(text) || TR_WORDS.test(text.toLocaleLowerCase("tr-TR"));

/** Calls whose string arguments are both languages side by side. */
const BILINGUAL_CALLS = new Set(["L", "liveLabels", "count"]);
const SELECTORS = new Set(["querySelector", "querySelectorAll", "closest", "matches"]);

/**
 * Files that read Turkish rather than show it: the start chat's and the assistant's word lists and prompts (each prompt
 * is chosen by L()), the readers' prompts, the trip kinds' answers, Turkish grammar (endings, numbers), and the
 * amenity ids stored in Turkish. A string there is shown only through a table that has its English beside it.
 */
const READERS = new Set([
  "lib/airlineData.ts",
  "lib/assistant.ts", "lib/startTrip.ts", "lib/startEvents.ts", "lib/extract.ts", "lib/reader.ts", "lib/analysis.ts",
  "lib/travelKinds.ts", "lib/prepBuy.ts", "lib/whose.ts", "lib/whoseChat.ts", "lib/types.ts", "lib/decision.ts",
  "lib/demo.ts", "lib/stayPicks.ts", "lib/lifecycle.ts", "lib/dayRowTitle.ts", "lib/listing.ts", "lib/i18nText.ts",
  "lib/tripSettings.ts", "lib/offerSource.ts", "lib/planned.ts", "lib/suggestions.ts", "lib/cardWhy.ts", "lib/templates.ts",
  "lib/intents.ts", "lib/playbooks/festival.ts", "lib/playbooks/wellness.ts", "lib/playbooks/honeymoon.ts",
  "lib/playbooks/ski.ts", "lib/playbooks/model.ts",
  // Turkish endings it adds to a word in Turkish only ("Bali'ye", "Porto'su").
  "app/start/Checklist.tsx",
]);

type Node = { type: string; [key: string]: unknown };
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && typeof (v as Node).type === "string";
const isString = (n: unknown): boolean => isNode(n) && ((n.type === "Literal" && typeof n.value === "string") || n.type === "TemplateLiteral");
const keyName = (p: Node): unknown => (isNode(p.key) ? (p.key.name ?? p.key.value) : undefined);

function filesOf(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? filesOf(p) : /\.tsx?$/.test(f) && !f.endsWith(".d.ts") ? [p] : [];
  });
}

/** The Turkish strings of one source outside both-language places: "file:line: text". */
function turkishLeaks(file: string, src: string): string[] {
  const ast = parseAst(src, { lang: file.endsWith("x") ? "tsx" : "ts" }, file) as unknown as Node;
  const out: string[] = [];
  const lineOf = (pos: number) => src.slice(0, pos).split("\n").length;
  const visit = (node: Node, both: boolean): void => {
    if (node.type === "ImportDeclaration") return;
    // Patterns built from words ("new RegExp(`(${words})`)") are read, never shown.
    if (node.type === "NewExpression" && isNode(node.callee) && node.callee.name === "RegExp") return;
    // A selector finds the page's own text in either language ("textarea[placeholder^='Bir link']").
    if (node.type === "CallExpression" && isNode(node.callee) && isNode(node.callee.property) && SELECTORS.has(node.callee.property.name as string)) return;
    if (node.type === "CallExpression" && isNode(node.callee) && BILINGUAL_CALLS.has(node.callee.name as string)) both = true;
    // ["Hepsi", "All"], [pattern, tr, en], [tr, en, tr, en]: the languages side by side.
    const els = node.type === "ArrayExpression" ? (node.elements as unknown[]) : [];
    if (els.length >= 2 && els.length <= 4 && isString(els.at(-1)) && isString(els.at(-2))) both = true;
    // { tr: "…", en: "…" }
    if (node.type === "ObjectExpression" && (node.properties as Node[]).some((p) => keyName(p) === "en")) both = true;
    // tr ? "…" : "…"
    if (node.type === "ConditionalExpression" && isNode(node.test) && node.test.name === "tr") both = true;
    let text: string | null = null;
    if (node.type === "JSXText") text = String(node.value).trim();
    else if (node.type === "Literal" && typeof node.value === "string") text = node.value;
    else if (node.type === "TemplateLiteral") text = (node.quasis as { value: { cooked: string | null; raw: string } }[]).map((q) => q.value.cooked ?? q.value.raw).join(" ");
    // A pattern's source or a word list ("a|b|c") is read, never shown.
    if (text && !both && !/[|\\]/.test(text) && turkish(text)) out.push(`${file}:${lineOf(node.start as number)}: ${text.slice(0, 80)}`);
    for (const [k, v] of Object.entries(node)) {
      if (k === "parent") continue;
      if (Array.isArray(v)) for (const c of v) isNode(c) && visit(c, both);
      else if (isNode(v)) visit(v, both);
    }
  };
  visit(ast, false);
  return out;
}

describe("Turkish on the English board (static)", () => {
  it("the scan finds a bare Turkish string and lets both-language ones be", () => {
    const src = [
      'const a = L("Kaydet", "Save");',
      'const b = ["Hepsi", "All"];',
      'const c = { tr: "Biniş başladı", en: "Boarding" };',
      'const d = count(n, "gece", "night");',
      'const e = <p title="Kapat">Bir gün önce</p>;',
      'const f = new Error("Bu fotoğraf kullanılamadı.");',
      'const g = "İstanbul";',
      "// bir yorum, sayılmaz",
    ].join("\n");
    expect(turkishLeaks("x.tsx", src).map((l) => l.split(": ")[1])).toEqual(["Kapat", "Bir gün önce", "Bu fotoğraf kullanılamadı."]);
  });

  it("no user-facing Turkish string outside L() in src", () => {
    const leaks = filesOf(ROOT)
      .map((f) => relative(ROOT, f).split("\\").join("/"))
      .filter((f) => !READERS.has(f))
      .flatMap((f) => turkishLeaks(f, readFileSync(join(ROOT, f), "utf8")));
    expect(leaks).toEqual([]);
  });
});
