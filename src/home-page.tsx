import React from "react";

interface HomePageProps {
  onNavigate: (path: string) => void;
}

const modules = [
  { title: "票根精选", body: "回看已经发生的现场。", path: "/tickets", enabled: true },
  { title: "本周演出日历", body: "看看接下来在哪上台。", path: "/calendar", enabled: true },
  { title: "留言精选", body: "现场之后，留下那句想说的话。", path: "/guestbook", enabled: true },
  { title: "日记精选", body: "写下台前台后没讲完的话。", path: "/diary", enabled: true },
  { title: "马达和他的朋友们", body: "看看那些一起把现场点亮的人。", path: "/friends", enabled: true }
];

export function HomePage({ onNavigate }: HomePageProps) {
  return (
    <main className="page home-page">
      <header className="glass-nav">
        <button className="brand-lockup" onClick={() => onNavigate("/")}>
          <img src="/app-icon.png" alt="XYSG" />
          <span>马达的喜剧中心</span>
        </button>
        <button className="ghost-button glass-button" onClick={() => onNavigate("/admin")}>后台管理</button>
      </header>

      <section className="home-hero">
        <p className="eyebrow">Comedy Archive</p>
        <h1>马达的喜剧中心</h1>
        <p>不把它做成冷冰冰的数据柜，而是一间能慢慢走进去的喜剧小厅。</p>
      </section>

      <section className="home-updates glass-panel" aria-label="更新动态">
        <div>
          <p className="eyebrow">Updates</p>
          <h2>最近发生</h2>
        </div>
        <p>第一期会从票根和演出日历里展示最近更新。</p>
      </section>

      <section className="module-grid" aria-label="模块入口">
        {modules.map((module) => (
          <button
            key={module.path}
            className="module-card glass-panel"
            onClick={() => onNavigate(module.path)}
          >
            <strong>{module.title}</strong>
            <span>{module.body}</span>
            {!module.enabled ? <em>即将开放</em> : null}
          </button>
        ))}
      </section>
    </main>
  );
}
