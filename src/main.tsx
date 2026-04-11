import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { fetchJSON } from "./api";
import { compressImage } from "./image-compress";
import { CalendarPage } from "./calendar-page";
import { ComingSoonPage } from "./coming-soon";
import { PerformerPicker } from "./performer-picker";
import { HomePage } from "./home-page";
import { GuestbookPage } from "./guestbook-page";
import { DiaryPage } from "./diary-page";
import { FriendsPage } from "./friends-page";
import { SiteNav } from "./site-nav";
import { CalendarAdmin } from "./admin-calendar";
import { GuestbookAdmin } from "./admin-guestbook";
import { DiaryAdmin } from "./admin-diary";
import { FriendsAdmin } from "./admin-friends";
import {
  formatLabels,
  roleLabels,
  showFormats,
  showRoles,
  showTypes,
  type ArchiveSummary,
  type BrandRecord,
  type PerformerRecord,
  type PublicShowSummary,
  type ShowFormat,
  type ShowRecord,
  type ShowRole,
  type ShowType,
  type VenueRecord,
  typeLabels
} from "../shared/domain";
import "./styles.css";

type Snapshot = {
  shows: ShowRecord[];
  performers: PerformerRecord[];
  brands: BrandRecord[];
  venues: VenueRecord[];
};

type Route = { path: string; params: Record<string, string> };

const emptySnapshot: Snapshot = { shows: [], performers: [], brands: [], venues: [] };

function routeFromLocation(): Route {
  const path = window.location.pathname;
  const showMatch = path.match(/^\/shows\/([^/]+)/);
  const diaryMatch = path.match(/^\/diary\/([^/]+)/);
  const friendMatch = path.match(/^\/friends\/([^/]+)/);
  if (showMatch) return { path: "/shows/:id", params: { id: showMatch[1] } };
  if (diaryMatch) return { path: "/diary/:id", params: { id: diaryMatch[1] } };
  if (friendMatch) return { path: "/friends/:id", params: { id: friendMatch[1] } };
  if (path.startsWith("/admin")) return { path: "/admin", params: {} };
  if (path.startsWith("/tickets")) return { path: "/tickets", params: {} };
  if (path.startsWith("/calendar")) return { path: "/calendar", params: {} };
  if (path.startsWith("/guestbook")) return { path: "/guestbook", params: {} };
  if (path.startsWith("/diary")) return { path: "/diary", params: {} };
  if (path.startsWith("/friends")) return { path: "/friends", params: {} };
  return { path: "/", params: {} };
}

