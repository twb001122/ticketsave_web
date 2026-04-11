import { describe, expect, it } from "vitest";
import request from "supertest";
import { createServerApp } from "../server/app.js";
import { createDataStore } from "../server/db.js";

describe("calendar API", () => {
  it("serves public calendar events for one month", async () => {
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

    const app = await createServerApp({ store, adminPassword: "secret", sessionSecret: "test-secret" });
    const response = await request(app).get("/api/public/calendar?month=2026-04").expect(200);

    expect(response.body.items[0].title).toBe("周六开放麦");
    expect(response.body.items[0].brand.displayName).toBe("笑声工厂");
  });

  it("requires admin auth for calendar mutations and imports JSON", async () => {
    const store = await createDataStore({ inMemory: true });
    const app = await createServerApp({ store, adminPassword: "secret", sessionSecret: "test-secret" });

    await request(app).post("/api/admin/calendar").send({ title: "未授权" }).expect(401);

    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "secret" }).expect(200);
    const template = await agent.get("/api/admin/calendar/import-template").expect(200);
    expect(template.body[0]).toHaveProperty("date");

    const imported = await agent
      .post("/api/admin/calendar/import")
      .send([
        {
          date: "2026-04-18",
          startTime: "20:00",
          brand: "笑声工厂",
          venue: "喜剧剧场",
          city: "上海",
          format: "单口",
          myRole: "主持",
          showType: "开放麦"
        }
      ])
      .expect(200);
    expect(imported.body.importedCount).toBe(1);

    const created = await agent.post(`/api/admin/calendar/${store.listCalendarEvents()[0].id}/create-show`).expect(201);
    expect(created.body.title).toContain("笑声工厂");
  });
});
