import { describe, expect, it } from "vitest";
import { createDataStore } from "../server/db.js";

describe("diary post store", () => {
  it("publishes diary posts with comments and likes", async () => {
    const store = await createDataStore({ inMemory: true });

    store.createDiaryPost({
      title: "草稿里的包袱",
      excerpt: "还没想好怎么讲。",
      content: "先放在后台。",
      status: "draft"
    });
    const published = store.createDiaryPost({
      title: "昨晚的开放麦",
      excerpt: "一个新段子第一次落地。",
      content: "上台前很紧张，下台后觉得它还能再长一点。",
      status: "published",
      publishedAt: "2026-04-10T20:00:00.000Z"
    });

    expect(store.listPublicDiaryPosts({ limit: 10, offset: 0 }).items.map((post) => post.title)).toEqual(["昨晚的开放麦"]);

    const comment = store.createDiaryComment(published.id, { nickname: "观众甲", content: "这个段子我喜欢。" });
    const liked = store.likeDiaryPost(published.id);
    const detail = store.getPublicDiaryPost(published.id);

    expect(comment.postID).toBe(published.id);
    expect(liked.likeCount).toBe(1);
    expect(detail?.comments.map((item) => item.content)).toEqual(["这个段子我喜欢。"]);
    expect(detail?.content).toContain("上台前很紧张");
  });
});