function navigate(path: string): void {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function App() {
  const [route, setRoute] = useState(routeFromLocation());

  useEffect(() => {
    const listener = () => setRoute(routeFromLocation());
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);

  if (route.path === "/admin") return <AdminApp />;
  if (route.path === "/shows/:id") return <ShowDetail id={route.params.id} />;
  if (route.path === "/tickets") return <ArchiveWall />;
  if (route.path === "/calendar") return <CalendarPage onNavigate={navigate} />;
  if (route.path === "/guestbook") return <GuestbookPage onNavigate={navigate} />;
  if (route.path === "/diary/:id") return <DiaryPage onNavigate={navigate} postID={route.params.id} />;
  if (route.path === "/diary") return <DiaryPage onNavigate={navigate} />;
  if (route.path === "/friends/:id") return <FriendsPage onNavigate={navigate} friendID={route.params.id} />;
  if (route.path === "/friends") return <FriendsPage onNavigate={navigate} />;
  return <HomePage onNavigate={navigate} />;
}

function ArchiveWall() {
  const [summary, setSummary] = useState<ArchiveSummary | null>(null);
  const [shows, setShows] = useState<PublicShowSummary[]>([]);
  const [showType, setShowType] = useState<string>("");
  const [brandID, setBrandID] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJSON<ArchiveSummary>("/api/public/summary").then(setSummary).catch(showError);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (showType) params.set("showType", showType);
    if (brandID) params.set("brandID", brandID);
    setLoading(true);
    fetchJSON<{ items: PublicShowSummary[] }>(`/api/public/shows?${params}`)
      .then((data) => setShows(data.items))
      .catch(showError)
      .finally(() => setLoading(false));
  }, [showType, brandID]);

  return (
    <main className="page tickets-page">
      <SiteNav onNavigate={navigate} activePath="/tickets" />

      <section className="archive-intro">
        <div>
          <p className="eyebrow">Performance Tickets</p>
          <h1>把每一次上台，留成一张可以回看的票。</h1>
          <p className="hero-copy">每张票根都是一次上台的证据，按时间和厂牌慢慢翻。</p>
        </div>
        <div className="stats-strip">
          <Stat label="总场次" value={summary?.totalShows ?? 0} />
          <Stat label="主持" value={summary?.roleCounts.host ?? 0} />
          <Stat label="专场" value={summary?.typeCounts.special ?? 0} />
        </div>
      </section>

      <section className="filters" aria-label="筛选类型">
        <button className={!showType ? "chip active" : "chip"} onClick={() => setShowType("")}>全部类型</button>
        {showTypes.map((item) => (
          <button key={item} className={showType === item ? "chip active" : "chip"} onClick={() => setShowType(item)}>
            {typeLabels[item]} {summary?.typeCounts[item] ? `· ${summary.typeCounts[item]}` : ""}
          </button>
        ))}
      </section>

      <section className="filters" aria-label="筛选厂牌">
        <button className={!brandID ? "chip active" : "chip"} onClick={() => setBrandID("")}>全部厂牌</button>
        {summary?.brands.map((brand) => (
          <button key={brand.id} className={brandID === brand.id ? "chip active" : "chip"} onClick={() => setBrandID(brand.id)}>
            {brand.displayName} {summary.brandCounts[brand.id] ? `· ${summary.brandCounts[brand.id]}` : ""}
          </button>
        ))}
      </section>

      {loading ? <p className="muted">正在整理票根...</p> : null}
      {!loading && shows.length === 0 ? <EmptyState /> : null}
      <section className="ticket-grid">
        {shows.map((show, index) => <TicketCard key={show.id} show={show} index={index} />)}
      </section>
    </main>
  );
}

export function TicketCard({
  show,
  onNavigate = navigate,
  index = 0
}: {
  show: PublicShowSummary;
  onNavigate?: (path: string) => void;
  index?: number;
}) {
  const [isPressing, setIsPressing] = useState(false);

  return (
    <button
      type="button"
      className={`ticket-card${isPressing ? " is-pressing" : ""}`}
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
      onMouseDown={() => setIsPressing(true)}
      onMouseUp={() => setIsPressing(false)}
      onMouseLeave={() => setIsPressing(false)}
      onBlur={() => setIsPressing(false)}
      onClick={() => onNavigate(`/shows/${show.id}`)}
      aria-label={`${show.title} 票根详情`}
    >
      <CoverImage show={show} />
      <div className="ticket-copy">
        <p className="eyebrow">{show.date ? formatDate(show.date) : "待定时间"}</p>
        <h2>{show.title}</h2>
        <p>{[show.brand?.displayName, show.venue?.displayName, show.venue?.cityName].filter(Boolean).join(" · ") || "地点待补充"}</p>
        <div className="tag-row">
          <span>{formatLabels[show.format]}</span>
          <span>{roleLabels[show.myRole]}</span>
          <span>{typeLabels[show.showType]}</span>
        </div>
      </div>
    </button>
  );
}

function CoverImage({ show }: { show: Pick<PublicShowSummary, "coverFileName" | "title" | "brand"> }) {
  if (show.coverFileName) {
    return <img className="cover" src={`/covers/${encodeURIComponent(show.coverFileName)}`} alt={show.title} />;
  }
  return (
    <div className="cover cover-placeholder">
      <span>{show.brand?.displayName ?? "XYSG"}</span>
      <strong>{show.title}</strong>
    </div>
  );
}

