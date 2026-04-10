# Comedy Center Phase One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build phase one of "马达的喜剧中心": a new home page, preserved ticket archive at `/tickets`, public performance calendar, admin calendar import/editing, and calendar-to-ticket generation.

**Architecture:** Keep the current Vite/React + Express/sql.js architecture, but add focused modules around calendar and new public pages so `src/main.tsx` and `server/app.ts` do not absorb every detail. Calendar events live in a new `calendar_events` table and link to ticket records through `createdShowID`; imported calendar entities reuse or create existing brands and venues.

**Tech Stack:** React 19, Vite 7, TypeScript, Express 5, sql.js SQLite, Vitest, Testing Library, Supertest.

---

## File Structure

- Modify `shared/domain.ts`: extend existing show role/type enums and add calendar event, input, import, and public summary types.
- Modify `server/db.ts`: add `calendar_events` schema, CRUD methods, month/upcoming queries, import support, and calendar-to-show generation.
- Modify `server/app.ts`: add public and admin calendar API routes, import-template route, JSON import route, and create-show route.
- Create `tests/calendar-store.test.ts`: data-layer coverage for CRUD, import entity creation, validation, and generated ticket links.
- Create `tests/calendar-api.test.ts`: Supertest coverage for public calendar routes and authenticated admin calendar routes.
- Create `src/api.ts`: shared `fetchJSON()` helper used by new components.
- Create `src/home-page.tsx`: new home page and module entrance cards.
- Create `src/calendar-page.tsx`: public month calendar/list toggle UI.
- Create `src/admin-calendar.tsx`: admin calendar tab with event form, JSON import, template download, and create-ticket action.
- Create `src/coming-soon.tsx`: placeholder pages for guestbook, diary, and friends.
- Modify `src/main.tsx`: route `/` to `HomePage`, `/tickets` to the existing archive wall, add `/calendar`, `/guestbook`, `/diary`, `/friends`, and admin calendar tab.
- Modify `src/styles.css`: add the bright, warm, airy, light-glass visual system and calendar/admin styles.
- Create or modify front-end tests in `tests/home-page.test.tsx`, `tests/calendar-page.test.tsx`, and `tests/admin-calendar.test.tsx`.

---

## Task 1: Extend Shared Domain Types

**Files:**
- Modify: `shared/domain.ts`

- [ ] **Step 1: Write the failing type-level expectations by updating existing tests that use role/type literals**

Update `tests/ticket-card.test.tsx` sample data to assert the new labels are usable:

```ts
const sampleShow: PublicShowSummary = {
  id: "show-1",
  title: "动画测试演出",
  coverFileName: null,
  date: "2026-04-09T12:00:00Z",
  format: "standup",
  myRole: "opener",
  showType: "competition",
  brand: null,
  venue: null,
  performers: []
};
```

- [ ] **Step 2: Run the affected test to verify it fails**

Run:

```bash
npm test -- tests/ticket-card.test.tsx
```

Expected: TypeScript or test compilation fails because `"opener"` and `"competition"` are not part of the current unions.

- [ ] **Step 3: Extend enums and labels in `shared/domain.ts`**

Change the role/type definitions to:

```ts
export const showRoles = ["host", "performer", "headliner", "opener", "other"] as const;
export const showTypes = ["openMic", "commercial", "showcase", "special", "competition", "other"] as const;
```

Add labels:

```ts
export const roleLabels: Record<ShowRole, string> = {
  host: "主持",
  performer: "演员",
  headliner: "主咖",
  opener: "开场",
  other: "其他"
};

export const typeLabels: Record<ShowType, string> = {
  openMic: "开放麦",
  commercial: "商演",
  showcase: "主打秀",
  special: "专场",
  competition: "比赛",
  other: "其他"
};
```

Add calendar types after `ArchiveSummary`:

```ts
export const calendarSources = ["manual", "import"] as const;
export type CalendarSource = (typeof calendarSources)[number];

export interface CalendarEventRecord {
  id: string;
  title: string;
  eventDate: string;
  startTime: string;
  brandID: string;
  venueID: string;
  format: ShowFormat;
  myRole: ShowRole;
  showType: ShowType;
  notes: string;
  source: CalendarSource;
  createdShowID: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventInput {
  title?: string;
  eventDate?: string;
  startTime?: string;
  brandID?: string;
  venueID?: string;
  format?: ShowFormat;
  myRole?: ShowRole;
  showType?: ShowType;
  notes?: string;
  source?: CalendarSource;
}

export interface PublicCalendarEventSummary {
  id: string;
  title: string;
  eventDate: string;
  startTime: string;
  format: ShowFormat;
  myRole: ShowRole;
  showType: ShowType;
  brand: Pick<BrandRecord, "id" | "displayName" | "cityName">;
  venue: Pick<VenueRecord, "id" | "displayName" | "cityName" | "district">;
  notes: string;
}

export interface CalendarImportRow {
  date: string;
  startTime: string;
  brand: string;
  venue: string;
  city?: string;
  format: string;
  myRole: string;
  showType: string;
  title?: string;
  notes?: string;
}

export interface CalendarImportResult {
  importedCount: number;
  skippedCount: number;
  createdBrands: Pick<BrandRecord, "id" | "displayName">[];
  createdVenues: Pick<VenueRecord, "id" | "displayName" | "cityName">[];
  errors: { row: number; field: string; message: string }[];
}
```

- [ ] **Step 4: Run the affected test again**

Run:

```bash
npm test -- tests/ticket-card.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/domain.ts tests/ticket-card.test.tsx
git commit -m "feat: extend show categories for calendar"
```

---

## Task 2: Add Calendar Store CRUD

**Files:**
- Modify: `server/db.ts`
- Test: `tests/calendar-store.test.ts`

- [ ] **Step 1: Write failing store CRUD tests**

