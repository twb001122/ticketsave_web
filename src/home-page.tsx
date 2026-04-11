import React, { useEffect, useMemo, useState } from "react";
import { fetchJSON } from "./api";
import {
  formatLabels,
  roleLabels,
  type DiaryPageResult,
  type GuestbookPageResult,
  type PublicCalendarEventSummary,
  type PublicDiaryPostSummary,
  type PublicFriendSummary,
  type PublicGuestbookMessage,
  type PublicShowSummary
} from "../shared/domain";

interface HomePageProps {
  onNavigate: (path: string) => void;
}

interface HomeData {
  calendarEvents: PublicCalendarEventSummary[];
  tickets: PublicShowSummary[];
  diaryPosts: PublicDiaryPostSummary[];
  friends: PublicFriendSummary[];
  messages: PublicGuestbookMessage[];
}

interface ActivityItem {
  id: string;
  icon: string;
  tone: "calendar" | "ticket" | "diary" | "friend" | "message";
  text: string;
  timeLabel: string;
  timeValue: number;
  path: string;
}

const emptyHomeData: HomeData = {
  calendarEvents: [],
  tickets: [],
  diaryPosts: [],
  friends: [],
  messages: []
};

const navItems = [
  { label: "首页", path: "/" },
  { label: "演出日历", path: "/calendar" },
  { label: "票根精选", path: "/tickets" },
  { label: "日记精选", path: "/diary" },
  { label: "马达和他的朋友们", path: "/friends" },
  { label: "留言精选", path: "/guestbook" },
  { label: "关于", path: "#about" },
  { label: "后台管理", path: "/admin" }
];

