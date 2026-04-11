// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiaryAdmin } from "../src/admin-diary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DiaryAdmin", () => {
  it("creates and lists diary posts", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/admin/diary" && !init) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [] }) } as Response);
      }
      if (url === "/api/admin/diary" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "post-1",
            title: "昨晚的开放麦",
            excerpt: "一个新段子第一次落地。",
            content: "上台前很紧张。",
            status: "published",
            likeCount: 0,
            publishedAt: "2026-04-10T20:00:00.000Z",
            createdAt: "2026-04-10T20:00:00.000Z",
            updatedAt: "2026-04-10T20:00:00.000Z"
          })
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    const user = userEvent.setup();
    render(<DiaryAdmin />);

    await waitFor(() => expect(screen.getByText("还没有日记。")).toBeTruthy());
    await user.type(screen.getByPlaceholderText("文章标题"), "昨晚的开放麦");
    await user.type(screen.getByPlaceholderText("列表摘要"), "一个新段子第一次落地。");
    await user.type(screen.getByPlaceholderText("正文"), "上台前很紧张。");
    await user.selectOptions(screen.getByLabelText("发布状态"), "published");
    await user.click(screen.getByRole("button", { name: "发布日记" }));

    await waitFor(() => expect(screen.getByText("昨晚的开放麦")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/diary", expect.objectContaining({ method: "POST" }));
  });
});
