import { describe, expect, it } from "vitest";
import request from "supertest";
import { createServerApp } from "../server/app.js";
import { createDataStore } from "../server/db.js";

describe("diary API", () => {
  it("manages posts in admin and serves public detail interactions", async () => {
    const store = await createDataStore({ inMemory: true });
    const app = await createServerApp({ store, adminPassword: "secret", sessionSecret: "test-secret" });

    await request(app).post("/api/admin/diary").send({ title: "未授权" }).expect(401);

    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "secret" }).expect(200);
    const created = await agent
      .post("/api/admin/diary")
      .send({
        title: "昨晚的开放麦",
        excerpt: "一个新段子第一次落地。",
        content: "上台前很紧张，下台后觉得它还能再长一点。",
        status: "published",
        publishedAt: "2026-04-10T20:00:00.000Z"
      })
      .expect(201);

    const list = await request(app).get("/api/public/diary?limit=1&offset=0").expect(200);
    expect(list.body.items[0]).toMatchObject({ id: created.body.id, title: "昨晚的开放麦" });

    const comment = await request(app)
      .post(`/api/public/diary/${created.body.id}/comments`)
      .send({ nickname: "观众甲", content: "这个段子我喜欢。" })
      .expect(201);
    expect(comment.body.content).toBe("这个段子我喜欢。");

    const liked = await request(app).post(`/api/public/diary/${created.body.id}/like`).expect(200);
    expect(liked.body.likeCount).toBe(1);

    const detail = await request(app).get(`/api/public/diary/${created.body.id}`).expect(200);
    expect(detail.body.comments[0].nickname).toBe("观众甲");
    expect(detail.body.content).toContain("上台前很紧张");
  });
});
