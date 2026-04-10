import { describe, expect, it } from "vitest";
import { createDataStore } from "../server/db.js";

describe("calendar event store", () => {
  it("creates, updates, lists by month, and deletes calendar events", async () => {
    const store = await createDataStore({ inMemory: true });
    const brand = store.createBrand({ displayName: "笑声工厂", cityName: "上海" });
    const venue = store.createVenue({ displayName: "喜剧剧场", cityName: "上海" });

    const created = store.createCalendarEvent({
      title: "周六开放麦",
      eventDate: "2026-04-18",
      startTime: "20:00",
      brandID: brand.id,
      venueID: venue.id,
      format: "standup",
      myRole: "host",
      showType: "openMic",
      notes: "带计时器",
      source: "manual"
    });

    expect(store.listCalendarEvents({ month: "2026-04" }).map((event) => event.id)).toEqual([created.id]);
    expect(store.listCalendarEvents({ month: "2026-05" })).toEqual([]);

    const updated = store.updateCalendarEvent(created.id, { title: "周六夜开放麦", myRole: "opener" });
    expect(updated.title).toBe("周六夜开放麦");
    expect(updated.myRole).toBe("opener");

    store.deleteCalendarEvent(created.id);
    expect(store.listCalendarEvents({ month: "2026-04" })).toEqual([]);
  });

  it("returns public calendar summaries with linked brand and venue", async () => {
    const store = await createDataStore({ inMemory: true });
    const brand = store.createBrand({ displayName: "笑声工厂", cityName: "上海" });
    const venue = store.createVenue({ displayName: "喜剧剧场", cityName: "上海", district: "静安" });

    store.createCalendarEvent({
      title: "周六开放麦",
      eventDate: "2026-04-18",
      startTime: "20:00",
      brandID: brand.id,
      venueID: venue.id,
      format: "standup",
      myRole: "host",
      showType: "openMic"
    });

    const events = store.listPublicCalendarEvents({ month: "2026-04" });
    expect(events[0].brand.displayName).toBe("笑声工厂");
    expect(events[0].venue.displayName).toBe("喜剧剧场");
    expect(events[0].venue.district).toBe("静安");
  });
});
