// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "../src/home-page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("HomePage", () => {
  it("presents the comedy center modules with real content previews", async () => {
    mockHomeFetch();

    render(<HomePage onNavigate={vi.fn()} />);

    const heroTitle = screen.getByRole("heading", { name: "马达的 喜剧路口" });
    expect(within(heroTitle).getByText("马达的")).toBeTruthy();
    expect(within(heroTitle).getByText("喜剧路口")).toBeTruthy();
    expect(screen.getByText("DongSi Brings People Together")).toBeTruthy();
    expect(screen.getByText("这里会记录一下马达的演出、他的日记、他的观众、他的朋友、他的喜剧、他的夏天和他的东四。")).toBeTruthy();
    expect(document.body.textContent).not.toContain("他的日、");
    expect(screen.getByLabelText("今日入口卡片")).toBeTruthy();
    expect(screen.getByText("TODAY'S ENTRY")).toBeTruthy();
    expect(screen.getByText("胡同里的笑声")).toBeTruthy();
    expect(screen.getByAltText("东四路口的夜色")).toBeTruthy();
    expect(screen.getByText("“东四的夏夜，蝉鸣和笑声一样响亮。”")).toBeTruthy();
    expect(screen.getByText("Read 4 min ago")).toBeTruthy();
    expect(screen.getByText("June 15 · Dongsi Road")).toBeTruthy();
    expect(screen.queryByText("VIEW RECENT ACTIVITY")).toBeNull();
    expect(screen.getAllByAltText(/读者头像/)).toHaveLength(4);
    expect(screen.getByRole("button", { name: /马达的喜剧路口/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "看最近演出" })).toBeNull();
    expect(screen.queryByRole("button", { name: "进入票根档案" })).toBeNull();
    const nav = screen.getByRole("navigation", { name: "全站导航" });
    expect(within(nav).getByRole("button", { name: "首页" }).getAttribute("aria-current")).toBe("page");
    expect(nav.textContent).toContain("后台管理");

    await waitFor(() => expect(screen.getByText("周六开放麦")).toBeTruthy());
    expect(screen.getAllByText("春天票根").length).toBeGreaterThan(0);
    expect(screen.getAllByText("写在开场之后").length).toBeGreaterThan(0);
    expect(screen.getAllByText("小李").length).toBeGreaterThan(0);
    expect(screen.getByText("这一场太好笑了")).toBeTruthy();
    expect(screen.getByLabelText("最近发生输入动画")).toBeTruthy();
    expect(screen.getAllByTestId("home-calendar-card")).toHaveLength(5);

    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent ?? "");
    const orderedSections = ["最近发生", "本周演出日历", "票根精选", "日记精选", "马达和他的朋友们", "留言精选"];
    const positions = orderedSections.map((section) => headings.findIndex((heading) => heading.includes(section)));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(document.body.textContent).not.toContain("即将开放");
  });
});

function mockHomeFetch() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url === "/api/public/calendar/upcoming?days=30") {
      return jsonResponse({
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
            notes: ""
          },
          {
            id: "event-2",
            title: "周日主打秀",
            eventDate: "2026-04-19",
            startTime: "19:30",
            format: "standup",
            myRole: "performer",
            showType: "showcase",
            brand: { id: "brand-1", displayName: "笑声工厂", cityName: "上海" },
            venue: { id: "venue-1", displayName: "喜剧剧场", cityName: "上海", district: "静安" },
            notes: ""
          },
          {
            id: "event-3",
            title: "周一开放麦",
            eventDate: "2026-04-20",
            startTime: "20:00",
            format: "standup",
            myRole: "opener",
            showType: "openMic",
            brand: { id: "brand-1", displayName: "笑声工厂", cityName: "上海" },
            venue: { id: "venue-1", displayName: "喜剧剧场", cityName: "上海", district: "静安" },
            notes: ""
          },
          {
            id: "event-4",
            title: "周二拼盘",
            eventDate: "2026-04-21",
            startTime: "20:00",
            format: "standup",
            myRole: "performer",
            showType: "commercial",
            brand: { id: "brand-1", displayName: "笑声工厂", cityName: "上海" },
            venue: { id: "venue-1", displayName: "喜剧剧场", cityName: "上海", district: "静安" },
            notes: ""
          },
          {
            id: "event-5",
            title: "周三开场",
            eventDate: "2026-04-22",
            startTime: "20:00",
            format: "standup",
            myRole: "opener",
            showType: "showcase",
            brand: { id: "brand-1", displayName: "笑声工厂", cityName: "上海" },
            venue: { id: "venue-1", displayName: "喜剧剧场", cityName: "上海", district: "静安" },
            notes: ""
          },
          {
            id: "event-6",
            title: "第六场不应在首页出现",
            eventDate: "2026-04-23",
            startTime: "20:00",
            format: "standup",
            myRole: "host",
            showType: "showcase",
            brand: { id: "brand-1", displayName: "笑声工厂", cityName: "上海" },
            venue: { id: "venue-1", displayName: "喜剧剧场", cityName: "上海", district: "静安" },
            notes: ""
          }
        ]
      });
    }
    if (url === "/api/public/shows") {
      return jsonResponse({
        items: [
          {
            id: "show-1",
            title: "春天票根",
            coverFileName: null,
            date: "2026-04-08T12:00:00Z",
            format: "standup",
            myRole: "opener",
            showType: "showcase",
            brand: { id: "brand-1", displayName: "笑声工厂", cityName: "上海" },
            venue: { id: "venue-1", displayName: "喜剧剧场", cityName: "上海", district: "静安" },
            performers: []
          }
        ]
      });
    }
    if (url === "/api/public/diary?limit=3&offset=0") {
      return jsonResponse({
        items: [
          {
            id: "diary-1",
            title: "写在开场之后",
            excerpt: "灯暗下来以后，那些没讲出口的话还在后台慢慢发亮。",
            likeCount: 3,
            publishedAt: "2026-04-09T12:00:00Z"
          }
        ],
        hasMore: false,
        nextOffset: null
      });
    }
    if (url === "/api/public/friends") {
      return jsonResponse({
        items: [
          {
            id: "friend-1",
            performerID: "performer-1",
            displayName: "小李",
            stageName: "李老师",
            bio: "一起跑过很多开放麦的朋友。",
            quote: "",
            photoUrl: null,
            galleryUrls: [],
            relationship: { sameShowCount: 12, firstSharedShowDate: "2023-01-01T12:00:00Z" },
            createdAt: "2026-04-07T12:00:00Z",
            updatedAt: "2026-04-08T12:00:00Z"
          }
        ]
      });
    }
    if (url === "/api/public/guestbook?limit=5&offset=0") {
      return jsonResponse({
        items: [
          {
            id: "message-1",
            nickname: "观众A",
            content: "这一场太好笑了",
            createdAt: "2026-04-10T12:00:00Z"
          }
        ],
        hasMore: false,
        nextOffset: null
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: async () => data
  } as Response;
}
