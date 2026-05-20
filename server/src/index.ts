import "dotenv/config";
import "./prelude.js";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { authRouter } from "./routes/auth.js";
import { articlesRouter } from "./routes/articles.js";
import { vocabularyRouter } from "./routes/vocabulary.js";
import { exercisesRouter } from "./routes/exercises.js";
import { aiRouter } from "./routes/ai.js";
import { progressRouter } from "./routes/progress.js";
import { excerptsRouter } from "./routes/excerpts.js";
import { wrongAnswersRouter } from "./routes/wrongAnswers.js";
import { petRouter } from "./routes/pet.js";
import { commentsRouter } from "./routes/comments.js";
import { groupsRouter } from "./routes/groups.js";
import { feedRouter } from "./routes/feed.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { dbReady } from "./db/index.js";

let __dirname: string;
try {
  __dirname = path.dirname(fileURLToPath(import.meta.url));
} catch {
  __dirname = path.dirname(process.execPath);
}
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// API routes
app.use("/api/auth", authRouter);
app.use("/api/articles", articlesRouter);
app.use("/api/vocabulary", vocabularyRouter);
app.use("/api/exercises", exercisesRouter);
app.use("/api/ai", aiRouter);
app.use("/api/progress", progressRouter);
app.use("/api/excerpts", excerptsRouter);
app.use("/api/wrong-answers", wrongAnswersRouter);
app.use("/api/pet", petRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/groups", groupsRouter);
app.use("/api/feed", feedRouter);

// Serve static client build in production
import fs from "fs";
let clientDist = path.join(__dirname, "../../client/dist");
if (!fs.existsSync(clientDist)) {
  clientDist = path.join(path.dirname(process.execPath), "client/dist");
}
app.use(express.static(clientDist));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.use(errorHandler);

// Wait for database to be ready before listening
dbReady.then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});

export default app;
