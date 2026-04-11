// @vitest-environment jsdom

import React, { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarAdmin, chooseCalendarAdminForm } from "../src/admin-calendar";
import type { BrandRecord, VenueRecord } from "../shared/domain";

const brand: BrandRecord = {
  id: "brand-1",
  displayName: "笑声工厂",
  normalizedKey: "笑声工厂",
  cityName: "上海",
  accentColorHex: null,
  performerIDs: [],
  venueIDs: [],
  createdAt: "2026-04-10T00:00:00Z",
  updatedAt: "2026-04-10T00:00:00Z"
};

const venue: VenueRecord = {
  id: "venue-1",
  displayName: "喜剧剧场",
  normalizedKey: "喜剧剧场",
  lookupKey: "喜剧剧场::上海",
  addressLine: null,
  district: "静安",
  cityName: "上海",
  performerIDs: [],
  createdAt: "2026-04-10T00:00:00Z",
  updatedAt: "2026-04-10T00:00:00Z"
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CalendarAdmin", () => {
  it("preserves the current draft while editing", () => {
    const current = {
      title: "周六开放麦",
      eventDate: "2026-04-18",
      startTime: "20:00",
      brandID: "brand-1",
      venueID: "venue-1",
      format: "standup",
      myRole: "host",
      showType: "openMic",
      notes: ""
    } as const;

    expect(
      chooseCalendarAdminForm(
        { id: "event-1" } as never,
        { ...current, title: "" },
        current
      ).title
    ).toBe("周六开放麦");
  });

  it("shows existing events and the JSON template link", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          id: "event-1",
          title: "周六开放麦",
          eventDate: "2026-04-18",
          startTime: "20:00",
          brandID: "brand-1",
          venueID: "venue-1",
          format: "standup",
          myRole: "host",
          showType: "openMic",
          notes: "",
          source: "manual",
          createdShowID: null,
          createdAt: "2026-04-10T00:00:00Z",
          updatedAt: "2026-04-10T00:00:00Z"
        }]
      })
    } as Response);

    render(<CalendarAdmin brands={[brand]} venues={[venue]} onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("周六开放麦")).toBeTruthy());
    expect(screen.getByRole("link", { name: /下载 JSON 示例/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /生成票根/i })).toBeTruthy();
  });

  it("keeps the selected event values when brands and venues refresh while editing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          id: "event-1",
          title: "周六开放麦",
          eventDate: "2026-04-18",
          startTime: "20:00",
          brandID: "brand-1",
          venueID: "venue-1",
          format: "standup",
          myRole: "host",
          showType: "openMic",
          notes: "",
          source: "manual",
          createdShowID: null,
          createdAt: "2026-04-10T00:00:00Z",
          updatedAt: "2026-04-10T00:00:00Z"
        }]
      })
    } as Response);

    const user = userEvent.setup();
    function Harness() {
      const [refreshed, setRefreshed] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setRefreshed(true)}>
            refresh snapshot
          </button>
          <CalendarAdmin
            brands={refreshed ? [brand, { ...brand, id: "brand-2", displayName: "开放麦社" }] : [brand]}
            venues={refreshed ? [venue, { ...venue, id: "venue-2", displayName: "新喜剧空间" }] : [venue]}
            onChanged={vi.fn()}
          />
        </>
      );
    }

    render(<Harness />);

    await waitFor(() => expect(screen.getByText("周六开放麦")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "编辑" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "编辑日历事件" })).toBeTruthy());

    const titleInput = screen.getByPlaceholderText("演出标题") as HTMLInputElement;
    expect(titleInput.value).toBe("周六开放麦");

    await user.click(screen.getByRole("button", { name: "refresh snapshot" }));

    await waitFor(() => {
      expect((screen.getByPlaceholderText("演出标题") as HTMLInputElement).value).toBe("周六开放麦");
    });
  });
});
