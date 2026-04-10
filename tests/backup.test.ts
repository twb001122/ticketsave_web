import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { exportBackupZip, importBackupZip } from "../server/backup.js";
import { createDataStore } from "../server/db.js";

describe("iOS backup compatibility", () => {
  it("imports the schema-v2 ZIP layout and exports the same JSON files", async () => {
    const store = await createDataStore({ inMemory: true });
    const sourceZip = new JSZip();
    sourceZip.file("manifest.json", JSON.stringify({
      schemaVersion: 2,
      exportedAt: "2026-04-10T00:00:00Z",
      appVersion: "1.0 (1)",
      counts: { shows: 1, performers: 1, brands: 1, venues: 1 }
    }));
    sourceZip.file("performers.json", JSON.stringify([{
      id: "11111111-1111-1111-1111-111111111111",
      displayName: "小明",
      normalizedKey: "小明",
      stageName: null,
      avatarFileName: null,
      brandIDs: ["22222222-2222-2222-2222-222222222222"],
      createdAt: "2026-04-10T00:00:00Z",
      updatedAt: "2026-04-10T00:00:00Z"
    }]));
    sourceZip.file("brands.json", JSON.stringify([{
      id: "22222222-2222-2222-2222-222222222222",
      displayName: "笑声工厂",
      normalizedKey: "笑声工厂",
      cityName: "上海",
      accentColorHex: null,
      performerIDs: ["11111111-1111-1111-1111-111111111111"],
      venueIDs: ["33333333-3333-3333-3333-333333333333"],
      createdAt: "2026-04-10T00:00:00Z",
      updatedAt: "2026-04-10T00:00:00Z"
    }]));
    sourceZip.file("venues.json", JSON.stringify([{
      id: "33333333-3333-3333-3333-333333333333",
      displayName: "喜剧剧场",
      normalizedKey: "喜剧剧场",
      lookupKey: "喜剧剧场::上海",
      addressLine: "南京西路",
      district: "静安",
      cityName: "上海",
      performerIDs: ["11111111-1111-1111-1111-111111111111"],
      createdAt: "2026-04-10T00:00:00Z",
      updatedAt: "2026-04-10T00:00:00Z"
    }]));
    sourceZip.file("shows.json", JSON.stringify([{
      id: "44444444-4444-4444-4444-444444444444",
      title: "春天开放麦",
      coverFileName: "cover-a.jpg",
      date: "2026-04-10T12:00:00Z",
      venueID: "33333333-3333-3333-3333-333333333333",
      brandID: "22222222-2222-2222-2222-222222222222",
      performerIDs: ["11111111-1111-1111-1111-111111111111"],
      format: "standup",
      myRole: "performer",
      showType: "openMic",
      notes: "后台笔记",
      tags: [],
      createdAt: "2026-04-10T00:00:00Z",
      updatedAt: "2026-04-10T00:00:00Z",
      status: "published",
      achievementFlags: []
    }]));
    sourceZip.file("covers/cover-a.jpg", Buffer.from("cover"));

    const zipBuffer = await sourceZip.generateAsync({ type: "nodebuffer" });
    await importBackupZip(store, zipBuffer);

    const exported = await JSZip.loadAsync(await exportBackupZip(store, "web-test"));
    expect(Object.keys(exported.files).sort()).toEqual([
      "brands.json",
      "covers/cover-a.jpg",
      "manifest.json",
      "performers.json",
      "shows.json",
      "venues.json"
    ]);
    const shows = JSON.parse(await exported.file("shows.json")!.async("string"));
    expect(shows[0]).not.toHaveProperty("notesPublic");
    expect(shows[0].performerIDs).toEqual(["11111111-1111-1111-1111-111111111111"]);
  });

  it("treats missing optional entity fields like the iOS decoder", async () => {
    const store = await createDataStore({ inMemory: true });
    const sourceZip = new JSZip();
    sourceZip.file("manifest.json", JSON.stringify({
      schemaVersion: 2,
      exportedAt: "2026-04-10T00:00:00Z",
      appVersion: "1.0 (1)",
      counts: { shows: 0, performers: 1, brands: 1, venues: 1 }
    }));
    sourceZip.file("shows.json", "[]");
    sourceZip.file("performers.json", JSON.stringify([{
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      displayName: "没有艺名字段",
      normalizedKey: "没有艺名字段",
      brandIDs: [],
      createdAt: "2026-04-10T00:00:00Z",
      updatedAt: "2026-04-10T00:00:00Z"
    }]));
    sourceZip.file("brands.json", JSON.stringify([{
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      displayName: "没有颜色字段",
      normalizedKey: "没有颜色字段",
      performerIDs: [],
      venueIDs: [],
      createdAt: "2026-04-10T00:00:00Z",
      updatedAt: "2026-04-10T00:00:00Z"
    }]));
    sourceZip.file("venues.json", JSON.stringify([{
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      displayName: "没有地址字段",
      normalizedKey: "没有地址字段",
      lookupKey: "没有地址字段",
      performerIDs: [],
      createdAt: "2026-04-10T00:00:00Z",
      updatedAt: "2026-04-10T00:00:00Z"
    }]));

    await importBackupZip(store, await sourceZip.generateAsync({ type: "nodebuffer" }));

    expect(store.listPerformers()[0].stageName).toBeNull();
    expect(store.listBrands()[0].accentColorHex).toBeNull();
    expect(store.listVenues()[0].addressLine).toBeNull();
  });
});