Create `tests/calendar-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDataStore } from "../server/db.js";

describe("calendar event store", () => {
  it("creates, updates, lists by month, and deletes calendar events", async () => {
    const store = await createDataStore({ inMemory: true });
    const brand = store.createBrand({ displayName: "笑声工厂", cityName: "上海" });
    const venue = store.createVenue({ displayName: "喜剧剧场", cityName: "上海" });

    const created = store.createCalendarEvent({
      title: "周六开放麦",
      eventDate: "2026-04-18",
      startTime: "20:00",
      brandID: brand.id,
      venueID: venue.id,
      format: "standup",
      myRole: "host",
      showType: "openMic",
      notes: "带计时器",
      source: "manual"
    });

    expect(store.listCalendarEvents({ month: "2026-04" }).map((event) => event.id)).toEqual([created.id]);
    expect(store.listCalendarEvents({ month: "2026-05" })).toEqual([]);

    const updated = store.updateCalendarEvent(created.id, { title: "周六夜开放麦", myRole: "opener" });
    expect(updated.title).toBe("周六夜开放麦");
    expect(updated.myRole).toBe("opener");

    store.deleteCalendarEvent(created.id);
    expect(store.listCalendarEvents({ month: "2026-04" })).toEqual([]);
  });

  it("returns public calendar summaries with linked brand and venue", async () => {
    const store = await createDataStore({ inMemory: true });
    const brand = store.createBrand({ displayName: "笑声工厂", cityName: "上海" });
    const venue = store.createVenue({ displayName: "喜剧剧场", cityName: "上海", district: "静安" });

    store.createCalendarEvent({
      title: "周六开放麦",
      eventDate: "2026-04-18",
      startTime: "20:00",
      brandID: brand.id,
      venueID: venue.id,
      format: "standup",
      myRole: "host",
      showType: "openMic"
    });

    const events = store.listPublicCalendarEvents({ month: "2026-04" });
    expect(events[0].brand.displayName).toBe("笑声工厂");
    expect(events[0].venue.displayName).toBe("喜剧剧场");
    expect(events[0].venue.district).toBe("静安");
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
npm test -- tests/calendar-store.test.ts
```

Expected: FAIL because `createCalendarEvent`, `listCalendarEvents`, `updateCalendarEvent`, `deleteCalendarEvent`, and `listPublicCalendarEvents` do not exist.

- [ ] **Step 3: Add calendar schema and methods to `server/db.ts`**

Add imports for the new shared types:

```ts
type CalendarEventInput,
type CalendarEventRecord,
type CalendarSource,
type PublicCalendarEventSummary
```

Add the table in `createSchema()`:

```sql
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  eventDate TEXT NOT NULL,
  startTime TEXT NOT NULL,
  brandID TEXT NOT NULL,
  venueID TEXT NOT NULL,
  format TEXT NOT NULL,
  myRole TEXT NOT NULL,
  showType TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  createdShowID TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

Add methods to `DataStore`:

```ts
listCalendarEvents(filters: { month?: string } = {}): CalendarEventRecord[] {
  const events = this.queryAll("SELECT * FROM calendar_events ORDER BY eventDate ASC, startTime ASC, updatedAt DESC")
    .map((row) => this.calendarEventFromRow(row));
  return filters.month ? events.filter((event) => event.eventDate.startsWith(`${filters.month}-`)) : events;
}

listPublicCalendarEvents(filters: { month?: string } = {}): PublicCalendarEventSummary[] {
  return this.listCalendarEvents(filters).map((event) => this.toPublicCalendarEvent(event));
}

