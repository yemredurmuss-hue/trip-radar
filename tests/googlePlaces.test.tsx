// Google's own Places API (New) for the suggested places (the offers function's kind=place asks Text Search first, then
// SerpApi): the answer shaped as serpPlaces shapes Maps', the photo kept by its name and shown through kind=placephoto,
// who took it in the card's credit. Every answer here is made up; nothing is asked out.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GOOGLE_PLACE_FIELDS, googlePhotoUri, googlePlaces, PLACE_MAX, photoNameOk, placePhotoUrl, serpPlaces,
} from "../supabase/functions/offers/shape";
import { SuggestCard } from "../src/app/plan/v82/KCard";
import { placePhotoCredit, suggestionCard } from "../src/lib/collectionCards";
import { makeLiveSource } from "../src/lib/offerSources";
import { findPlace } from "../src/lib/placeSuggest";
import { memoryKV } from "../src/lib/share/store";
import { checkSuggestionInput } from "../src/lib/suggestions";
import type { Suggestion } from "../src/lib/types";

const BASE = "https://zjkesdsbructiyflzqvq.supabase.co";
const suggestion = (title: string, place: string, section = "todo"): Suggestion =>
  checkSuggestionInput({ section, kind: "add", title, why: "Gün batımı için.", template: section, city: "Tabanan", start: "", end: "", place }, "ai", 1) as Suggestion;

// Trimmed from the shape of Text Search's answer (places:searchText with GOOGLE_PLACE_FIELDS).
const PHOTO = "places/ChIJx9Lr6tQ30i0RkP1gD2o/photos/AUc7tXV_9a-Bq2";
const tanahLot = {
  id: "ChIJx9Lr6tQ30i0RkP1gD2o",
  displayName: { text: "Tanah Lot", languageCode: "en" },
  formattedAddress: "Beraban, Kediri, Tabanan Regency, Bali, Indonesia",
  rating: 4.6,
  userRatingCount: 61234,
  location: { latitude: -8.6212, longitude: 115.0868 },
  googleMapsUri: "https://maps.google.com/?cid=11334",
  photos: [{ name: PHOTO, widthPx: 4032, heightPx: 3024, authorAttributions: [{ displayName: "Ayu Lestari", uri: "https://maps.google.com/maps/contrib/1" }] }],
};
const body = {
  places: [
    tanahLot,
    { id: "p2", displayName: { text: "Mason" }, photos: [{ name: "../../v1/x" }] },
    { id: "p3", displayName: { text: "  " } },
    { displayName: { text: "No id" } },
    { id: "p4", displayName: { text: "Shady Shack" }, googleMapsUri: "http://insecure", rating: 0, userRatingCount: 0 },
  ],
};

