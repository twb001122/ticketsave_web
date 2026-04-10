// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TicketCard } from "../src/main";
import type { PublicShowSummary } from "../shared/domain";

const sampleShow: PublicShowSummary = {
  id: "show-1",
  title: "动画测试演出",
  coverFileName: null,
  date: "2026-04-09T12:00:00Z",
  format: "standup",
  myRole: "performer",
  showType: "showcase",
  brand: null,
  venue: null,
  performers: []
};

describe("TicketCard interactions", () => {
  it("shows a pressed state while the card is being clicked", () => {
    render(<TicketCard show={sampleShow} onNavigate={vi.fn()} />);

    const card = screen.getByRole("button", { name: /动画测试演出/i });
    expect(card.className).not.toContain("is-pressing");

    fireEvent.mouseDown(card);
    expect(card.className).toContain("is-pressing");

    fireEvent.mouseUp(card);
    expect(card.className).not.toContain("is-pressing");
  });
});
