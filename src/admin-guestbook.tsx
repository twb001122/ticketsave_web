import React, { useEffect, useState } from "react";
import { fetchJSON } from "./api";
import type { GuestbookMessageRecord, GuestbookStatus } from "../shared/domain";

const statusLabels: Record<GuestbookStatus, string> = {
  pending: "待审核",
  approved: "已通过",
  hidden: "已隐藏"
};

export function GuestbookAdmin() {
  const [messages, setMessages] = useState<GuestbookMessageRecord[]>([]);
  const [pendingID, setPendingID] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const data = await fetchJSON<{ items: GuestbookMessageRecord[] }>("/api/admin/guestbook");
    setMessages(data.items);
  }

  async function setStatus(id: string, status: GuestbookStatus) {
    setPendingID(id);
    const response = await fetch(`/api/admin/guestbook/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      setPendingID(null);
      return alert((await response.json()).error ?? "更新失败");
    }
    const updated = await response.json() as GuestbookMessageRecord;
    setMessages((current) => current.map((message) => message.id === id ? updated : message));
    setPendingID(null);
  }

  async function deleteMessage(id: string) {
    setPendingID(id);
    const response = await fetch(`/api/admin/guestbook/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setPendingID(null);
      return alert((await response.json()).error ?? "删除失败");
    }
    setMessages((current) => current.filter((message) => message.id !== id));
    setPendingID(null);
  }

  return (
    <section className="table-panel guestbook-admin">
      <h2>留言管理</h2>
      {messages.length === 0 ? <p className="muted">暂时没有留言。</p> : null}
      {messages.map((message) => (
        <div className="admin-row guestbook-row" key={message.id}>
          <div>
            <strong>
              {message.nickname} · <span className={`guestbook-status ${message.status}`}>{statusLabels[message.status]}</span>
            </strong>
            <span>{message.email ?? "未留邮箱"}</span>
            <p>{message.content}</p>
            {pendingID === message.id ? <em>正在更新...</em> : null}
          </div>
          <button
            type="button"
            className={message.status === "approved" ? "approved-action" : ""}
            onClick={() => setStatus(message.id, "approved")}
            disabled={pendingID === message.id || message.status === "approved"}
          >
            {message.status === "approved" ? "已通过" : "通过"}
          </button>
          <button type="button" onClick={() => setStatus(message.id, "hidden")} disabled={pendingID === message.id || message.status === "hidden"}>隐藏</button>
          <button type="button" className="danger" onClick={() => deleteMessage(message.id)} disabled={pendingID === message.id}>删除</button>
        </div>
      ))}
    </section>
  );
}
