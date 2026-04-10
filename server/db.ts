import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { v4 as uuidv4 } from "uuid";
import {
  asNullableString,
  formatLabels,
  roleLabels,
  typeLabels,
  nowISO,
  normalizeValue,
  storedTitle,
  venueLookupKey,
  type CalendarEventInput,
  type CalendarImportResult,
  type CalendarImportRow,
  type CalendarEventRecord,
  type CalendarSource,
  type ArchiveSummary,
  type BackupPayload,
  type BackupShowRecord,
  type BrandRecord,
  type PerformerRecord,
  type PublicCalendarEventSummary,
  type PublicShowSummary,
  type ShowFormat,
  type ShowRecord,
  type ShowRole,
  type ShowStatus,
  type ShowType,
  type VenueRecord
} from "../shared/domain.js";

type RowValue = string | number | Uint8Array | null;
type Row = Record<string, RowValue>;

export interface DataStoreOptions {
  inMemory?: boolean;
  dataDir?: string;
}

export interface ShowInput {
  title?: string;
  coverFileName?: string | null;
  date?: string | null;
  venueID?: string | null;
  brandID?: string | null;
  performerIDs?: string[];
  format?: ShowFormat;
  myRole?: ShowRole;
  showType?: ShowType;
  notes?: string;
  notesPublic?: boolean;
  tags?: string[];
  status?: ShowStatus;
  achievementFlags?: string[];
}

export interface PerformerInput {
  displayName: string;
  stageName?: string | null;
  avatarFileName?: string | null;
  brandIDs?: string[];
}

export interface BrandInput {
  displayName: string;
  cityName?: string | null;
  accentColorHex?: string | null;
  performerIDs?: string[];
  venueIDs?: string[];
}

export interface VenueInput {
  displayName: string;
  cityName?: string | null;
  district?: string | null;
  addressLine?: string | null;
  performerIDs?: string[];
}

export class DataStore {
  private readonly db: Database;
  private readonly dbPath: string | null;
  private readonly coverDir: string | null;
  private readonly memoryCovers = new Map<string, Buffer>();

  constructor(db: Database, options: DataStoreOptions) {
    this.db = db;
    this.dbPath = options.inMemory ? null : path.join(options.dataDir ?? "data", "xysg.sqlite");
    this.coverDir = options.inMemory ? null : path.join(options.dataDir ?? "data", "covers");
    this.createSchema();
    this.persist();
  }

  close(): void {
    this.persist();
    this.db.close();
  }

  publicSummary(): ArchiveSummary {
    const shows = this.listShows();
    const published = shows.filter((show) => show.status === "published");
    const formatCounts: Record<string, number> = {};
    const roleCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    const brandCounts: Record<string, number> = {};

    for (const show of published) {
      formatCounts[show.format] = (formatCounts[show.format] ?? 0) + 1;
      roleCounts[show.myRole] = (roleCounts[show.myRole] ?? 0) + 1;
      typeCounts[show.showType] = (typeCounts[show.showType] ?? 0) + 1;
      if (show.brandID) brandCounts[show.brandID] = (brandCounts[show.brandID] ?? 0) + 1;
    }

    return {
      totalShows: published.length,
      latestShowDate: published.map((show) => show.date).filter(Boolean).sort().at(-1) ?? null,
      formatCounts,
      roleCounts,
      typeCounts,
      brandCounts,
      brands: this.listBrands()
        .filter((brand) => brandCounts[brand.id])
        .map((brand) => ({ id: brand.id, displayName: brand.displayName }))
    };
  }

  listPublicShows(filters: { format?: string; brandID?: string } = {}): PublicShowSummary[] {
    return this.listShows()
      .filter((show) => show.status === "published")
      .filter((show) => !filters.format || show.format === filters.format)
      .filter((show) => !filters.brandID || show.brandID === filters.brandID)
      .sort(byDateDesc)
      .map((show) => this.toPublicShow(show, false));
  }

