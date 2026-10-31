import { describe, expect, it } from "vitest";
import { cleanTitle, splitTripName, videoThumb } from "../src/lib/saveLabels";

describe("cleanTitle", () => {
  it("drops the unread count, the emoji, the site's name and lowers a run of capitals", () => {
    expect(cleanTitle("(2) TRAVEL PLAN WITH ME ✈️ (Booking Flights, Budgeting, Itinerary & More!) | How To Plan A Trip Abroad - YouTube", "YouTube")).toBe(
      "Travel plan with me (Booking Flights, Budgeting, Itinerary & More!) | How To Plan A Trip Abroad",
    );
  });
  it("drops the site's name at the end whatever the separator", () => {
    expect(cleanTitle("Patagonya'da 10 gün: Torres del Paine | Gezgin Defteri", "Gezgin Defteri")).toBe("Patagonya'da 10 gün: Torres del Paine");
    expect(cleanTitle("Hotel Las Torres – Booking.com", "Booking.com")).toBe("Hotel Las Torres");
  });
  it("keeps a part that is not the site's name, and one capital word", () => {
    expect(cleanTitle("IST → ATH flights - Cheap tickets", "Skyscanner")).toBe("IST → ATH flights - Cheap tickets");
  });
  it("lowers Turkish capitals the Turkish way", () => {
    expect(cleanTitle("İSTANBUL GEZİ REHBERİ", null)).toBe("İstanbul gezi rehberi");
  });
  it("never leaves nothing", () => {
    expect(cleanTitle("✈️", null)).toBe("✈️");
    expect(cleanTitle("(3) YouTube", "YouTube")).toBe("YouTube");
  });
});

describe("splitTripName", () => {
  it("moves a month and year at the end under the name", () => {
    expect(splitTripName("Patagonya Gezisi · Şubat 2027")).toEqual({ name: "Patagonya Gezisi", date: "Şubat 2027" });
    expect(splitTripName("Japan - April 2027")).toEqual({ name: "Japan", date: "April 2027" });
    expect(splitTripName("Tomorrowland (2027)")).toEqual({ name: "Tomorrowland", date: "2027" });
  });
  it("leaves a name without a date, and a number that is part of the name", () => {
    expect(splitTripName("Porto ve Lizbon")).toEqual({ name: "Porto ve Lizbon", date: null });
    expect(splitTripName("7 Günlük Hurgada Dalış Gezisi")).toEqual({ name: "7 Günlük Hurgada Dalış Gezisi", date: null });
    expect(splitTripName("Şubat 2027")).toEqual({ name: "Şubat 2027", date: null });
  });
});

describe("videoThumb", () => {
  it("finds a video's picture by its address", () => {
    expect(videoThumb("https://www.youtube.com/watch?v=zI9coyuSXos")).toBe("https://i.ytimg.com/vi/zI9coyuSXos/mqdefault.jpg");
    expect(videoThumb("https://www.youtube.com/watch?list=x&v=zI9coyuSXos&t=3")).toBe("https://i.ytimg.com/vi/zI9coyuSXos/mqdefault.jpg");
    expect(videoThumb("https://youtu.be/zI9coyuSXos")).toBe("https://i.ytimg.com/vi/zI9coyuSXos/mqdefault.jpg");
    expect(videoThumb("https://www.youtube.com/")).toBeNull();
  });
});
