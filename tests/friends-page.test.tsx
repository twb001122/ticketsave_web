// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FriendsPage } from "../src/friends-page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FriendsPage", () => {
  it("loads friends and opens a friend detail route", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/public/friends") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [{
              id: "friend-1",
              performerID: "performer-1",
              displayName: "小明",
              stageName: "明仔",
              bio: "很会接梗的朋友。",
              quote: "台上见。",
              photoUrl: "friend.jpg",
              relationship: { sameShowCount: 2, firstSharedShowDate: "2023-01-01T20:00:00.000" }
            }]
          })
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<FriendsPage onNavigate={onNavigate} />);

    await waitFor(() => expect(screen.getByText("小明")).toBeTruthy());
    expect(screen.getByText("同台 2 场")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /小明/ }));

    expect(onNavigate).toHaveBeenCalledWith("/friends/friend-1");
  });

  it("shows friend detail with gallery and relationship", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/public/friends/friend-1") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "friend-1",
            performerID: "performer-1",
            displayName: "小明",
            stageName: "明仔",
            bio: "很会接梗的朋友。",
            quote: "台上见。",
            photoUrl: "friend.jpg",
            galleryUrls: ["one.jpg", "two.jpg"],
            relationship: {
              sameShowCount: 2,
              firstSharedShowDate: "2023-01-01T20:00:00.000",
              sharedShows: [{ id: "show-1", title: "第一次同台", date: "2023-01-01T20:00:00.000" }]
            }
          })
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    render(<FriendsPage onNavigate={vi.fn()} friendID="friend-1" />);

    await waitFor(() => expect(screen.getByText("台上见。")).toBeTruthy());
    expect(screen.getByText("同台演出 2 场")).toBeTruthy();
    expect(screen.getByText("第一次同台是 2023年1月1日")).toBeTruthy();
    expect(screen.getByAltText("小明 相册 1")).toBeTruthy();
  });
});