  getPublicShow(id: string): PublicShowSummary | null {
    const show = this.getShow(id);
    if (!show || show.status !== "published") return null;
    return this.toPublicShow(show, true);
  }

  listShows(): ShowRecord[] {
    return this.queryAll("SELECT * FROM shows").map((row) => this.showFromRow(row));
  }

  getShow(id: string): ShowRecord | null {
    const row = this.queryOne("SELECT * FROM shows WHERE id = ?", [id]);
    return row ? this.showFromRow(row) : null;
  }

  createShow(input: ShowInput): ShowRecord {
    const now = nowISO();
    const show: ShowRecord = {
      id: uuidv4(),
      title: storedTitle(input.title ?? ""),
      coverFileName: input.coverFileName ?? null,
      date: asNullableString(input.date) ?? null,
      venueID: input.venueID ?? null,
      brandID: input.brandID ?? null,
      performerIDs: input.performerIDs ?? [],
      format: input.format ?? "standup",
      myRole: input.myRole ?? "performer",
      showType: input.showType ?? "showcase",
      notes: input.notes ?? "",
      notesPublic: input.notesPublic ?? false,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
      status: input.status ?? "published",
      achievementFlags: input.achievementFlags ?? []
    };
    this.db.run(
      `INSERT INTO shows
       (id, title, coverFileName, date, venueID, brandID, format, myRole, showType, notes, notesPublic, tags, createdAt, updatedAt, status, achievementFlags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      showParams(show)
    );
    this.replaceShowPerformers(show.id, show.performerIDs);
    this.persist();
    return show;
  }

  updateShow(id: string, input: ShowInput): ShowRecord {
    const existing = this.requireShow(id);
    const updated: ShowRecord = {
      ...existing,
      title: input.title === undefined ? existing.title : storedTitle(input.title),
      coverFileName: input.coverFileName === undefined ? existing.coverFileName : input.coverFileName,
      date: input.date === undefined ? existing.date : asNullableString(input.date),
      venueID: input.venueID === undefined ? existing.venueID : input.venueID,
      brandID: input.brandID === undefined ? existing.brandID : input.brandID,
      performerIDs: input.performerIDs ?? existing.performerIDs,
      format: input.format ?? existing.format,
      myRole: input.myRole ?? existing.myRole,
      showType: input.showType ?? existing.showType,
      notes: input.notes ?? existing.notes,
      notesPublic: input.notesPublic ?? existing.notesPublic,
      tags: input.tags ?? existing.tags,
      updatedAt: nowISO(),
      status: input.status ?? existing.status,
      achievementFlags: input.achievementFlags ?? existing.achievementFlags
    };
    this.db.run(
      `UPDATE shows SET
       title = ?, coverFileName = ?, date = ?, venueID = ?, brandID = ?, format = ?, myRole = ?, showType = ?,
       notes = ?, notesPublic = ?, tags = ?, updatedAt = ?, status = ?, achievementFlags = ?
       WHERE id = ?`,
      [
        updated.title,
        updated.coverFileName,
        updated.date,
        updated.venueID,
        updated.brandID,
        updated.format,
        updated.myRole,
        updated.showType,
        updated.notes,
        updated.notesPublic ? 1 : 0,
        JSON.stringify(updated.tags),
        updated.updatedAt,
        updated.status,
        JSON.stringify(updated.achievementFlags),
        id
      ]
    );
    this.replaceShowPerformers(id, updated.performerIDs);
    this.persist();
    return updated;
  }

  deleteShow(id: string): void {
    this.db.run("DELETE FROM shows WHERE id = ?", [id]);
    this.db.run("DELETE FROM show_performers WHERE showID = ?", [id]);
    this.db.run("UPDATE calendar_events SET createdShowID = NULL, updatedAt = ? WHERE createdShowID = ?", [nowISO(), id]);
    this.persist();
  }

  listPerformers(): PerformerRecord[] {
    return this.queryAll("SELECT * FROM performers ORDER BY displayName").map((row) => this.performerFromRow(row));
  }

  createPerformer(input: PerformerInput): PerformerRecord {
    const now = nowISO();
    const displayName = requiredName(input.displayName, "演员");
    const performer: PerformerRecord = {
      id: uuidv4(),
      displayName,
      normalizedKey: normalizeValue(displayName),
      stageName: asNullableString(input.stageName),
      avatarFileName: asNullableString(input.avatarFileName),
      brandIDs: input.brandIDs ?? [],
      createdAt: now,
      updatedAt: now
    };
    this.db.run(
      "INSERT INTO performers (id, displayName, normalizedKey, stageName, avatarFileName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [performer.id, performer.displayName, performer.normalizedKey, performer.stageName, performer.avatarFileName, performer.createdAt, performer.updatedAt]
    );
    this.replacePerformerBrands(performer.id, performer.brandIDs);
    this.persist();
    return performer;
  }

  updatePerformer(id: string, input: PerformerInput): PerformerRecord {
    const existing = this.listPerformers().find((performer) => performer.id === id);
    if (!existing) throw new Error("演员不存在。");
    const displayName = requiredName(input.displayName, "演员");
    const updated = {
      ...existing,
      displayName,
      normalizedKey: normalizeValue(displayName),
      stageName: asNullableString(input.stageName),
      avatarFileName: asNullableString(input.avatarFileName),
      brandIDs: input.brandIDs ?? [],
      updatedAt: nowISO()
    };
    this.db.run(
      "UPDATE performers SET displayName = ?, normalizedKey = ?, stageName = ?, avatarFileName = ?, updatedAt = ? WHERE id = ?",
      [updated.displayName, updated.normalizedKey, updated.stageName, updated.avatarFileName, updated.updatedAt, id]
    );
    this.replacePerformerBrands(id, updated.brandIDs);
    this.persist();
    return updated;
  }

  deletePerformer(id: string): void {
    if (this.queryOne("SELECT showID FROM show_performers WHERE performerID = ? LIMIT 1", [id])) {
      throw new Error("演员仍被演出引用，暂时不能删除。");
    }
    this.db.run("DELETE FROM performers WHERE id = ?", [id]);
    this.db.run("DELETE FROM performer_brands WHERE performerID = ?", [id]);
    this.db.run("DELETE FROM venue_performers WHERE performerID = ?", [id]);
    this.persist();
  }

  listBrands(): BrandRecord[] {
    return this.queryAll("SELECT * FROM brands ORDER BY displayName").map((row) => this.brandFromRow(row));
  }

  createBrand(input: BrandInput): BrandRecord {
    const now = nowISO();
    const displayName = requiredName(input.displayName, "厂牌");
    const brand: BrandRecord = {
      id: uuidv4(),
      displayName,
      normalizedKey: normalizeValue(displayName),
      cityName: asNullableString(input.cityName),
      accentColorHex: asNullableString(input.accentColorHex),
      performerIDs: input.performerIDs ?? [],
      venueIDs: input.venueIDs ?? [],
      createdAt: now,
      updatedAt: now
    };
    this.db.run(
      "INSERT INTO brands (id, displayName, normalizedKey, cityName, accentColorHex, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [brand.id, brand.displayName, brand.normalizedKey, brand.cityName, brand.accentColorHex, brand.createdAt, brand.updatedAt]
    );
    this.replaceBrandPerformers(brand.id, brand.performerIDs);
    this.replaceBrandVenues(brand.id, brand.venueIDs);
    this.persist();
    return brand;
  }

  updateBrand(id: string, input: BrandInput): BrandRecord {
    const existing = this.listBrands().find((brand) => brand.id === id);
    if (!existing) throw new Error("厂牌不存在。");
    const displayName = requiredName(input.displayName, "厂牌");
    const updated = {
      ...existing,
      displayName,
      normalizedKey: normalizeValue(displayName),
      cityName: asNullableString(input.cityName),
      accentColorHex: asNullableString(input.accentColorHex),
      performerIDs: input.performerIDs ?? [],
      venueIDs: input.venueIDs ?? [],
      updatedAt: nowISO()
    };
    this.db.run(
      "UPDATE brands SET displayName = ?, normalizedKey = ?, cityName = ?, accentColorHex = ?, updatedAt = ? WHERE id = ?",
      [updated.displayName, updated.normalizedKey, updated.cityName, updated.accentColorHex, updated.updatedAt, id]
    );
    this.replaceBrandPerformers(id, updated.performerIDs);
    this.replaceBrandVenues(id, updated.venueIDs);
    this.persist();
    return updated;
  }

  deleteBrand(id: string): void {
    if (this.queryOne("SELECT id FROM shows WHERE brandID = ? LIMIT 1", [id])) {
      throw new Error("厂牌仍被演出引用，暂时不能删除。");
    }
    if (this.queryOne("SELECT id FROM calendar_events WHERE brandID = ? LIMIT 1", [id])) {
      throw new Error("厂牌仍被日历事件引用，暂时不能删除。");
    }
    this.db.run("DELETE FROM brands WHERE id = ?", [id]);
    this.db.run("DELETE FROM performer_brands WHERE brandID = ?", [id]);
    this.db.run("DELETE FROM brand_performers WHERE brandID = ?", [id]);
    this.db.run("DELETE FROM brand_venues WHERE brandID = ?", [id]);
    this.persist();
  }

  listVenues(): VenueRecord[] {
    return this.queryAll("SELECT * FROM venues ORDER BY displayName").map((row) => this.venueFromRow(row));
  }

  createVenue(input: VenueInput): VenueRecord {
    const now = nowISO();
    const displayName = requiredName(input.displayName, "场地");
    const cityName = asNullableString(input.cityName);
    const venue: VenueRecord = {
      id: uuidv4(),
      displayName,
      normalizedKey: normalizeValue(displayName),
      lookupKey: venueLookupKey(displayName, cityName),
      addressLine: asNullableString(input.addressLine),
      district: asNullableString(input.district),
      cityName,
      performerIDs: input.performerIDs ?? [],
      createdAt: now,
      updatedAt: now
    };
    this.db.run(
      "INSERT INTO venues (id, displayName, normalizedKey, lookupKey, addressLine, district, cityName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [venue.id, venue.displayName, venue.normalizedKey, venue.lookupKey, venue.addressLine, venue.district, venue.cityName, venue.createdAt, venue.updatedAt]
    );
    this.replaceVenuePerformers(venue.id, venue.performerIDs);
    this.persist();
    return venue;
  }

  updateVenue(id: string, input: VenueInput): VenueRecord {
    const existing = this.listVenues().find((venue) => venue.id === id);
    if (!existing) throw new Error("场地不存在。");
    const displayName = requiredName(input.displayName, "场地");
    const cityName = asNullableString(input.cityName);
    const updated = {
      ...existing,
      displayName,
      normalizedKey: normalizeValue(displayName),
      lookupKey: venueLookupKey(displayName, cityName),
      addressLine: asNullableString(input.addressLine),
      district: asNullableString(input.district),
      cityName,
      performerIDs: input.performerIDs ?? [],
      updatedAt: nowISO()
    };
    this.db.run(
      "UPDATE venues SET displayName = ?, normalizedKey = ?, lookupKey = ?, addressLine = ?, district = ?, cityName = ?, updatedAt = ? WHERE id = ?",
      [updated.displayName, updated.normalizedKey, updated.lookupKey, updated.addressLine, updated.district, updated.cityName, updated.updatedAt, id]
    );
    this.replaceVenuePerformers(id, updated.performerIDs);
    this.persist();
    return updated;
  }

  deleteVenue(id: string): void {
    if (this.queryOne("SELECT id FROM shows WHERE venueID = ? LIMIT 1", [id])) {
      throw new Error("场地仍被演出引用，暂时不能删除。");
    }
    if (this.queryOne("SELECT id FROM calendar_events WHERE venueID = ? LIMIT 1", [id])) {
      throw new Error("场地仍被日历事件引用，暂时不能删除。");
    }
    this.db.run("DELETE FROM venues WHERE id = ?", [id]);
    this.db.run("DELETE FROM brand_venues WHERE venueID = ?", [id]);
    this.db.run("DELETE FROM venue_performers WHERE venueID = ?", [id]);
    this.persist();
  }

  listCalendarEvents(filters: { month?: string } = {}): CalendarEventRecord[] {
    const events = this.queryAll("SELECT * FROM calendar_events ORDER BY eventDate ASC, startTime ASC, updatedAt DESC").map((row) => this.calendarEventFromRow(row));
    return filters.month ? events.filter((event) => event.eventDate.startsWith(`${filters.month}-`)) : events;
  }

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

  listPublicCalendarEvents(filters: { month?: string } = {}): PublicCalendarEventSummary[] {
    return this.listCalendarEvents(filters).map((event) => this.toPublicCalendarEvent(event));
  }

  listUpcomingPublicCalendarEvents(days: number): PublicCalendarEventSummary[] {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + Math.max(1, days));
    const startDate = localDateKey(now);
    const endDate = localDateKey(end);
    return this.listCalendarEvents()
      .filter((event) => event.eventDate >= startDate && event.eventDate <= endDate)
      .map((event) => this.toPublicCalendarEvent(event));
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

  deleteCalendarEvent(id: string): void {
    this.db.run("DELETE FROM calendar_events WHERE id = ?", [id]);
    this.persist();
  }

  getAdminSnapshot() {
    return {
      shows: this.listShows().sort(byDateDesc),
      performers: this.listPerformers(),
      brands: this.listBrands(),
      venues: this.listVenues()
    };
  }

  async saveCover(fileName: string, data: Buffer): Promise<void> {
    if (this.coverDir) {
      fs.mkdirSync(this.coverDir, { recursive: true });
      fs.writeFileSync(path.join(this.coverDir, path.basename(fileName)), data);
    } else {
      this.memoryCovers.set(path.basename(fileName), data);
    }
  }

  readCover(fileName: string): Buffer | null {
    const clean = path.basename(fileName);
    if (this.coverDir) {
      const filePath = path.join(this.coverDir, clean);
      return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
    }
    return this.memoryCovers.get(clean) ?? null;
  }

  replaceCovers(covers: Map<string, Uint8Array>): void {
    if (this.coverDir) {
      fs.rmSync(this.coverDir, { recursive: true, force: true });
      fs.mkdirSync(this.coverDir, { recursive: true });
      for (const [fileName, data] of covers) {
        fs.writeFileSync(path.join(this.coverDir, path.basename(fileName)), Buffer.from(data));
      }
      return;
    }

    this.memoryCovers.clear();
    for (const [fileName, data] of covers) {
      this.memoryCovers.set(path.basename(fileName), Buffer.from(data));
    }
  }

  toBackupPayload(appVersion: string): BackupPayload {
    const shows = this.listShows();
    const performers = this.listPerformers();
    const brands = this.listBrands();
    const venues = this.listVenues();
    const covers = new Map<string, Buffer>();
    for (const show of shows) {
      if (!show.coverFileName || covers.has(show.coverFileName)) continue;
      const data = this.readCover(show.coverFileName);
      if (data) covers.set(show.coverFileName, data);
    }

    return {
      manifest: {
        schemaVersion: 2,
        exportedAt: nowISO(),
        appVersion,
        counts: {
          shows: shows.length,
          performers: performers.length,
          brands: brands.length,
          venues: venues.length
        }
      },
      shows: shows.map(({ notesPublic: _notesPublic, ...show }) => show),
      performers,
      brands,
      venues,
      covers
    };
  }

  replaceFromBackup(payload: BackupPayload): void {
    this.db.run("DELETE FROM show_performers");
    this.db.run("DELETE FROM performer_brands");
    this.db.run("DELETE FROM brand_performers");
    this.db.run("DELETE FROM brand_venues");
    this.db.run("DELETE FROM venue_performers");
    this.db.run("DELETE FROM calendar_events");
    this.db.run("DELETE FROM shows");
    this.db.run("DELETE FROM performers");
    this.db.run("DELETE FROM brands");
    this.db.run("DELETE FROM venues");

    for (const performer of payload.performers) {
      this.db.run(
        "INSERT INTO performers (id, displayName, normalizedKey, stageName, avatarFileName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [performer.id, performer.displayName, performer.normalizedKey, performer.stageName, performer.avatarFileName, performer.createdAt, performer.updatedAt]
      );
      this.replacePerformerBrands(performer.id, performer.brandIDs ?? []);
    }

    for (const brand of payload.brands) {
      this.db.run(
        "INSERT INTO brands (id, displayName, normalizedKey, cityName, accentColorHex, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [brand.id, brand.displayName, brand.normalizedKey, brand.cityName, brand.accentColorHex, brand.createdAt, brand.updatedAt]
      );
      this.replaceBrandPerformers(brand.id, brand.performerIDs ?? []);
      this.replaceBrandVenues(brand.id, brand.venueIDs ?? []);
    }

    for (const venue of payload.venues) {
      this.db.run(
        "INSERT INTO venues (id, displayName, normalizedKey, lookupKey, addressLine, district, cityName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [venue.id, venue.displayName, venue.normalizedKey, venue.lookupKey, venue.addressLine, venue.district, venue.cityName, venue.createdAt, venue.updatedAt]
      );
      this.replaceVenuePerformers(venue.id, venue.performerIDs ?? []);
    }

    for (const backupShow of payload.shows) {
      const show: ShowRecord = {
        ...backupShow,
        notesPublic: false
      };
      this.db.run(
        `INSERT INTO shows
         (id, title, coverFileName, date, venueID, brandID, format, myRole, showType, notes, notesPublic, tags, createdAt, updatedAt, status, achievementFlags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        showParams(show)
      );
      this.replaceShowPerformers(show.id, show.performerIDs ?? []);
    }

    this.replaceCovers(payload.covers);
    this.persist();
  }

