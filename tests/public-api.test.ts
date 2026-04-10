import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import request from "supertest";
import { createServerApp } from "../server/app.js";
import { createDataStore } from "../server/db.js";

describe("public and admin API boundaries", () => {
  it("does not expose private notes on public show details", async () => {
    const store = await createDataStore({ inMemory: true });
    await store.createShow({
      title: "不公开备注的演出",
      notes: "这句不应该给访客看",
      notesPublic: false,
      format: "standup",
      myRole: "performer",
      showType: "showcase"
    });
    const app = await createServerApp({ store, adminPassword: "secret", sessionSecret: "test-secret" });

    const response = await request(app).get("/api/public/shows").expect(200);

    expect(response.body.items[0].notes).toBeUndefined();
  });

  it("rejects admin mutations until the admin password is accepted", async () => {
    const store = await createDataStore({ inMemory: true });
    const app = await createServerApp({ store, adminPassword: "secret", sessionSecret: "test-secret" });

    await request(app)
      .post("/api/admin/shows")
      .send({ title: "未授权" })
      .expect(401);

    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "secret" }).expect(200);
    await agent
      .post("/api/admin/shows")
      .send({ title: "已授权", format: "standup", myRole: "performer", showType: "showcase" })
      .expect(201);
  });

  it("accepts iOS backup imports that are larger than twelve megabytes", async () => {
    const store = await createDataStore({ inMemory: true });
    const app = await createServerApp({ store, adminPassword: "secret", sessionSecret: "test-secret" });
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "secret" }).expect(200);

    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({
      schemaVersion: 2,
      exportedAt: "2026-04-10T00:00:00Z",
      appVersion: "1.0 (1)",
      counts: { shows: 1, performers: 0, brands: 0, venues: 0 }
    }));
    zip.file("performers.json", "[]");
    zip.file("brands.json", "[]");
    zip.file("venues.json", "[]");
    zip.file("shows.json", JSON.stringify([{
      id: "55555555-5555-5555-5555-555555555555",
      title: "大备份演出",
      coverFileName: "large-cover.bin",
      date: null,
      venueID: null,
      brandID: null,
      performerIDs: [],
      format: "standup",
      myRole: "performer",
      showType: "showcase",
      notes: "",
      tags: [],
      createdAt: "2026-04-10T00:00:00Z",
      updatedAt: "2026-04-10T00:00:00Z",
      status: "published",
      achievementFlags: []
    }]));
    zip.file("covers/large-cover.bin", Buffer.alloc(13 * 1024 * 1024, 7), { createFolders: false });

    const archive = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
    expect(archive.length).toBeGreaterThan(12 * 1024 * 1024);

    await agent
      .post("/api/admin/backup/import")
      .attach("archive", archive, "large-xysg-backup.zip")
      .expect(200);
  });
});