function ShowDetail({ id }: { id: string }) {
  const [show, setShow] = useState<PublicShowSummary | null>(null);

  useEffect(() => {
    fetchJSON<PublicShowSummary>(`/api/public/shows/${id}`).then(setShow).catch(showError);
  }, [id]);

  if (!show) {
    return (
      <main className="page">
        <SiteNav onNavigate={navigate} activePath="/tickets" />
        <p className="muted">正在展开票根...</p>
      </main>
    );
  }

  return (
    <main className="page detail-page">
      <SiteNav onNavigate={navigate} activePath="/tickets" />
      <button type="button" className="ghost-button" onClick={() => navigate("/tickets")}>返回票根墙</button>
      <section className="detail-layout home-glass">
        <CoverImage show={show} />
        <div className="detail-main">
          <p className="eyebrow">{show.brand?.displayName ?? "个人档案"}</p>
          <h1>{show.title}</h1>
          <div className="tag-row large">
            <span>{formatLabels[show.format]}</span>
            <span>{roleLabels[show.myRole]}</span>
            <span>{typeLabels[show.showType]}</span>
          </div>
          <dl className="detail-list">
            <div><dt>日期时间</dt><dd>{show.date ? formatFullDate(show.date) : "待定时间"}</dd></div>
            <div><dt>剧场</dt><dd>{show.venue?.displayName ?? "地点待补充"}</dd></div>
            <div><dt>城市地点</dt><dd>{[show.venue?.cityName, show.venue?.district].filter(Boolean).join(" · ") || "待补充"}</dd></div>
            <div><dt>演员阵容</dt><dd>{show.performers.map((item) => item.displayName).join(" · ") || "待补充阵容"}</dd></div>
          </dl>
          {show.notes ? <section className="public-notes"><h2>备注</h2><p>{show.notes}</p></section> : null}
        </div>
      </section>
    </main>
  );
}

function AdminApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [tab, setTab] = useState<"shows" | "entities" | "calendar" | "guestbook" | "diary" | "friends" | "backup">("shows");

  useEffect(() => {
    fetch("/api/admin/me")
      .then((response) => setAuthenticated(response.ok))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (authenticated) refreshSnapshot(setSnapshot);
  }, [authenticated]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (!response.ok) return alert((await response.json()).error ?? "登录失败");
    setAuthenticated(true);
  }

  if (checking) return <main className="page"><p className="muted">正在确认管理入口...</p></main>;

  if (!authenticated) {
    return (
      <main className="admin-login">
        <form className="login-panel" onSubmit={login}>
          <img src="/app-icon.png" alt="XYSG" />
          <p className="eyebrow">Admin Gate</p>
          <h1>输入管理密码</h1>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="管理密码" autoFocus />
          <button className="primary-button">进入管理端</button>
        </form>
      </main>
    );
  }

  return (
    <main className="page admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>票根管理台</h1>
        </div>
        <button className="ghost-button" onClick={() => navigate("/")}>查看公开端</button>
      </header>
      <nav className="admin-tabs">
        <button className={tab === "shows" ? "active" : ""} onClick={() => setTab("shows")}>演出</button>
        <button className={tab === "entities" ? "active" : ""} onClick={() => setTab("entities")}>实体</button>
        <button className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}>日历</button>
        <button className={tab === "guestbook" ? "active" : ""} onClick={() => setTab("guestbook")}>留言</button>
        <button className={tab === "diary" ? "active" : ""} onClick={() => setTab("diary")}>日记</button>
        <button className={tab === "friends" ? "active" : ""} onClick={() => setTab("friends")}>朋友</button>
        <button className={tab === "backup" ? "active" : ""} onClick={() => setTab("backup")}>备份</button>
      </nav>
      {tab === "shows" ? <ShowAdmin snapshot={snapshot} onChanged={() => refreshSnapshot(setSnapshot)} /> : null}
      {tab === "entities" ? <EntityAdmin snapshot={snapshot} onChanged={() => refreshSnapshot(setSnapshot)} /> : null}
      {tab === "calendar" ? <CalendarAdmin brands={snapshot.brands} venues={snapshot.venues} onChanged={() => refreshSnapshot(setSnapshot)} /> : null}
      {tab === "guestbook" ? <GuestbookAdmin /> : null}
      {tab === "diary" ? <DiaryAdmin /> : null}
      {tab === "friends" ? <FriendsAdmin performers={snapshot.performers} /> : null}
      {tab === "backup" ? <BackupAdmin onChanged={() => refreshSnapshot(setSnapshot)} /> : null}
    </main>
  );
}

