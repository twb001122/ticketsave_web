import React, { useEffect, useState } from "react";
import { fetchJSON } from "./api";
import { SiteNav } from "./site-nav";
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
      <SiteNav onNavigate={onNavigate} activePath="/diary" />

      <section className="diary-hero">
        <p className="eyebrow">Comedy Diary</p>
        <h1>把上台前后那些没讲完的话，慢慢写下来。</h1>
        <p className="hero-copy">台下的思绪、幕后的故事，和不方便在台上讲的那些。</p>
      </section>

      <section className="diary-list" aria-label="日记列表">
        {posts.length === 0 && !loading ? <p className="muted">还没有发布的日记。</p> : null}
        {posts.map((post) => (
          <article className="diary-card home-glass" key={post.id}>
            <p className="eyebrow">{formatDiaryDate(post.publishedAt)}</p>
            <h2>{post.title}</h2>
            <p>{post.excerpt}</p>
            <button type="button" className="text-link" onClick={() => onNavigate(`/diary/${post.id}`)}>
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

  if (!post) {
    return (
      <main className="page diary-detail-page">
        <SiteNav onNavigate={onNavigate} activePath="/diary" />
        <p className="muted">正在翻开日记...</p>
      </main>
    );
  }

  return (
    <main className="page diary-detail-page">
      <SiteNav onNavigate={onNavigate} activePath="/diary" />
      <article className="diary-detail home-glass">
        <button type="button" className="back-link" onClick={() => onNavigate("/diary")}>← 日记</button>
        <p className="eyebrow">{formatDiaryDate(post.publishedAt)}</p>
        <h1>{post.title}</h1>
        {post.excerpt ? <p className="diary-excerpt">{post.excerpt}</p> : null}
        <div className="diary-body">{post.content}</div>
        <button type="button" className="like-button" onClick={likePost}>
          <span className="like-icon">♥</span> {post.likeCount}
        </button>
      </article>

      <section className="diary-comments home-glass" aria-label="日记评论">
        <h2>评论</h2>
        {post.comments.length === 0 ? <p className="muted">还没有评论，留一句吧。</p> : null}
        {post.comments.map((comment) => (
          <article className="comment-card" key={comment.id}>
            <strong>{comment.nickname}</strong>
            <p>{comment.content}</p>
            <span>{formatDiaryDate(comment.createdAt)}</span>
          </article>
        ))}
        <form className="diary-comment-form" onSubmit={submitComment}>
          <input value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder="你的昵称" />
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
