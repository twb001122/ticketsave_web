import JSZip from "jszip";
import type { BackupPayload, BackupShowRecord } from "../shared/domain.js";
import type { DataStore } from "./db.js";

const requiredFiles = ["manifest.json", "shows.json", "performers.json", "brands.json", "venues.json"] as const;

export async function importBackupZip(store: DataStore, zipBuffer: Buffer): Promise<void> {
  const zip = await JSZip.loadAsync(zipBuffer);
  for (const fileName of requiredFiles) {
    if (!zip.file(fileName)) throw new Error(`备份缺少 ${fileName}`);
  }

  const covers = new Map<string, Buffer>();
  for (const [path, file] of Object.entries(zip.files)) {
    if (!path.startsWith("covers/") || file.dir) continue;
    covers.set(path.replace(/^covers\//, ""), Buffer.from(await file.async("uint8array")));
  }

  const payload: BackupPayload = {
    manifest: await readJSON(zip, "manifest.json"),
    shows: (await readJSON<BackupShowRecord[]>(zip, "shows.json")).map(normalizeShow),
    performers: (await readJSON<any[]>(zip, "performers.json")).map(normalizePerformer),
    brands: (await readJSON<any[]>(zip, "brands.json")).map(normalizeBrand),
    venues: (await readJSON<any[]>(zip, "venues.json")).map(normalizeVenue),
    covers
  };

  if (!payload.manifest.schemaVersion || payload.manifest.schemaVersion < 1) {
    throw new Error("这个 zip 备份无法识别。");
  }

  store.replaceFromBackup(payload);
}

export async function exportBackupZip(store: DataStore, appVersion = "XYSG Web"): Promise<Buffer> {
  const payload = store.toBackupPayload(appVersion);
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(payload.manifest, null, 2));
  zip.file("shows.json", JSON.stringify(payload.shows, null, 2));
  zip.file("performers.json", JSON.stringify(payload.performers, null, 2));
  zip.file("brands.json", JSON.stringify(payload.brands, null, 2));
  zip.file("venues.json", JSON.stringify(payload.venues, null, 2));
  for (const [fileName, data] of payload.covers) {
    zip.file(`covers/${fileName}`, data, { createFolders: false });
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
}

async function readJSON<T>(zip: JSZip, fileName: string): Promise<T> {
  const file = zip.file(fileName);
  if (!file) throw new Error(`备份缺少 ${fileName}`);
  return JSON.parse(await file.async("string")) as T;
}

function normalizeShow(show: any): BackupShowRecord {
  const createdAt = show.createdAt ?? "1970-01-01T00:00:00Z";
  return {
    id: show.id,
    title: show.title ?? "",
    coverFileName: show.coverFileName ?? null,
    date: show.date ?? null,
    venueID: show.venueID ?? null,
    brandID: show.brandID ?? null,
    performerIDs: show.performerIDs ?? [],
    format: show.format ?? "other",
    myRole: show.myRole ?? "performer",
    showType: show.showType ?? "showcase",
    notes: show.notes ?? "",
    tags: show.tags ?? [],
    createdAt,
    updatedAt: show.updatedAt ?? createdAt,
    status: show.status ?? "published",
    achievementFlags: show.achievementFlags ?? []
  };
}

function normalizePerformer(performer: any) {
  const createdAt = performer.createdAt ?? "1970-01-01T00:00:00Z";
  return {
    id: performer.id,
    displayName: performer.displayName ?? "",
    normalizedKey: performer.normalizedKey ?? "",
    stageName: performer.stageName ?? null,
    avatarFileName: performer.avatarFileName ?? null,
    brandIDs: performer.brandIDs ?? [],
    createdAt,
    updatedAt: performer.updatedAt ?? createdAt
  };
}

function normalizeBrand(brand: any) {
  const createdAt = brand.createdAt ?? "1970-01-01T00:00:00Z";
  return {
    id: brand.id,
    displayName: brand.displayName ?? "",
    normalizedKey: brand.normalizedKey ?? "",
    cityName: brand.cityName ?? null,
    accentColorHex: brand.accentColorHex ?? null,
    performerIDs: brand.performerIDs ?? [],
    venueIDs: brand.venueIDs ?? [],
    createdAt,
    updatedAt: brand.updatedAt ?? createdAt
  };
}

function normalizeVenue(venue: any) {
  const createdAt = venue.createdAt ?? "1970-01-01T00:00:00Z";
  const normalizedKey = venue.normalizedKey ?? "";
  return {
    id: venue.id,
    displayName: venue.displayName ?? "",
    normalizedKey,
    lookupKey: venue.lookupKey ?? normalizedKey,
    addressLine: venue.addressLine ?? null,
    district: venue.district ?? null,
    cityName: venue.cityName ?? null,
    performerIDs: venue.performerIDs ?? [],
    createdAt,
    updatedAt: venue.updatedAt ?? createdAt
  };
}