function ShowAdmin({ snapshot, onChanged }: { snapshot: Snapshot; onChanged: () => void }) {
  const [editing, setEditing] = useState<ShowRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const emptyForm = useMemo(() => showToForm(null), []);
  const [form, setForm] = useState(emptyForm);
  const [cover, setCover] = useState<File | null>(null);

  function startEdit(show: ShowRecord | null) {
    setEditing(show);
    setCover(null);
    setForm(showToForm(show));
    setShowModal(true);
  }

  function closeModal() {
    setEditing(null);
    setCover(null);
    setForm(emptyForm);
    setShowModal(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const data = new FormData();
    for (const [key, value] of Object.entries(form)) data.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
    if (cover) data.set("cover", await compressImage(cover), "cover.jpg");
    const url = editing ? `/api/admin/shows/${editing.id}` : "/api/admin/shows";
    const method = editing ? "PUT" : "POST";
    const response = await fetch(url, { method, body: data });
    if (!response.ok) return alert((await response.json()).error ?? "保存失败");
    closeModal();
    onChanged();
  }

  async function createPerformer(name: string) {
    const response = await fetch("/api/admin/performers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name, stageName: "", brandIDs: [] })
    });
    if (!response.ok) {
      throw new Error((await response.json()).error ?? "新建演员失败");
    }
    const performer = await response.json();
    onChanged();
    return {
      id: performer.id,
      label: performer.displayName,
      subtitle: performer.stageName
    };
  }

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>演出列表</h2>
        <button type="button" className="primary-button" onClick={() => startEdit(null)}>新增演出</button>
      </div>
      {snapshot.shows.map((show) => (
        <div className="admin-row" key={show.id}>
          <div>
            <strong>{show.title}</strong>
            <span>{show.date ? formatFullDate(show.date) : "待定时间"} · {formatLabels[show.format]}</span>
          </div>
          <button onClick={() => startEdit(show)}>编辑</button>
          <button className="danger" onClick={() => deleteItem(`/api/admin/shows/${show.id}`, onChanged)}>删除</button>
        </div>
      ))}
      {showModal ? (
        <div className="admin-modal-backdrop" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editing ? "编辑演出" : "新增演出"}</h2>
              <button type="button" className="admin-modal-close" onClick={closeModal}>×</button>
            </div>
            <form style={{ display: "grid", gap: "12px" }} onSubmit={save}>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="演出标题" />
              <input type="datetime-local" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
              <select value={form.brandID} onChange={(event) => setForm({ ...form, brandID: event.target.value })}>
                <option value="">未选择厂牌</option>
                {snapshot.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.displayName}</option>)}
              </select>
              <select value={form.venueID} onChange={(event) => setForm({ ...form, venueID: event.target.value })}>
                <option value="">未选择场地</option>
                {snapshot.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.displayName}</option>)}
              </select>
              <PerformerPicker
                label="演员阵容"
                values={form.performerIDs}
                options={snapshot.performers.map((item) => ({ id: item.id, label: item.displayName, subtitle: item.stageName }))}
                onChange={(performerIDs) => setForm({ ...form, performerIDs })}
                onCreate={createPerformer}
              />
              <div className="three-cols">
                <EnumSelect value={form.format} values={showFormats} labels={formatLabels} onChange={(format) => setForm({ ...form, format })} />
                <EnumSelect value={form.myRole} values={showRoles} labels={roleLabels} onChange={(myRole) => setForm({ ...form, myRole })} />
                <EnumSelect value={form.showType} values={showTypes} labels={typeLabels} onChange={(showType) => setForm({ ...form, showType })} />
              </div>
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="备注" />
              <label className="check-line"><input type="checkbox" checked={form.notesPublic} onChange={(event) => setForm({ ...form, notesPublic: event.target.checked })} /> 公开展示备注</label>
              <input type="file" accept="image/*" onChange={(event) => setCover(event.target.files?.[0] ?? null)} />
              <button className="primary-button" type="submit">{editing ? "保存修改" : "新增演出"}</button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EntityAdmin({ snapshot, onChanged }: { snapshot: Snapshot; onChanged: () => void }) {
  return (
    <section className="entity-columns">
      <CatalogPanel title="演员" endpoint="/api/admin/performers" items={snapshot.performers} fields={["displayName", "stageName"]} relations={[{ key: "brandIDs", label: "关联厂牌", options: snapshot.brands.map((item) => ({ id: item.id, label: item.displayName })) }]} onChanged={onChanged} />
      <CatalogPanel title="厂牌" endpoint="/api/admin/brands" items={snapshot.brands} fields={["displayName", "cityName"]} relations={[{ key: "performerIDs", label: "关联演员", options: snapshot.performers.map((item) => ({ id: item.id, label: item.displayName })) }, { key: "venueIDs", label: "关联场地", options: snapshot.venues.map((item) => ({ id: item.id, label: item.displayName })) }]} onChanged={onChanged} />
      <CatalogPanel title="场地" endpoint="/api/admin/venues" items={snapshot.venues} fields={["displayName", "cityName", "district", "addressLine"]} relations={[{ key: "brandIDs", label: "关联厂牌", options: snapshot.brands.map((item) => ({ id: item.id, label: item.displayName })) }]} onChanged={onChanged} />
    </section>
  );
}

