import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createServerApp } from "./app.js";
import { createDataStore } from "./db.js";

dotenv.config();

const port = Number(process.env.PORT ?? 3008);
const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), "data");
const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me-now";
const sessionSecret = process.env.SESSION_SECRET ?? "dev-session-secret-change-me";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(__dirname, "../../client");

const store = await createDataStore({ dataDir });
const app = await createServerApp({ store, adminPassword, sessionSecret, staticDir });

app.listen(port, () => {
  console.log(`XYSG Web listening on http://localhost:${port}`);
  console.log(`Data directory: ${dataDir}`);
});
