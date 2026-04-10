// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App, TicketCard } from "../src/main";
import type { PublicShowSummary } from "../shared/domain";

const sampleShow: PublicShowSummary = {
  id: "show-1",
  title: "动画测试演出",
  coverFileName: null,
  date: "2026-04-09T12:00:00Z",
  format: "standup",
  myRole: "opener",
  showType: "competition",
  brand: null,
  venue: null,
  performers: []
};

describe("TicketCard interactions", () => {
  it("shows a pressed state while the card is being clicked", () => {
    render(<TicketCard show={sampleShow} onNavigate={vi.fn()} />);

    const card = screen.getByRole("button", { name: /动画测试演出/i });
    expect(card.className).not.toContain("is-pressing");
    screen.getByText("开场");
    screen.getByText("比赛");

    fireEvent.mouseDown(card);
    expect(card.className).toContain("is-pressing");

    fireEvent.mouseUp(card);
    expect(card.className).not.toContain("is-pressing");
  });

  it("returns from show detail to the ticket wall", async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/public/shows/show-1") {
          return {
            ok: true,
            json: async () => sampleShow
          } as Response;
        }
        if (url === "/api/public/summary") {
          return {
            ok: true,
            json: async () => ({
              totalShows: 0,
              roleCounts: { host: 0 },
              typeCounts: { special: 0 },
              formatCounts: {},
              brandCounts: {},
              brands: []
            })
          } as Response;
        }
        if (url.startsWith("/api/public/shows?")) {
          return {
            ok: true,
            json: async () => ({ items: [] })
          } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    try {
      window.history.pushState({}, "", "/shows/show-1");
      render(<App />);

      const backButton = await screen.findByRole("button", { name: /返回票根墙/i });
      fireEvent.click(backButton);

      expect(window.location.pathname).toBe("/tickets");
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
  });
});
