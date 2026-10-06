// Domain model. Kept storage-agnostic so the same shapes can move to a server DB later.
import type { FlightSeen } from "./flightData";
import { L, type Lang } from "./i18n";

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

export interface Travellers {
  /** Names as typed, each once (case aside). */
  names: string[];
  /** How many go, when it's more than the names (null: as many as the names, or the saves say). */
  count?: number | null;
  /**
   * Kişiye özel rezervasyon (spec 2026-10-06): who comes from somewhere other than where the trip leaves from, by
   * name as on the trip ("Sabine" → "Alicante"; me by my profile name). Shared with the settings like the names;
   * a name taken off leaves it, a name changed takes it along (tripSettings.withTravellers).
   */
  from?: Record<string, string>;
}

export interface Trip {
  id: string;
  title: string;
  /** Dates the user confirmed. Without them the board shows the range derived from items as an estimate. */
  confirmedDates: { start: string; end: string } | null;
  /** What they'd like to spend (`amount`), and what they won't go over (`ceiling`), when they said one. */
  budget: {
    amount: number;
    currency: string;
    ceiling?: number | null;
    /**
     * The budget as the traveller said it, when the board shows it converted into another money (0.37,
     * tripSettings.withCurrency): every later conversion starts from this, so switching back and forth never
     * drifts. Gone when a new amount is said.
     */
    source?: { amount: number; currency: string; ceiling?: number | null };
  } | null;
  /**
   * The money the board shows the trip in, when the traveller picked one ("bütçeyi euro göster") and there's no
   * budget to carry it: a budget's own currency wins (they're kept the same when it's changed). This computer only.
   */
  currency?: string | null;
  /**
   * Who goes, said without sharing (0.37): the names typed in the hero ("Sabine") or said in the chat, never "me"
   * (that's the profile or sharing name), and how many when more go than are named. Shared with the trip's settings.
   */
  travellers?: Travellers;
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
  /** Günlük akış times the traveller set themselves, by row key ("HH:MM"); the rest of the day follows them (dayTimes.ts). */
  dayTimes?: Record<string, string> | null;
  /**
   * Günlük akış order the traveller gave a day (0.35.6), by date: its lines' keys. Only the lines without a time
   * keep the place they're given; the timed ones always go by the clock (dayCards.orderRows).
   */
  dayOrder?: Record<string, string[]> | null;
  /** Günlük akış lines with a time the traveller moved by hand (0.35.10): off the clock, shown without their time, by row key. */
  dayLoose?: string[] | null;
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
  /**
   * The hero card's "Tercihler": the model's 1–3 word name for a note the code can't name itself
   * (preferences.ts noteLabelKey → "Şarap tadımı"); "" when its answer wasn't one (the first words stand).
   */
  prefLabels?: Record<string, string>;
  /**
   * The hero's main places (destinations.ts): for the stay cities `key` was asked for, each smaller place's
   * bigger destination by city key ("gaula" → "Madeira"). The Plan and Günlük akış keep the places as they are.
   */
  placeParents?: { key: string; parents: Record<string, string> } | null;
  /**
   * Öneriler (suggestions.ts): what the AI review and the chat suggested, and what the traveller did with a rule's
   * suggestion ("Plana ekle", "Gerek yok"). A rule's open suggestion isn't stored: it's worked out from the trip.
   */
  suggestions?: Suggestion[];
  /** The last AI review of the trip for suggestions (suggestReview.ts): for which state, when, and whether it failed. */
  suggestReview?: { key: string; at: number; failed?: boolean; state?: "running" | "done" | "failed" } | null;
  /** Made by the start chat (spec 2026-10-06 §2): its one-time start card above the plan (startTrip.ts guideSteps). */
  startGuide?: StartGuide | null;
  /**
   * The language of the conversation the trip was started with (start chat, revision 2): its chat goes on in it and
   * its suggestions are written in it, whatever the board's language. Unset: the board's.
   */
  lang?: Lang | null;
  createdAt: number;
  updatedAt: number;
}

/** A section a suggestion can sit in (İlham is filled by sending links, never suggested). */
export type SuggestionSection = "flight" | "stay" | "transport" | "activity" | "todo" | "food" | "other";
/** "add": something to put on the plan ("Plana ekle"); "warning": something to check (a short layover). */
export type SuggestionKind = "add" | "warning";
export type SuggestionState = "open" | "added" | "dismissed";