export function HomePage({ onNavigate }: HomePageProps) {
  const [data, setData] = useState<HomeData>(emptyHomeData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadHomeData()
      .then((nextData) => {
        if (active) setData(nextData);
      })
      .catch((error) => console.error(error))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activityItems = useMemo(() => buildActivityItems(data), [data]);

  function go(path: string): void {
    if (path.startsWith("#")) {
      document.querySelector(path)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    onNavigate(path);
  }

  return (
    <main className="home-page">
      <header className="home-nav">
        <button type="button" className="home-brand" onClick={() => go("/")}>
          <img src="/app-icon.png" alt="XYSG" />
          <span>马达的喜剧中心</span>
        </button>
        <nav className="home-nav-links" aria-label="首页导航">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              className={item.path === "/" ? "active" : ""}
              onClick={() => go(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <section className="home-hero">
        <div>
          <p className="eyebrow">Comedy Center</p>
          <h1>脱口秀演员马达</h1>
          <p className="home-hero-copy">
            这里收藏每一次上台、每一张票根、每一段台前台后的文字，也慢慢长出一张和朋友、观众、现场有关的喜剧地图。
          </p>
          <div className="home-hero-actions">
            <button type="button" className="primary-button" onClick={() => go("/calendar")}>看最近演出</button>
            <button type="button" className="ghost-button" onClick={() => go("/tickets")}>进入票根档案</button>
          </div>
        </div>
        <div className="home-hero-note home-glass">
          <p>今日入口</p>
          <strong>最近演出、票根、日记、留言，都放在同一个慢慢更新的首页里。</strong>
          <span>{loading ? "正在整理内容..." : `${data.tickets.length} 张票根 · ${data.calendarEvents.length} 场近期演出`}</span>
        </div>
      </section>

      <section className="home-activity" aria-label="最近发生">
        <SectionHeading eyebrow="Recent Activity" title="最近发生" actionLabel="查看全部演出日历" onAction={() => go("/calendar")} />
        <div className="activity-ticker home-glass" aria-label="播放中的最近动态" aria-live="polite">
          {activityItems.length === 0 ? (
            <p className="muted">{loading ? "正在整理最近更新..." : "最近更新还在整理中。"}</p>
          ) : (
            <div
              className="activity-ticker-track"
              style={{ "--activity-count": activityItems.length } as React.CSSProperties}
            >
              {activityItems.map((item) => (
                <button key={item.id} type="button" className="activity-item" onClick={() => go(item.path)}>
                  <span className={`activity-icon activity-tone-${item.tone}`} aria-hidden="true">{item.icon}</span>
                  <strong>{item.text}</strong>
                  <em>{item.timeLabel}</em>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="home-section home-calendar-section" aria-label="本周演出日历">
        <SectionHeading eyebrow="Weekly Shows" title="本周演出日历" actionLabel="查看全部演出日历" onAction={() => go("/calendar")} />
        <div className="home-calendar-row">
          {data.calendarEvents.slice(0, 5).map((event) => (
            <button key={event.id} type="button" className="home-calendar-card home-card" data-testid="home-calendar-card" onClick={() => go("/calendar")}>
              <span>{formatWeekday(event.eventDate)}</span>
              <strong>{event.title}</strong>
              <em>{event.eventDate} · {event.startTime}</em>
              <p>{event.brand.displayName} · {event.venue.displayName}</p>
              <div className="tag-row">
                <span>{formatLabels[event.format]}</span>
                <span>{roleLabels[event.myRole]}</span>
              </div>
            </button>
          ))}
          {data.calendarEvents.length === 0 ? <p className="muted">这一周暂时还没有公开演出安排。</p> : null}
        </div>
      </section>

      <section className="home-section" aria-label="票根精选">
        <SectionHeading eyebrow="Featured Tickets" title="票根精选" actionLabel="去票根墙" onAction={() => go("/tickets")} />
        <div className="home-ticket-grid">
          {data.tickets.slice(0, 4).map((ticket) => (
            <button key={ticket.id} type="button" className="home-ticket-card" onClick={() => go(`/shows/${ticket.id}`)}>
              <TicketCover show={ticket} />
              <span>{ticket.date ? formatShortDate(ticket.date) : "时间待补充"}</span>
              <strong>{ticket.title}</strong>
              <p>{[ticket.brand?.displayName, ticket.venue?.displayName].filter(Boolean).join(" · ") || "地点待补充"}</p>
            </button>
          ))}
          {data.tickets.length === 0 ? <p className="muted">还没有可以公开展示的票根。</p> : null}
        </div>
      </section>

      <section className="home-section" aria-label="日记精选">
        <SectionHeading eyebrow="From the Diary" title="日记精选" actionLabel="读全部日记" onAction={() => go("/diary")} />
        <div className="home-diary-grid">
          {data.diaryPosts.slice(0, 3).map((post) => (
            <article className="home-diary-card home-card" key={post.id}>
              <span>{formatShortDate(post.publishedAt)}</span>
              <h3>{post.title}</h3>
              <p>{post.excerpt}</p>
              <button type="button" className="text-link" onClick={() => go(`/diary/${post.id}`)}>
                继续读
              </button>
            </article>
          ))}
          {data.diaryPosts.length === 0 ? <p className="muted">日记还在整理中。</p> : null}
        </div>
      </section>

      <section className="home-section" aria-label="马达和他的朋友们">
        <SectionHeading eyebrow="Friends" title="马达和他的朋友们" actionLabel="认识更多朋友" onAction={() => go("/friends")} />
        <div className="home-friends-grid">
          {data.friends.slice(0, 4).map((friend) => (
            <button key={friend.id} type="button" className="home-friend-card" onClick={() => go(`/friends/${friend.id}`)}>
              <FriendPhoto friend={friend} />
              <strong>{friend.displayName}</strong>
              <span>{friend.stageName ?? "Comedy Friend"}</span>
              <p>{friend.relationship.sameShowCount > 0 ? `和马达同台 ${friend.relationship.sameShowCount} 场` : friend.bio}</p>
            </button>
          ))}
          {data.friends.length === 0 ? <p className="muted">朋友资料还在慢慢补全。</p> : null}
        </div>
      </section>

      <section className="home-section" aria-label="留言精选">
        <SectionHeading eyebrow="Guestbook" title="留言精选" actionLabel="去留言板" onAction={() => go("/guestbook")} />
        <div className="home-message-grid">
          {data.messages.slice(0, 5).map((message) => (
            <article className="home-message-card home-card" key={message.id}>
              <p>{message.content}</p>
              <span>{message.nickname} · {formatShortDate(message.createdAt)}</span>
            </article>
          ))}
          {data.messages.length === 0 ? <p className="muted">还在等第一条精选留言。</p> : null}
        </div>
      </section>

      <footer id="about" className="home-footer">
        <div>
          <strong>马达的喜剧中心</strong>
          <p>一个持续更新的个人喜剧档案：演出、票根、日记、朋友和观众留下的话。</p>
        </div>
        <div className="home-footer-links">
          {navItems.filter((item) => item.path !== "#about").map((item) => (
            <button key={item.path} type="button" onClick={() => go(item.path)}>{item.label}</button>
          ))}
        </div>
        <span>© {new Date().getFullYear()} Mada Comedy Center</span>
      </footer>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  actionLabel,
  onAction
}: {
  eyebrow: string;
  title: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="home-section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <button type="button" className="text-link" onClick={onAction}>{actionLabel}</button>
    </div>
  );
}

function TicketCover({ show }: { show: Pick<PublicShowSummary, "coverFileName" | "title" | "brand"> }) {
  if (show.coverFileName) {
    return <img className="home-ticket-cover" src={`/covers/${encodeURIComponent(show.coverFileName)}`} alt={show.title} />;
  }
  return (
    <div className="home-ticket-cover home-ticket-placeholder">
      <span>{show.brand?.displayName ?? "MADA"}</span>
      <strong>{show.title}</strong>
    </div>
  );
}

function FriendPhoto({ friend }: { friend: Pick<PublicFriendSummary, "displayName" | "photoUrl"> }) {
  if (friend.photoUrl) {
    return <img className="home-friend-photo" src={friend.photoUrl} alt={friend.displayName} />;
  }
  return <div className="home-friend-photo home-friend-placeholder"><span>{friend.displayName.slice(0, 2)}</span></div>;
}

async function loadHomeData(): Promise<HomeData> {
  const [calendarEvents, tickets, diaryPosts, friends, messages] = await Promise.all([
    fetchJSON<{ items: PublicCalendarEventSummary[] }>("/api/public/calendar/upcoming?days=30")
      .then((data) => data.items)
      .catch(() => []),
    fetchJSON<{ items: PublicShowSummary[] }>("/api/public/shows")
      .then((data) => data.items)
      .catch(() => []),
    fetchJSON<DiaryPageResult>("/api/public/diary?limit=3&offset=0")
      .then((data) => data.items)
      .catch(() => []),
    fetchJSON<{ items: PublicFriendSummary[] }>("/api/public/friends")
      .then((data) => data.items)
      .catch(() => []),
    fetchJSON<GuestbookPageResult>("/api/public/guestbook?limit=5&offset=0")
      .then((data) => data.items)
      .catch(() => [])
  ]);
  return { calendarEvents, tickets, diaryPosts, friends, messages };
}

function buildActivityItems(data: HomeData): ActivityItem[] {
  const activities: ActivityItem[] = [
    ...data.calendarEvents.slice(0, 2).map((event) => ({
      id: `calendar-${event.id}`,
      icon: "日",
      tone: "calendar" as const,
      text: `马达有一场演出：${event.title}`,
      timeLabel: formatShortDate(event.eventDate),
      timeValue: toTimeValue(`${event.eventDate}T${event.startTime || "00:00"}:00+08:00`),
      path: "/calendar"
    })),
    ...data.tickets.slice(0, 2).map((ticket) => ({
      id: `ticket-${ticket.id}`,
      icon: "票",
      tone: "ticket" as const,
      text: `马达留下了一张票根：${ticket.title}`,
      timeLabel: formatActivityTime(ticket.date),
      timeValue: toTimeValue(ticket.date),
      path: `/shows/${ticket.id}`
    })),
    ...data.diaryPosts.slice(0, 2).map((post) => ({
      id: `diary-${post.id}`,
      icon: "记",
      tone: "diary" as const,
      text: `马达发布了日记：${post.title}`,
      timeLabel: formatActivityTime(post.publishedAt),
      timeValue: toTimeValue(post.publishedAt),
      path: `/diary/${post.id}`
    })),
    ...data.friends.slice(0, 2).map((friend) => ({
      id: `friend-${friend.id}`,
      icon: "友",
      tone: "friend" as const,
      text: `马达整理了朋友资料：${friend.displayName}`,
      timeLabel: formatActivityTime(friend.updatedAt ?? friend.createdAt),
      timeValue: toTimeValue(friend.updatedAt ?? friend.createdAt),
      path: `/friends/${friend.id}`
    })),
    ...data.messages.slice(0, 2).map((message) => ({
      id: `message-${message.id}`,
      icon: "言",
      tone: "message" as const,
      text: `${message.nickname} 留下了一句留言`,
      timeLabel: formatActivityTime(message.createdAt),
      timeValue: toTimeValue(message.createdAt),
      path: "/guestbook"
    }))
  ];
  return activities.sort((a, b) => b.timeValue - a.timeValue).slice(0, 6);
}

function formatWeekday(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(toDate(value));
}

function formatShortDate(value: string | null): string {
  if (!value) return "时间待补充";
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(toDate(value));
}

function formatActivityTime(value: string | null): string {
  if (!value) return "最近";
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "最近";
  const today = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((startOfDay(today).getTime() - startOfDay(date).getTime()) / dayMs);
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays > 1 && diffDays <= 6) return `${diffDays} 天前`;
  return formatShortDate(value);
}

function toDate(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value);
}

function toTimeValue(value: string | null): number {
  if (!value) return 0;
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
