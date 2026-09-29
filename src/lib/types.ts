// Domain model. Kept storage-agnostic so the same shapes can move to a server DB later.

export type Category = "flight" | "stay" | "transport" | "activity" | "food" | "esim" | "other";

export const ITEM_STATUSES = ["saved", "chosen", "booked", "dismissed"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

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
  | "details"
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

export type Requirement =
  | { kind: "amenity"; amenity: Amenity }
  | { kind: "free_cancellation" }
  | { kind: "direct_flight" }
  | { kind: "max_walk"; minutes: number };

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
  /** Stays: what kind of place (older items don't have it). */
  stayKind?: StayKind | null;
  /** Flats and houses: bedrooms, as the page states. */
  bedrooms?: number | null;
}

export const STAY_KINDS = ["hotel_room", "apartment", "house", "guesthouse", "hostel", "other"] as const;
export type StayKind = (typeof STAY_KINDS)[number];

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
  /** Hard requirements ("mutfak şart", "iadesiz olmasın"): options that fail them can't win. */
  requirements?: Requirement[];
  /** Inferred signals the user dismissed ("bunu yok say"), by signal id. */
  ignoredSignals?: string[];
  /** Findings the traveller said are fine ("sorun değil"): `${listingKey}#${topic}:${polarity}`. */
  acceptedFindings?: string[];
  /** What the traveller decided for each transfer (see legs.ts), by leg key. */
  legs?: Record<string, LegChoice>;
  /**
   * What the traveller said isn't needed: a transfer (`leg:<key>`) or nights without a place to book
   * (`nights:<start>_<end>`). Hidden from the board and the to-dos, never deleted; "Geri getir" restores it.
   */
  hidden?: string[];
  createdAt: number;
  updatedAt: number;
}

/** How a transfer is made. Flights, trains, buses and ferries go from a station, so they bring their own transfers. */
export const LEG_MODES = ["flight", "train", "bus", "ferry", "metro", "taxi", "transfer", "car", "walk"] as const;
export type LegMode = (typeof LEG_MODES)[number];

/** The traveller's own plan for one transfer ("metroyla gideceğim", "otel servisi ayarlandı"). */
export interface LegChoice {
  mode: LegMode | null;
  /** Arranged outside the tool: a ticket, the hotel's shuttle, a friend picking them up... */
  booked: boolean;
  note: string | null;
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
  /** "chat": the traveller said it in the chat, no page behind it (a plan until a saved page replaces it). */
  origin?: "chat";
  /** What kind of plan was said in the chat (a car rental or a transfer can carry any title). */
  plannedKind?: "flight" | "train" | "bus" | "ferry" | "transfer" | "car_rental" | "stay" | "activity" | "other";
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

// --- what was read on a place's pages -------------------------------------------------------------

export const FINDING_TOPICS = [
  "location",
  "nearby",
  "transport",
  "cleanliness",
  "comfort",
  "bed",
  "noise",
  "space",
  "view",
  "staff",
  "host",
  "food",
  "amenities",
  "facilities",
  "access",
  "condition",
  "safety",
  "value",
  "check_in",
  "accuracy",
  "other",
] as const;
export type FindingTopic = (typeof FINDING_TOPICS)[number];

/** Where on the page a finding was read. */
export type FindingSource = "reviews" | "description" | "amenities" | "policy" | "other";

/** A guest review excerpt kept exactly as the page showed it. The id comes from the text, so re-reads don't duplicate it. */
export interface ReviewEvidence {
  id: string;
  text: string;
  /** YYYY-MM when the page showed a date. */
  date: string | null;
  captureId: string;
}

/**
 * One fact about a place, positive or negative ("Geniş yatak", "Yan binada inşaat"). The Reader
 * finds it; code checks its quotes against the stored page and counts the reviews behind it.
 * Whether it rules a place out depends on the traveller, so that is decided elsewhere.
 */
export interface Finding {
  /** `${topic}:${polarity}:${text hash}`. */
  id: string;
  text: string;
  polarity: "positive" | "negative";
  topic: FindingTopic;
  source: FindingSource;
  /** How much it would matter to a typical traveller. */
  severity: "high" | "medium" | "low";
  /** Stored reviews that say it. Counted by code, never by the model. */
  reviewIds: string[];
  /** Verbatim text from the description, amenities or rules that says it. */
  quotes: string[];
  /** At least one supporting quote was found on the stored page. Unverified findings are never decisive. */
  verified: boolean;
}

/**
 * What has been read about one place (hotel, flat, tour...). Shared by every offer of it (different
 * dates or rooms are different items), so a place is read once and its evidence grows with each save.
 */
export interface Listing {
  /** listingKeyOf(item): the item's canonical key, else `item:<id>`. */
  key: string;
  name: string;
  reviews: ReviewEvidence[];
  /** Total the site states ("1.204 yorum"); the stored reviews are a sample of it. */
  reviewTotal: number | null;
  findings: Finding[];
  /** Captures already read, and when the last one was. */
  readCaptureIds: string[];
  readAt: number | null;
  /** Quotes the model gave that weren't on the page (dropped, not shown). */
  dropped: number;
  /** Last reading failure, retried later. */
  error: string | null;
  errorAt: number | null;
  autoRetries?: number;
  /** Check-in/out times and arrival rules the page states (checked against it, see listing.ts). */
  house?: HouseRules | null;
  updatedAt: number;
}

/** Times and arrival rules as the page states them; each read from the quoted page text. */
export interface HouseRules {
  /** "15:00": check-in starts. */
  checkInFrom: string | null;
  /** "23:00": arriving later needs arranging. */
  checkInUntil: string | null;
  /** "11:00": check-out by. */
  checkOutUntil: string | null;
  selfCheckIn: boolean | null;
  luggageStorage: boolean | null;
  airportShuttle: boolean | null;
  quotes: string[];
}

/** Cached AI analysis of one need group; stale when the inputs' hash changes. */
export interface Analysis {
  key: string; // `${tripId}|${group key}`
  tripId: string;
  /** The compared group's key (see plan.groupKeyOf); named needKey in stored records. */
  needKey: string;
  inputHash: string;
  createdAt: number;
  verdict: string;
  reasons: string[];
  tradeoffs: string[];
  risks: string[];
  question: string | null;
  aiScores: { itemId: string; score: number; note: string }[];
  /**
   * Options the assistant ruled out for this traveller, each citing findings. Code only applies one
   * while a cited finding is still verified, recent and not accepted by the traveller.
   */
  eliminations?: { itemId: string; reason: string; findingIds: string[] }[];
  /**
   * The last call failed. A failure never replaces a good verdict: the record keeps the last good
   * analysis (empty verdict if there was none) and notes which inputs failed.
   */
  error?: string;
  errorAt?: number;
  /** Inputs the failed call was for (older records: inputHash). */
  errorHash?: string;
}
