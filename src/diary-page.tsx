import React, { useEffect, useState } from "react";
import { fetchJSON } from "./api";
import type { DiaryPageResult, PublicDiaryComment, PublicDiaryPostDetail, PublicDiaryPostSummary } from "../shared/domain";

const pageSize = 6;

export function DiaryPage({ onNavigate, postID }: { onNavigate: (path: string) => void; postID?: string }) {
  if (postID) return <DiaryDetail postID={postID} onNavigate={onNavigate} />;
  return <DiaryList onNavigate={onNavigate} />;
}

function DiaryList({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [posts, setPosts] = useState<PublicDiaryPostSummary[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadPosts(0);
  }, []);

  async function loadPosts(offset: number) {
    setLoading(true);
    try {
      const data = await fetchJSON<DiaryPageResult>(`/api/public/diary?limit=${pageSize}&offset=${offset}`);
      setPosts((current) => offset === 0 ? data.items : [...current, ...data.items]);
      setNextOffset(data.nextOffset);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page diary-page">
      <header className="topbar glass-nav">
        <button type="button" className="brand-lockup" onClick={() => onNavigate("/")}>
          <img src="/app-icon.png" alt="XYSG" />
          <span>喜剧日记</span>
        </button>
        <button type="button" className="ghost-button glass-button" onClick={() => onNavigate("/guestbook")}>
          去留言板
        </button>
      </header>

      <section className="diary-hero">
        <p className="eyebrow">Comedy Diary</p>
        <h1>把上台前后那些没讲完的话，慢慢写下来。</h1>
      </section>

      <section className="diary-list" aria-label="日记列表">
        {posts.length === 0 && !loading ? <p className="muted">还没有发布的日记。</p> : null}
        {posts.map((post) => (
          <article className="diary-card glass-panel" key={post.id}>
            <p className="eyebrow">{formatDiaryDate(post.publishedAt)}</p>
            <h2>{post.title}</h2>
            <p>{post.excerpt}</p>
            <button type="button" className="ghost-button" onClick={() => onNavigate(`/diary/${post.id}`)}>
              读 {post.title}
            </button>
            <span>{post.likeCount} 次喜欢</span>
          </article>
        ))}
        {nextOffset !== null ? (
          <button type="button" className="ghost-button" onClick={() => loadPosts(nextOffset)} disabled={loading}>
            {loading ? "加载中..." : "加载更多"}
          </button>
        ) : null}
      </section>
    </main>
  );
}

function DiaryDetail({ postID, onNavigate }: { postID: string; onNavigate: (path: string) => void }) {
  const [post, setPost] = useState<PublicDiaryPostDetail | null>(null);
  const [form, setForm] = useState({ nickname: "", content: "" });

  useEffect(() => {
    fetchJSON<PublicDiaryPostDetail>(`/api/public/diary/${postID}`).then(setPost).catch(showDiaryError);
  }, [postID]);

  async function likePost() {
    const data = await fetchJSON<PublicDiaryPostDetail>(`/api/public/diary/${postID}/like`, { method: "POST" });
    setPost(data);
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/public/diary/${postID}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!response.ok) return alert((await response.json()).error ?? "评论失败");
    const comment = await response.json() as PublicDiaryComment;
    setPost((current) => current ? { ...current, comments: [...current.comments, comment] } : current);
    setForm({ nickname: "", content: "" });
  }

  if (!post) return <main className="page diary-page"><p className="muted">正在翻开日记...</p></main>;

  return (
    <main className="page diary-page">
      <button type="button" className="ghost-button" onClick={() => onNavigate("/diary")}>返回日记列表</button>
      <article className="diary-detail glass-panel">
        <p className="eyebrow">{formatDiaryDate(post.publishedAt)}</p>
        <h1>{post.title}</h1>
        <p className="diary-excerpt">{post.excerpt}</p>
        <p>{post.content}</p>
        <button type="button" className="primary-button" onClick={likePost}>喜欢 {post.likeCount}</button>
      </article>

      <section className="diary-comments glass-panel" aria-label="日记评论">
        <h2>评论</h2>
        {post.comments.length === 0 ? <p className="muted">还没有评论。</p> : null}
        {post.comments.map((comment) => (
          <article className="message-card" key={comment.id}>
            <p>{comment.content}</p>
            <span>{comment.nickname} · {formatDiaryDate(comment.createdAt)}</span>
          </article>
        ))}
        <form className="diary-comment-form" onSubmit={submitComment}>
          <input value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder="昵称" />
          <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="想说的话" />
          <button type="submit" className="primary-button">留下评论</button>
        </form>
      </section>
    </main>
  );
}

function formatDiaryDate(value: string | null): string {
  if (!value) return "未发布";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

function showDiaryError(error: unknown): void {
  alert(error instanceof Error ? error.message : "日记加载失败");
}
