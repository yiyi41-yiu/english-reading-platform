import { Router, Response } from "express";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

export const petRouter = Router();

const STAGE_CONFIG = [
  { stage: 0, name: "Egg", emoji: "🥚", xpToNext: 50 },
  { stage: 1, name: "Baby", emoji: "🐣", xpToNext: 150 },
  { stage: 2, name: "Child", emoji: "🐥", xpToNext: 350 },
  { stage: 3, name: "Teen", emoji: "🐤", xpToNext: 700 },
  { stage: 4, name: "Adult", emoji: "🦉", xpToNext: Infinity },
];

function getOrCreatePet(userId: number) {
  let pet = db.select().from(schema.pets).where(eq(schema.pets.userId, userId)).get();
  if (!pet) {
    const names = ["Luna", "Max", "Bella", "Charlie", "Lucy", "Milo", "Daisy", "Oscar"];
    const name = names[Math.floor(Math.random() * names.length)];
    pet = db.insert(schema.pets).values({
      userId, name,
      stage: 0, happiness: 80, experience: 0,
    }).returning().get();
  }
  return { ...pet, config: STAGE_CONFIG[pet.stage], nextConfig: STAGE_CONFIG[pet.stage + 1] || null };
}

function addXP(userId: number, amount: number) {
  const pet = getOrCreatePet(userId);
  let newXP = pet.experience + amount;
  let newStage = pet.stage;

  // Level up if enough XP
  while (newStage < 4 && newXP >= STAGE_CONFIG[newStage].xpToNext) {
    newStage++;
  }

  db.update(schema.pets)
    .set({ experience: newXP, stage: newStage })
    .where(eq(schema.pets.userId, userId))
    .run();

  const leveled = newStage > pet.stage;
  return { experience: newXP, stage: newStage, leveled };
}

function updateHappiness(userId: number, delta: number) {
  const pet = getOrCreatePet(userId);
  const newHappiness = Math.max(0, Math.min(100, pet.happiness + delta));
  db.update(schema.pets)
    .set({ happiness: newHappiness, lastFedAt: new Date().toISOString() })
    .where(eq(schema.pets.userId, userId))
    .run();
  return newHappiness;
}

// Get current pet
petRouter.get("/", authMiddleware, (req: AuthRequest, res: Response) => {
  const pet = getOrCreatePet(req.userId!);
  return res.json({
    ...pet,
    passwordHash: undefined,
    stageInfo: STAGE_CONFIG[pet.stage],
    nextStage: pet.stage < 4 ? STAGE_CONFIG[pet.stage + 1] : null,
  });
});

// Feed pet (increase happiness)
petRouter.post("/feed", authMiddleware, (req: AuthRequest, res: Response) => {
  const happiness = updateHappiness(req.userId!, 10);
  return res.json({ happiness });
});

// Name pet
petRouter.post("/name", authMiddleware, (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  db.update(schema.pets).set({ name }).where(eq(schema.pets.userId, req.userId!)).run();
  return res.json({ name });
});

export { getOrCreatePet, addXP, updateHappiness };
