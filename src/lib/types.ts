// Domain model. Kept storage-agnostic so the same shapes can move to a server DB later.
import { L } from "./i18n";

export type Category = "flight" | "stay" | "transport" | "activity" | "food" | "esim" | "other";

export const ITEM_STATUSES = ["saved", "chosen", "booked", "dismissed"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/**
 * Where a fact came from. "unverified" = the model quoted text we could not find on the page; "user" =
 * the traveller said it in the chat ("biletim 312 dolardı").
 */
export type FactSource = "url" | "page" | "screenshot" | "unverified" | "user" | "none";

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
  | "ai"
  // What the traveller asks of a place in their own words ("sessiz bir yer istiyoruz"): each its own
  // criterion, weighed by how strongly it was said, measured from what the pages and guests say.
  | "quiet"
  | "clean"
  | "view"
  | "space"
  | "bed"
  | "breakfast"
  | "access"
  | "safety";

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

/** Amenities are stored by their Turkish id; this is how one reads in English. */
export const AMENITY_EN: Record<Amenity, string> = {
  mutfak: "kitchen",
  klima: "air conditioning",
  "ücretsiz wifi": "free Wi-Fi",
  "kahvaltı dahil": "breakfast included",
  otopark: "parking",
  asansör: "lift",
  "çamaşır makinesi": "washing machine",
  havuz: "pool",
  "balkon/teras": "balcony/terrace",
  manzara: "view",
  "iş alanı": "workspace",
  "evcil hayvan kabul": "pets allowed",
  "24 saat resepsiyon": "24-hour reception",
  "havalimanı servisi": "airport shuttle",
  "engelli erişimi": "wheelchair access",
  sessiz: "quiet",
};

/** An amenity as the traveller reads it: the Turkish id itself, or its English name. */
export const amenityLabel = (a: Amenity): string => L(a, AMENITY_EN[a] ?? a);

export type Requirement =
  | { kind: "amenity"; amenity: Amenity }
  | { kind: "free_cancellation" }
  | { kind: "direct_flight" }
  | { kind: "max_walk"; minutes: number }
  /** "Kesinlikle gürültü olmasın": a problem on this topic that the page or several guests report rules a place out. */
  | { kind: "avoid"; topic: FindingTopic };

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
  /** What they'd like to spend (`amount`), and what they won't go over (`ceiling`), when they said one. */
  budget: { amount: number; currency: string; ceiling?: number | null } | null;
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
  /** Inferred signals the user confirmed ("evet, konum önemli"): only these change weights. */
  confirmedSignals?: string[];
  /** Findings the traveller said are fine ("sorun değil"): `${listingKey}#${topic}:${polarity}`. */
  acceptedFindings?: string[];
  /**
   * Findings the traveller said matter to them ("Önemli, kalsın"), same keys: these rule a place out.
   * Nothing read on a page rules a place out without this (or a requirement it breaks).
   */
  confirmedFindings?: string[];
  /** What the traveller decided for each transfer (see legs.ts), by leg key. */
  legs?: Record<string, LegChoice>;
  /**
   * What the traveller said isn't needed: a transfer (`leg:<key>`) or nights without a place to book
   * (`nights:<start>_<end>`). Hidden from the board and the to-dos, never deleted; "Geri getir" restores it.
   */
  hidden?: string[];
  /** Shared with someone (see share/): the secret id of the shared copy on the sharing server. */
  shareId?: string;
  /** Hero photo per city (city key → URL, null when none was found); fetched once. */
  cityImages?: Record<string, string | null>;
  /** The AI's mood sentence for the hero and the cities it was written for (see heroText.ts). */
  mood?: { key: string; text: string } | null;
  /** The style words the model picked for the hero (tripStyle.ts) and what they were picked for. */
  style?: { key: string; ids: string[] } | null;
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
  /** Photos on the page, in view first (see pagecapture.ts). */
  images?: { src: string; alt: string; inView: boolean }[];
  capturedAt: number;
  status: "pending" | "processing" | "done" | "error";
  error: string | null;
  /** Times a busy/rate-limit failure was put back in the queue automatically. */
  autoRetries?: number;
  itemId: string | null;
  /** Came from a shared trip: it goes into this trip, not wherever chooseTrip would put it. */
  forTripId?: string;
  /** Who saved it, when someone else did (a shared trip's other traveller). */
  sharedBy?: string;
  /** When it reached the sharing server (or arrived from it): never uploaded again. */
  sharedAt?: number;
}

