import React from "react";

export function ComingSoonPage({ title, onNavigate }: { title: string; onNavigate: (path: string) => void }) {
  return (
    <main className="page coming-soon-page">
      <button className="ghost-button" onClick={() => onNavigate("/")}>返回首页</button>
      <section className="glass-panel coming-soon-panel">
        <p className="eyebrow">Coming Soon</p>
        <h1>{title}</h1>
        <p>这个房间已经留好了，后续阶段会开放。</p>
      </section>
    </main>
  );
}
