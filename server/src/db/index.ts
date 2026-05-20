import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { seedDatabase } from "./seed";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_URL || "./data/app.db";

// Ensure data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };

// Initialize tables and seed data (returns Promise)
export const dbReady = seedDatabase(sqlite);
