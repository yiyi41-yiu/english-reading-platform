import { Router, Response } from "express";
import { db, schema } from "../db";
import { eq, and, like, sql } from "drizzle-orm";
import { authMiddleware, teacherOnly, optionalAuth, AuthRequest } from "../middleware/auth";

export const articlesRouter = Router();

// Tokenize article text into structured content
function tokenizeContent(text: string) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  return paragraphs.map((p, i) => {
    const words = p.split(/(\s+)/).filter(w => w.trim()).map(w => {
      // Keep punctuation attached for display, strip for lookup
      const clean = w.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
      return { word: w, clean };
    });
    return { index: i, text: p.trim(), words };
  });
}

articlesRouter.get("/", optionalAuth, (req: AuthRequest, res: Response) => {
  const { grade_level, category, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let conditions = [];
  if (grade_level) conditions.push(eq(schema.articles.gradeLevel, grade_level));
  if (category) conditions.push(eq(schema.articles.category, category));

  let query = db.select().from(schema.articles);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  if (search) {
    query = query.where(like(schema.articles.title, `%${search}%`)) as typeof query;
  }

  const total = query.all().length;
  const items = query.limit(parseInt(limit)).offset(offset).all();

  // Attach user progress if authenticated
  let progressMap = new Map();
  if (req.userId) {
    const progressRows = db.select().from(schema.readingProgress)
      .where(eq(schema.readingProgress.userId, req.userId)).all();
    progressMap = new Map(progressRows.map(p => [p.articleId, p]));
  }

  const result = items.map(a => ({
    ...a,
    content: undefined,
    progress: progressMap.get(a.id) || null,
  }));

  return res.json({ items: result, total, page: parseInt(page), limit: parseInt(limit) });
});

articlesRouter.get("/:id", optionalAuth, (req: AuthRequest, res: Response) => {
  const article = db.select().from(schema.articles).where(eq(schema.articles.id, parseInt(req.params.id))).get();
  if (!article) return res.status(404).json({ error: "Article not found" });

  let progress = null;
  if (req.userId) {
    progress = db.select().from(schema.readingProgress)
      .where(and(
        eq(schema.readingProgress.userId, req.userId),
        eq(schema.readingProgress.articleId, article.id)
      )).get();
  }

  return res.json({ ...article, progress: progress || null });
});

articlesRouter.post("/", authMiddleware, (req: AuthRequest, res: Response) => {
  const { title, content_text, grade_level, category, author, background, source } = req.body;
  if (!title || !content_text || !grade_level || !category) {
    return res.status(400).json({ error: "Title, content_text, grade_level, and category are required" });
  }

  const content = tokenizeContent(content_text);
  const wordCount = content.reduce((sum, p) => sum + p.words.length, 0);

  // Determine source type: teachers import as 'teacher', students as 'student'
  const sourceType = req.userRole === "teacher" ? "teacher" : "student";

  const article = db.insert(schema.articles).values({
    title,
    content: JSON.stringify({ paragraphs: content }),
    gradeLevel: grade_level,
    category,
    author: author || null,
    background: background || null,
    source: source || null,
    sourceType,
    wordCount,
    createdBy: req.userId!,
  }).returning().get();

  return res.status(201).json(article);
});

articlesRouter.delete("/:id", authMiddleware, teacherOnly, (req: AuthRequest, res: Response) => {
  db.delete(schema.articles).where(eq(schema.articles.id, parseInt(req.params.id))).run();
  return res.json({ success: true });
});