/**
 * A suggestion card at the top of its section (spec 2026-10-06 §1): never part of the plan, never counted. `key`
 * makes it unique ("rule:insurance", "chat:transport-moto-aylik-motor-kiralama"); "Gerek yok" on a key is for good.
 */
export interface Suggestion {
  key: string;
  section: SuggestionSection;
  kind: SuggestionKind;
  title: string;
  /** One sentence: why, from facts only (no invented prices, times or percentages). */
  why: string;
  source: "rule" | "ai" | "chat";
  /** The template "Plana ekle" adds with (templates.ts TemplateId); none for a warning. */
  template?: string;
  /** What the record is made with: its city, first and last day (YYYY-MM-DD), a time (rules only), a name. */
  payload?: { city?: string | null; start?: string | null; end?: string | null; time?: string | null; title?: string | null };
  createdAt: number;
  state: SuggestionState;
  stateAt?: number;
}

/** The new trip's start card: closed with ×, the suggestions looked at, a road trip (a car instead of flights). */
export interface StartGuide {
  createdAt: number;
  closed?: boolean;
  looked?: boolean;
  road?: boolean;
  /**
   * The flights, stays and car the start made, by item id with what they said then (startTrip.ts placeholderPrint): places to fill,
   * not the traveller's choices, until one is changed (startTrip.ts isPlaceholder).
   */
  placeholders?: Record<string, string>;
  /** The start day was a guess from a month ("Ortası" → the 15th): the hero says "tarih yaklaşık" while the trip starts on it; null once confirmed. */
  approxStart?: string | null;
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
  | "stay" | "activity" | "food" | "esim" | "insurance" | "note" | "todo" | "prep" | "other";

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
  /** A trip's arrival, YYYY-MM-DDTHH:MM (said in the chat: it can land the next day). */
  arrival?: string;
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
  /** The status it had when the chat took it off the plan (dismissed): Gizlenenler's "Geri al" puts that back. */
  dismissedFrom?: ItemStatus;
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
  /** Moved by the traveller between Hazırlık (true) and Yapılacak şeyler (false); wins over its words. */
  prep?: boolean;
  /** The idea's kind the traveller picked (fikir havuzu, ideaKinds.ts); wins over its words. */
  ideaKind?: string | null;
  /** A restaurant idea put on a day: which meal ("8 Eki akşam"). */
  meal?: MealSlot;
  /**
   * The traveller's corrections to a saved page's card (spec 0.33 §3): shown, planned and compared in place
   * of what the page said (userEdits.ts withEdits); a page saved again keeps them. A plan made by hand or
   * said in the chat is edited itself instead. Local: records aren't shared.
   */
  userEdits?: UserEdits;
  /**
   * The flight's real data (0.36.15, flightData.ts): its schedule and, on the day, status, gate, terminal and
   * belt. Read in memory where the board reads the records (never stored on the record).
   */
  flightLive?: FlightSeen | null;
  /**
   * Kişiye özel rezervasyon (spec 2026-10-06): whose it is, by the names on the trip ("Sabine"; me by my profile or
   * sharing name, never "Ben"), matched case aside. Missing or empty: everyone's. Only a strict part of the trip's
   * people is shown (whose.ts whoseOf: "Sabine'in bileti"); a name taken off the trip leaves it, and a plan left
   * with nobody is everyone's again (tripSettings.ownersAfter).
   */
  forWho?: string[];
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
  /** A history line for a trip setting changed on this computer (0.37): what Geçmiş's "Geri al" puts back. */
  undo?: EventUndo;
  /** Taken back (from Geçmiş or the board's "Geri al"): when. Geçmiş shows it "geri alındı". */
  undoneAt?: number;
  /** An assistant reply saying something changed while no tool changed anything (claims.ts): a note shows under it. */
  unbacked?: boolean;
  /**
   * A question the code asked under this reply (kişiye özel rezervasyon): its chips are answered by the code, not
   * the model ("Evet, Alicante" adds the way home; "Sabine" makes the ticket hers). Only the newest reply's counts.
   */
  ask?: ChatAsk;
}

