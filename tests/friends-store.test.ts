import { describe, expect, it } from "vitest";
import { createDataStore } from "../server/db.js";

describe("friends store", () => {
  it("creates friends and computes shared stage relationship from shows", async () => {
    const store = await createDataStore({ inMemory: true });
    const performer = store.createPerformer({ displayName: "小明", stageName: "明仔" });
    const venue = store.createVenue({ displayName: "喜剧剧场", cityName: "上海" });

    store.createShow({
      title: "第一次同台",
      date: "2023-01-01T20:00:00.000",
      venueID: venue.id,
      performerIDs: [performer.id],
      status: "published"
    });
    store.createShow({
      title: "第二次同台",
      date: "2023-02-01T20:00:00.000",
      venueID: venue.id,
      performerIDs: [performer.id],
      status: "published"
    });
    store.createShow({
      title: "草稿不算公开关系",
      date: "2022-12-01T20:00:00.000",
      venueID: venue.id,
      performerIDs: [performer.id],
      status: "draft"
    });

    const friend = store.createFriend({
      performerID: performer.id,
      bio: "很会接梗的朋友。",
      quote: "台上见。",
      photoUrl: "/covers/friend.jpg",
      galleryUrls: ["/covers/one.jpg", "/covers/two.jpg"]
    });

    const detail = store.getPublicFriend(friend.id);

    expect(detail?.displayName).toBe("小明");
    expect(detail?.stageName).toBe("明仔");
    expect(detail?.relationship.sameShowCount).toBe(2);
    expect(detail?.relationship.firstSharedShowDate).toBe("2023-01-01T20:00:00.000");
    expect(detail?.relationship.sharedShows.map((show) => show.title)).toEqual(["第一次同台", "第二次同台"]);
  });
});
