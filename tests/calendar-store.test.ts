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

  it("clears calendar events when restoring from backup", async () => {
    const store = await createDataStore({ inMemory: true });
    const brand = store.createBrand({ displayName: "笑声工厂", cityName: "上海" });
    const venue = store.createVenue({ displayName: "喜剧剧场", cityName: "上海" });

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

    store.replaceFromBackup({
      manifest: {
        schemaVersion: 2,
        exportedAt: "2026-04-11T00:00:00Z",
        appVersion: "test",
        counts: { shows: 0, performers: 0, brands: 0, venues: 0 }
      },
      shows: [],
      performers: [],
      brands: [],
      venues: [],
      covers: new Map()
    });

    expect(store.listCalendarEvents()).toEqual([]);
  });

  it("prevents deleting brands and venues referenced by calendar events", async () => {
    const store = await createDataStore({ inMemory: true });
    const brand = store.createBrand({ displayName: "笑声工厂", cityName: "上海" });
    const venue = store.createVenue({ displayName: "喜剧剧场", cityName: "上海" });

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

    expect(() => store.deleteBrand(brand.id)).toThrow("厂牌仍被日历事件引用，暂时不能删除。");
    expect(() => store.deleteVenue(venue.id)).toThrow("场地仍被日历事件引用，暂时不能删除。");
  });

  it("rejects impossible calendar dates", async () => {
    const store = await createDataStore({ inMemory: true });
    const brand = store.createBrand({ displayName: "笑声工厂", cityName: "上海" });
    const venue = store.createVenue({ displayName: "喜剧剧场", cityName: "上海" });

    expect(() =>
      store.createCalendarEvent({
        title: "周六开放麦",
        eventDate: "2026-02-31",
        startTime: "20:00",
        brandID: brand.id,
        venueID: venue.id,
        format: "standup",
        myRole: "host",
        showType: "openMic"
    })
    ).toThrow("日历事件日期必须是有效的 YYYY-MM-DD。");
  });

  it("imports calendar JSON rows and summarizes created entities", async () => {
    const store = await createDataStore({ inMemory: true });

    const result = store.importCalendarRows([
      {
        date: "2026-04-18",
        startTime: "20:00",
        brand: "笑声工厂",
        venue: "喜剧剧场",
        city: "上海",
        format: "单口",
        myRole: "主持",
        showType: "开放麦",
        title: "周六开放麦",
        notes: "带计时器"
      }
    ]);

    expect(result.importedCount).toBe(1);
    expect(result.createdBrands.map((brand) => brand.displayName)).toEqual(["笑声工厂"]);
    expect(result.createdVenues.map((venue) => venue.displayName)).toEqual(["喜剧剧场"]);
    expect(result.errors).toEqual([]);
    expect(store.listCalendarEvents({ month: "2026-04" })[0].title).toBe("周六开放麦");
  });

  it("reports invalid calendar import rows without importing them", async () => {
    const store = await createDataStore({ inMemory: true });

    const result = store.importCalendarRows([
      {
        date: "2026/04/18",
        startTime: "25:00",
        brand: "",
        venue: "喜剧剧场",
        format: "脱口秀",
        myRole: "主持",
        showType: "开放麦"
      }
    ]);

    expect(result.importedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(result.errors.map((error) => error.field)).toContain("date");
    expect(result.errors.map((error) => error.field)).toContain("brand");
    expect(store.listCalendarEvents()).toEqual([]);
  });

  it("creates a ticket from a calendar event once", async () => {
    const store = await createDataStore({ inMemory: true });
    const brand = store.createBrand({ displayName: "笑声工厂", cityName: "上海" });
    const venue = store.createVenue({ displayName: "喜剧剧场", cityName: "上海" });
    const event = store.createCalendarEvent({
      title: "周六开放麦",
      eventDate: "2026-04-18",
      startTime: "20:00",
      brandID: brand.id,
      venueID: venue.id,
      format: "standup",
      myRole: "opener",
      showType: "competition",
      notes: "比赛开场"
    });

    const show = store.createShowFromCalendarEvent(event.id);
    expect(show.title).toBe("周六开放麦");
    expect(show.date).toBe("2026-04-18T20:00:00.000");
    expect(show.brandID).toBe(brand.id);
    expect(show.venueID).toBe(venue.id);
    expect(show.myRole).toBe("opener");
    expect(show.showType).toBe("competition");
    expect(store.listCalendarEvents()[0].createdShowID).toBe(show.id);
    expect(() => store.createShowFromCalendarEvent(event.id)).toThrow("这条日历事件已经生成过票根。");
  });

  it("clears calendar ticket links when deleting generated shows", async () => {
    const store = await createDataStore({ inMemory: true });
    const brand = store.createBrand({ displayName: "笑声工厂", cityName: "上海" });
    const venue = store.createVenue({ displayName: "喜剧剧场", cityName: "上海" });
    const event = store.createCalendarEvent({
      title: "周六开放麦",
      eventDate: "2026-04-18",
      startTime: "20:00",
      brandID: brand.id,
      venueID: venue.id,
      format: "standup",
      myRole: "host",
      showType: "openMic"
    });

    const show = store.createShowFromCalendarEvent(event.id);
    store.deleteShow(show.id);

    expect(store.listCalendarEvents()[0].createdShowID).toBeNull();
    const replacement = store.createShowFromCalendarEvent(event.id);
    expect(replacement.id).not.toBe(show.id);
  });
});
