import React, { useEffect, useMemo, useState } from "react";
import { fetchJSON } from "./api";
import { SiteNav, siteNavItems } from "./site-nav";
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
      <SiteNav onNavigate={onNavigate} activePath="/" />

      <section className="home-hero">
        <div>
          <p className="eyebrow">DongSi Brings People Together</p>
          <h1 className="home-hero-title" aria-label="马达的 喜剧路口">
            <span>马达的</span>
            <span className="home-title-accent">喜剧路口</span>
          </h1>
          <p className="home-hero-copy">
            这里会记录一下马达的演出、他的日记、他的观众、他的朋友、他的喜剧、他的夏天和他的东四。
          </p>
        </div>
        <div className="home-hero-entry home-glass" aria-label="今日入口卡片">
          <span className="hero-entry-icon" aria-hidden="true">✦</span>
          <p>TODAY'S ENTRY</p>
          <strong>胡同里的笑声</strong>
          <div className="hero-entry-story">
            <img
              className="hero-entry-cover"
              src="/hero/cover.jpg"
              alt="东四路口的夜色"
            />
            <div>
              <blockquote>“东四的夏夜，蝉鸣和笑声一样响亮。”</blockquote>
              <span>Read 4 min ago</span>
            </div>
          </div>
          <div className="hero-entry-footer">
            <div className="hero-entry-readers" aria-label="18 人读过">
              <img
                src="/hero/avatar1.jpg"
                alt="读者头像一"
              />
              <img
                src="/hero/avatar2.jpg"
                alt="读者头像二"
              />
              <img
                src="/hero/avatar3.jpg"
                alt="读者头像三"
              />
              <img
                src="/hero/avatar4.jpg"
                alt="读者头像四"
              />
              <em>+14</em>
            </div>
            <span className="hero-entry-date">June 15 · Dongsi Road</span>
          </div>
        </div>
      </section>

      <section className="home-activity" aria-label="最近发生">
        <SectionHeading eyebrow="Recent Activity" title="最近发生" actionLabel="查看全部演出日历" onAction={() => go("/calendar")} />
        <ActivityTypewriter items={activityItems} loading={loading} onNavigate={go} />
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
              <span className="home-friend-kicker">{friend.stageName ?? "Comedy Friend"}</span>
              <strong>{friend.displayName}</strong>
              {friend.quote ? <p>「{friend.quote}」</p> : null}
              <em>{friend.relationship.sameShowCount > 0 ? `同台 ${friend.relationship.sameShowCount} 场` : "资料整理中"}</em>
            </button>
          ))}
          {data.friends.length === 0 ? <p className="muted">朋友资料还在慢慢补全。</p> : null}
        </div>
      </section>

      <section className="home-section" aria-label="留言精选">
        <SectionHeading eyebrow="Guestbook" title="留言精选" actionLabel="去留言板" onAction={() => go("/guestbook")} />
        <div className="home-message-list">
          {data.messages.slice(0, 5).map((message) => (
            <article className="home-message-line" key={message.id}>
              <p>{message.content}</p>
              <span>{message.nickname} · {formatShortDate(message.createdAt)}</span>
            </article>
          ))}
          {data.messages.length === 0 ? <p className="muted">还在等第一条精选留言。</p> : null}
        </div>
      </section>

      <footer id="about" className="home-footer">
        <div>
          <strong>马达的喜剧路口</strong>
          <p>这里会记录一下脱口秀演员马达的演出、他的日记、他的观众、他的朋友、他的喜剧、他的夏天和他的东四。</p>
        </div>
        <div className="home-footer-links">
          {siteNavItems.filter((item) => item.path !== "#about").map((item) => (
            <button key={item.path} type="button" onClick={() => go(item.path)}>{item.label}</button>
          ))}
        </div>
        <span>© {new Date().getFullYear()} Mada Comedy Crossroads</span>
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

