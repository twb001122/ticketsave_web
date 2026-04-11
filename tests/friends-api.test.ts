import { describe, expect, it } from "vitest";
import request from "supertest";
import { createServerApp } from "../server/app.js";
import { createDataStore } from "../server/db.js";

describe("friends API", () => {
  it("manages friends in admin and serves public relationship details", async () => {
    const store = await createDataStore({ inMemory: true });
    const performer = store.createPerformer({ displayName: "小明" });
    store.createShow({ title: "第一次同台", date: "2023-01-01T20:00:00.000", performerIDs: [performer.id], status: "published" });
    const app = await createServerApp({ store, adminPassword: "secret", sessionSecret: "test-secret" });

    await request(app).post("/api/admin/friends").send({ performerID: performer.id }).expect(401);

    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "secret" }).expect(200);
    const created = await agent
      .post("/api/admin/friends")
      .send({
        performerID: performer.id,
        bio: "很会接梗的朋友。",
        quote: "台上见。",
        photoUrl: "/covers/friend.jpg",
        galleryUrls: ["/covers/one.jpg"]
      })
      .expect(201);

    const list = await request(app).get("/api/public/friends").expect(200);
    expect(list.body.items[0]).toMatchObject({ id: created.body.id, displayName: "小明" });
    expect(list.body.items[0].relationship.sameShowCount).toBe(1);

    const detail = await request(app).get(`/api/public/friends/${created.body.id}`).expect(200);
    expect(detail.body.quote).toBe("台上见。");
    expect(detail.body.relationship.firstSharedShowDate).toBe("2023-01-01T20:00:00.000");
  });
});
