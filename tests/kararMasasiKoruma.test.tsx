// Karar Masası'na geçiş (docs/superpowers/plans/2026-10-23-karar-masasi-gecis.md, aşama 0): what stays as it is while the
// flight row takes its new language. Ulaşım's and Konaklama's rows say today's words (a snapshot of every dated intent of
// the two fixture trips, its search too); a flight keeps its "Tarih ver", "✨ Önerimiz", "Senin kaydın", "Sen hallettin" and
// "Dahil", no paid sum without a code or a file; its opened ticket keeps the check-in, the travel day's code, the missing
// file's warning and the last step's drop zone.
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardEnvContext, type CardEnv } from "../src/app/cards/PlanCard";
import { FrameTicket } from "../src/app/plan/v82/FrameTicket";
import { V82EnvContext, type V82Env } from "../src/app/plan/v82/v82Env";
import { setLang } from "../src/lib/i18n";
import type { IntentVM } from "../src/lib/intents";
import { rowView, whileSearching, type RowView } from "../src/lib/rowView";
import { boardOf, japan, JAPAN_TODAY, ozora, OZORA_TODAY } from "./fixtures/v82Trips";

setLang("tr");

const dated = (v: IntentVM) => v.frame !== "collection" && ["stay", "transport"].includes(v.section);
const brief = (r: RowView) => ({
  face: r.face,
  lead: r.lead,
  stage: r.stage,
  stageWord: r.stageWord,
  title: r.title,
  route: r.route,
  line: r.line.map((p) => (p.tone ? `${p.text} [${p.tone}]` : p.text)),
  third: r.third.map((p) => (p.tone ? `${p.text} [${p.tone}]` : p.text)),
  wants: r.wants,
  figure: r.figure,
  slot: r.slot,
  count: r.count,
});
const boards = () => {
  const jp = japan();
  const jpDuring = japan({ during: true });
  const oz = ozora();
  return [
    ["Japonya", boardOf(jp.trip, jp.items, JAPAN_TODAY).intents],
    ["Japonya, yolculukta", boardOf(jpDuring.trip, jpDuring.items, "2027-04-06").intents],
    ["Ozora", boardOf(oz.trip, oz.items, OZORA_TODAY).intents],
  ] as const;
};

describe("koruma: Ulaşım ve Konaklama bugünkü sözleriyle kalır", () => {
  for (const [name, list] of boards()) {
    it(name, () => {
      const rows = list.filter(dated).map((v) => {
        const r = rowView(v);
        return { key: v.key, status: v.status, row: brief(r), searching: brief(whileSearching(r, v.status, true)) };
      });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows).toMatchSnapshot();
    });
  }
});

const flights = () => {
  const { trip, items } = japan();
  return boardOf(trip, items, JAPAN_TODAY).intents.filter((v) => v.section === "flight" && v.frame !== "collection");
};

describe("koruma: uçuşta kalan hâller", () => {
  it("✨ Önerimiz and Senin kaydın wait for a yes with Seç", () => {
    const pick = flights().find((v) => v.status === "suggested" && v.chosen)!;
    expect(pick).toBeTruthy();
    const ours = rowView({ ...pick, own: false });
    expect(ours.stageWord).toBe("✨ Önerimiz");
    expect(ours.slot).toEqual({ kind: "take" });
    expect(rowView({ ...pick, own: true }).stageWord).toBe("Senin kaydın");
  });
  it("Ben hallettim: Sen hallettin, its ticket still to add", () => {
    const f = flights().find((v) => v.chosen)!;
    const r = rowView({ ...f, status: "arranged", selfArranged: true });
    expect(r.stage).toBe("bought");
    expect(r.stageWord).toBe("Sen hallettin");
    expect(r.slot).toEqual({ kind: "proof", word: "Bileti ekle" });
  });
  it("Dahil: a grey hap, nothing to do", () => {
    const f = flights()[0];
    const r = rowView({ ...f, status: "included" });
    expect(r.stageWord).toBe("Dahil");
    expect(r.slot).toEqual({ kind: "hap", tone: "inc", text: "Dahil" });
  });
  it("no day yet: Tarih ver", () => {
    const f = flights().find((v) => v.status === "searching" || v.status === "deciding") ?? flights()[0];
    const r = rowView({ ...f, status: "searching", options: [], more: [], optionCount: 0, chosen: null, head: { ...f.head, date: null } });
    expect(r.slot).toEqual({ kind: "date" });
  });
  it("bought with nothing to back it: no paid sum is said", () => {
    const f = flights().find((v) => v.key === "flight:kix-ist")!;
    const r = rowView({ ...f, access: f.access && { ...f.access, code: null, doc: { count: 0, name: null } }, paid: "€1.580 ödendi" });
    expect(r.figure).toBeNull();
  });
});

describe("koruma: açık bilet (FrameTicket inRow)", () => {
  const { trip, items } = japan();
  const board = boardOf(trip, items, JAPAN_TODAY);
  const home = board.intents.find((v) => v.key === "flight:kix-ist")!;
  const on = { take: () => {}, got: () => {}, change: null, openDoc: null, addDoc: () => {}, ask: null, edit: () => {}, unarrange: null };
  const draw = (vm: IntentVM, today = JAPAN_TODAY) => {
    const env = { trip, today, focus: null, setFocus: () => {}, docsFor: () => [] } as unknown as CardEnv;
    const v82 = { byId: new Map(items.map((i) => [i.id, i])), selfAt: { adults: 2, countries: ["JP"] } } as unknown as V82Env;
    return renderToStaticMarkup(
      <CardEnvContext.Provider value={env}>
        <V82EnvContext.Provider value={v82}>
          <FrameTicket vm={vm} form="booked" art="illus/ucus.png" page={vm.chosen?.item.url ?? null} links={[]} hints={[]} info={null} detail={null} quiet={false} on={on} onCover={null} ways={null} onReset={null} onLegGot={null} inRow />
        </V82EnvContext.Provider>
      </CardEnvContext.Provider>,
    );
  };
  it("its code in hand: Bilet elde", () => {
    expect(home.access?.code?.value).toBe("K7T2QX");
    expect(draw(home)).toContain("Bilet elde");
  });
  it("bought with nothing to back it: Alındı, its ticket the last step, dropped under the pass", () => {
    const html = draw({ ...home, access: home.access && { ...home.access, code: null, doc: { count: 0, name: null } } });
    expect(html).toContain("Alındı");
    expect(html).toContain("bileti eklenmedi");
    expect(html).toContain("Son adım");
  });
  it("48 hours before: Online check-in is the main button", () => {
    const html = draw({ ...home, access: home.access && { ...home.access, primary: "checkin" } });
    expect(html).toContain("Online check-in");
  });
  it("on its day: the code to copy where the seal stands", () => {
    expect(draw(home, "2027-04-16")).toContain("K7T2QX");
  });
  it("soon and still no file: the amber warning", () => {
    const html = draw({ ...home, access: home.access && { ...home.access, docMissing: true } });
    expect(html).toContain("eksik");
  });
});
