import { Router, Response } from "express";
import { db, schema } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

export const groupsRouter = Router();

// List all groups
groupsRouter.get("/", authMiddleware, (_req: AuthRequest, res: Response) => {
  const items = db.select().from(schema.groups).orderBy(desc(schema.groups.memberCount)).all();
  return res.json({ items });
});

// Get group detail
groupsRouter.get("/:id", authMiddleware, (req: AuthRequest, res: Response) => {
  const group = db.select().from(schema.groups)
    .where(eq(schema.groups.id, parseInt(req.params.id))).get();
  if (!group) return res.status(404).json({ error: "Group not found" });

  const members = db.select().from(schema.groupMembers)
    .where(eq(schema.groupMembers.groupId, group.id)).all();
  const memberDetails = members.map(m => {
    const user = db.select().from(schema.users).where(eq(schema.users.id, m.userId)).get();
    return { ...m, userName: user?.name || "Unknown" };
  });

  // Group feed
  const feed = db.select().from(schema.activityFeed)
    .where(eq(schema.activityFeed.groupId, group.id))
    .orderBy(desc(schema.activityFeed.createdAt))
    .limit(20).all();
  const feedWithNames = feed.map(f => {
    const user = db.select().from(schema.users).where(eq(schema.users.id, f.userId)).get();
    return { ...f, userName: user?.name || "Unknown" };
  });

  return res.json({ ...group, members: memberDetails, feed: feedWithNames });
});

// Create group
groupsRouter.post("/", authMiddleware, (req: AuthRequest, res: Response) => {
  const { name, description, grade_level } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });

  const group = db.insert(schema.groups).values({
    name, description: description || null, gradeLevel: grade_level || null,
    createdBy: req.userId!, memberCount: 1,
  }).returning().get();

  db.insert(schema.groupMembers).values({
    groupId: group.id, userId: req.userId!, role: "admin",
  }).run();

  return res.status(201).json(group);
});

// Join group
groupsRouter.post("/:id/join", authMiddleware, (req: AuthRequest, res: Response) => {
  const groupId = parseInt(req.params.id);
  const group = db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).get();
  if (!group) return res.status(404).json({ error: "Group not found" });

  const existing = db.select().from(schema.groupMembers)
    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, req.userId!))).get();
  if (existing) return res.status(409).json({ error: "Already a member" });

  db.insert(schema.groupMembers).values({ groupId, userId: req.userId! }).run();
  db.update(schema.groups).set({ memberCount: group.memberCount + 1 }).where(eq(schema.groups.id, groupId)).run();

  return res.json({ success: true });
});

// Leave group
groupsRouter.post("/:id/leave", authMiddleware, (req: AuthRequest, res: Response) => {
  const groupId = parseInt(req.params.id);
  db.delete(schema.groupMembers)
    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, req.userId!))).run();

  const count = db.select({ count: sql`COUNT(*)` }).from(schema.groupMembers)
    .where(eq(schema.groupMembers.groupId, groupId)).get() as { count: number };
  db.update(schema.groups).set({ memberCount: Number(count.count) }).where(eq(schema.groups.id, groupId)).run();

  return res.json({ success: true });
});
