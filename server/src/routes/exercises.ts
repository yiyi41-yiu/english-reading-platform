import { Router, Response } from "express";
import { db, schema } from "../db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

export const exercisesRouter = Router();

// Get exercises for an article (without answers for students)
exercisesRouter.get("/article/:articleId", authMiddleware, (req: AuthRequest, res: Response) => {
  const exercises = db.select().from(schema.exercises)
    .where(eq(schema.exercises.articleId, parseInt(req.params.articleId)))
    .orderBy(schema.exercises.orderIndex)
    .all();

  // Get user's attempts for these exercises
  const attemptRows = db.select().from(schema.exerciseAttempts)
    .where(eq(schema.exerciseAttempts.userId, req.userId!)).all();
  const attemptMap = new Map(attemptRows.map(a => [a.exerciseId, a]));

  const result = exercises.map(e => ({
    ...e,
    answer: undefined, // Don't reveal answer
    userAttempt: attemptMap.get(e.id) || null,
  }));

  return res.json({ items: result });
});

// Submit an answer
exercisesRouter.post("/:exerciseId/submit", authMiddleware, (req: AuthRequest, res: Response) => {
  const { answer, article_id } = req.body;
  const exercise = db.select().from(schema.exercises)
    .where(eq(schema.exercises.id, parseInt(req.params.exerciseId)))
    .get();

  if (!exercise) return res.status(404).json({ error: "Exercise not found" });

  const isCorrect = answer?.trim().toLowerCase() === exercise.answer.trim().toLowerCase() ? 1 : 0;

  const attempt = db.insert(schema.exerciseAttempts).values({
    userId: req.userId!,
    exerciseId: exercise.id,
    userAnswer: answer,
    isCorrect,
  }).returning().get();

  // Record wrong answer with grammar context
  let grammarAnalysis: string | null = null;
  if (!isCorrect) {
    const options = exercise.options || null;
    db.insert(schema.wrongAnswers).values({
      userId: req.userId!,
      exerciseId: exercise.id,
      articleId: article_id || exercise.articleId,
      userAnswer: answer || "",
      correctAnswer: exercise.answer,
      questionText: exercise.question,
      questionType: exercise.type,
      options,
      grammarAnalysis: null,
    }).run();

    // Extract grammar info from explanation for display
    if (exercise.explanation && exercise.type === "grammar") {
      grammarAnalysis = exercise.explanation;
    }
  }

  return res.json({
    id: attempt.id,
    isCorrect: !!isCorrect,
    explanation: exercise.explanation,
    correctAnswer: exercise.answer,
    grammarAnalysis,
  });
});

// Get results for all exercises in an article
exercisesRouter.get("/article/:articleId/results", authMiddleware, (req: AuthRequest, res: Response) => {
  const exercises = db.select().from(schema.exercises)
    .where(eq(schema.exercises.articleId, parseInt(req.params.articleId)))
    .all();

  const attemptRows = db.select().from(schema.exerciseAttempts)
    .where(and(
      eq(schema.exerciseAttempts.userId, req.userId!),
    )).all();
  const attemptMap = new Map(attemptRows.map(a => [a.exerciseId, a]));

  const results = exercises.map(e => {
    const attempt = attemptMap.get(e.id);
    return {
      exerciseId: e.id,
      type: e.type,
      question: e.question,
      attempted: !!attempt,
      isCorrect: attempt?.isCorrect,
      userAnswer: attempt?.userAnswer,
      correctAnswer: e.answer,
      explanation: e.explanation,
    };
  });

  const total = results.length;
  const correct = results.filter(r => r.isCorrect).length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  return res.json({ results, score, total, correct });
});
