// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarPage } from "../src/calendar-page";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CalendarPage", () => {
  it("renders month events and toggles to list view", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "event-1",
            title: "周六开放麦",
            eventDate: "2026-04-18",
            startTime: "20:00",
            format: "standup",
            myRole: "host",
            showType: "openMic",
            brand: { id: "brand-1", displayName: "笑声工厂", cityName: "上海" },
            venue: { id: "venue-1", displayName: "喜剧剧场", cityName: "上海", district: "静安" },
            notes: "带计时器"
          }
        ]
      })
    } as Response);

    const user = userEvent.setup();
    render(<CalendarPage onNavigate={vi.fn()} initialMonth="2026-04" />);

    await waitFor(() => expect(screen.getByText("周六开放麦")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "列表" }));
    expect(screen.getByRole("heading", { name: /2026 年 4 月演出列表/i })).toBeTruthy();
    expect(screen.getByText(/笑声工厂/)).toBeTruthy();
  });

  it("resets the selected day when the month changes", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      const items =
        url.includes("month=2026-04") ?
          [
            {
              id: "event-1",
              title: "周六开放麦",
              eventDate: "2026-04-18",
              startTime: "20:00",
              format: "standup",
              myRole: "host",
              showType: "openMic",
              brand: { id: "brand-1", displayName: "笑声工厂", cityName: "上海" },
              venue: { id: "venue-1", displayName: "喜剧剧场", cityName: "上海", district: "静安" },
              notes: "带计时器"
            }
          ] :
          [];

      return {
        ok: true,
        json: async () => ({ items })
      } as Response;
    });

    const user = userEvent.setup();
    render(<CalendarPage onNavigate={vi.fn()} initialMonth="2026-04" />);

    await waitFor(() => expect(screen.getByText("周六开放麦")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /18/ }));
    expect(screen.getByRole("heading", { name: /2026-04-18 的演出/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "下个月" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: /2026-04-18 的演出/ })).toBeNull());
    expect(screen.getByRole("heading", { name: "选择一个有演出的日子" })).toBeTruthy();
  });

  it("uses the local month at the Shanghai month boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T16:30:00Z"));
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] })
    } as Response);

    render(<CalendarPage onNavigate={vi.fn()} />);

    expect(screen.getByText("2026 年 4 月", { selector: "strong" })).toBeTruthy();
  });
});