createCalendarEvent(input: CalendarEventInput): CalendarEventRecord {
  const now = nowISO();
  const event = this.calendarEventFromInput({
    ...input,
    id: uuidv4(),
    createdShowID: null,
    createdAt: now,
    updatedAt: now
  });
  this.db.run(
    `INSERT INTO calendar_events
     (id, title, eventDate, startTime, brandID, venueID, format, myRole, showType, notes, source, createdShowID, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    calendarEventParams(event)
  );
  this.persist();
  return event;
}

updateCalendarEvent(id: string, input: CalendarEventInput): CalendarEventRecord {
  const existing = this.requireCalendarEvent(id);
  const updated = this.calendarEventFromInput({
    ...existing,
    ...input,
    id,
    createdShowID: existing.createdShowID,
    createdAt: existing.createdAt,
    updatedAt: nowISO()
  });
  this.db.run(
    `UPDATE calendar_events SET
     title = ?, eventDate = ?, startTime = ?, brandID = ?, venueID = ?, format = ?, myRole = ?, showType = ?,
     notes = ?, source = ?, createdShowID = ?, updatedAt = ?
     WHERE id = ?`,
    [
      updated.title,
      updated.eventDate,
      updated.startTime,
      updated.brandID,
      updated.venueID,
      updated.format,
      updated.myRole,
      updated.showType,
      updated.notes,
      updated.source,
      updated.createdShowID,
      updated.updatedAt,
      id
    ]
  );
  this.persist();
  return updated;
}

deleteCalendarEvent(id: string): void {
  this.db.run("DELETE FROM calendar_events WHERE id = ?", [id]);
  this.persist();
}
```

Add helpers near other private conversion helpers:

```ts
private calendarEventFromRow(row: Row): CalendarEventRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    eventDate: String(row.eventDate),
    startTime: String(row.startTime),
    brandID: String(row.brandID),
    venueID: String(row.venueID),
    format: String(row.format) as ShowFormat,
    myRole: String(row.myRole) as ShowRole,
    showType: String(row.showType) as ShowType,
    notes: String(row.notes ?? ""),
    source: String(row.source) as CalendarSource,
    createdShowID: nullable(row.createdShowID),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

private toPublicCalendarEvent(event: CalendarEventRecord): PublicCalendarEventSummary {
  const brand = this.listBrands().find((item) => item.id === event.brandID);
  const venue = this.listVenues().find((item) => item.id === event.venueID);
  if (!brand) throw new Error("日历事件关联的厂牌不存在。");
  if (!venue) throw new Error("日历事件关联的场地不存在。");
  return {
    id: event.id,
    title: event.title,
    eventDate: event.eventDate,
    startTime: event.startTime,
    format: event.format,
    myRole: event.myRole,
    showType: event.showType,
    brand: { id: brand.id, displayName: brand.displayName, cityName: brand.cityName },
    venue: { id: venue.id, displayName: venue.displayName, cityName: venue.cityName, district: venue.district },
    notes: event.notes
  };
}

private requireCalendarEvent(id: string): CalendarEventRecord {
  const event = this.listCalendarEvents().find((item) => item.id === id);
  if (!event) throw new Error("日历事件不存在。");
  return event;
}

private calendarEventFromInput(input: CalendarEventInput & {
  id: string;
  createdShowID: string | null;
  createdAt: string;
  updatedAt: string;
}): CalendarEventRecord {
  const eventDate = requireDate(input.eventDate);
  const startTime = requireTime(input.startTime);
  if (!input.brandID) throw new Error("日历事件厂牌不能为空。");
  if (!input.venueID) throw new Error("日历事件场地不能为空。");
  return {
    id: input.id,
    title: storedTitle(input.title ?? ""),
    eventDate,
    startTime,
    brandID: input.brandID,
    venueID: input.venueID,
    format: input.format ?? "standup",
    myRole: input.myRole ?? "performer",
    showType: input.showType ?? "showcase",
    notes: input.notes ?? "",
    source: input.source ?? "manual",
    createdShowID: input.createdShowID,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}
```

Add file-level helpers:

```ts
function calendarEventParams(event: CalendarEventRecord): RowValue[] {
  return [
    event.id,
    event.title,
    event.eventDate,
    event.startTime,
    event.brandID,
    event.venueID,
    event.format,
    event.myRole,
    event.showType,
    event.notes,
    event.source,
    event.createdShowID,
    event.createdAt,
    event.updatedAt
  ];
}

function requireDate(value: string | undefined): string {
  const date = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error("日历事件日期必须是 YYYY-MM-DD。");
  }
  return date;
}

function requireTime(value: string | undefined): string {
  const time = String(value ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error("日历事件开始时间必须是 HH:mm。");
  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) throw new Error("日历事件开始时间必须是有效的 HH:mm。");
  return time;
}
```

- [ ] **Step 4: Run the store tests**

Run:

```bash
npm test -- tests/calendar-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/db.ts tests/calendar-store.test.ts
git commit -m "feat: add calendar event store"
```

---

## Task 3: Add JSON Import and Calendar-to-Ticket Generation

**Files:**
- Modify: `server/db.ts`
- Test: `tests/calendar-store.test.ts`

- [ ] **Step 1: Add failing import and create-show tests**

Append to `tests/calendar-store.test.ts`:

```ts
it("imports calendar JSON rows and summarizes created entities", async () => {
  const store = await createDataStore({ inMemory: true });

  const result = store.importCalendarRows([
    {
      date: "2026-04-18",
      startTime: "20:00",
      brand: "笑声工厂",
      venue: "喜剧剧场",
      city: "上海",
      format: "单口",
      myRole: "主持",
      showType: "开放麦",
      title: "周六开放麦",
      notes: "带计时器"
    }
  ]);

  expect(result.importedCount).toBe(1);
  expect(result.createdBrands.map((brand) => brand.displayName)).toEqual(["笑声工厂"]);
  expect(result.createdVenues.map((venue) => venue.displayName)).toEqual(["喜剧剧场"]);
  expect(result.errors).toEqual([]);
  expect(store.listCalendarEvents({ month: "2026-04" })[0].title).toBe("周六开放麦");
});

it("reports invalid calendar import rows without importing them", async () => {
  const store = await createDataStore({ inMemory: true });

  const result = store.importCalendarRows([
    {
      date: "2026/04/18",
      startTime: "25:00",
      brand: "",
      venue: "喜剧剧场",
      format: "脱口秀",
      myRole: "主持",
      showType: "开放麦"
    }
  ]);

  expect(result.importedCount).toBe(0);
  expect(result.skippedCount).toBe(1);
  expect(result.errors.map((error) => error.field)).toContain("date");
  expect(result.errors.map((error) => error.field)).toContain("brand");
  expect(store.listCalendarEvents()).toEqual([]);
});

it("creates a ticket from a calendar event once", async () => {
  const store = await createDataStore({ inMemory: true });
  const brand = store.createBrand({ displayName: "笑声工厂", cityName: "上海" });
  const venue = store.createVenue({ displayName: "喜剧剧场", cityName: "上海" });
  const event = store.createCalendarEvent({
    title: "周六开放麦",
    eventDate: "2026-04-18",
    startTime: "20:00",
    brandID: brand.id,
    venueID: venue.id,
    format: "standup",
    myRole: "opener",
    showType: "competition",
    notes: "比赛开场"
  });

  const show = store.createShowFromCalendarEvent(event.id);
  expect(show.title).toBe("周六开放麦");
  expect(show.date).toBe("2026-04-18T20:00:00.000");
  expect(show.brandID).toBe(brand.id);
  expect(show.venueID).toBe(venue.id);
  expect(show.myRole).toBe("opener");
  expect(show.showType).toBe("competition");
  expect(store.listCalendarEvents()[0].createdShowID).toBe(show.id);
  expect(() => store.createShowFromCalendarEvent(event.id)).toThrow("这条日历事件已经生成过票根。");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/calendar-store.test.ts
```

Expected: FAIL because `importCalendarRows` and `createShowFromCalendarEvent` do not exist.

- [ ] **Step 3: Implement import parsing in `server/db.ts`**

Add imports:

```ts
formatLabels,
roleLabels,
typeLabels,
type CalendarImportResult,
type CalendarImportRow
```

Add methods:

```ts
importCalendarRows(rows: Partial<CalendarImportRow>[]): CalendarImportResult {
  const result: CalendarImportResult = {
    importedCount: 0,
    skippedCount: 0,
    createdBrands: [],
    createdVenues: [],
    errors: []
  };

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const parsed = parseCalendarRow(row, rowNumber);
    if (parsed.errors.length > 0) {
      result.skippedCount += 1;
      result.errors.push(...parsed.errors);
      return;
    }

    const brand = this.findOrCreateImportBrand(parsed.value.brand, parsed.value.city, result);
    const venue = this.findOrCreateImportVenue(parsed.value.venue, parsed.value.city, result);
    this.createCalendarEvent({
      title: parsed.value.title,
      eventDate: parsed.value.date,
      startTime: parsed.value.startTime,
      brandID: brand.id,
      venueID: venue.id,
      format: parsed.value.format,
      myRole: parsed.value.myRole,
      showType: parsed.value.showType,
      notes: parsed.value.notes,
      source: "import"
    });
    result.importedCount += 1;
  });

  return result;
}

createShowFromCalendarEvent(id: string): ShowRecord {
  const event = this.requireCalendarEvent(id);
  if (event.createdShowID) throw new Error("这条日历事件已经生成过票根。");
  const show = this.createShow({
    title: event.title,
    date: `${event.eventDate}T${event.startTime}:00.000`,
    venueID: event.venueID,
    brandID: event.brandID,
    format: event.format,
    myRole: event.myRole,
    showType: event.showType,
    notes: event.notes,
    notesPublic: false,
    status: "published"
  });
  this.db.run("UPDATE calendar_events SET createdShowID = ?, updatedAt = ? WHERE id = ?", [show.id, nowISO(), id]);
  this.persist();
  return show;
}
```

Add private helpers:

```ts
private findOrCreateImportBrand(displayName: string, cityName: string | null, result: CalendarImportResult): BrandRecord {
  const normalizedKey = normalizeValue(displayName);
  const existing = this.listBrands().find((brand) => brand.normalizedKey === normalizedKey);
  if (existing) return existing;
  const brand = this.createBrand({ displayName, cityName });
  result.createdBrands.push({ id: brand.id, displayName: brand.displayName });
  return brand;
}

private findOrCreateImportVenue(displayName: string, cityName: string | null, result: CalendarImportResult): VenueRecord {
  const lookupKey = venueLookupKey(displayName, cityName);
  const existing = this.listVenues().find((venue) => venue.lookupKey === lookupKey);
  if (existing) return existing;
  const venue = this.createVenue({ displayName, cityName });
  result.createdVenues.push({ id: venue.id, displayName: venue.displayName, cityName: venue.cityName });
  return venue;
}
```

Add file-level parsing helpers:

```ts
const formatByLabel = new Map(Object.entries(formatLabels).map(([key, label]) => [label, key as ShowFormat]));
const roleByLabel = new Map(Object.entries(roleLabels).map(([key, label]) => [label, key as ShowRole]));
const typeByLabel = new Map(Object.entries(typeLabels).map(([key, label]) => [label, key as ShowType]));

function parseCalendarRow(row: Partial<CalendarImportRow>, rowNumber: number): {
  value: {
    date: string;
    startTime: string;
    brand: string;
    venue: string;
    city: string | null;
    format: ShowFormat;
    myRole: ShowRole;
    showType: ShowType;
    title: string;
    notes: string;
  };
  errors: CalendarImportResult["errors"];
} {
  const errors: CalendarImportResult["errors"] = [];
  const date = String(row.date ?? "").trim();
  const startTime = String(row.startTime ?? "").trim();
  const brand = String(row.brand ?? "").trim();
  const venue = String(row.venue ?? "").trim();
  const city = asNullableString(row.city);
  const format = formatByLabel.get(String(row.format ?? "").trim());
  const myRole = roleByLabel.get(String(row.myRole ?? "").trim());
  const showType = typeByLabel.get(String(row.showType ?? "").trim());

  try { requireDate(date); } catch (error) { errors.push({ row: rowNumber, field: "date", message: (error as Error).message }); }
  try { requireTime(startTime); } catch (error) { errors.push({ row: rowNumber, field: "startTime", message: (error as Error).message }); }
  if (!brand) errors.push({ row: rowNumber, field: "brand", message: "厂牌不能为空。" });
  if (!venue) errors.push({ row: rowNumber, field: "venue", message: "场地不能为空。" });
  if (!format) errors.push({ row: rowNumber, field: "format", message: "形式必须是单口、漫才、即兴、新喜剧或其他。" });
  if (!myRole) errors.push({ row: rowNumber, field: "myRole", message: "角色必须是主持、演员、主咖、开场或其他。" });
  if (!showType) errors.push({ row: rowNumber, field: "showType", message: "类型必须是开放麦、商演、主打秀、专场、比赛或其他。" });

  return {
    value: {
      date,
      startTime,
      brand,
      venue,
      city,
      format: format ?? "other",
      myRole: myRole ?? "other",
      showType: showType ?? "other",
      title: storedTitle(row.title ?? `${brand} ${row.showType ?? ""}`),
      notes: String(row.notes ?? "")
    },
    errors
  };
}
```

- [ ] **Step 4: Run the calendar store tests**

Run:

```bash
npm test -- tests/calendar-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/db.ts tests/calendar-store.test.ts
git commit -m "feat: import calendar events"
```

---

## Task 4: Add Calendar API Routes

**Files:**
- Modify: `server/app.ts`
- Test: `tests/calendar-api.test.ts`

- [ ] **Step 1: Write failing API tests**

Create `tests/calendar-api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createServerApp } from "../server/app.js";
import { createDataStore } from "../server/db.js";

describe("calendar API", () => {
  it("serves public calendar events for one month", async () => {
    const store = await createDataStore({ inMemory: true });
    const brand = store.createBrand({ displayName: "笑声工厂", cityName: "上海" });
    const venue = store.createVenue({ displayName: "喜剧剧场", cityName: "上海" });
    store.createCalendarEvent({
      title: "周六开放麦",
      eventDate: "2026-04-18",
      startTime: "20:00",
      brandID: brand.id,
      venueID: venue.id,
      format: "standup",
      myRole: "host",
      showType: "openMic"
    });

    const app = await createServerApp({ store, adminPassword: "secret", sessionSecret: "test-secret" });
    const response = await request(app).get("/api/public/calendar?month=2026-04").expect(200);

    expect(response.body.items[0].title).toBe("周六开放麦");
    expect(response.body.items[0].brand.displayName).toBe("笑声工厂");
  });

  it("requires admin auth for calendar mutations and imports JSON", async () => {
    const store = await createDataStore({ inMemory: true });
    const app = await createServerApp({ store, adminPassword: "secret", sessionSecret: "test-secret" });

    await request(app).post("/api/admin/calendar").send({ title: "未授权" }).expect(401);

    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: "secret" }).expect(200);
    const template = await agent.get("/api/admin/calendar/import-template").expect(200);
    expect(template.body[0]).toHaveProperty("date");

    const imported = await agent
      .post("/api/admin/calendar/import")
      .send([
        {
          date: "2026-04-18",
          startTime: "20:00",
          brand: "笑声工厂",
          venue: "喜剧剧场",
          city: "上海",
          format: "单口",
          myRole: "主持",
          showType: "开放麦"
        }
      ])
      .expect(200);
    expect(imported.body.importedCount).toBe(1);

    const created = await agent.post(`/api/admin/calendar/${store.listCalendarEvents()[0].id}/create-show`).expect(201);
    expect(created.body.title).toContain("笑声工厂");
  });
});
```

- [ ] **Step 2: Run the API test to verify it fails**

Run:

```bash
npm test -- tests/calendar-api.test.ts
```

Expected: FAIL because routes are missing.

- [ ] **Step 3: Add routes to `server/app.ts`**

Add near public show routes:

```ts
app.get("/api/public/calendar", (req, res) => {
  res.json({
    items: options.store.listPublicCalendarEvents({
      month: typeof req.query.month === "string" ? req.query.month : undefined
    })
  });
});

app.get("/api/public/calendar/upcoming", (req, res) => {
  const days = Number(req.query.days ?? 7);
  res.json({ items: options.store.listUpcomingPublicCalendarEvents(days) });
});
```

Add `listUpcomingPublicCalendarEvents(days: number)` to `DataStore`:

```ts
listUpcomingPublicCalendarEvents(days: number): PublicCalendarEventSummary[] {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + Math.max(1, days));
  const startDate = now.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  return this.listCalendarEvents()
    .filter((event) => event.eventDate >= startDate && event.eventDate <= endDate)
    .map((event) => this.toPublicCalendarEvent(event));
}
```

Add near admin routes:

```ts
app.get("/api/admin/calendar", requireAdmin, (_req, res) => {
  res.json({ items: options.store.listCalendarEvents() });
});

app.post("/api/admin/calendar", requireAdmin, (req, res, next) => {
  try {
    res.status(201).json(options.store.createCalendarEvent(parseBody(req.body)));
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/calendar/:id", requireAdmin, (req, res, next) => {
  try {
    res.json(options.store.updateCalendarEvent(String(req.params.id), parseBody(req.body)));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/calendar/:id", requireAdmin, (req, res, next) => {
  try {
    options.store.deleteCalendarEvent(String(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/calendar/import-template", requireAdmin, (_req, res) => {
  res.json(calendarImportTemplate);
});

app.post("/api/admin/calendar/import", requireAdmin, (req, res, next) => {
  try {
    if (!Array.isArray(req.body)) return res.status(400).json({ error: "导入内容必须是 JSON 数组。" });
    res.json(options.store.importCalendarRows(req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/calendar/:id/create-show", requireAdmin, (req, res, next) => {
  try {
    res.status(201).json(options.store.createShowFromCalendarEvent(String(req.params.id)));
  } catch (error) {
    next(error);
  }
});
```

Add `calendarImportTemplate` in `server/app.ts`:

```ts
const calendarImportTemplate = [
  {
    date: "2026-04-18",
    startTime: "20:00",
    brand: "某某喜剧",
    venue: "某某剧场",
    city: "上海",
    format: "单口",
    myRole: "主持",
    showType: "开放麦",
    title: "周六开放麦",
    notes: "可选备注"
  }
];
```

- [ ] **Step 4: Run API tests**

Run:

```bash
npm test -- tests/calendar-api.test.ts tests/public-api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/app.ts server/db.ts tests/calendar-api.test.ts
git commit -m "feat: add calendar api"
```

---

## Task 5: Add Home, Route Shell, and Placeholder Pages

**Files:**
- Create: `src/api.ts`
- Create: `src/home-page.tsx`
- Create: `src/coming-soon.tsx`
- Modify: `src/main.tsx`
- Modify: `src/styles.css`
- Test: `tests/home-page.test.tsx`

- [ ] **Step 1: Write failing home page tests**

Create `tests/home-page.test.tsx`:

```tsx
// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "../src/home-page";

describe("HomePage", () => {
  it("presents the comedy center modules", () => {
    render(<HomePage onNavigate={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /马达的喜剧中心/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /票根精选/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /本周演出日历/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /留言精选/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /喜剧日记/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the home page test to verify it fails**

Run:

```bash
npm test -- tests/home-page.test.tsx
```

Expected: FAIL because `src/home-page.tsx` does not exist.

- [ ] **Step 3: Create shared fetch helper**

Create `src/api.ts`:

```ts
export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error((await response.json()).error ?? "请求失败");
  return response.json() as Promise<T>;
}
```

Remove the local `fetchJSON` function from `src/main.tsx` and import this helper there.

- [ ] **Step 4: Create `HomePage`**

Create `src/home-page.tsx`:

```tsx
import React from "react";

interface HomePageProps {
  onNavigate: (path: string) => void;
}

const modules = [
  { title: "票根精选", body: "回看已经发生的现场。", path: "/tickets", enabled: true },
  { title: "本周演出日历", body: "看看接下来在哪上台。", path: "/calendar", enabled: true },
  { title: "留言精选", body: "第二期开放。", path: "/guestbook", enabled: false },
  { title: "喜剧日记", body: "第二期开放。", path: "/diary", enabled: false },
  { title: "马达和他的朋友们", body: "第三期开放。", path: "/friends", enabled: false }
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
        <h1>这里收藏马达的演出、票根、朋友和一些现场之后才会想起的话。</h1>
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
```

- [ ] **Step 5: Create placeholder page**

Create `src/coming-soon.tsx`:

```tsx
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
```

- [ ] **Step 6: Update routes in `src/main.tsx`**

Import:

```ts
import { fetchJSON } from "./api";
import { ComingSoonPage } from "./coming-soon";
import { HomePage } from "./home-page";
```

Update `routeFromLocation()`:

```ts
if (path.startsWith("/admin")) return { path: "/admin", params: {} };
if (path.startsWith("/tickets")) return { path: "/tickets", params: {} };
if (path.startsWith("/calendar")) return { path: "/calendar", params: {} };
if (path.startsWith("/guestbook")) return { path: "/guestbook", params: {} };
if (path.startsWith("/diary")) return { path: "/diary", params: {} };
if (path.startsWith("/friends")) return { path: "/friends", params: {} };
```

Update `App()`:

```tsx
if (route.path === "/admin") return <AdminApp />;
if (route.path === "/shows/:id") return <ShowDetail id={route.params.id} />;
if (route.path === "/tickets") return <ArchiveWall />;
if (route.path === "/calendar") return <ComingSoonPage title="演出日历" onNavigate={navigate} />;
if (route.path === "/guestbook") return <ComingSoonPage title="留言板" onNavigate={navigate} />;
if (route.path === "/diary") return <ComingSoonPage title="喜剧日记" onNavigate={navigate} />;
if (route.path === "/friends") return <ComingSoonPage title="马达和他的朋友们" onNavigate={navigate} />;
return <HomePage onNavigate={navigate} />;
```

Task 6 replaces the `/calendar` branch with the real calendar page after `src/calendar-page.tsx` exists.

- [ ] **Step 7: Add baseline glass styles**

Append to `src/styles.css`:

```css
.glass-nav,
.glass-panel {
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.68);
  box-shadow: 0 18px 48px rgba(89, 75, 53, 0.12);
  backdrop-filter: blur(18px);
}

.home-page {
  display: grid;
  gap: 28px;
}

.home-hero {
  display: grid;
  gap: 16px;
  padding: 52px 0 22px;
}

.home-hero p {
  max-width: 700px;
  color: #66736f;
}

.home-updates {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 0.8fr);
  gap: 20px;
  border-radius: 8px;
  padding: 22px;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
}

