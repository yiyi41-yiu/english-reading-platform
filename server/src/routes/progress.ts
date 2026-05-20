import { Router, Response } from "express";
import { db, schema } from "../db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, teacherOnly, AuthRequest } from "../middleware/auth";
import { addXP } from "./pet";

export const progressRouter = Router();

progressRouter.post("/", authMiddleware, (req: AuthRequest, res: Response) => {
  const { article_id, completed } = req.body;
  if (!article_id) return res.status(400).json({ error: "article_id is required" });

  const existing = db.select().from(schema.readingProgress)
    .where(and(
      eq(schema.readingProgress.userId, req.userId!),
      eq(schema.readingProgress.articleId, article_id)
    )).get();

  if (existing) {
    const updated = db.update(schema.readingProgress)
      .set({ completed: completed ? 1 : 0, readAt: new Date().toISOString() })
      .where(and(
        eq(schema.readingProgress.userId, req.userId!),
        eq(schema.readingProgress.articleId, article_id)
      )).returning().get();
    // Pet XP: completing article
    if (completed) {
      try { addXP(req.userId!, 15); } catch {}
    }
    return res.json(updated);
  }

  const progress = db.insert(schema.readingProgress).values({
    userId: req.userId!,
    articleId: article_id,
    completed: completed ? 1 : 0,
    readAt: new Date().toISOString(),
  }).returning().get();

  // Pet XP: reading article +10, completing +15 extra
  try { addXP(req.userId!, completed ? 25 : 10); } catch {}

  return res.status(201).json(progress);
});

progressRouter.get("/", authMiddleware, (req: AuthRequest, res: Response) => {
  const items = db.select().from(schema.readingProgress)
    .where(eq(schema.readingProgress.userId, req.userId!))
    .all();
  return res.json({ items });
});

// Teacher: view a student's progress
progressRouter.get("/student/:userId", authMiddleware, teacherOnly, (req: AuthRequest, res: Response) => {
  const items = db.select().from(schema.readingProgress)
    .where(eq(schema.readingProgress.userId, parseInt(req.params.userId)))
    .all();

  // Also get the student's vocabulary and exercise stats
  const vocabCount = db.select().from(schema.vocabulary)
    .where(eq(schema.vocabulary.userId, parseInt(req.params.userId)))
    .all().length;

  const attempts = db.select().from(schema.exerciseAttempts)
    .where(eq(schema.exerciseAttempts.userId, parseInt(req.params.userId)))
    .all();
  const correctAttempts = attempts.filter(a => a.isCorrect === 1).length;

  return res.json({
    items,
    stats: {
      articlesRead: items.filter(i => i.completed).length,
      vocabularySaved: vocabCount,
      exercisesCorrect: correctAttempts,
      exercisesTotal: attempts.length,
    },
  });
});

// Teacher: get analytics for all students
progressRouter.get("/analytics", authMiddleware, teacherOnly, (_req: AuthRequest, res: Response) => {
  // Get all students
  const students = db.select().from(schema.users)
    .where(eq(schema.users.role, "student"))
    .all();

  const allProgress = db.select().from(schema.readingProgress).all();
  const allAttempts = db.select().from(schema.exerciseAttempts).all();
  const allVocab = db.select().from(schema.vocabulary).all();

  const studentStats = students.map(student => {
    const progress = allProgress.filter(p => p.userId === student.id);
    const attempts = allAttempts.filter(a => a.userId === student.id);
    const vocab = allVocab.filter(v => v.userId === student.id);
    const correctAttempts = attempts.filter(a => a.isCorrect === 1).length;
    const totalExercises = attempts.length;

    // Calculate weekly activity
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weeklyAttempts = attempts.filter(a => new Date(a.attemptedAt) > weekAgo);
    const weeklyVocab = vocab.filter(v => new Date(v.createdAt) > weekAgo);

    return {
      id: student.id,
      name: student.name,
      email: student.email,
      articlesCompleted: progress.filter(p => p.completed).length,
      articlesTotal: progress.length,
      exercisesCorrect: correctAttempts,
      exercisesTotal: totalExercises,
      accuracy: totalExercises > 0 ? Math.round((correctAttempts / totalExercises) * 100) : 0,
      vocabularySaved: vocab.length,
      weeklyActivity: weeklyAttempts.length + weeklyVocab.length,
      lastActive: progress.length > 0
        ? progress.reduce((latest, p) => p.readAt && p.readAt > latest ? p.readAt : latest, "")
        : null,
    };
  });

  // Class summary
  const totalArticles = db.select().from(schema.articles).all().length;
  const classSummary = {
    totalStudents: students.length,
    totalArticles: totalArticles,
    averageAccuracy: studentStats.length > 0
      ? Math.round(studentStats.reduce((s, st) => s + st.accuracy, 0) / studentStats.length)
      : 0,
    totalExercisesDone: allAttempts.length,
    averageVocabPerStudent: studentStats.length > 0
      ? Math.round(allVocab.length / studentStats.length)
      : 0,
  };

  return res.json({ students: studentStats, classSummary });
});

