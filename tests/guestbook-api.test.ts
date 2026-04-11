import { describe, expect, it } from "vitest";
import request from "supertest";
import { createServerApp } from "../server/app.js";
import { createDataStore } from "../server/db.js";

describe("guestbook API", () => {
  it("submits messages publicly and paginates approved messages", async () => {
    const store = await createDataStore({ inMemory: true });
    const app = await createServerApp({ store, adminPassword: "secret", sessionSecret: "test-secret" });

    await request(app)
      .post("/api/public/guestbook")
      .send({ nickname: "小马", email: "pony@example.com", content: "今晚笑得很开心。" })
      .expect(201);

    const pendingList = await request(app).get("/api/public/guestbook?limit=10&offset=0").expect(200);
    expect(pendingList.body.items).toEqual([]);

    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "secret" }).expect(200);
    const adminList = await agent.get("/api/admin/guestbook").expect(200);
    expect(adminList.body.items[0].email).toBe("pony@example.com");
    await agent.put(`/api/admin/guestbook/${adminList.body.items[0].id}`).send({ status: "approved" }).expect(200);

    const publicList = await request(app).get("/api/public/guestbook?limit=1&offset=0").expect(200);
    expect(publicList.body.items[0]).toMatchObject({ nickname: "小马", content: "今晚笑得很开心。" });
    expect(publicList.body.items[0].email).toBeUndefined();
    expect(publicList.body.hasMore).toBe(false);
  });
});
