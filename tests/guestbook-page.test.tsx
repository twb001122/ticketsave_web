// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuestbookPage } from "../src/guestbook-page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GuestbookPage", () => {
  it("loads messages and submits a new message", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.startsWith("/api/public/guestbook") && !init) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [{ id: "msg-1", nickname: "观众甲", content: "下次还来。", createdAt: "2026-04-10T00:00:00Z" }],
            hasMore: false,
            nextOffset: null
          })
        } as Response);
      }
      if (url === "/api/public/guestbook" && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    const user = userEvent.setup();
    render(<GuestbookPage onNavigate={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("下次还来。")).toBeTruthy());
    await user.type(screen.getByPlaceholderText("昵称"), "小马");
    await user.type(screen.getByPlaceholderText("邮箱（选填）"), "pony@example.com");
    await user.type(screen.getByPlaceholderText("想留下些什么"), "今晚笑得很开心。");
    await user.click(screen.getByRole("button", { name: "留下留言" }));

    await waitFor(() => expect(screen.getByText("留言已收到，审核后会出现在这里。")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/public/guestbook", expect.objectContaining({ method: "POST" }));
  });
});
