// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiaryPage } from "../src/diary-page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DiaryPage", () => {
  it("loads diary posts and opens a detail route", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/public/diary?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [{
              id: "post-1",
              title: "昨晚的开放麦",
              excerpt: "一个新段子第一次落地。",
              likeCount: 2,
              publishedAt: "2026-04-10T20:00:00.000Z"
            }],
            hasMore: false,
            nextOffset: null
          })
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<DiaryPage onNavigate={onNavigate} />);

    await waitFor(() => expect(screen.getByText("昨晚的开放麦")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "读 昨晚的开放麦" }));

    expect(onNavigate).toHaveBeenCalledWith("/diary/post-1");
  });

  it("shows diary detail with likes and comments", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/public/diary/post-1" && !init) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "post-1",
            title: "昨晚的开放麦",
            excerpt: "一个新段子第一次落地。",
            content: "上台前很紧张，下台后觉得它还能再长一点。",
            likeCount: 2,
            publishedAt: "2026-04-10T20:00:00.000Z",
            comments: [{ id: "comment-1", postID: "post-1", nickname: "观众甲", content: "这个段子我喜欢。", createdAt: "2026-04-10T21:00:00.000Z" }]
          })
        } as Response);
      }
      if (url === "/api/public/diary/post-1/like" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "post-1",
            title: "昨晚的开放麦",
            excerpt: "一个新段子第一次落地。",
            content: "上台前很紧张，下台后觉得它还能再长一点。",
            likeCount: 3,
            publishedAt: "2026-04-10T20:00:00.000Z",
            comments: [{ id: "comment-1", postID: "post-1", nickname: "观众甲", content: "这个段子我喜欢。", createdAt: "2026-04-10T21:00:00.000Z" }]
          })
        } as Response);
      }
      if (url === "/api/public/diary/post-1/comments" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "comment-2", postID: "post-1", nickname: "小马", content: "继续写。", createdAt: "2026-04-10T22:00:00.000Z" })
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    const user = userEvent.setup();
    render(<DiaryPage onNavigate={vi.fn()} postID="post-1" />);

    await waitFor(() => expect(screen.getByText("上台前很紧张，下台后觉得它还能再长一点。")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "喜欢 2" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "喜欢 3" })).toBeTruthy());
    await user.type(screen.getByPlaceholderText("昵称"), "小马");
    await user.type(screen.getByPlaceholderText("想说的话"), "继续写。");
    await user.click(screen.getByRole("button", { name: "留下评论" }));

    await waitFor(() => expect(screen.getByText("继续写。")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/public/diary/post-1/like", expect.objectContaining({ method: "POST" }));
  });
});
