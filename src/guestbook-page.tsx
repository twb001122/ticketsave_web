import React, { useEffect, useState } from "react";
import { fetchJSON } from "./api";
import type { GuestbookPageResult, PublicGuestbookMessage } from "../shared/domain";

const pageSize = 8;

export function GuestbookPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [messages, setMessages] = useState<PublicGuestbookMessage[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nickname: "", email: "", content: "" });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void loadMessages(0);
  }, []);

  async function loadMessages(offset: number) {
    setLoading(true);
    try {
      const data = await fetchJSON<GuestbookPageResult>(`/api/public/guestbook?limit=${pageSize}&offset=${offset}`);
      setMessages((current) => offset === 0 ? data.items : [...current, ...data.items]);
      setNextOffset(data.nextOffset);
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/public/guestbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!response.ok) return alert((await response.json()).error ?? "留言失败");
    setForm({ nickname: "", email: "", content: "" });
    setNotice("留言已收到，审核后会出现在这里。");
  }

  return (
    <main className="page guestbook-page">
      <header className="topbar glass-nav">
        <button type="button" className="brand-lockup" onClick={() => onNavigate("/")}>
          <img src="/app-icon.png" alt="XYSG" />
          <span>留言板</span>
        </button>
        <button type="button" className="ghost-button glass-button" onClick={() => onNavigate("/tickets")}>
          去票根墙
        </button>
      </header>

      <section className="guestbook-hero">
        <p className="eyebrow">Guestbook</p>
        <h1>把笑声后面的那句话，也留在这里。</h1>
      </section>

      <section className="guestbook-layout">
        <form className="guestbook-form glass-panel" onSubmit={submit}>
          <h2>留一句话</h2>
          <input value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder="昵称" />
          <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="邮箱（选填）" />
          <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="想留下些什么" />
          <button className="primary-button">留下留言</button>
          {notice ? <p className="muted">{notice}</p> : null}
        </form>

        <section className="guestbook-list glass-panel" aria-label="留言列表">
          <h2>大家留下的声音</h2>
          {messages.length === 0 && !loading ? <p className="muted">还在等第一条通过审核的留言。</p> : null}
          {messages.map((message) => (
            <article className="message-card" key={message.id}>
              <p>{message.content}</p>
              <span>{message.nickname} · {formatGuestbookDate(message.createdAt)}</span>
            </article>
          ))}
          {nextOffset !== null ? (
            <button type="button" className="ghost-button" onClick={() => loadMessages(nextOffset)} disabled={loading}>
              {loading ? "加载中..." : "加载更多"}
            </button>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function formatGuestbookDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}
