import { describe, expect, it } from "vitest";
import { createDataStore } from "../server/db.js";

describe("guestbook message store", () => {
  it("creates pending messages and only publishes approved messages", async () => {
    const store = await createDataStore({ inMemory: true });

    const pending = store.createGuestbookMessage({
      nickname: "小马",
      email: "pony@example.com",
      content: "今晚笑得很开心。"
    });
    const approved = store.createGuestbookMessage({
      nickname: "观众甲",
      content: "下次还来。"
    });
    store.updateGuestbookMessageStatus(approved.id, "approved");

    expect(pending.status).toBe("pending");
    expect(store.listPublicGuestbookMessages({ limit: 10, offset: 0 }).items.map((message) => message.nickname)).toEqual(["观众甲"]);
    expect(store.listGuestbookMessages().map((message) => message.email)).toContain("pony@example.com");

    store.deleteGuestbookMessage(pending.id);
    expect(store.listGuestbookMessages().map((message) => message.id)).not.toContain(pending.id);
  });
});
