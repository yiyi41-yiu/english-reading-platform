import { Router, Response } from "express";
import { db, schema } from "../db";
import { eq, and, desc, isNull } from "drizzle-orm";
import { authMiddleware, optionalAuth, AuthRequest } from "../middleware/auth";

export const commentsRouter = Router();

// Get comments for an article (publicly readable)
commentsRouter.get("/article/:articleId", optionalAuth, (req: AuthRequest, res: Response) => {
  const articleId = parseInt(req.params.articleId);

  const rows = db.select().from(schema.comments)
    .where(eq(schema.comments.articleId, articleId))
    .orderBy(desc(schema.comments.createdAt))
    .all();

  // Attach user names
  const result = rows.map(c => {
    const user = db.select().from(schema.users).where(eq(schema.users.id, c.userId)).get();
    return { ...c, userName: user?.name || "Unknown" };
  });

  return res.json({ items: result });
});

// Add comment
commentsRouter.post("/", authMiddleware, (req: AuthRequest, res: Response) => {
  const { article_id, content, parent_id } = req.body;
  if (!article_id || !content) {
    return res.status(400).json({ error: "article_id and content required" });
  }

  const comment = db.insert(schema.comments).values({
    articleId: article_id,
    userId: req.userId!,
    parentId: parent_id || null,
    content,
  }).returning().get();

  return res.status(201).json(comment);
});

// Like a comment
commentsRouter.post("/:id/like", authMiddleware, (req: AuthRequest, res: Response) => {
  const comment = db.select().from(schema.comments)
    .where(eq(schema.comments.id, parseInt(req.params.id))).get();
  if (!comment) return res.status(404).json({ error: "Comment not found" });

  db.update(schema.comments)
    .set({ likes: comment.likes + 1 })
    .where(eq(schema.comments.id, comment.id))
    .run();

  return res.json({ likes: comment.likes + 1 });
});

// Delete own comment
commentsRouter.delete("/:id", authMiddleware, (req: AuthRequest, res: Response) => {
  const comment = db.select().from(schema.comments)
    .where(eq(schema.comments.id, parseInt(req.params.id))).get();
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.userId !== req.userId) return res.status(403).json({ error: "Not your comment" });

  db.delete(schema.comments).where(eq(schema.comments.id, comment.id)).run();
  return res.json({ success: true });
});
