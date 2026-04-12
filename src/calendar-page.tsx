import React, { useEffect, useMemo, useState } from "react";
import { fetchJSON } from "./api";
import { SiteNav } from "./site-nav";
import { formatLabels, roleLabels, showTypes, typeLabels, type PublicCalendarEventSummary, type ShowType } from "../shared/domain";

type ViewMode = "month" | "list";

export function CalendarPage({
  onNavigate,
  initialMonth
}: {
  onNavigate: (path: string) => void;
  initialMonth?: string;
}) {
  const [month, setMonth] = useState(initialMonth ?? currentMonthKey());
  const [mode, setMode] = useState<ViewMode>("month");
  const [events, setEvents] = useState<PublicCalendarEventSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => todayKey());

  useEffect(() => {
    let active = true;
    fetchJSON<{ items: PublicCalendarEventSummary[] }>(`/api/public/calendar?month=${month}`)
      .then((data) => {
        if (active) setEvents(data.items);
      })
      .catch((error) => console.error(error));
    return () => {
      active = false;
    };
  }, [month]);

  function changeMonth(delta: number): void {
    setSelectedDate(null);
    setEvents([]);
    setMonth((currentMonth) => shiftMonth(currentMonth, delta));
  }

  const days = useMemo(() => monthGrid(month), [month]);
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];

  useEffect(() => {
    if (events.length === 0) {
      setSelectedDate(null);
      return;
    }
    if (selectedDate && eventsByDate.has(selectedDate)) return;
    setSelectedDate(events[0].eventDate);
  }, [events, eventsByDate, selectedDate]);

  return (
    <main className="page calendar-page">
      <SiteNav onNavigate={onNavigate} activePath="/calendar" />

      <section className="calendar-hero">
        <div className="calendar-hero-text">
          <p className="eyebrow">Live Calendar</p>
          <h1>这个月，马达会出现在哪些现场。</h1>
          <p className="hero-copy">追踪每场演出的时间、地点和阵容，不错过每一次笑声。</p>
        </div>
        <div className="calendar-hero-actions">
          <button type="button" className="chip" onClick={() => changeMonth(-1)}>
            ← 上个月
          </button>
          <strong className="calendar-month-label">{formatMonthLabel(month)}</strong>
          <button type="button" className="chip" onClick={() => changeMonth(1)}>
          下个月 →
          </button>
          <div className="calendar-view-toggle">
            <button type="button" className={mode === "month" ? "chip active" : "chip"} onClick={() => setMode("month")}>
              月历
            </button>
            <button type="button" className={mode === "list" ? "chip active" : "chip"} onClick={() => setMode("list")}>
              列表
            </button>
          </div>
        </div>
      </section>

      {mode === "month" ? (
        <section className="calendar-shell home-glass">
          <div className="calendar-grid" aria-label={`${formatMonthLabel(month)}月历`}>
            {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
              <span className="calendar-weekday" key={day}>{day}</span>
            ))}
            {days.map((day, index) => {
              const dateEvents = day ? eventsByDate.get(day) ?? [] : [];
              const isSelected = day === selectedDate;
              const uniqueTypes = [...new Set(dateEvents.map((e) => e.showType))];
              const eventCount = dateEvents.length;
              return (
                <button
                  key={day ?? `blank-${index}`}
                  type="button"
                  className={`calendar-day${isSelected ? " is-selected" : ""}${eventCount > 0 ? " has-events" : ""}`}
                  onClick={() => day && setSelectedDate(day)}
                  disabled={!day}
                >
                  {day ? <span className="calendar-day-number">{Number(day.slice(-2))}</span> : null}
                  {eventCount > 0 ? <span className="calendar-day-count">{eventCount}</span> : null}
                  {uniqueTypes.length > 0 ? (
                    <span className="calendar-dots">
                      {uniqueTypes.map((t) => <em key={t} className={`calendar-dot dot-${t}`} title={typeLabels[t]} />)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="day-detail">
            <h2>{selectedDate ? `${selectedDate} 的演出` : "选择一个有演出的日子"}</h2>
            {selectedEvents.map((event) => (
              <CalendarEventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : (
        <section className="calendar-list home-glass">
          <h2>{formatMonthLabel(month)}演出列表</h2>
          {events.map((event) => (
            <CalendarEventCard key={event.id} event={event} />
          ))}
        </section>
      )}
    </main>
  );
}

function CalendarEventCard({ event }: { event: PublicCalendarEventSummary }) {
  return (
    <article className={`calendar-event-card card-type-${event.showType}`}>
      <p className="eyebrow">
        {event.eventDate} {event.startTime}
      </p>
      <h3>{event.title}</h3>
      <p>
        {event.brand.displayName} · {event.venue.displayName}
      </p>
      <div className="tag-row">
        <span>{formatLabels[event.format]}</span>
        <span>{roleLabels[event.myRole]}</span>
        <span>{typeLabels[event.showType]}</span>
      </div>
    </article>
  );
}

function monthGrid(month: string): (string | null)[] {
  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(year, monthIndex - 1, 1);
  const totalDays = new Date(year, monthIndex, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function groupEventsByDate(events: PublicCalendarEventSummary[]): Map<string, PublicCalendarEventSummary[]> {
  const byDate = new Map<string, PublicCalendarEventSummary[]>();
  for (const event of events) {
    byDate.set(event.eventDate, [...(byDate.get(event.eventDate) ?? []), event]);
  }
  return byDate;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return `${year} 年 ${monthIndex} 月`;
}

export function currentMonthKey(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? String(date.getFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function todayKey(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
}
