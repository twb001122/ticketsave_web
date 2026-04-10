import React, { useEffect, useMemo, useState } from "react";
import { fetchJSON } from "./api";
import {
  formatLabels,
  roleLabels,
  showFormats,
  showRoles,
  showTypes,
  type BrandRecord,
  type CalendarEventRecord,
  type ShowFormat,
  type ShowRole,
  type ShowType,
  type VenueRecord,
  typeLabels
} from "../shared/domain";

interface CalendarAdminProps {
  brands: BrandRecord[];
  venues: VenueRecord[];
  onChanged: () => void;
}

type CalendarEventForm = {
  title: string;
  eventDate: string;
  startTime: string;
  brandID: string;
  venueID: string;
  format: ShowFormat;
  myRole: ShowRole;
  showType: ShowType;
  notes: string;
};

function toForm(event: CalendarEventRecord | null, brands: BrandRecord[], venues: VenueRecord[]): CalendarEventForm {
  return {
    title: event?.title ?? "",
    eventDate: event?.eventDate ?? new Date().toISOString().slice(0, 10),
    startTime: event?.startTime ?? "20:00",
    brandID: event?.brandID ?? brands[0]?.id ?? "",
    venueID: event?.venueID ?? venues[0]?.id ?? "",
    format: event?.format ?? "standup",
    myRole: event?.myRole ?? "performer",
    showType: event?.showType ?? "showcase",
    notes: event?.notes ?? ""
  };
}

export function CalendarAdmin({ brands, venues, onChanged }: CalendarAdminProps) {
  const emptyForm = useMemo(() => toForm(null, brands, venues), [brands, venues]);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [editing, setEditing] = useState<CalendarEventRecord | null>(null);
  const [form, setForm] = useState<CalendarEventForm>(emptyForm);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState("");

  useEffect(() => {
    setForm(emptyForm);
  }, [emptyForm]);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const data = await fetchJSON<{ items: CalendarEventRecord[] }>("/api/admin/calendar");
    setEvents(data.items);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = editing ? `/api/admin/calendar/${editing.id}` : "/api/admin/calendar";
    const response = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!response.ok) return alert((await response.json()).error ?? "保存失败");
    setEditing(null);
    setForm(emptyForm);
    await refresh();
    onChanged();
  }

  async function importJSON() {
    const response = await fetch("/api/admin/calendar/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: importText
    });
    const body = await response.json();
    if (!response.ok) return alert(body.error ?? "导入失败");
    setImportResult(`导入 ${body.importedCount} 条，跳过 ${body.skippedCount} 条，新建厂牌 ${body.createdBrands.length} 个，新建场地 ${body.createdVenues.length} 个。`);
    await refresh();
    onChanged();
  }

  async function createShow(eventID: string) {
    const response = await fetch(`/api/admin/calendar/${eventID}/create-show`, { method: "POST" });
    if (!response.ok) return alert((await response.json()).error ?? "生成票根失败");
    await refresh();
    onChanged();
  }

  return (
    <section className="admin-grid calendar-admin">
      <form className="editor-panel" onSubmit={save}>
        <h2>{editing ? "编辑日历事件" : "新增日历事件"}</h2>
        <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="演出标题" />
        <input type="date" value={form.eventDate} onChange={(event) => setForm({ ...form, eventDate: event.target.value })} />
        <input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
        <select value={form.brandID} onChange={(event) => setForm({ ...form, brandID: event.target.value })}>
          <option value="">选择厂牌</option>
          {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.displayName}</option>)}
        </select>
        <select value={form.venueID} onChange={(event) => setForm({ ...form, venueID: event.target.value })}>
          <option value="">选择场地</option>
          {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.displayName}</option>)}
        </select>
        <div className="three-cols">
          <EnumSelect value={form.format} values={showFormats} labels={formatLabels} onChange={(format) => setForm({ ...form, format })} />
          <EnumSelect value={form.myRole} values={showRoles} labels={roleLabels} onChange={(myRole) => setForm({ ...form, myRole })} />
          <EnumSelect value={form.showType} values={showTypes} labels={typeLabels} onChange={(showType) => setForm({ ...form, showType })} />
        </div>
        <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="备注" />
        <button className="primary-button">{editing ? "保存日历事件" : "新增日历事件"}</button>
      </form>

      <section className="table-panel">
        <h2>日历事件</h2>
        <a className="primary-button as-link" href="/api/admin/calendar/import-template">下载 JSON 示例</a>
        <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="粘贴 JSON 数组后导入" />
        <button className="ghost-button" onClick={importJSON} type="button">导入 JSON</button>
        {importResult ? <p className="muted">{importResult}</p> : null}
        {events.map((item) => (
          <div className="admin-row" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.eventDate} {item.startTime} · {formatLabels[item.format]} · {roleLabels[item.myRole]} · {typeLabels[item.showType]}</span>
            </div>
            <button type="button" onClick={() => { setEditing(item); setForm(toForm(item, brands, venues)); }}>编辑</button>
            <button type="button" onClick={() => createShow(item.id)} disabled={Boolean(item.createdShowID)}>{item.createdShowID ? "已生成" : "生成票根"}</button>
          </div>
        ))}
      </section>
    </section>
  );
}

function EnumSelect<T extends string>({ value, values, labels, onChange }: { value: T; values: readonly T[]; labels: Record<T, string>; onChange: (value: T) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as T)}>
      {values.map((item) => <option key={item} value={item}>{labels[item]}</option>)}
    </select>
  );
}