/** The code's own question under a reply, and what its chips mean (whoseStore.answerAsk). */
export type ChatAsk =
  /** "Sabine dönüşte de Alicante'ye mi?": yes adds her flight home from `leave` to `place` on `date`. */
  | { kind: "return"; name: string; place: string; leave: string | null; date: string | null; origin: string | null; line?: string | null }
  /** "Bu Ryanair bileti kimin?": a name (or several) makes it theirs, "Herkes" everyone's. */
  | { kind: "owner"; itemId: string; names: string[] }
  /**
   * "Sana ne diyeyim?": I have no name yet and a plan would be mine (never "Ben'in bileti"). What's said is saved as
   * my profile name; then `ownerItem` is mine, the trip's own flights go to whom they're for, and `then` is asked.
   */
  | { kind: "name"; ownerItem?: string | null; then?: { text: string; choices: string[]; ask: ChatAsk } | null; line?: string | null; retried?: boolean };

/** A plan's owners before and after a change (kişiye özel rezervasyon): what "Geri al" puts back. */
export interface OwnerChange {
  id: string;
  before: string[] | null;
  after: string[] | null;
}

/**
 * How a history line is taken back: these trip fields to their values before (only while they still hold the
 * values after), or the board's language to the one before. `owners`: plans whose owners the same change set
 * (a name taken off, "bu bilet Sabine'in"), put back the same way (no trip field when `fields` is empty).
 */
export type EventUndo =
  | {
      kind: "fields";
      fields: (keyof Trip)[];
      before: Partial<Trip>;
      after: Partial<Trip>;
      owners?: OwnerChange[];
      /** Records the same change made ("Sabine Alicante'den geliyor" opens her flight): they go again. */
      made?: string[];
      /** My profile (sharing) name before the change set it ("Sana ne diyeyim?"): it goes back to this. */
      profileName?: { before: string };
    }
  | { kind: "lang"; prev: "tr" | "en" };

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

/** What a document is, as the assistant read it (spec 0.34.6 §2); "other" when it couldn't tell. */
export const DOC_KINDS = ["insurance", "flight", "stay", "train", "bus", "ferry", "event", "esim", "car_rental", "visa", "other"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

/**
 * A file of the trip (a ticket PDF, a QR screenshot, a policy): attached to a card, or dropped in the chat and
 * not linked to one yet (`itemId` ""; Belgeler offers "Bir karta bağla"). Kept on this computer only: never
 * shared, never exported.
 */
export interface DocRecord {
  id: string;
  /** The card it belongs to; "" while it belongs to none. */
  itemId: string;
  tripId: string;
  name: string;
  /** MIME type (from the extension when the file came without one; see docs.docType). */
  type: string;
  size: number;
  blob: Blob;
  addedAt: number;
  /** What the assistant read it as (older files and unread ones don't say). */
  kind?: DocKind;
}
export type DocMeta = Omit<DocRecord, "blob">;

/** What a deleted card took with it: the record and its files. */
export interface TrashedItem {
  item: Item;
  docs: DocRecord[];
}

/** What a deleted trip took with it: everything on this computer that was only the trip's. */
export interface TrashedTrip {
  trip: Trip;
  items: Item[];
  docs: DocRecord[];
  captures: Capture[];
  /** The chat and the trip's history lines. */
  messages: ChatMessage[];
  analyses: Analysis[];
  /** The notes said for this trip only (the ones for every trip stay). */
  preferences: Preference[];
}

/** A deleted file (Belgeler, a card's file list). */
export interface TrashedDoc {
  doc: DocRecord;
}

export type TrashKind = "item" | "trip" | "doc";

/**
 * Çöp kutusu (0.37, trash.ts): a deleted card, file or trip, kept on this computer for 30 days and brought back
 * in one tap with its own ids. This is the light row the lists read; what it took is in `trashData`.
 */
export interface TrashEntry {
  id: string;
  tripId: string;
  kind: TrashKind;
  deletedAt: number;
  label: string;
  /** About how many bytes it holds (files and records), and how many records. */
  size: number;
  count: number;
}

/** What a trash entry took with it, read only to restore it (or for a backup). */
export type TrashPayload = ({ kind: "item" } & TrashedItem) | ({ kind: "trip" } & TrashedTrip) | ({ kind: "doc" } & TrashedDoc);

export interface TrashData {
  id: string;
  payload: TrashPayload;
}