function CatalogPanel({ title, endpoint, items, fields, relations, onChanged }: {
  title: string;
  endpoint: string;
  items: Array<Record<string, any>>;
  fields: string[];
  relations: { key: string; label: string; options: { id: string; label: string }[] }[];
  onChanged: () => void;
}) {
  const emptyForm = useMemo(() => {
    const base: Record<string, any> = { displayName: "" };
    for (const r of relations) base[r.key] = [];
    return base;
  }, [relations]);

  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Record<string, any>>(emptyForm);

  function start(item: Record<string, any> | null) {
    setEditing(item);
    setForm(item ? { ...item } : { ...emptyForm });
    setShowModal(true);
  }

  function closeModal() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowModal(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const url = editing ? `${endpoint}/${editing.id}` : endpoint;
    const response = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!response.ok) return alert((await response.json()).error ?? "保存失败");
    closeModal();
    onChanged();
  }

  return (
    <section className="catalog-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>{title}</h2>
        <button type="button" className="primary-button" onClick={() => start(null)}>新增</button>
      </div>
      {items.map((item) => (
        <div className="admin-row compact" key={item.id}>
          <div><strong>{item.displayName}</strong><span>{item.cityName ?? item.stageName ?? "实体"}</span></div>
          <button onClick={() => start(item)}>编辑</button>
          <button className="danger" onClick={() => deleteItem(`${endpoint}/${item.id}`, onChanged)}>删除</button>
        </div>
      ))}
      {showModal ? (
        <div className="admin-modal-backdrop" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editing ? `编辑${title}` : `新增${title}`}</h2>
              <button type="button" className="admin-modal-close" onClick={closeModal}>×</button>
            </div>
            <form style={{ display: "grid", gap: "12px" }} onSubmit={save}>
              {fields.map((field) => (
                <input key={field} value={form[field] ?? ""} onChange={(event) => setForm({ ...form, [field]: event.target.value })} placeholder={fieldLabel(field)} />
              ))}
              {relations.map((rel) => (
                <MultiSelect key={rel.key} label={rel.label} values={form[rel.key] ?? []} options={rel.options} onChange={(values) => setForm({ ...form, [rel.key]: values })} />
              ))}
              <button className="primary-button" type="submit">{editing ? "保存" : "新增"}</button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BackupAdmin({ onChanged }: { onChanged: () => void }) {
  const [file, setFile] = useState<File | null>(null);

  async function upload() {
    if (!file) return alert("请选择 zip 备份。");
    if (!confirm("导入会覆盖服务器当前数据，确定继续吗？")) return;
    const data = new FormData();
    data.set("archive", file);
    const response = await fetch("/api/admin/backup/import", { method: "POST", body: data });
    if (!response.ok) return alert((await response.json()).error ?? "导入失败");
    onChanged();
    alert("备份已恢复。");
  }

  return (
    <section className="backup-panel">
      <h2>备份与恢复</h2>
      <p>这里使用和 iOS App 一样的 ZIP 格式。导入会覆盖服务器数据，导出可回到 iOS 恢复。</p>
      <a className="primary-button as-link" href="/api/admin/backup/export">导出 ZIP 备份</a>
      <input type="file" accept=".zip,application/zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <button className="ghost-button" onClick={upload}>导入并覆盖</button>
    </section>
  );
}

function MultiSelect({ label, values, options, onChange }: { label: string; values: string[]; options: { id: string; label: string }[]; onChange: (values: string[]) => void }) {
  const [query, setQuery] = useState("");
  const selected = options.filter((o) => values.includes(o.id));
  const available = options.filter((o) => !values.includes(o.id) && (!query || o.label.includes(query)));
  function add(id: string) { onChange([...values, id]); }
  function remove(id: string) { onChange(values.filter((v) => v !== id)); }
  return (
    <div className="multi-select">
      <span>{label}</span>
      {selected.length > 0 ? (
        <div className="chip-row selected-chips">
          {selected.map((item) => (
            <button type="button" key={item.id} className="ms-chip is-on" onClick={() => remove(item.id)}>{item.label} ×</button>
          ))}
        </div>
      ) : null}
      <input className="ms-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`搜索${label}…`} />
      {available.length > 0 ? (
        <div className="chip-row available-chips">
          {available.map((item) => (
            <button type="button" key={item.id} className="ms-chip" onClick={() => add(item.id)}>{item.label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EnumSelect<T extends string>({ value, values, labels, onChange }: { value: T; values: readonly T[]; labels: Record<T, string>; onChange: (value: T) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as T)}>
      {values.map((item) => <option key={item} value={item}>{labels[item]}</option>)}
    </select>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="stat"><strong>{value}</strong><span>{label}</span></div>;
}

function EmptyState() {
  return (
    <section className="empty-state">
      <img src="/app-icon.png" alt="" />
      <h2>还没有公开票根</h2>
      <p>进入管理端导入 iOS ZIP 备份，或先新增一场演出。</p>
    </section>
  );
}

function showToForm(show: ShowRecord | null) {
  return {
    title: show?.title ?? "",
    date: show?.date ? new Date(show.date).toISOString().slice(0, 16) : "",
    venueID: show?.venueID ?? "",
    brandID: show?.brandID ?? "",
    performerIDs: show?.performerIDs ?? [],
    format: show?.format ?? "standup" as ShowFormat,
    myRole: show?.myRole ?? "performer" as ShowRole,
    showType: show?.showType ?? "showcase" as ShowType,
    notes: show?.notes ?? "",
    notesPublic: show?.notesPublic ?? false,
    coverFileName: show?.coverFileName ?? ""
  };
}

async function refreshSnapshot(setSnapshot: (snapshot: Snapshot) => void) {
  fetchJSON<Snapshot>("/api/admin/snapshot").then(setSnapshot).catch(showError);
}

async function deleteItem(url: string, onChanged: () => void) {
  if (!confirm("确定删除吗？")) return;
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) return alert((await response.json()).error ?? "删除失败");
  onChanged();
}

function showError(error: unknown): void {
  console.error(error);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatFullDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    displayName: "名称",
    stageName: "艺名 / 备注",
    cityName: "城市",
    district: "区县 / 商圈",
    addressLine: "地址"
  };
  return labels[field] ?? field;
}

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
