import React, { useEffect, useState } from "react";
import { fetchJSON } from "./api";
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
      <header className="topbar glass-nav">
        <button type="button" className="brand-lockup" onClick={() => onNavigate("/")}>
          <img src="/app-icon.png" alt="XYSG" />
          <span>马达和他的朋友们</span>
        </button>
        <button type="button" className="ghost-button glass-button" onClick={() => onNavigate("/tickets")}>去票根墙</button>
      </header>

      <section className="friends-hero">
        <p className="eyebrow">Friends</p>
        <h1>那些一起把夜晚讲亮的人。</h1>
      </section>

      <section className="friends-grid" aria-label="朋友列表">
        {friends.length === 0 ? <p className="muted">还没有朋友资料。</p> : null}
        {friends.map((friend) => (
          <article className="friend-card glass-panel" key={friend.id}>
            <FriendPhoto friend={friend} />
            <div>
              <p className="eyebrow">{friend.stageName ?? "Comedy Friend"}</p>
              <h2>{friend.displayName}</h2>
              <p>{friend.bio}</p>
              <span>同台 {friend.relationship.sameShowCount} 场</span>
              <button type="button" className="ghost-button" onClick={() => onNavigate(`/friends/${friend.id}`)}>看{friend.displayName}</button>
            </div>
          </article>
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

  if (!friend) return <main className="page friends-page"><p className="muted">正在打开朋友资料...</p></main>;

  return (
    <main className="page friends-page">
      <button type="button" className="ghost-button" onClick={() => onNavigate("/friends")}>返回朋友列表</button>
      <section className="friend-detail glass-panel">
        <FriendPhoto friend={friend} />
        <div>
          <p className="eyebrow">{friend.stageName ?? "Comedy Friend"}</p>
          <h1>{friend.displayName}</h1>
          <p>{friend.bio}</p>
          {friend.quote ? <blockquote>{friend.quote}</blockquote> : null}
          <div className="relationship-panel">
            <strong>同台演出 {friend.relationship.sameShowCount} 场</strong>
            <span>{friend.relationship.firstSharedShowDate ? `第一次同台是 ${formatFriendDate(friend.relationship.firstSharedShowDate)}` : "还没有记录到同台演出"}</span>
          </div>
        </div>
      </section>

      {friend.galleryUrls.length > 0 ? (
        <section className="friend-gallery" aria-label="朋友相册">
          {friend.galleryUrls.map((url, index) => (
            <img key={url} src={url} alt={`${friend.displayName} 相册 ${index + 1}`} />
          ))}
        </section>
      ) : null}

      {friend.relationship.sharedShows.length > 0 ? (
        <section className="shared-shows glass-panel">
          <h2>一起上过的台</h2>
          {friend.relationship.sharedShows.map((show) => (
            <article className="message-card" key={show.id}>
              <p>{show.title}</p>
              <span>{show.date ? formatFriendDate(show.date) : "时间待补充"}</span>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}

function FriendPhoto({ friend }: { friend: Pick<PublicFriendSummary, "displayName" | "photoUrl"> }) {
  return friend.photoUrl ? (
    <img className="friend-photo" src={friend.photoUrl} alt={friend.displayName} />
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