// Leaderboard - available to all authenticated users
progressRouter.get("/leaderboard", authMiddleware, (_req: AuthRequest, res: Response) => {
  const students = db.select().from(schema.users)
    .where(eq(schema.users.role, "student"))
    .all();

  const allProgress = db.select().from(schema.readingProgress).all();
  const allAttempts = db.select().from(schema.exerciseAttempts).all();
  const allVocab = db.select().from(schema.vocabulary).all();

  const leaderboard = students.map(student => {
    const completedArticles = allProgress.filter(p => p.userId === student.id && p.completed).length;
    const correctExercises = allAttempts.filter(a => a.userId === student.id && a.isCorrect === 1).length;
    const vocabCount = allVocab.filter(v => v.userId === student.id).length;
    const points = completedArticles * 10 + correctExercises * 2 + vocabCount * 1;

    return {
      id: student.id,
      name: student.name,
      points,
      articlesCompleted: completedArticles,
      exercisesCorrect: correctExercises,
      vocabularySaved: vocabCount,
    };
  });

  leaderboard.sort((a, b) => b.points - a.points);
  return res.json({ leaderboard: leaderboard.slice(0, 20) }); // Top 20
});

// Personal reading report
progressRouter.get("/report", authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const progress = db.select().from(schema.readingProgress)
    .where(eq(schema.readingProgress.userId, userId)).all();
  const attempts = db.select().from(schema.exerciseAttempts)
    .where(eq(schema.exerciseAttempts.userId, userId)).all();
  const vocab = db.select().from(schema.vocabulary)
    .where(eq(schema.vocabulary.userId, userId)).all();

  const completedArticles = progress.filter(p => p.completed).length;
  const correctExercises = attempts.filter(a => a.isCorrect === 1).length;
  const accuracy = attempts.length > 0 ? Math.round((correctExercises / attempts.length) * 100) : 0;

  // Weekly breakdown
  const now = new Date();
  const weeklyData: Array<{ week: string; articles: number; exercises: number; vocab: number }> = [];
  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;

    const weekArticles = progress.filter(p => p.completed && p.readAt && new Date(p.readAt) >= weekStart && new Date(p.readAt) < weekEnd).length;
    const weekExercises = attempts.filter(a => new Date(a.attemptedAt) >= weekStart && new Date(a.attemptedAt) < weekEnd).length;
    const weekVocab = vocab.filter(v => new Date(v.createdAt) >= weekStart && new Date(v.createdAt) < weekEnd).length;

    weeklyData.push({ week: weekLabel, articles: weekArticles, exercises: weekExercises, vocab: weekVocab });
  }

  // Grade-level distribution
  const articleIds = progress.map(p => p.articleId);
  const articles = db.select().from(schema.articles).all();
  const gradeDist: Record<string, number> = {};
  articleIds.forEach(aid => {
    const article = articles.find(a => a.id === aid);
    if (article) gradeDist[article.gradeLevel] = (gradeDist[article.gradeLevel] || 0) + 1;
  });

  // Points
  const points = completedArticles * 10 + correctExercises * 2 + vocab.length * 1;

  // Rank
  const allStudents = db.select().from(schema.users).where(eq(schema.users.role, "student")).all();
  const allProgress = db.select().from(schema.readingProgress).all();
  const allAttempts2 = db.select().from(schema.exerciseAttempts).all();
  const allVocab2 = db.select().from(schema.vocabulary).all();
  const allPoints = allStudents.map(s => {
    return allProgress.filter(p => p.userId === s.id && p.completed).length * 10
      + allAttempts2.filter(a => a.userId === s.id && a.isCorrect === 1).length * 2
      + allVocab2.filter(v => v.userId === s.id).length * 1;
  });
  allPoints.sort((x, y) => y - x);
  const rank = allPoints.indexOf(points) + 1;

  return res.json({
    summary: {
      totalArticles: completedArticles,
      totalExercises: attempts.length,
      correctExercises,
      accuracy,
      vocabularySaved: vocab.length,
      points,
      rank: rank > 0 ? rank : allStudents.length,
      totalStudents: allStudents.length,
    },
    weeklyData,
    gradeDistribution: gradeDist,
  });
});
