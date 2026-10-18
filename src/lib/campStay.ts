// A festival's own nights (a tent camp, a caravan): a stay complete in itself, nothing to find, price or book. A leaf module
// (types only), so the plan, the card views and the playbooks can all ask it without importing each other.
import type { Item } from "./types";

export const isCampStay = (item: Pick<Item, "metrics"> | null | undefined): boolean => item?.metrics?.stayKind === "camp" || item?.metrics?.stayKind === "vehicle";
