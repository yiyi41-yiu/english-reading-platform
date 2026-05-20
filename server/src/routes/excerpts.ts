import { Router, Response } from "express";
import { db, schema } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

export const excerptsRouter = Router();

excerptsRouter.get("/", authMiddleware, (req: AuthRequest, res: Response) => {
  const items = db.select().from(schema.excerpts)
    .where(eq(schema.excerpts.userId, req.userId!))
    .orderBy(desc(schema.excerpts.createdAt))
    .all();

  // Attach article title for display
  const articles = db.select({ id: schema.articles.id, title: schema.articles.title })
    .from(schema.articles).all();
  const articleMap = new Map(articles.map(a => [a.id, a.title]));

  return res.json({
    items: items.map(e => ({ ...e, articleTitle: articleMap.get(e.articleId) || "Unknown" })),
  });
});

excerptsRouter.post("/", authMiddleware, (req: AuthRequest, res: Response) => {
  const { article_id, text, note, paragraph_index, start_offset } = req.body;
  if (!article_id || !text) {
    return res.status(400).json({ error: "article_id and text are required" });
  }

  const excerpt = db.insert(schema.excerpts).values({
    userId: req.userId!,
    articleId: article_id,
    text,
    note: note || null,
    paragraphIndex: paragraph_index || 0,
    startOffset: start_offset || 0,
  }).returning().get();

  return res.status(201).json(excerpt);
});

excerptsRouter.delete("/:id", authMiddleware, (req: AuthRequest, res: Response) => {
  const entry = db.select().from(schema.excerpts)
    .where(and(
      eq(schema.excerpts.id, parseInt(req.params.id)),
      eq(schema.excerpts.userId, req.userId!)
    )).get();

  if (!entry) return res.status(404).json({ error: "Excerpt not found" });
  db.delete(schema.excerpts).where(eq(schema.excerpts.id, entry.id)).run();
  return res.json({ success: true });
});