  private createSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS shows (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        coverFileName TEXT,
        date TEXT,
        venueID TEXT,
        brandID TEXT,
        format TEXT NOT NULL,
        myRole TEXT NOT NULL,
        showType TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        notesPublic INTEGER NOT NULL DEFAULT 0,
        tags TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        status TEXT NOT NULL,
        achievementFlags TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS performers (
        id TEXT PRIMARY KEY,
        displayName TEXT NOT NULL,
        normalizedKey TEXT NOT NULL,
        stageName TEXT,
        avatarFileName TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS brands (
        id TEXT PRIMARY KEY,
        displayName TEXT NOT NULL,
        normalizedKey TEXT NOT NULL,
        cityName TEXT,
        accentColorHex TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS venues (
        id TEXT PRIMARY KEY,
        displayName TEXT NOT NULL,
        normalizedKey TEXT NOT NULL,
        lookupKey TEXT NOT NULL,
        addressLine TEXT,
        district TEXT,
        cityName TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
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
      CREATE TABLE IF NOT EXISTS show_performers (showID TEXT NOT NULL, performerID TEXT NOT NULL, sortOrder INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS performer_brands (performerID TEXT NOT NULL, brandID TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS brand_performers (brandID TEXT NOT NULL, performerID TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS brand_venues (brandID TEXT NOT NULL, venueID TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS venue_performers (venueID TEXT NOT NULL, performerID TEXT NOT NULL);
    `);
  }

  private persist(): void {
    if (!this.dbPath) return;
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    fs.writeFileSync(this.dbPath, Buffer.from(this.db.export()));
    if (this.coverDir) fs.mkdirSync(this.coverDir, { recursive: true });
  }

  private queryAll(sql: string, params: RowValue[] = []): Row[] {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const rows: Row[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as Row);
      return rows;
    } finally {
      stmt.free();
    }
  }

  private queryOne(sql: string, params: RowValue[] = []): Row | null {
    return this.queryAll(sql, params)[0] ?? null;
  }

  private showFromRow(row: Row): ShowRecord {
    const id = String(row.id);
    return {
      id,
      title: String(row.title),
      coverFileName: nullable(row.coverFileName),
      date: nullable(row.date),
      venueID: nullable(row.venueID),
      brandID: nullable(row.brandID),
      performerIDs: this.queryAll("SELECT performerID FROM show_performers WHERE showID = ? ORDER BY sortOrder", [id]).map((item) => String(item.performerID)),
      format: String(row.format) as ShowFormat,
      myRole: String(row.myRole) as ShowRole,
      showType: String(row.showType) as ShowType,
      notes: String(row.notes ?? ""),
      notesPublic: Boolean(Number(row.notesPublic ?? 0)),
      tags: parseJSONList(row.tags),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      status: String(row.status) as ShowStatus,
      achievementFlags: parseJSONList(row.achievementFlags)
    };
  }

  private performerFromRow(row: Row): PerformerRecord {
    const id = String(row.id);
    return {
      id,
      displayName: String(row.displayName),
      normalizedKey: String(row.normalizedKey),
      stageName: nullable(row.stageName),
      avatarFileName: nullable(row.avatarFileName),
      brandIDs: this.queryAll("SELECT brandID FROM performer_brands WHERE performerID = ?", [id]).map((item) => String(item.brandID)),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt)
    };
  }

  private brandFromRow(row: Row): BrandRecord {
    const id = String(row.id);
    return {
      id,
      displayName: String(row.displayName),
      normalizedKey: String(row.normalizedKey),
      cityName: nullable(row.cityName),
      accentColorHex: nullable(row.accentColorHex),
      performerIDs: this.queryAll("SELECT performerID FROM brand_performers WHERE brandID = ?", [id]).map((item) => String(item.performerID)),
      venueIDs: this.queryAll("SELECT venueID FROM brand_venues WHERE brandID = ?", [id]).map((item) => String(item.venueID)),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt)
    };
  }

  private venueFromRow(row: Row): VenueRecord {
    const id = String(row.id);
    return {
      id,
      displayName: String(row.displayName),
      normalizedKey: String(row.normalizedKey),
      lookupKey: String(row.lookupKey),
      addressLine: nullable(row.addressLine),
      district: nullable(row.district),
      cityName: nullable(row.cityName),
      performerIDs: this.queryAll("SELECT performerID FROM venue_performers WHERE venueID = ?", [id]).map((item) => String(item.performerID)),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt)
    };
  }

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

  private toPublicShow(show: ShowRecord, includeNotes: boolean): PublicShowSummary {
    const brand = show.brandID ? this.listBrands().find((item) => item.id === show.brandID) ?? null : null;
    const venue = show.venueID ? this.listVenues().find((item) => item.id === show.venueID) ?? null : null;
    const performerByID = new Map(this.listPerformers().map((performer) => [performer.id, performer]));
    return {
      id: show.id,
      title: show.title,
      coverFileName: show.coverFileName,
      date: show.date,
      format: show.format,
      myRole: show.myRole,
      showType: show.showType,
      brand: brand ? { id: brand.id, displayName: brand.displayName, cityName: brand.cityName } : null,
      venue: venue ? { id: venue.id, displayName: venue.displayName, cityName: venue.cityName, district: venue.district } : null,
      performers: show.performerIDs
        .map((id) => performerByID.get(id))
        .filter(Boolean)
        .map((performer) => ({ id: performer!.id, displayName: performer!.displayName, stageName: performer!.stageName })),
      ...(includeNotes && show.notesPublic ? { notes: show.notes } : {})
    };
  }

  private requireShow(id: string): ShowRecord {
    const show = this.getShow(id);
    if (!show) throw new Error("演出不存在。");
    return show;
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

  private replaceShowPerformers(showID: string, performerIDs: string[]): void {
    this.db.run("DELETE FROM show_performers WHERE showID = ?", [showID]);
    performerIDs.forEach((performerID, index) => {
      this.db.run("INSERT INTO show_performers (showID, performerID, sortOrder) VALUES (?, ?, ?)", [showID, performerID, index]);
    });
  }

  private replacePerformerBrands(performerID: string, brandIDs: string[]): void {
    this.db.run("DELETE FROM performer_brands WHERE performerID = ?", [performerID]);
    brandIDs.forEach((brandID) => this.db.run("INSERT INTO performer_brands (performerID, brandID) VALUES (?, ?)", [performerID, brandID]));
  }

  private replaceBrandPerformers(brandID: string, performerIDs: string[]): void {
    this.db.run("DELETE FROM brand_performers WHERE brandID = ?", [brandID]);
    performerIDs.forEach((performerID) => this.db.run("INSERT INTO brand_performers (brandID, performerID) VALUES (?, ?)", [brandID, performerID]));
  }

  private replaceBrandVenues(brandID: string, venueIDs: string[]): void {
    this.db.run("DELETE FROM brand_venues WHERE brandID = ?", [brandID]);
    venueIDs.forEach((venueID) => this.db.run("INSERT INTO brand_venues (brandID, venueID) VALUES (?, ?)", [brandID, venueID]));
  }

  private replaceVenuePerformers(venueID: string, performerIDs: string[]): void {
    this.db.run("DELETE FROM venue_performers WHERE venueID = ?", [venueID]);
    performerIDs.forEach((performerID) => this.db.run("INSERT INTO venue_performers (venueID, performerID) VALUES (?, ?)", [venueID, performerID]));
  }
}

export async function createDataStore(options: DataStoreOptions = {}): Promise<DataStore> {
  const SQL = await initSqlJs();
  const dbPath = options.inMemory ? null : path.join(options.dataDir ?? "data", "xysg.sqlite");
  const db = dbPath && fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
  return new DataStore(db, options);
}

function showParams(show: ShowRecord): RowValue[] {
  return [
    show.id,
    show.title,
    show.coverFileName,
    show.date,
    show.venueID,
    show.brandID,
    show.format,
    show.myRole,
    show.showType,
    show.notes,
    show.notesPublic ? 1 : 0,
    JSON.stringify(show.tags),
    show.createdAt,
    show.updatedAt,
    show.status,
    JSON.stringify(show.achievementFlags)
  ];
}

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

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nullable(value: RowValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  const stringValue = String(value);
  return stringValue.length > 0 ? stringValue : null;
}

function parseJSONList(value: RowValue | undefined): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function requiredName(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label}名称不能为空。`);
  return trimmed;
}

function requireDate(value: string | undefined): string {
  const date = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("日历事件日期必须是 YYYY-MM-DD。");
  }
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("日历事件日期必须是有效的 YYYY-MM-DD。");
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

const formatByLabel = new Map(Object.entries(formatLabels).map(([key, label]) => [label, key as ShowFormat]));
const roleByLabel = new Map(Object.entries(roleLabels).map(([key, label]) => [label, key as ShowRole]));
const typeByLabel = new Map(Object.entries(typeLabels).map(([key, label]) => [label, key as ShowType]));

function parseCalendarRow(
  row: Partial<CalendarImportRow>,
  rowNumber: number
): {
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

  try {
    requireDate(date);
  } catch (error) {
    errors.push({ row: rowNumber, field: "date", message: (error as Error).message });
  }
  try {
    requireTime(startTime);
  } catch (error) {
    errors.push({ row: rowNumber, field: "startTime", message: (error as Error).message });
  }
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

function byDateDesc(a: ShowRecord, b: ShowRecord): number {
  return (b.date ?? b.updatedAt).localeCompare(a.date ?? a.updatedAt);
}
