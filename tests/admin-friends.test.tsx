// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FriendsAdmin } from "../src/admin-friends";
import type { PerformerRecord } from "../shared/domain";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FriendsAdmin", () => {
  it("creates friend profiles linked to performers", async () => {
    const performers = [{
      id: "performer-1",
      displayName: "小明",
      normalizedKey: "小明",
      stageName: "明仔",
      avatarFileName: null,
      brandIDs: [],
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z"
    }] satisfies PerformerRecord[];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/admin/friends" && !init) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [] }) } as Response);
      }
      if (url === "/api/admin/friends" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "friend-1",
            performerID: "performer-1",
            bio: "很会接梗的朋友。",
            quote: "台上见。",
            photoUrl: "/covers/friend.jpg",
            galleryUrls: ["/covers/one.jpg"],
            createdAt: "2026-04-10T00:00:00.000Z",
            updatedAt: "2026-04-10T00:00:00.000Z"
          })
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    const user = userEvent.setup();
    render(<FriendsAdmin performers={performers} />);

    await waitFor(() => expect(screen.getByText("还没有朋友资料。")).toBeTruthy());
    await user.selectOptions(screen.getByLabelText("关联演员"), "performer-1");
    await user.type(screen.getByPlaceholderText("简介"), "很会接梗的朋友。");
    await user.type(screen.getByPlaceholderText("他的话"), "台上见。");
    await user.type(screen.getByPlaceholderText("主照片 URL"), "/covers/friend.jpg");
    await user.type(screen.getByPlaceholderText("相册 URL，每行一张，最多 5 张"), "/covers/one.jpg");
    await user.click(screen.getByRole("button", { name: "保存朋友" }));

    await waitFor(() => expect(screen.getByText("小明", { selector: "strong" })).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/friends", expect.objectContaining({ method: "POST" }));
  });
});
