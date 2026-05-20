import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

export const authRouter = Router();

authRouter.post("/register", async (req, res: Response) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }

    const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.insert(schema.users).values({
      email,
      passwordHash,
      name,
      role: role === "teacher" ? "teacher" : "student",
    }).returning().get();

    const token = jwt.sign({ userId: result.id, role: result.role }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token, user: { id: result.id, email: result.email, name: result.name, role: result.role } });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Registration failed" });
  }
});

authRouter.post("/login", async (req, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

authRouter.get("/me", authMiddleware, (req: AuthRequest, res: Response) => {
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({ id: user.id, email: user.email, name: user.name, role: user.role, isGuest: !!user.isGuest });
});

// Guest login — create a temporary 24h account
authRouter.post("/guest", async (_req, res: Response) => {
  try {
    const guestId = crypto.randomUUID();
    const guestName = `Guest_${guestId.slice(0, 6)}`;
    const passwordHash = await bcrypt.hash(guestId, 10);

    const result = db.insert(schema.users).values({
      email: `guest_${guestId}@temp.local`,
      passwordHash,
      name: guestName,
      role: "student",
      isGuest: 1,
      guestId,
    }).returning().get();

    const token = jwt.sign({ userId: result.id, role: result.role }, JWT_SECRET, { expiresIn: "24h" });
    return res.json({ token, user: { id: result.id, email: result.email, name: result.name, role: result.role, isGuest: true } });
  } catch (err) {
    console.error("Guest login error:", err);
    return res.status(500).json({ error: "Guest login failed" });
  }
});

// Get user API settings
authRouter.get("/settings", authMiddleware, (req: AuthRequest, res: Response) => {
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).get();
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({
    apiKey: user.apiKey ? `****${user.apiKey.slice(-4)}` : null,
    apiProvider: user.apiProvider || null,
    hasApiKey: !!user.apiKey,
  });
});

// Update user API settings
authRouter.put("/settings", authMiddleware, (req: AuthRequest, res: Response) => {
  const { api_key, api_provider } = req.body;
  const updates: Record<string, unknown> = {};
  if (api_key !== undefined) updates.apiKey = api_key || null;
  if (api_provider !== undefined) updates.apiProvider = api_provider || null;

  db.update(schema.users).set(updates).where(eq(schema.users.id, req.userId!)).run();
  return res.json({ success: true });
});
