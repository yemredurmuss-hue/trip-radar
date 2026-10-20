// P2: a trip's kind is its own, its rules hold (the UX test's F48, F67, F68).
import { describe, expect, it } from "vitest";
import { playbookFor } from "../src/lib/playbooks";

describe("P2", () => {
  it("F67/F68: an event only the model named is a festival only when said so; a rented car along a coast is a road trip", () => {
    const amalfi = "Haziran'da 7 gün Amalfi kıyısı: Napoli'den araç kiralayıp Positano ve Ravello, bir gün de tekneyle Capri.";
    expect(playbookFor({ kind: "event", name: "Amalfi Coast" }, amalfi)).toBe("road");
    expect(playbookFor({ kind: "event", name: "Napoli Deneyimi" }, "Napoli'de 6 gece")).toBe("classic");
    expect(playbookFor({ kind: "event", name: "Napoli Jazz Festival" }, "")).toBe("festival");
    expect(playbookFor({ kind: "event", name: "Sziget", id: "sziget" }, "")).toBe("festival");
    expect(playbookFor(null, "Ağustosta festivale gidiyoruz")).toBe("festival");
  });
});