describe("the offers function's places from Google's Places API (made-up answers)", () => {
  it("asks only the fields a card shows", () => {
    expect(GOOGLE_PLACE_FIELDS.split(",")).toEqual([
      "places.id", "places.displayName", "places.formattedAddress", "places.rating", "places.userRatingCount", "places.location", "places.googleMapsUri", "places.photos",
    ]);
  });

  it("is serpPlaces' shape: the cards read either without a change", () => {
    const [g] = googlePlaces({ places: [tanahLot] }, 7, BASE);
    const [s] = serpPlaces({ place_results: { title: "Tanah Lot", place_id: "x" } }, 7);
    const { photoBy, ...rest } = g;
    expect(Object.keys(rest).sort()).toEqual(Object.keys(s).sort());
    expect(g).toEqual({
      id: tanahLot.id,
      dataId: null,
      name: "Tanah Lot",
      address: "Beraban, Kediri, Tabanan Regency, Bali, Indonesia",
      rating: 4.6,
      reviews: 61234,
      photo: `${BASE}/functions/v1/offers?kind=placephoto&name=places%2FChIJx9Lr6tQ30i0RkP1gD2o%2Fphotos%2FAUc7tXV_9a-Bq2`,
      geo: { lat: -8.6212, lng: 115.0868 },
      type: null,
      url: "https://maps.google.com/?cid=11334",
      source: "Google Maps",
      fetchedAt: 7,
      photoBy: "Ayu Lestari",
    });
    expect(photoBy).toBe("Ayu Lestari");
  });

  it("keeps Google's order, only with a name and an id; no photo, rating or page made up", () => {
    const list = googlePlaces(body, 1, BASE);
    expect(list.map((p) => p.name)).toEqual(["Tanah Lot", "Mason", "Shady Shack"]);
    // A photo name that isn't a Places photo's isn't asked for; no author without a photo.
    expect(list[1]).toMatchObject({ photo: null, rating: null, reviews: null, address: null, geo: null });
    expect(list[1].photoBy).toBeUndefined();
    // Not an https page of its own: the Maps search by its id.
    expect(list[2]).toMatchObject({ rating: null, reviews: null, url: "https://www.google.com/maps/search/?api=1&query=Shady%20Shack&query_place_id=p4" });
  });

  it("is none for no answer, Google's error or an empty one; at most a few", () => {
    expect(googlePlaces(null, 1, BASE)).toEqual([]);
    expect(googlePlaces({ error: { code: 403, status: "PERMISSION_DENIED" } }, 1, BASE)).toEqual([]);
    expect(googlePlaces({}, 1, BASE)).toEqual([]);
    const many = { places: Array.from({ length: 20 }, (_, i) => ({ id: `id${i}`, displayName: { text: `P${i}` } })) };
    expect(googlePlaces(many, 1, BASE)).toHaveLength(PLACE_MAX);
  });

  it("the picture is the function's kind=placephoto, only for a Places photo name and an https project", () => {
    expect(placePhotoUrl(PHOTO, `${BASE}/`)).toBe(`${BASE}/functions/v1/offers?kind=placephoto&name=${encodeURIComponent(PHOTO)}`);
    expect(placePhotoUrl(PHOTO, "http://localhost:54321")).toBeNull();
    expect(googlePlaces({ places: [tanahLot] }, 1, "")[0]).toMatchObject({ photo: null });
    expect(photoNameOk(` ${PHOTO} `)).toBe(PHOTO);
    for (const bad of ["places/x/photos/../../keys", "places/x/photos/a?key=1", "https://evil/x", "places/x", "", null, undefined]) expect(photoNameOk(bad)).toBeNull();
  });

  it("the media answer's photo address, https only", () => {
    expect(googlePhotoUri({ name: `${PHOTO}/media`, photoUri: "https://lh3.googleusercontent.com/place-photos/abc=s480" })).toBe("https://lh3.googleusercontent.com/place-photos/abc=s480");
    expect(googlePhotoUri({ photoUri: "http://x" })).toBeNull();
    expect(googlePhotoUri({ error: { code: 400 } })).toBeNull();
    expect(googlePhotoUri(null)).toBeNull();
  });
});

describe("a suggested place's card with Google's photo", () => {
  const places = googlePlaces({ places: [tanahLot] }, 1, BASE);

  it("the live source keeps a place whose photo is the function's address", async () => {
    const src = makeLiveSource({ kv: memoryKV(), fetcher: (async () => new Response(JSON.stringify({ offers: [], places }))) as unknown as typeof fetch, server: BASE });
    expect(await src.places("Tanah Lot Temple, Tabanan")).toEqual(places);
  });

  it("the card's picture is that address, the credit says Google Maps and who took it", async () => {
    const s = suggestion("Tanah Lot Tapınağı", "Tanah Lot Temple, Tabanan, Bali");
    const found = await findPlace(s, { places: async () => places, fetchJson: async () => null });
    expect(found).toEqual({ photo: { url: places[0].photo, page: places[0].url }, credit: "Google Maps", rating: 4.6, reviews: 61234, map: places[0].url, photoBy: "Ayu Lestari" });
    const html = renderToStaticMarkup(<SuggestCard card={suggestionCard(s, "todo")} onPut={() => {}} onDismiss={() => {}} />);
    expect(html).toContain(`src="${places[0].photo!.replace(/&/g, "&amp;")}"`);
    expect(html).toContain("Fotoğraf: Google Haritalar · Ayu Lestari");
  });

  it("the credit without an author, and Wikipedia's", () => {
    expect(placePhotoCredit("Google Maps")).toBe("Fotoğraf: Google Haritalar");
    expect(placePhotoCredit("Google Maps", "  ")).toBe("Fotoğraf: Google Haritalar");
    expect(placePhotoCredit("Wikipedia", "x")).toBe("Fotoğraf: Wikipedia");
    expect(placePhotoCredit(null)).toBeUndefined();
  });
});