.module-card {
  display: grid;
  min-height: 150px;
  gap: 10px;
  align-content: start;
  border-radius: 8px;
  color: #182125;
  padding: 18px;
  text-align: left;
  cursor: pointer;
}

.module-card span,
.module-card em,
.coming-soon-panel p {
  color: #66736f;
}

.module-card em {
  font-style: normal;
  font-weight: 800;
}

.coming-soon-panel {
  margin-top: 24px;
  border-radius: 8px;
  padding: 34px;
}
```

- [ ] **Step 8: Run tests**

Run:

```bash
npm test -- tests/home-page.test.tsx tests/ticket-card.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/api.ts src/home-page.tsx src/coming-soon.tsx src/main.tsx src/styles.css tests/home-page.test.tsx tests/ticket-card.test.tsx
git commit -m "feat: add comedy center home shell"
```

---

## Task 6: Add Public Calendar Page

**Files:**
- Create: `src/calendar-page.tsx`
- Modify: `src/main.tsx`
- Modify: `src/styles.css`
- Test: `tests/calendar-page.test.tsx`

- [ ] **Step 1: Write failing public calendar page tests**

Create `tests/calendar-page.test.tsx`:

```tsx
// @vitest-environment jsdom

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarPage } from "../src/calendar-page";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CalendarPage", () => {
  it("renders month events and toggles to list view", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "event-1",
            title: "周六开放麦",
            eventDate: "2026-04-18",
            startTime: "20:00",
            format: "standup",
            myRole: "host",
            showType: "openMic",
            brand: { id: "brand-1", displayName: "笑声工厂", cityName: "上海" },
            venue: { id: "venue-1", displayName: "喜剧剧场", cityName: "上海", district: "静安" },
            notes: "带计时器"
          }
        ]
      })
    } as Response);

    const user = userEvent.setup();
    render(<CalendarPage onNavigate={vi.fn()} initialMonth="2026-04" />);

    await waitFor(() => expect(screen.getByText("周六开放麦")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "列表" }));
    expect(screen.getByRole("heading", { name: /2026 年 4 月演出列表/i })).toBeTruthy();
    expect(screen.getByText(/笑声工厂/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/calendar-page.test.tsx
```

Expected: FAIL because `src/calendar-page.tsx` does not exist.

- [ ] **Step 3: Implement `CalendarPage`**

Create `src/calendar-page.tsx`:

```tsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchJSON } from "./api";
import { formatLabels, roleLabels, typeLabels, type PublicCalendarEventSummary } from "../shared/domain";

type ViewMode = "month" | "list";

export function CalendarPage({ onNavigate, initialMonth }: { onNavigate: (path: string) => void; initialMonth?: string }) {
  const [month, setMonth] = useState(initialMonth ?? new Date().toISOString().slice(0, 7));
  const [mode, setMode] = useState<ViewMode>("month");
  const [events, setEvents] = useState<PublicCalendarEventSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetchJSON<{ items: PublicCalendarEventSummary[] }>(`/api/public/calendar?month=${month}`)
      .then((data) => setEvents(data.items))
      .catch((error) => console.error(error));
  }, [month]);

  const days = useMemo(() => monthGrid(month), [month]);
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];

  return (
    <main className="page calendar-page">
      <header className="topbar glass-nav">
        <button className="brand-lockup" onClick={() => onNavigate("/")}>
          <img src="/app-icon.png" alt="XYSG" />
          <span>演出日历</span>
        </button>
        <button className="ghost-button glass-button" onClick={() => onNavigate("/tickets")}>去票根墙</button>
      </header>

      <section className="calendar-hero">
        <p className="eyebrow">Live Calendar</p>
        <h1>这个月，马达会出现在哪些现场。</h1>
      </section>

      <section className="calendar-toolbar">
        <button className="chip" onClick={() => setMonth(shiftMonth(month, -1))}>上个月</button>
        <strong>{formatMonthLabel(month)}</strong>
        <button className="chip" onClick={() => setMonth(shiftMonth(month, 1))}>下个月</button>
        <button className={mode === "month" ? "chip active" : "chip"} onClick={() => setMode("month")}>月历</button>
        <button className={mode === "list" ? "chip active" : "chip"} onClick={() => setMode("list")}>列表</button>
      </section>

      {mode === "month" ? (
        <section className="calendar-shell glass-panel">
          <div className="calendar-grid">
            {["一", "二", "三", "四", "五", "六", "日"].map((day) => <strong key={day}>{day}</strong>)}
            {days.map((day) => {
              const dateEvents = day ? eventsByDate.get(day) ?? [] : [];
              return (
                <button key={day ?? Math.random()} className="calendar-day" onClick={() => day && setSelectedDate(day)} disabled={!day}>
                  {day ? <span>{Number(day.slice(-2))}</span> : null}
                  {dateEvents.length > 0 ? <em>{dateEvents.length} 场</em> : null}
                </button>
              );
            })}
          </div>
          <div className="day-detail">
            <h2>{selectedDate ? `${selectedDate} 的演出` : "选择一个有演出的日子"}</h2>
            {selectedEvents.map((event) => <CalendarEventCard key={event.id} event={event} />)}
          </div>
        </section>
      ) : (
        <section className="calendar-list glass-panel">
          <h2>{formatMonthLabel(month)}演出列表</h2>
          {events.map((event) => <CalendarEventCard key={event.id} event={event} />)}
        </section>
      )}
    </main>
  );
}

