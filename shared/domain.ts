export const showFormats = ["standup", "manzai", "improv", "sketch", "other"] as const;
export const showRoles = ["host", "performer", "headliner", "opener", "other"] as const;
export const showTypes = ["openMic", "commercial", "showcase", "special", "competition", "other"] as const;
export const showStatuses = ["published", "draft"] as const;

export type ShowFormat = (typeof showFormats)[number];
export type ShowRole = (typeof showRoles)[number];
export type ShowType = (typeof showTypes)[number];
export type ShowStatus = (typeof showStatuses)[number];

export const formatLabels: Record<ShowFormat, string> = {
  standup: "单口",
  manzai: "漫才",
  improv: "即兴",
  sketch: "新喜剧",
  other: "其他"
};

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

export interface PerformerRecord {
  id: string;
  displayName: string;
  normalizedKey: string;
  stageName: string | null;
  avatarFileName: string | null;
  brandIDs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BrandRecord {
  id: string;
  displayName: string;
  normalizedKey: string;
  cityName: string | null;
  accentColorHex: string | null;
  performerIDs: string[];
  venueIDs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VenueRecord {
  id: string;
  displayName: string;
  normalizedKey: string;
  lookupKey: string;
  addressLine: string | null;
  district: string | null;
  cityName: string | null;
  performerIDs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ShowRecord {
  id: string;
  title: string;
  coverFileName: string | null;
  date: string | null;
  venueID: string | null;
  brandID: string | null;
  performerIDs: string[];
  format: ShowFormat;
  myRole: ShowRole;
  showType: ShowType;
  notes: string;
  notesPublic: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  status: ShowStatus;
  achievementFlags: string[];
}

export interface BackupManifest {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  counts: {
    shows: number;
    performers: number;
    brands: number;
    venues: number;
  };
}

export interface BackupShowRecord {
  id: string;
  title: string;
  coverFileName: string | null;
  date: string | null;
  venueID: string | null;
  brandID: string | null;
  performerIDs: string[];
  format: ShowFormat;
  myRole: ShowRole;
  showType: ShowType;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  status: ShowStatus;
  achievementFlags: string[];
}

export interface BackupPayload {
  manifest: BackupManifest;
  shows: BackupShowRecord[];
  performers: PerformerRecord[];
  brands: BrandRecord[];
  venues: VenueRecord[];
  covers: Map<string, Uint8Array>;
}

export interface PublicShowSummary {
  id: string;
  title: string;
  coverFileName: string | null;
  date: string | null;
  format: ShowFormat;
  myRole: ShowRole;
  showType: ShowType;
  brand: Pick<BrandRecord, "id" | "displayName" | "cityName"> | null;
  venue: Pick<VenueRecord, "id" | "displayName" | "cityName" | "district"> | null;
  performers: Pick<PerformerRecord, "id" | "displayName" | "stageName">[];
  notes?: string;
}

export interface ArchiveSummary {
  totalShows: number;
  latestShowDate: string | null;
  formatCounts: Record<string, number>;
  roleCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  brandCounts: Record<string, number>;
  brands: Pick<BrandRecord, "id" | "displayName">[];
}

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

export const guestbookStatuses = ["pending", "approved", "hidden"] as const;
export type GuestbookStatus = (typeof guestbookStatuses)[number];

export interface GuestbookMessageRecord {
  id: string;
  nickname: string;
  email: string | null;
  content: string;
  status: GuestbookStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GuestbookMessageInput {
  nickname?: string;
  email?: string | null;
  content?: string;
  status?: GuestbookStatus;
}

export type PublicGuestbookMessage = Pick<GuestbookMessageRecord, "id" | "nickname" | "content" | "createdAt">;

export interface GuestbookPageResult {
  items: PublicGuestbookMessage[];
  hasMore: boolean;
  nextOffset: number | null;
}

export function normalizeValue(rawValue: string): string {
  return rawValue.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function venueLookupKey(name: string, city: string | null | undefined): string {
  const normalizedName = normalizeValue(name);
  const normalizedCity = city ? normalizeValue(city) : "";
  return normalizedCity ? `${normalizedName}::${normalizedCity}` : normalizedName;
}

export function storedTitle(rawTitle: string): string {
  const trimmed = rawTitle.trim();
  return trimmed.length > 0 ? trimmed : "未命名演出";
}

export function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function nowISO(): string {
  return new Date().toISOString();
}
