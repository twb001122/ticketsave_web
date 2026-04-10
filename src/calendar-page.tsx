import React, { useEffect, useMemo, useState } from "react";
import { fetchJSON } from "./api";
import { formatLabels, roleLabels, typeLabels, type PublicCalendarEventSummary } from "../shared/domain";

type ViewMode = "month" | "list";

export function CalendarPage({
  onNavigate,
  initialMonth
}: {
  onNavigate: (path: string) => void;
  initialMonth?: string;
}) {
  const [month, setMonth] = useState(initialMonth ?? new Date().toISOString().slice(0, 7));
  const [mode, setMode] = useState<ViewMode>("month");
  const [events, setEvents] = useState<PublicCalendarEventSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetchJSON<{ items: PublicCalendarEventSummary[] }>(`/api/public/calendar?month=${month}`)
      .then((data) => setEvents(data.items))
      .catch((error) => console.error(error));
  }, [month]);

  useEffect(() => {
    if (selectedDate || events.length === 0) return;
    setSelectedDate(events[0].eventDate);
  }, [events, selectedDate]);

  const days = useMemo(() => monthGrid(month), [month]);
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];

  return (
    <main className="page calendar-page">
      <header className="topbar glass-nav">
        <button type="button" className="brand-lockup" onClick={() => onNavigate("/")}>
          <img src="/app-icon.png" alt="XYSG" />
          <span>演出日历</span>
        </button>
        <button type="button" className="ghost-button glass-button" onClick={() => onNavigate("/tickets")}>
          去票根墙
        </button>
      </header>

      <section className="calendar-hero">
        <p className="eyebrow">Live Calendar</p>
        <h1>这个月，马达会出现在哪些现场。</h1>
      </section>

      <section className="calendar-toolbar" aria-label="切换月份和视图">
        <button type="button" className="chip" onClick={() => setMonth(shiftMonth(month, -1))}>
          上个月
        </button>
        <strong>{formatMonthLabel(month)}</strong>
        <button type="button" className="chip" onClick={() => setMonth(shiftMonth(month, 1))}>
          下个月
        </button>
        <button type="button" className={mode === "month" ? "chip active" : "chip"} onClick={() => setMode("month")}>
          月历
        </button>
        <button type="button" className={mode === "list" ? "chip active" : "chip"} onClick={() => setMode("list")}>
          列表
        </button>
      </section>

      {mode === "month" ? (
        <section className="calendar-shell glass-panel">
          <div className="calendar-grid" aria-label={`${formatMonthLabel(month)}月历`}>
            {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
              <strong key={day}>{day}</strong>
            ))}
            {days.map((day, index) => {
              const dateEvents = day ? eventsByDate.get(day) ?? [] : [];
              return (
                <button
                  key={day ?? `blank-${index}`}
                  type="button"
                  className="calendar-day"
                  onClick={() => day && setSelectedDate(day)}
                  disabled={!day}
                >
                  {day ? <span>{Number(day.slice(-2))}</span> : null}
                  {dateEvents.length > 0 ? <em>{dateEvents.length} 场</em> : null}
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
        <section className="calendar-list glass-panel">
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
    <article className="calendar-event-card">
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
