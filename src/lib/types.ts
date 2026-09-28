// Domain model. Kept storage-agnostic so the same shapes can move to a server DB later.

export type Category = "flight" | "stay" | "transport" | "activity" | "food" | "esim" | "other";

export type ItemStatus = "saved" | "chosen" | "booked" | "dismissed";

/** Where a fact came from. "unverified" = the model quoted text we could not find on the page. */
export type FactSource = "url" | "page" | "screenshot" | "unverified" | "none";

/** Criteria the decision engine compares options on (see decision.ts). */
export type CriterionId =
  | "price"
  | "location"
  | "rating"
  | "comfort"
  | "cancellation"
  | "amenities"
  | "duration"
  | "stops"
  | "schedule"
  | "baggage"
  | "data"
  | "validity"
  | "ai";

/** 0 önemsiz · 1 az · 2 normal · 3 önemli · 4 çok önemli */
export type PriorityLevel = 0 | 1 | 2 | 3 | 4;

export const AMENITIES = [
  "mutfak",
  "klima",
  "ücretsiz wifi",
  "kahvaltı dahil",
  "otopark",
  "asansör",
  "çamaşır makinesi",
  "havuz",
  "balkon/teras",
  "manzara",
  "iş alanı",
  "evcil hayvan kabul",
  "24 saat resepsiyon",
  "havalimanı servisi",
  "engelli erişimi",
  "sessiz",
] as const;
export type Amenity = (typeof AMENITIES)[number];

export const REVIEW_ASPECTS = [
  "location",
  "cleanliness",
  "comfort",
  "staff",
  "facilities",
  "value",
  "wifi",
  "noise",
  "breakfast",
  "check_in",
  "accuracy",
  "communication",
] as const;
export type ReviewAspect = (typeof REVIEW_ASPECTS)[number];

/** Measurable facts beyond price/rating, used by the decision engine. All optional. */
export interface ItemMetrics {
  reviewAspects: { aspect: ReviewAspect; score: number | null; scale: number | null; sentiment: "positive" | "mixed" | "negative" | null }[];
  amenities: Amenity[];
  cancellationType: "free" | "partial" | "non_refundable" | "unknown";
  distanceToCenterKm: number | null;
  durationMinutes: number | null;
  checkedBagIncluded: boolean | null;
  dataGb: number | null;
  unlimitedData: boolean | null;
  validityDays: number | null;
}

export interface Geo {
  lat: number;
  lng: number;
  source: "page" | "geocoded";
}

export interface Trip {
  id: string;
  title: string;
  /** Dates the user confirmed. Without them the board shows the range derived from items as an estimate. */
  confirmedDates: { start: string; end: string } | null;
  budget: { amount: number; currency: string } | null;
  heroImage: string | null;
  /** Sample data; never receives real captures. */
  demo?: boolean;
  /** How much each criterion matters on this trip, for every category (defaults per category otherwise). */
  priorities?: Partial<Record<CriterionId, PriorityLevel>>;
  /** Overrides for one category (set from its comparison view); win over `priorities`. */
  categoryPriorities?: Partial<Record<Category, Partial<Record<CriterionId, PriorityLevel>>>>;
  /** Amenities the user asked for; options are compared on how many they have. */
  wantedAmenities?: Amenity[];
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
  /** Coordinates found in the page markup (JSON-LD geo, map links, data attributes). */
  coords?: { lat: number; lng: number; source: string }[];
  capturedAt: number;
  status: "pending" | "processing" | "done" | "error";
  error: string | null;
  /** Times a busy/rate-limit failure was put back in the queue automatically. */
  autoRetries?: number;
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
  /** Missing on items saved before the decision engine; read through metricsOf(). */
  metrics?: ItemMetrics;
  geo?: Geo | null;
  highlights: string[];
  concerns: string[];
  reviewSummary: string | null;
  missing: string[];
  status: ItemStatus;
  statusNote: string | null;
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

/** Cached AI analysis of one need group; stale when the inputs' hash changes. */
export interface Analysis {
  key: string; // `${tripId}|${needKey}`
  tripId: string;
  needKey: string;
  inputHash: string;
  createdAt: number;
  verdict: string;
  reasons: string[];
  tradeoffs: string[];
  risks: string[];
  question: string | null;
  aiScores: { itemId: string; score: number; note: string }[];
  /** Set when the analysis call failed for these inputs (retried later, or on request). */
  error?: string;
}
