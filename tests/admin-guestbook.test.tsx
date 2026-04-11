// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuestbookAdmin } from "../src/admin-guestbook";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GuestbookAdmin", () => {
  it("shows pending messages and approves them", async () => {
    let resolveUpdate: ((response: Response) => void) | null = null;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/admin/guestbook" && !init) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [{
              id: "msg-1",
              nickname: "小马",
              email: "pony@example.com",
              content: "今晚笑得很开心。",
              status: "pending",
              createdAt: "2026-04-10T00:00:00Z",
              updatedAt: "2026-04-10T00:00:00Z"
            }]
          })
        } as Response);
      }
      if (url === "/api/admin/guestbook/msg-1" && init?.method === "PUT") {
        return new Promise<Response>((resolve) => {
          resolveUpdate = resolve;
        });
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    const user = userEvent.setup();
    render(<GuestbookAdmin />);

    await waitFor(() => expect(screen.getByText("今晚笑得很开心。")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "通过" }));
    expect(screen.getByText("正在更新...")).toBeTruthy();

    resolveUpdate?.({
      ok: true,
      json: async () => ({
        id: "msg-1",
        nickname: "小马",
        email: "pony@example.com",
        content: "今晚笑得很开心。",
        status: "approved",
        createdAt: "2026-04-10T00:00:00Z",
        updatedAt: "2026-04-10T00:00:01Z"
      })
    } as Response);
    await waitFor(() => expect(screen.getByText("已通过", { selector: ".guestbook-status" })).toBeTruthy());
    expect((screen.getByRole("button", { name: "已通过" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "已通过" }).className).toContain("approved-action");
    expect(screen.getByText("已通过", { selector: ".guestbook-status" }).className).toContain("approved");

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/guestbook/msg-1", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ status: "approved" })
    }));
  });
});