function CalendarEventCard({ event }: { event: PublicCalendarEventSummary }) {
  return (
    <article className="calendar-event-card">
      <p className="eyebrow">{event.eventDate} {event.startTime}</p>
      <h3>{event.title}</h3>
      <p>{event.brand.displayName} · {event.venue.displayName}</p>
      <div className="tag-row">
        <span>{formatLabels[event.format]}</span>
        <span>{roleLabels[event.myRole]}</span>
        <span>{typeLabels[event.showType]}</span>
      </div>
    </article>
  );
}
```

Add helper functions in the same file:

```ts
function monthGrid(month: string): (string | null)[] {
  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(year, monthIndex - 1, 1);
  const totalDays = new Date(year, monthIndex, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function groupEventsByDate(events: PublicCalendarEventSummary[]): Map<string, PublicCalendarEventSummary[]> {
  const byDate = new Map<string, PublicCalendarEventSummary[]>();
  for (const event of events) {
    byDate.set(event.eventDate, [...(byDate.get(event.eventDate) ?? []), event]);
  }
  return byDate;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return `${year} 年 ${monthIndex} 月`;
}
```

Import the calendar page in `src/main.tsx`:

```ts
import { CalendarPage } from "./calendar-page";
```

Replace the `/calendar` branch in `App()`:

```tsx
if (route.path === "/calendar") return <CalendarPage onNavigate={navigate} />;
```

- [ ] **Step 4: Add calendar styles**

Append to `src/styles.css`:

```css
.calendar-page {
  display: grid;
  gap: 24px;
}

.calendar-hero {
  display: grid;
  gap: 14px;
  padding: 22px 0;
}

.calendar-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.calendar-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.85fr);
  gap: 18px;
  border-radius: 8px;
  padding: 18px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.calendar-day {
  min-height: 92px;
  border: 1px solid #dfe6dd;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: #182125;
  padding: 10px;
  text-align: left;
  cursor: pointer;
}

.calendar-day:disabled {
  cursor: default;
  opacity: 0.4;
}

.calendar-day em {
  display: inline-block;
  margin-top: 16px;
  color: #d85c44;
  font-style: normal;
  font-weight: 800;
}

.day-detail,
.calendar-list {
  display: grid;
  gap: 14px;
}

.calendar-list {
  border-radius: 8px;
  padding: 18px;
}

.calendar-event-card {
  border: 1px solid #e0e8e2;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.78);
  padding: 16px;
}
```

- [ ] **Step 5: Run public calendar tests**

Run:

```bash
npm test -- tests/calendar-page.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/calendar-page.tsx src/main.tsx src/styles.css tests/calendar-page.test.tsx
git commit -m "feat: add public calendar page"
```

---

## Task 7: Add Admin Calendar UI

**Files:**
- Create: `src/admin-calendar.tsx`
- Modify: `src/main.tsx`
- Modify: `src/styles.css`
- Test: `tests/admin-calendar.test.tsx`

- [ ] **Step 1: Write failing admin calendar tests**

Create `tests/admin-calendar.test.tsx`:

```tsx
// @vitest-environment jsdom

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarAdmin } from "../src/admin-calendar";
import type { BrandRecord, VenueRecord } from "../shared/domain";

