import React, { useEffect, useState } from "react";
import { fetchJSON } from "./api";
import type { FriendRecord, PerformerRecord } from "../shared/domain";

const emptyForm = {
  performerID: "",
  bio: "",
  quote: "",
  photoUrl: "",
  galleryText: ""
};

export function FriendsAdmin({ performers }: { performers: PerformerRecord[] }) {
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [editing, setEditing] = useState<FriendRecord | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const data = await fetchJSON<{ items: FriendRecord[] }>("/api/admin/friends");
    setFriends(data.items);
  }

  function startEdit(friend: FriendRecord | null) {
    setEditing(friend);
    setForm(friend ? {
      performerID: friend.performerID,
      bio: friend.bio,
      quote: friend.quote,
      photoUrl: friend.photoUrl ?? "",
      galleryText: friend.galleryUrls.join("\n")
    } : emptyForm);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = editing ? `/api/admin/friends/${editing.id}` : "/api/admin/friends";
    const response = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        performerID: form.performerID,
        bio: form.bio,
        quote: form.quote,
        photoUrl: form.photoUrl,
        galleryUrls: form.galleryText.split("\n").map((value) => value.trim()).filter(Boolean).slice(0, 5)
      })
    });
    if (!response.ok) return alert((await response.json()).error ?? "保存失败");
    const saved = await response.json() as FriendRecord;
    setFriends((current) => editing ? current.map((friend) => friend.id === saved.id ? saved : friend) : [saved, ...current]);
    startEdit(null);
  }

  async function deleteFriend(id: string) {
    const response = await fetch(`/api/admin/friends/${id}`, { method: "DELETE" });
    if (!response.ok) return alert((await response.json()).error ?? "删除失败");
    setFriends((current) => current.filter((friend) => friend.id !== id));
  }

  return (
    <section className="admin-grid friends-admin">
      <form className="editor-panel" onSubmit={save}>
        <h2>{editing ? "编辑朋友" : "新增朋友"}</h2>
        <label className="field-label">
          关联演员
          <select value={form.performerID} onChange={(event) => setForm({ ...form, performerID: event.target.value })} aria-label="关联演员">
            <option value="">选择演员实体</option>
            {performers.map((performer) => <option key={performer.id} value={performer.id}>{performer.displayName}</option>)}
          </select>
        </label>
        <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="简介" />
        <textarea value={form.quote} onChange={(event) => setForm({ ...form, quote: event.target.value })} placeholder="他的话" />
        <input value={form.photoUrl} onChange={(event) => setForm({ ...form, photoUrl: event.target.value })} placeholder="主照片 URL" />
        <textarea value={form.galleryText} onChange={(event) => setForm({ ...form, galleryText: event.target.value })} placeholder="相册 URL，每行一张，最多 5 张" />
        <button type="submit" className="primary-button">保存朋友</button>
        {editing ? <button type="button" className="ghost-button" onClick={() => startEdit(null)}>取消编辑</button> : null}
      </form>

      <section className="table-panel">
        <h2>朋友资料</h2>
        {friends.length === 0 ? <p className="muted">还没有朋友资料。</p> : null}
        {friends.map((friend) => {
          const performer = performers.find((item) => item.id === friend.performerID);
          return (
            <div className="admin-row friend-row" key={friend.id}>
              <div>
                <strong>{performer?.displayName ?? "未关联演员"}</strong>
                <span>{friend.galleryUrls.length} 张相册图</span>
                <p>{friend.bio}</p>
              </div>
              <button type="button" onClick={() => startEdit(friend)}>编辑</button>
              <button type="button" className="danger" onClick={() => deleteFriend(friend.id)}>删除</button>
            </div>
          );
        })}
      </section>
    </section>
  );
}
