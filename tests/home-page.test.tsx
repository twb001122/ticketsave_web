// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "../src/home-page";

describe("HomePage", () => {
  it("presents the comedy center modules", () => {
    render(<HomePage onNavigate={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /马达的喜剧中心/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /票根精选/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /本周演出日历/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /留言精选/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /日记精选/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /留言精选/i }).textContent).not.toContain("即将开放");
    expect(screen.getByRole("button", { name: /日记精选/i }).textContent).not.toContain("即将开放");
    expect(screen.getByRole("button", { name: /马达和他的朋友们/i }).textContent).not.toContain("即将开放");
  });
});
