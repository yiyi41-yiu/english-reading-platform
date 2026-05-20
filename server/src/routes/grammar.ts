import { Router, Response } from "express";
import { db, schema } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

export const grammarRouter = Router();

// Save grammar analysis
grammarRouter.post("/", authMiddleware, (req: AuthRequest, res: Response) => {
  const { sentence, analysis, article_id } = req.body;
  if (!sentence || !analysis) {
    return res.status(400).json({ error: "Sentence and analysis are required" });
  }

  const entry = db.insert(schema.grammarHistory).values({
    userId: req.userId!,
    sentence,
    analysis: JSON.stringify(analysis),
    articleId: article_id || null,
  }).returning().get();

  return res.status(201).json(entry);
});

// List grammar history
grammarRouter.get("/", authMiddleware, (req: AuthRequest, res: Response) => {
  const items = db.select().from(schema.grammarHistory)
    .where(eq(schema.grammarHistory.userId, req.userId!))
    .orderBy(desc(schema.grammarHistory.createdAt))
    .all();

  const parsed = items.map(item => ({
    ...item,
    analysis: JSON.parse(item.analysis),
  }));

  return res.json({ items: parsed });
});

// Get single grammar history entry
grammarRouter.get("/:id", authMiddleware, (req: AuthRequest, res: Response) => {
  const entry = db.select().from(schema.grammarHistory)
    .where(and(
      eq(schema.grammarHistory.id, parseInt(req.params.id)),
      eq(schema.grammarHistory.userId, req.userId!),
    )).get();

  if (!entry) return res.status(404).json({ error: "Entry not found" });

  return res.json({ ...entry, analysis: JSON.parse(entry.analysis) });
});

// Delete grammar history entry
grammarRouter.delete("/:id", authMiddleware, (req: AuthRequest, res: Response) => {
  const entry = db.select().from(schema.grammarHistory)
    .where(and(
      eq(schema.grammarHistory.id, parseInt(req.params.id)),
      eq(schema.grammarHistory.userId, req.userId!),
    )).get();

  if (!entry) return res.status(404).json({ error: "Entry not found" });
  db.delete(schema.grammarHistory).where(eq(schema.grammarHistory.id, entry.id)).run();
  return res.json({ success: true });
});
