import React, { useEffect, useState } from "react";
import { fetchJSON } from "./api";
import { compressImage } from "./image-compress";
import type { FriendRecord, PerformerRecord } from "../shared/domain";

const emptyForm = {
  performerID: "",
  bio: "",
  quote: ""
};

export function FriendsAdmin({ performers }: { performers: PerformerRecord[] }) {
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [editing, setEditing] = useState<FriendRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const data = await fetchJSON<{ items: FriendRecord[] }>("/api/admin/friends");
    setFriends(data.items);
  }

  function startEdit(friend: FriendRecord | null) {
    setEditing(friend);
    setPhotoFile(null);
    setGalleryFiles([]);
    setForm(friend ? {
      performerID: friend.performerID,
      bio: friend.bio,
      quote: friend.quote
    } : emptyForm);
    setShowModal(true);
  }

  function closeModal() {
    setEditing(null);
    setPhotoFile(null);
    setGalleryFiles([]);
    setForm(emptyForm);
    setShowModal(false);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = new FormData();
      data.set("performerID", form.performerID);
      data.set("bio", form.bio);
      data.set("quote", form.quote);
      if (photoFile) {
        const compressed = await compressImage(photoFile);
        data.set("photo", compressed, "photo.jpg");
      }
      for (const file of galleryFiles) {
        const compressed = await compressImage(file);
        data.append("gallery", compressed, `gallery-${galleryFiles.indexOf(file)}.jpg`);
      }
      const url = editing ? `/api/admin/friends/${editing.id}` : "/api/admin/friends";
      const response = await fetch(url, { method: editing ? "PUT" : "POST", body: data });
      if (!response.ok) return alert((await response.json()).error ?? "保存失败");
      const saved = await response.json() as FriendRecord;
      setFriends((current) => editing ? current.map((friend) => friend.id === saved.id ? saved : friend) : [saved, ...current]);
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  async function deleteFriend(id: string) {
    const response = await fetch(`/api/admin/friends/${id}`, { method: "DELETE" });
    if (!response.ok) return alert((await response.json()).error ?? "删除失败");
    setFriends((current) => current.filter((friend) => friend.id !== id));
  }

  return (
    <section className="friends-admin">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>朋友资料</h2>
        <button type="button" className="primary-button" onClick={() => startEdit(null)}>新增朋友</button>
      </div>
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
      {showModal ? (
        <div className="admin-modal-backdrop" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editing ? "编辑朋友" : "新增朋友"}</h2>
              <button type="button" className="admin-modal-close" onClick={closeModal}>×</button>
            </div>
            <form style={{ display: "grid", gap: "12px" }} onSubmit={save}>
              <label className="field-label">
                关联演员
                <select value={form.performerID} onChange={(event) => setForm({ ...form, performerID: event.target.value })} aria-label="关联演员">
                  <option value="">选择演员实体</option>
                  {performers.map((performer) => <option key={performer.id} value={performer.id}>{performer.displayName}</option>)}
                </select>
              </label>
              <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="简介" />
              <textarea value={form.quote} onChange={(event) => setForm({ ...form, quote: event.target.value })} placeholder="他的话" />
              <label className="field-label">
                主照片
                {editing?.photoUrl ? <img className="current-photo" src={`/covers/${encodeURIComponent(editing.photoUrl)}`} alt="当前主照片" /> : null}
                <input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
              </label>
              <label className="field-label">
                相册图片（最多 5 张）
                {editing?.galleryUrls.length ? (
                  <div className="current-gallery">
                    {editing.galleryUrls.map((url, i) => <img key={url} className="current-gallery-thumb" src={`/covers/${encodeURIComponent(url)}`} alt={`相册 ${i + 1}`} />)}
                  </div>
                ) : null}
                <input type="file" accept="image/*" multiple onChange={(event) => setGalleryFiles(Array.from(event.target.files ?? []).slice(0, 5))} />
              </label>
              <button type="submit" className="primary-button" disabled={saving}>{saving ? "提交中..." : "保存朋友"}</button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
