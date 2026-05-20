import { Router, Response } from "express";
import { db, schema } from "../db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

export const wrongAnswersRouter = Router();

// List wrong answers for current user
wrongAnswersRouter.get("/", authMiddleware, (req: AuthRequest, res: Response) => {
  const items = db.select().from(schema.wrongAnswers)
    .where(eq(schema.wrongAnswers.userId, req.userId!))
    .orderBy(desc(schema.wrongAnswers.createdAt))
    .all();

  // Attach article titles
  const result = items.map(wa => {
    const article = db.select().from(schema.articles)
      .where(eq(schema.articles.id, wa.articleId)).get();
    return { ...wa, articleTitle: article?.title || "Unknown" };
  });

  return res.json({ items: result });
});

// Retry a wrong answer
wrongAnswersRouter.post("/:id/retry", authMiddleware, (req: AuthRequest, res: Response) => {
  const { answer } = req.body;
  const wrongAnswer = db.select().from(schema.wrongAnswers)
    .where(eq(schema.wrongAnswers.id, parseInt(req.params.id)))
    .get();

  if (!wrongAnswer) return res.status(404).json({ error: "Wrong answer not found" });
  if (wrongAnswer.userId !== req.userId) return res.status(403).json({ error: "Not your entry" });

  const correct = answer?.trim().toLowerCase() === wrongAnswer.correctAnswer.trim().toLowerCase();

  if (correct) {
    db.update(schema.wrongAnswers)
      .set({ retried: 1, retriedAt: new Date().toISOString() })
      .where(eq(schema.wrongAnswers.id, wrongAnswer.id))
      .run();
  }

  return res.json({ correct });
});
