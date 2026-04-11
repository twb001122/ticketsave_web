import React, { useEffect, useState } from "react";
import { fetchJSON } from "./api";
import { SiteNav } from "./site-nav";
import type { PublicFriendDetail, PublicFriendSummary } from "../shared/domain";

export function FriendsPage({ onNavigate, friendID }: { onNavigate: (path: string) => void; friendID?: string }) {
  if (friendID) return <FriendDetail friendID={friendID} onNavigate={onNavigate} />;
  return <FriendList onNavigate={onNavigate} />;
}

function FriendList({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [friends, setFriends] = useState<PublicFriendSummary[]>([]);

  useEffect(() => {
    fetchJSON<{ items: PublicFriendSummary[] }>("/api/public/friends").then((data) => setFriends(data.items)).catch(showFriendsError);
  }, []);

  return (
    <main className="page friends-page">
      <SiteNav onNavigate={onNavigate} activePath="/friends" />

      <section className="friends-hero">
        <p className="eyebrow">Friends</p>
        <h1>那些一起把夜晚讲亮的人。</h1>
        <p className="hero-copy">同台过的演员、一起熬夜的朋友，和这条路上的伙伴。</p>
      </section>

      <section className="friends-grid" aria-label="朋友列表">
        {friends.length === 0 ? <p className="muted">还没有朋友资料。</p> : null}
        {friends.map((friend) => (
          <button type="button" className="friend-card home-glass" key={friend.id} onClick={() => onNavigate(`/friends/${friend.id}`)}>
            <FriendPhoto friend={friend} />
            <div className="friend-card-info">
              <h2>{friend.displayName}</h2>
              {friend.quote ? <p className="friend-card-quote">「{friend.quote}」</p> : null}
              <span className="friend-card-stat">同台 {friend.relationship.sameShowCount} 场</span>
            </div>
          </button>
        ))}
      </section>
    </main>
  );
}

function FriendDetail({ friendID, onNavigate }: { friendID: string; onNavigate: (path: string) => void }) {
  const [friend, setFriend] = useState<PublicFriendDetail | null>(null);

  useEffect(() => {
    fetchJSON<PublicFriendDetail>(`/api/public/friends/${friendID}`).then(setFriend).catch(showFriendsError);
  }, [friendID]);

  if (!friend) {
    return (
      <main className="page friend-detail-page">
        <SiteNav onNavigate={onNavigate} activePath="/friends" />
        <p className="muted">正在打开朋友资料...</p>
      </main>
    );
  }

  return (
    <main className="page friend-detail-page">
      <SiteNav onNavigate={onNavigate} activePath="/friends" />
      <section className="friend-detail home-glass">
        <div className="friend-detail-photo">
          <FriendPhoto friend={friend} />
        </div>
        <div className="friend-detail-info">
          <button type="button" className="back-link" onClick={() => onNavigate("/friends")}>← 朋友</button>
          <p className="eyebrow">{friend.stageName ?? "Comedy Friend"}</p>
          <h1>{friend.displayName}</h1>
          {friend.bio ? <p className="friend-bio">{friend.bio}</p> : null}
          {friend.quote ? <blockquote className="friend-quote">{friend.quote}</blockquote> : null}
          <div className="relationship-panel">
            <strong>同台演出 {friend.relationship.sameShowCount} 场</strong>
            <span>{friend.relationship.firstSharedShowDate ? `第一次同台是 ${formatFriendDate(friend.relationship.firstSharedShowDate)}` : "还没有记录到同台演出"}</span>
          </div>
        </div>
      </section>

      {friend.galleryUrls.length > 0 ? (
        <section className="friend-gallery" aria-label="朋友相册">
          <h2>相册</h2>
          <div className="gallery-grid">
            {friend.galleryUrls.map((url, index) => (
              <img key={url} src={`/covers/${encodeURIComponent(url)}`} alt={`${friend.displayName} 相册 ${index + 1}`} />
            ))}
          </div>
        </section>
      ) : null}

      {friend.relationship.sharedShows.length > 0 ? (
        <section className="shared-shows-section" aria-label="共同演出">
          <h2>一起上过的台</h2>
          <div className="shared-shows-list">
            {friend.relationship.sharedShows.map((show) => (
              <article className="shared-show-card" key={show.id}>
                <strong>{show.title}</strong>
                <span>{show.date ? formatFriendDate(show.date) : "时间待补充"}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function FriendPhoto({ friend }: { friend: Pick<PublicFriendSummary, "displayName" | "photoUrl"> }) {
  const src = friend.photoUrl ? `/covers/${encodeURIComponent(friend.photoUrl)}` : null;
  return src ? (
    <img className="friend-photo" src={src} alt={friend.displayName} />
  ) : (
    <div className="friend-photo friend-photo-placeholder"><span>{friend.displayName}</span></div>
  );
}

function formatFriendDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

function showFriendsError(error: unknown): void {
  alert(error instanceof Error ? error.message : "朋友资料加载失败");
}