const brand: BrandRecord = {
  id: "brand-1",
  displayName: "笑声工厂",
  normalizedKey: "笑声工厂",
  cityName: "上海",
  accentColorHex: null,
  performerIDs: [],
  venueIDs: [],
  createdAt: "2026-04-10T00:00:00Z",
  updatedAt: "2026-04-10T00:00:00Z"
};

const venue: VenueRecord = {
  id: "venue-1",
  displayName: "喜剧剧场",
  normalizedKey: "喜剧剧场",
  lookupKey: "喜剧剧场::上海",
  addressLine: null,
  district: "静安",
  cityName: "上海",
  performerIDs: [],
  createdAt: "2026-04-10T00:00:00Z",
  updatedAt: "2026-04-10T00:00:00Z"
};

describe("CalendarAdmin", () => {
  it("shows existing events and the JSON template link", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          id: "event-1",
          title: "周六开放麦",
          eventDate: "2026-04-18",
          startTime: "20:00",
          brandID: "brand-1",
          venueID: "venue-1",
          format: "standup",
          myRole: "host",
          showType: "openMic",
          notes: "",
          source: "manual",
          createdShowID: null,
          createdAt: "2026-04-10T00:00:00Z",
          updatedAt: "2026-04-10T00:00:00Z"
        }]
      })
    } as Response);

    render(<CalendarAdmin brands={[brand]} venues={[venue]} onChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("周六开放麦")).toBeTruthy());
    expect(screen.getByRole("link", { name: /下载 JSON 示例/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /生成票根/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/admin-calendar.test.tsx
```

Expected: FAIL because `src/admin-calendar.tsx` does not exist.

- [ ] **Step 3: Implement `CalendarAdmin`**

Create `src/admin-calendar.tsx`:

```tsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchJSON } from "./api";
import { formatLabels, roleLabels, showFormats, showRoles, showTypes, typeLabels, type BrandRecord, type CalendarEventRecord, type ShowFormat, type ShowRole, type ShowType, type VenueRecord } from "../shared/domain";

interface CalendarAdminProps {
  brands: BrandRecord[];
  venues: VenueRecord[];
  onChanged: () => void;
}

export function CalendarAdmin({ brands, venues, onChanged }: CalendarAdminProps) {
  const emptyForm = useMemo(() => ({
    title: "",
    eventDate: new Date().toISOString().slice(0, 10),
    startTime: "20:00",
    brandID: brands[0]?.id ?? "",
    venueID: venues[0]?.id ?? "",
    format: "standup" as ShowFormat,
    myRole: "performer" as ShowRole,
    showType: "showcase" as ShowType,
    notes: ""
  }), [brands, venues]);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [editing, setEditing] = useState<CalendarEventRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<string>("");

  useEffect(() => setForm(emptyForm), [emptyForm]);
  useEffect(() => { refresh(); }, []);

  async function refresh() {
    const data = await fetchJSON<{ items: CalendarEventRecord[] }>("/api/admin/calendar");
    setEvents(data.items);
  }

  async function save(event: React.FormEvent) {
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
        <button className="ghost-button" onClick={importJSON}>导入 JSON</button>
        {importResult ? <p className="muted">{importResult}</p> : null}
        {events.map((item) => (
          <div className="admin-row" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.eventDate} {item.startTime} · {formatLabels[item.format]} · {roleLabels[item.myRole]} · {typeLabels[item.showType]}</span>
            </div>
            <button onClick={() => { setEditing(item); setForm(item); }}>编辑</button>
            <button onClick={() => createShow(item.id)} disabled={Boolean(item.createdShowID)}>{item.createdShowID ? "已生成" : "生成票根"}</button>
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
```

- [ ] **Step 4: Wire admin tab in `src/main.tsx`**

Import:

```ts
import { CalendarAdmin } from "./admin-calendar";
```

Change tab type:

```ts
const [tab, setTab] = useState<"shows" | "entities" | "calendar" | "backup">("shows");
```

Add nav button:

```tsx
<button className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}>日历</button>
```

Add panel:

```tsx
{tab === "calendar" ? <CalendarAdmin brands={snapshot.brands} venues={snapshot.venues} onChanged={() => refreshSnapshot(setSnapshot)} /> : null}
```

- [ ] **Step 5: Run admin calendar tests**

Run:

```bash
npm test -- tests/admin-calendar.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/admin-calendar.tsx src/main.tsx src/styles.css tests/admin-calendar.test.tsx
git commit -m "feat: add admin calendar management"
```

---

## Task 8: Final Integration, Styling, and Verification

**Files:**
- Modify: `src/styles.css`
- Modify: `README.md`

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run typecheck and production build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 3: Start the dev server**

Run:

```bash
npm run dev
```

Expected: Vite starts on `http://localhost:5173` and the API server starts on `http://localhost:3008`.

- [ ] **Step 4: Browser smoke-check the implemented routes**

Open these URLs:

```text
http://localhost:5173/
http://localhost:5173/tickets
http://localhost:5173/calendar
http://localhost:5173/guestbook
http://localhost:5173/diary
http://localhost:5173/friends
http://localhost:5173/admin
```

Expected:

- `/` shows the new comedy center home page with bright warm glass styling.
- `/tickets` shows the existing ticket wall.
- `/calendar` shows month/list controls without console errors.
- Placeholder routes explain they are coming later.
- `/admin` still requires login and includes the new 日历 tab after authentication.

- [ ] **Step 5: Inspect git diff for accidental generated files**

Run:

```bash
git status --short
git diff --stat
```

Expected: no `.superpowers/`, `dist/`, `data/`, `.env`, or uploaded cover files are staged or modified.

- [ ] **Step 6: Document the phase-one routes and JSON import workflow**

Add this section to `README.md` after the local development section:

````md
## 功能入口

- `/`：马达的喜剧中心首页。
- `/tickets`：票根墙。
- `/calendar`：演出日历，支持月历和列表视图。
- `/admin`：后台管理，包含票根、实体、日历和备份。

## 日历 JSON 导入

后台日历管理页提供 JSON 示例下载。导入格式是一个数组：

```json
[
  {
    "date": "2026-04-18",
    "startTime": "20:00",
    "brand": "某某喜剧",
    "venue": "某某剧场",
    "city": "上海",
    "format": "单口",
    "myRole": "主持",
    "showType": "开放麦",
    "title": "周六开放麦",
    "notes": "可选备注"
  }
]
```

导入时会自动匹配厂牌和场地；如果找不到，会自动创建并在导入结果里汇总。
````

- [ ] **Step 7: Commit final documentation and style polish**

```bash
git add README.md src/styles.css
git commit -m "docs: document calendar import flow"
```
