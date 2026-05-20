import { Router, Response } from "express";
import { db, schema } from "../db";
import { eq, and, like } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { addXP } from "./pet";

export const vocabularyRouter = Router();

vocabularyRouter.get("/", authMiddleware, (req: AuthRequest, res: Response) => {
  const { search, sort = "newest" } = req.query as Record<string, string>;

  let query = db.select().from(schema.vocabulary)
    .where(eq(schema.vocabulary.userId, req.userId!));

  if (search) {
    query = query.where(like(schema.vocabulary.word, `%${search}%`)) as typeof query;
  }

  const items = query.all();
  items.sort((a, b) => {
    if (sort === "alphabetical") return a.word.localeCompare(b.word);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return res.json({ items });
});

vocabularyRouter.post("/", authMiddleware, (req: AuthRequest, res: Response) => {
  const { word, translation, word_type, pronunciation, affixes, derivatives, example_sentence, article_id } = req.body;
  if (!word || !translation) {
    return res.status(400).json({ error: "Word and translation are required" });
  }

  // Upsert: delete existing then insert
  db.delete(schema.vocabulary).where(and(
    eq(schema.vocabulary.userId, req.userId!),
    eq(schema.vocabulary.word, word)
  )).run();

  const entry = db.insert(schema.vocabulary).values({
    userId: req.userId!,
    word,
    translation,
    wordType: word_type || null,
    pronunciation: pronunciation || null,
    affixes: affixes ? JSON.stringify(affixes) : null,
    derivatives: derivatives ? JSON.stringify(derivatives) : null,
    exampleSentence: example_sentence ? JSON.stringify(example_sentence) : null,
    articleId: article_id || null,
  }).returning().get();

  // Pet XP: saving vocabulary
  try { addXP(req.userId!, 3); } catch {}

  return res.status(201).json(entry);
});

vocabularyRouter.delete("/:id", authMiddleware, (req: AuthRequest, res: Response) => {
  const entry = db.select().from(schema.vocabulary)
    .where(and(
      eq(schema.vocabulary.id, parseInt(req.params.id)),
      eq(schema.vocabulary.userId, req.userId!)
    )).get();

  if (!entry) return res.status(404).json({ error: "Word not found" });
  db.delete(schema.vocabulary).where(eq(schema.vocabulary.id, entry.id)).run();
  return res.json({ success: true });
});

// Get words due for review (SM-2 spaced repetition)
vocabularyRouter.get("/review", authMiddleware, (req: AuthRequest, res: Response) => {
  const now = new Date().toISOString();
  const items = db.select().from(schema.vocabulary)
    .where(and(
      eq(schema.vocabulary.userId, req.userId!),
    ))
    .all()
    .filter(v => !v.nextReview || v.nextReview <= now)
    .sort((a, b) => {
      if (!a.nextReview && !b.nextReview) return 0;
      if (!a.nextReview) return -1;
      if (!b.nextReview) return 1;
      return a.nextReview.localeCompare(b.nextReview);
    });

  const totalWords = db.select().from(schema.vocabulary)
    .where(eq(schema.vocabulary.userId, req.userId!))
    .all().length;

  const mastered = db.select().from(schema.vocabulary)
    .where(and(
      eq(schema.vocabulary.userId, req.userId!),
      // eq(schema.vocabulary.interval, db.sql`>= 21`),
    ))
    .all()
    .filter(v => v.interval >= 21);

  return res.json({ items, totalWords, mastered: mastered.length, due: items.length });
});

// Submit review result (SM-2 algorithm)
vocabularyRouter.post("/review/:id", authMiddleware, (req: AuthRequest, res: Response) => {
  const entry = db.select().from(schema.vocabulary)
    .where(and(
      eq(schema.vocabulary.id, parseInt(req.params.id)),
      eq(schema.vocabulary.userId, req.userId!)
    )).get();

  if (!entry) return res.status(404).json({ error: "Word not found" });

  const { quality } = req.body; // 0-5 rating
  if (typeof quality !== "number" || quality < 0 || quality > 5) {
    return res.status(400).json({ error: "Quality must be a number 0-5" });
  }

  const now = new Date().toISOString();
  let { interval, easeFactor, repetitions } = entry;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor * 10) / 10;
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 0;
  }

  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  easeFactor = Math.round(easeFactor * 100) / 100;

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);
  const nextReview = interval > 0 ? nextReviewDate.toISOString() : now;

  const updated = db.update(schema.vocabulary)
    .set({
      interval,
      easeFactor,
      repetitions,
      nextReview,
      lastReviewed: now,
    })
    .where(eq(schema.vocabulary.id, entry.id))
    .returning()
    .get();

  // Pet XP: reviewing vocabulary
  try { addXP(req.userId!, 2); } catch {}

  return res.json(updated);
});
