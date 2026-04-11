import crypto from "node:crypto";
import path from "node:path";
import express, { type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import multer from "multer";
import { exportBackupZip, importBackupZip } from "./backup.js";
import type { DataStore } from "./db.js";
import type { DiaryPostStatus, GuestbookStatus } from "../shared/domain.js";

export interface ServerAppOptions {
  store: DataStore;
  adminPassword: string;
  sessionSecret: string;
  staticDir?: string;
}

const uploadLimitMB = Number(process.env.UPLOAD_LIMIT_MB ?? 256);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: uploadLimitMB * 1024 * 1024 } });
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

export async function createServerApp(options: ServerAppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      name: "xysg.sid",
      secret: options.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 14
      }
    })
  );

  app.get("/api/public/summary", (_req, res) => {
    res.json(options.store.publicSummary());
  });

  app.get("/api/public/shows", (req, res) => {
    res.json({
      items: options.store.listPublicShows({
        format: typeof req.query.format === "string" ? req.query.format : undefined,
        brandID: typeof req.query.brandID === "string" ? req.query.brandID : undefined
      })
    });
  });

  app.get("/api/public/shows/:id", (req, res) => {
    const show = options.store.getPublicShow(req.params.id);
    if (!show) return res.status(404).json({ error: "演出不存在。" });
    res.json(show);
  });

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

  app.get("/api/public/guestbook", (req, res) => {
    res.json(options.store.listPublicGuestbookMessages({
      limit: Number(req.query.limit ?? 10),
      offset: Number(req.query.offset ?? 0)
    }));
  });

  app.post("/api/public/guestbook", (req, res, next) => {
    try {
      options.store.createGuestbookMessage(parseBody(req.body));
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/public/diary", (req, res) => {
    res.json(options.store.listPublicDiaryPosts({
      limit: Number(req.query.limit ?? 6),
      offset: Number(req.query.offset ?? 0)
    }));
  });

  app.get("/api/public/diary/:id", (req, res) => {
    const post = options.store.getPublicDiaryPost(String(req.params.id));
    if (!post) return res.status(404).json({ error: "日记不存在。" });
    res.json(post);
  });

  app.post("/api/public/diary/:id/like", (req, res, next) => {
    try {
      res.json(options.store.likeDiaryPost(String(req.params.id)));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/public/diary/:id/comments", (req, res, next) => {
    try {
      res.status(201).json(options.store.createDiaryComment(String(req.params.id), parseBody(req.body)));
    } catch (error) {
      next(error);
    }
  });

  app.get("/covers/:fileName", (req, res) => {
    const data = options.store.readCover(req.params.fileName);
    if (!data) return res.status(404).end();
    res.type(path.extname(req.params.fileName) || "jpg").send(data);
  });

  app.post("/api/admin/login", (req, res) => {
    const password = String(req.body?.password ?? "");
    if (!safeEqual(password, options.adminPassword)) {
      return res.status(401).json({ error: "密码不正确。" });
    }
    req.session.admin = true;
    res.json({ ok: true });
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/admin/me", requireAdmin, (_req, res) => {
    res.json({ authenticated: true });
  });

  app.get("/api/admin/snapshot", requireAdmin, (_req, res) => {
    res.json(options.store.getAdminSnapshot());
  });

  app.get("/api/admin/shows", requireAdmin, (_req, res) => res.json({ items: options.store.listShows() }));
  app.post("/api/admin/shows", requireAdmin, upload.single("cover"), async (req, res, next) => {
    try {
      const coverFileName = req.file ? await saveUploadedCover(options.store, req.file) : bodyOrNull(req.body.coverFileName);
      const show = options.store.createShow({ ...parseBody(req.body), coverFileName });
      res.status(201).json(show);
    } catch (error) {
      next(error);
    }
  });
  app.put("/api/admin/shows/:id", requireAdmin, upload.single("cover"), async (req, res, next) => {
    try {
      const input = parseBody(req.body);
      if (req.file) input.coverFileName = await saveUploadedCover(options.store, req.file);
      const show = options.store.updateShow(String(req.params.id), input);
      res.json(show);
    } catch (error) {
      next(error);
    }
  });
  app.delete("/api/admin/shows/:id", requireAdmin, (req, res, next) => {
    try {
      options.store.deleteShow(String(req.params.id));
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  wireCatalogRoutes(app, "/api/admin/performers", requireAdmin, {
    list: () => options.store.listPerformers(),
    create: (body) => options.store.createPerformer(parseBody(body)),
    update: (id, body) => options.store.updatePerformer(id, parseBody(body)),
    delete: (id) => options.store.deletePerformer(id)
  });
  wireCatalogRoutes(app, "/api/admin/brands", requireAdmin, {
    list: () => options.store.listBrands(),
    create: (body) => options.store.createBrand(parseBody(body)),
    update: (id, body) => options.store.updateBrand(id, parseBody(body)),
    delete: (id) => options.store.deleteBrand(id)
  });
  wireCatalogRoutes(app, "/api/admin/venues", requireAdmin, {
    list: () => options.store.listVenues(),
    create: (body) => options.store.createVenue(parseBody(body)),
    update: (id, body) => options.store.updateVenue(id, parseBody(body)),
    delete: (id) => options.store.deleteVenue(id)
  });

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

  app.get("/api/admin/guestbook", requireAdmin, (_req, res) => {
    res.json({ items: options.store.listGuestbookMessages() });
  });

  app.put("/api/admin/guestbook/:id", requireAdmin, (req, res, next) => {
    try {
      res.json(options.store.updateGuestbookMessageStatus(String(req.params.id), String(req.body?.status) as GuestbookStatus));
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/guestbook/:id", requireAdmin, (req, res, next) => {
    try {
      options.store.deleteGuestbookMessage(String(req.params.id));
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/diary", requireAdmin, (_req, res) => {
    res.json({ items: options.store.listDiaryPosts() });
  });

  app.post("/api/admin/diary", requireAdmin, (req, res, next) => {
    try {
      res.status(201).json(options.store.createDiaryPost(parseDiaryPostBody(req.body)));
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/diary/:id", requireAdmin, (req, res, next) => {
    try {
      res.json(options.store.updateDiaryPost(String(req.params.id), parseDiaryPostBody(req.body)));
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/diary/:id", requireAdmin, (req, res, next) => {
    try {
      options.store.deleteDiaryPost(String(req.params.id));
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/backup/import", requireAdmin, upload.single("archive"), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "请选择 zip 备份文件。" });
      await importBackupZip(options.store, req.file.buffer);
      res.json(options.store.publicSummary());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/backup/export", requireAdmin, async (_req, res, next) => {
    try {
      const zip = await exportBackupZip(options.store, "XYSG Web");
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
      res
        .type("zip")
        .setHeader("Content-Disposition", `attachment; filename="xysg-web-backup-${stamp}.zip"`)
        .send(zip);
    } catch (error) {
      next(error);
    }
  });

  if (options.staticDir) {
    app.get(/^(?!\/api|\/covers)(?!.*\.[^/]+$).*/, (_req, res) => {
      res.sendFile("index.html", { root: options.staticDir });
    });
    app.use(express.static(options.staticDir));
    app.get(/^(?!\/api|\/covers).*/, (_req, res) => {
      res.sendFile("index.html", { root: options.staticDir });
    });
  }

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(400).json({ error: error.message || "操作失败。" });
  });

  return app;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.admin) {
    res.status(401).json({ error: "需要管理密码。" });
    return;
  }
  next();
}

function wireCatalogRoutes(
  app: express.Express,
  basePath: string,
  auth: express.RequestHandler,
  handlers: {
    list: () => unknown[];
    create: (body: Record<string, unknown>) => unknown;
    update: (id: string, body: Record<string, unknown>) => unknown;
    delete: (id: string) => void;
  }
): void {
  app.get(basePath, auth, (_req, res) => res.json({ items: handlers.list() }));
  app.post(basePath, auth, (req, res, next) => {
    try {
      res.status(201).json(handlers.create(req.body));
    } catch (error) {
      next(error);
    }
  });
  app.put(`${basePath}/:id`, auth, (req, res, next) => {
    try {
      res.json(handlers.update(String(req.params.id), req.body));
    } catch (error) {
      next(error);
    }
  });
  app.delete(`${basePath}/:id`, auth, (req, res, next) => {
    try {
      handlers.delete(String(req.params.id));
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
}

function parseBody(body: Record<string, unknown>): any {
  const parsed = { ...body };
  for (const key of ["performerIDs", "brandIDs", "venueIDs", "tags", "achievementFlags"]) {
    if (typeof parsed[key] === "string") {
      try {
        parsed[key] = JSON.parse(parsed[key] as string);
      } catch {
        parsed[key] = (parsed[key] as string).split(",").map((value) => value.trim()).filter(Boolean);
      }
    }
  }
  for (const key of ["notesPublic"]) {
    if (typeof parsed[key] === "string") parsed[key] = parsed[key] === "true" || parsed[key] === "1";
  }
  for (const key of ["date", "venueID", "brandID", "coverFileName", "cityName", "district", "addressLine", "stageName", "avatarFileName", "accentColorHex"]) {
    if (parsed[key] === "") parsed[key] = null;
  }
  return parsed;
}

function parseDiaryPostBody(body: Record<string, unknown>) {
  return {
    title: typeof body.title === "string" ? body.title : undefined,
    excerpt: typeof body.excerpt === "string" ? body.excerpt : undefined,
    content: typeof body.content === "string" ? body.content : undefined,
    status: typeof body.status === "string" ? body.status as DiaryPostStatus : undefined,
    publishedAt: typeof body.publishedAt === "string" ? body.publishedAt : null
  };
}

function bodyOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function saveUploadedCover(store: DataStore, file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname) || ".jpg";
  const fileName = `${crypto.randomUUID()}${ext.toLowerCase()}`;
  await store.saveCover(fileName, file.buffer);
  return fileName;
}

function safeEqual(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

declare module "express-session" {
  interface SessionData {
    admin?: boolean;
  }
}
