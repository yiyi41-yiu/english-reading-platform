import { Router, Response } from "express";
import { db, schema } from "../db";
import { eq, desc, isNull } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

export const feedRouter = Router();

// Get public feed
feedRouter.get("/", authMiddleware, (_req: AuthRequest, res: Response) => {
  const rows = db.select().from(schema.activityFeed)
    .where(isNull(schema.activityFeed.groupId))
    .orderBy(desc(schema.activityFeed.createdAt))
    .limit(30).all();

  const items = rows.map(f => {
    const user = db.select().from(schema.users).where(eq(schema.users.id, f.userId)).get();
    return { ...f, userName: user?.name || "Unknown" };
  });

  return res.json({ items });
});

// Helper to create feed entry (exported for use in other routes)
export function createFeedEntry(
  userId: number,
  activityType: "read_article" | "complete_exercise" | "save_vocab" | "share_note" | "join_group",
  targetId?: number,
  summary?: string,
  groupId: number | null = null
) {
  db.insert(schema.activityFeed).values({
    userId, groupId, activityType, targetId: targetId || null, summary: summary || null,
  }).run();
}
