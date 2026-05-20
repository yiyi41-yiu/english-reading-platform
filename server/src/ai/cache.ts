import { createHash } from "crypto";
import { db, schema } from "../db";
import { eq, and } from "drizzle-orm";

// In-memory cache for faster repeated lookups
const memCache = new Map<string, string>();

function hash(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

export function getCached(cacheKey: string): string | null {
  // Check memory first
  if (memCache.has(cacheKey)) return memCache.get(cacheKey)!;

  // Check database
  const row = db.select().from(schema.aiCache)
    .where(eq(schema.aiCache.cacheKey, cacheKey))
    .get();

  if (row) {
    memCache.set(cacheKey, row.result);
    return row.result;
  }
  return null;
}

export function setCache(
  cacheKey: string,
  operation: string,
  articleId: number | null,
  input: string,
  result: string
): void {
  memCache.set(cacheKey, result);

  const inputHash = hash(input);
  // Upsert
  const existing = db.select().from(schema.aiCache)
    .where(eq(schema.aiCache.cacheKey, cacheKey)).get();

  if (existing) {
    db.update(schema.aiCache)
      .set({ result, inputHash })
      .where(eq(schema.aiCache.cacheKey, cacheKey))
      .run();
  } else {
    db.insert(schema.aiCache).values({
      cacheKey,
      operation,
      articleId,
      inputHash,
      result,
    }).run();
  }
}
