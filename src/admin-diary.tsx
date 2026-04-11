import React, { useEffect, useMemo, useState } from "react";
import { fetchJSON } from "./api";
import type { DiaryPostRecord, DiaryPostStatus } from "../shared/domain";

const emptyForm = {
  title: "",
  excerpt: "",
  content: "",
  status: "draft" as DiaryPostStatus,
  publishedAt: ""
};

export function DiaryAdmin() {
  const [posts, setPosts] = useState<DiaryPostRecord[]>([]);
  const [editing, setEditing] = useState<DiaryPostRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const submitLabel = useMemo(() => editing ? "保存日记" : "发布日记", [editing]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const data = await fetchJSON<{ items: DiaryPostRecord[] }>("/api/admin/diary");
    setPosts(data.items);
  }

  function startEdit(post: DiaryPostRecord | null) {
    setEditing(post);
    setForm(post ? {
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      status: post.status,
      publishedAt: toDatetimeLocal(post.publishedAt)
    } : emptyForm);
    setShowModal(true);
  }

  function closeModal() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(false);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = editing ? `/api/admin/diary/${editing.id}` : "/api/admin/diary";
    const method = editing ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, publishedAt: fromDatetimeLocal(form.publishedAt) })
    });
    if (!response.ok) return alert((await response.json()).error ?? "保存失败");
    const saved = await response.json() as DiaryPostRecord;
    setPosts((current) => editing ? current.map((post) => post.id === saved.id ? saved : post) : [saved, ...current]);
    closeModal();
  }

  async function deletePost(id: string) {
    const response = await fetch(`/api/admin/diary/${id}`, { method: "DELETE" });
    if (!response.ok) return alert((await response.json()).error ?? "删除失败");
    setPosts((current) => current.filter((post) => post.id !== id));
  }

  return (
    <section className="diary-admin">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>日记管理</h2>
        <button type="button" className="primary-button" onClick={() => startEdit(null)}>新增日记</button>
      </div>
      {posts.length === 0 ? <p className="muted">还没有日记。</p> : null}
      {posts.map((post) => (
        <div className="admin-row diary-row" key={post.id}>
          <div>
            <strong><span>{post.title}</span> · {post.status === "published" ? "已发布" : "草稿"}</strong>
            <span>{formatAdminDiaryDate(post.publishedAt)} · {post.likeCount} 次喜欢</span>
            <p>{post.excerpt}</p>
          </div>
          <button type="button" onClick={() => startEdit(post)}>编辑</button>
          <button type="button" className="danger" onClick={() => deletePost(post.id)}>删除</button>
        </div>
      ))}
      {showModal ? (
        <div className="admin-modal-backdrop" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editing ? "编辑日记" : "新增日记"}</h2>
              <button type="button" className="admin-modal-close" onClick={closeModal}>×</button>
            </div>
            <form style={{ display: "grid", gap: "12px" }} onSubmit={save}>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="文章标题" />
              <input value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} placeholder="列表摘要" />
              <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="正文" />
              <label className="field-label">
                发布状态
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DiaryPostStatus })} aria-label="发布状态">
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                </select>
              </label>
              <label className="field-label">
                发布时间
                <input type="datetime-local" value={form.publishedAt} onChange={(event) => setForm({ ...form, publishedAt: event.target.value })} />
              </label>
              <button type="submit" className="primary-button">{submitLabel}</button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 16);
}

function fromDatetimeLocal(value: string): string | null {
  return value ? `${value}:00.000` : null;
}

function formatAdminDiaryDate(value: string | null): string {
  return value ? value.slice(0, 10) : "未发布";
}