export interface Price {
  amount: number | null;
  currency: string | null;
  scope: "total" | "per_night" | "per_person" | "unknown";
  taxesIncluded: "yes" | "no" | "unknown";
  source: FactSource;
  observedAt: number;
}

/** What a plan said in the chat, or added from a template, is (a car rental or a transfer can carry any title). */
export type PlannedKind =
  | "flight" | "train" | "bus" | "minibus" | "ferry" | "transfer" | "taxi"
  | "car_rental" | "moto_rental" | "rv_rental" | "bike_rental"
  | "stay" | "activity" | "food" | "esim" | "insurance" | "note" | "todo" | "other";

/** When a restaurant idea is put on a day: breakfast, lunch or dinner. */
export type MealSlot = "breakfast" | "lunch" | "dinner";

/** A correction per field of a saved page's card; a date is YYYY-MM-DD, a time HH:MM. */
export interface UserEdits {
  name?: string;
  city?: string;
  start?: string;
  end?: string;
  time?: string;
  price?: number;
  currency?: string;
  from?: string;
  to?: string;
}
export type PageValues = { [K in keyof UserEdits]?: UserEdits[K] | null };

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
  /** When the status last changed (a choice made after a stay was said in the chat fills its nights). */
  statusAt?: number;
  /** "chat": the traveller said it in the chat, no page behind it (a plan until a saved page replaces it). */
  origin?: "chat";
  /** What kind of plan was said in the chat, or added from a template (a car rental or a transfer can carry any title). */
  plannedKind?: PlannedKind;
  /** eSIM: when the traveller said it's installed ("Kurdum"). */
  installedAt?: number;
  /**
   * Needs a booking (counts as "Rezerve et") or not (an idea: Yapılacak şeyler, Restoranlar). Missing on
   * older records and pages that didn't say: read by kind (booking.ts bookingOf).
   */
  booking?: "needed" | "none";
  /** A to-do or an idea ticked off ("Yapıldı · 12 Eki"). */
  doneAt?: number;
  /** A restaurant idea put on a day: which meal ("8 Eki akşam"). */
  meal?: MealSlot;
  /**
   * The traveller's corrections to a saved page's card (spec 0.33 §3): shown, planned and compared in place
   * of what the page said (userEdits.ts withEdits); a page saved again keeps them. A plan made by hand or
   * said in the chat is edited itself instead. Local: records aren't shared.
   */
  userEdits?: UserEdits;
  /** Set by withEdits on the board's copy, never stored: what the page says under each correction. */
  pageValues?: PageValues;
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
  /**
   * Lasting (thin walls), an event that passes (scaffolding, a renovation) or stated by the page itself.
   * Older readings don't have it (see natureOf).
   */
  nature?: FindingNature;
}

export type FindingNature = "lasting" | "event" | "stated";

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
  /** Language the findings were written in (older records: Turkish). */
  lang?: "tr" | "en";
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
  /** Language the verdict was written in (older records: Turkish); another language asks again. */
  lang?: "tr" | "en";
}

/** A file attached to a card (a ticket PDF, a QR screenshot). Kept on this computer only: never shared, never exported. */
export interface DocRecord {
  id: string;
  itemId: string;
  tripId: string;
  name: string;
  /** MIME type (from the extension when the file came without one; see docs.docType). */
  type: string;
  size: number;
  blob: Blob;
  addedAt: number;
}
export type DocMeta = Omit<DocRecord, "blob">;
