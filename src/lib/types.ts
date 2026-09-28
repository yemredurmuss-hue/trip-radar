// Domain model. Kept storage-agnostic so the same shapes can move to a server DB later.

export type Category = "flight" | "stay" | "transport" | "activity" | "food" | "esim" | "other";

export type ItemStatus = "saved" | "chosen" | "booked" | "dismissed";

/** Where a fact came from. "unverified" = the model quoted text we could not find on the page. */
export type FactSource = "url" | "page" | "screenshot" | "unverified" | "none";

export interface Trip {
  id: string;
  title: string;
  /** Dates the user confirmed. Without them the board shows the range derived from items as an estimate. */
  confirmedDates: { start: string; end: string } | null;
  budget: { amount: number; currency: string } | null;
  heroImage: string | null;
  /** Sample data; never receives real captures. */
  demo?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Raw input exactly as captured. Never mutated after creation except for processing status. */
export interface Capture {
  id: string;
  kind: "extension" | "paste-link" | "image";
  url: string | null;
  title: string | null;
  pageText: string;
  viewportText: string;
  selection: string;
  jsonLd: string[];
  meta: Record<string, string>;
  screenshot: string | null; // JPEG data URL
  capturedAt: number;
  status: "pending" | "processing" | "done" | "error";
  error: string | null;
  itemId: string | null;
}

export interface Price {
  amount: number | null;
  currency: string | null;
  scope: "total" | "per_night" | "per_person" | "unknown";
  taxesIncluded: "yes" | "no" | "unknown";
  source: FactSource;
  observedAt: number;
}

export interface Item {
  id: string;
  tripId: string;
  captureIds: string[];
  /** Canonical identity (e.g. booking:pt/jardim-stay). Null when we only have a screenshot. */
  key: string | null;
  category: Category;
  needKey: string;
  name: string;
  provider: string | null;
  summary: string;
  optionDetail: string | null;
  url: string | null;
  imageUrl: string | null;
  city: string | null;
  country: string | null;
  /** ISO 3166-1 alpha-2; used to keep trips apart. */
  countryCode: string | null;
  location: { address: string | null; area: string | null; approximate: boolean };
  dates: { start: string | null; end: string | null; source: FactSource };
  guests: { adults: number | null; children: number | null; rooms: number | null };
  price: Price;
  priceHistory: { amount: number; currency: string; observedAt: number }[];
  cancellation: { summary: string | null; freeUntil: string | null; source: FactSource };
  rating: { value: number | null; scale: number | null; count: number | null; source: FactSource };
  flight: {
    from: string | null;
    to: string | null;
    departure: string | null;
    arrival: string | null;
    carrier: string | null;
    flightNumber: string | null;
    stops: number | null;
  } | null;
  highlights: string[];
  concerns: string[];
  reviewSummary: string | null;
  missing: string[];
  status: ItemStatus;
  statusNote: string | null;
  recommendation: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Preference {
  id: string;
  tripId: string | null; // null = applies to every trip
  text: string;
  createdAt: number;
}

/** Chat log. "event" rows are local notes (e.g. "Jardim Stay kaydedildi") and are not sent to the model as turns. */
export interface ChatMessage {
  id: string;
  tripId: string;
  role: "user" | "assistant" | "event";
  /** Full API content for user/assistant turns (tool_use/tool_result included) so history replays exactly. */
  content: unknown;
  text: string;
  choices: string[];
  /** Hash of the trip state sent with this user turn; the state is only resent when it changed. */
  stateHash?: string;
  /** Event row that starts a fresh model context (older turns are no longer sent). */
  resetsContext?: boolean;
  /** Provider whose native format `content` is in. Missing on rows written before Gemini support = Claude. */
  provider?: "gemini" | "anthropic";
  createdAt: number;
}

export interface Settings {
  provider: "gemini" | "anthropic";
  /** Claude API key and model. */
  apiKey: string;
  model: string;
  /** Google AI Studio (Gemini) key and model. */
  geminiKey: string;
  geminiModel: string;
}