function ActivityTypewriter({
  items,
  loading,
  onNavigate
}: {
  items: ActivityItem[];
  loading: boolean;
  onNavigate: (path: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [phase, setPhase] = useState<"blink" | "typing" | "hold" | "exit">("blink");
  const activeItem = items[activeIndex % Math.max(items.length, 1)];
  const fullText = activeItem?.text ?? "";

  useEffect(() => {
    setActiveIndex(0);
    setTypedText("");
    setPhase("blink");
  }, [items.length]);

  useEffect(() => {
    if (!activeItem) return;

    if (phase === "blink") {
      const timer = window.setTimeout(() => setPhase("typing"), 900);
      return () => window.clearTimeout(timer);
    }

    if (phase === "typing") {
      if (typedText.length < fullText.length) {
        const timer = window.setTimeout(() => setTypedText(fullText.slice(0, typedText.length + 1)), 42);
        return () => window.clearTimeout(timer);
      }
      const timer = window.setTimeout(() => setPhase("hold"), 700);
      return () => window.clearTimeout(timer);
    }

    if (phase === "hold") {
      const timer = window.setTimeout(() => setPhase("exit"), 1100);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setTypedText("");
      setActiveIndex((current) => (current + 1) % items.length);
      setPhase("blink");
    }, 320);
    return () => window.clearTimeout(timer);
  }, [activeItem, fullText, items.length, phase, typedText]);

  if (!activeItem) {
    return (
      <div className="activity-typewriter home-glass" aria-label="最近发生输入动画" aria-live="polite">
        <p className="muted">{loading ? "正在整理最近更新..." : "最近更新还在整理中。"}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`activity-typewriter home-glass is-${phase}`}
      aria-label="最近发生输入动画"
      aria-live="polite"
      onClick={() => onNavigate(activeItem.path)}
    >
      <span className={`activity-icon activity-tone-${activeItem.tone}`} aria-hidden="true">{activeItem.icon}</span>
      <span className="activity-typewriter-copy">
        <strong>{typedText}</strong>
        <i aria-hidden="true" />
      </span>
      <em>{activeItem.timeLabel}</em>
    </button>
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
    return <img className="home-friend-photo" src={`/covers/${encodeURIComponent(friend.photoUrl)}`} alt={friend.displayName} />;
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
      text: `马达添加了一个演出：${event.title}`,
      timeLabel: formatShortDate(event.eventDate),
      timeValue: toTimeValue(`${event.eventDate}T${event.startTime || "00:00"}:00+08:00`),
      path: "/calendar"
    })),
    ...data.tickets.slice(0, 2).map((ticket) => ({
      id: `ticket-${ticket.id}`,
      icon: "票",
      tone: "ticket" as const,
      text: `马达更新了一个票根：${ticket.title}`,
      timeLabel: formatActivityTime(ticket.date),
      timeValue: toTimeValue(ticket.date),
      path: `/shows/${ticket.id}`
    })),
    ...data.diaryPosts.slice(0, 2).map((post) => ({
      id: `diary-${post.id}`,
      icon: "记",
      tone: "diary" as const,
      text: `马达发布了一篇日记：${post.title}`,
      timeLabel: formatActivityTime(post.publishedAt),
      timeValue: toTimeValue(post.publishedAt),
      path: `/diary/${post.id}`
    })),
    ...data.friends.slice(0, 2).map((friend) => ({
      id: `friend-${friend.id}`,
      icon: "友",
      tone: "friend" as const,
      text: `马达添加了一个朋友：${friend.displayName}`,
      timeLabel: formatActivityTime(friend.updatedAt ?? friend.createdAt),
      timeValue: toTimeValue(friend.updatedAt ?? friend.createdAt),
      path: `/friends/${friend.id}`
    })),
    ...data.messages.slice(0, 2).map((message) => ({
      id: `message-${message.id}`,
      icon: "言",
      tone: "message" as const,
      text: `${message.nickname} 留下了一条留言`,
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
