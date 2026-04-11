import React from "react";

export type SiteNavActivePath =
  | "/"
  | "/calendar"
  | "/tickets"
  | "/diary"
  | "/friends"
  | "/guestbook"
  | "/admin";

export const siteNavItems = [
  { label: "首页", path: "/" },
  { label: "演出日历", path: "/calendar" },
  { label: "票根精选", path: "/tickets" },
  { label: "日记精选", path: "/diary" },
  { label: "马达和他的朋友们", path: "/friends" },
  { label: "留言精选", path: "/guestbook" },
  { label: "关于", path: "#about" },
  { label: "后台管理", path: "/admin" }
] as const;

export function SiteNav({
  onNavigate,
  activePath = activePathFromLocation()
}: {
  onNavigate: (path: string) => void;
  activePath?: SiteNavActivePath;
}) {
  function go(path: string): void {
    if (path.startsWith("#")) {
      document.querySelector(path)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    onNavigate(path);
  }

  return (
    <header className="home-nav">
      <button type="button" className="home-brand" onClick={() => go("/")}>
        <img src="/app-icon.png" alt="XYSG" />
        <span>马达的喜剧路口</span>
      </button>
      <nav className="home-nav-links" aria-label="全站导航">
        {siteNavItems.map((item) => {
          const isActive = item.path === activePath;
          return (
            <button
              key={item.path}
              type="button"
              className={isActive ? "active" : ""}
              aria-current={isActive ? "page" : undefined}
              onClick={() => go(item.path)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

export function activePathFromLocation(pathname = window.location.pathname): SiteNavActivePath {
  if (pathname.startsWith("/calendar")) return "/calendar";
  if (pathname.startsWith("/tickets") || pathname.startsWith("/shows/")) return "/tickets";
  if (pathname.startsWith("/diary")) return "/diary";
  if (pathname.startsWith("/friends")) return "/friends";
  if (pathname.startsWith("/guestbook")) return "/guestbook";
  if (pathname.startsWith("/admin")) return "/admin";
  return "/";
}
