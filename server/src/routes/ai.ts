import { Router, Response } from "express";
import { authMiddleware, teacherOnly, AuthRequest } from "../middleware/auth";
import { chat as aiChat } from "../ai/client";
import { buildPrompt } from "../ai/prompts";
import { getCached, setCache } from "../ai/cache";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

export const aiRouter = Router();

const SERVER_AI_ENABLED = !!process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== "sk-your-deepseek-api-key";

function getUserAI(req: AuthRequest): { apiKey?: string; baseURL?: string; enabled: boolean } {
  if (!req.userId) return { enabled: false };
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.userId)).get();
  if (!user) return { enabled: false };
  const apiKey = user.apiKey || undefined;
  const enabled = !!(apiKey || SERVER_AI_ENABLED);
  return { apiKey, baseURL: user.apiProvider || undefined, enabled };
}

function mockResponse(operation: string, input: Record<string, unknown>) {
  switch (operation) {
    case "translate_word":
      return { translation: "AI未配置", word_type: "", pronunciation: "", affixes: {}, example_sentence: { en: "Configure your DeepSeek API key in Settings or .env to enable translation.", zh: "请在设置页面或.env文件中配置DeepSeek API密钥以启用翻译功能。" }, derivatives: [] };
    case "translate_paragraph":
      return { translation: "AI 翻译功能未配置，请在设置页面添加 DeepSeek API Key。" };
    case "analyze_grammar":
      return { sentence_type: "", clauses: [], structure_description: "AI 未配置，请在设置页面或 .env 文件中配置 DeepSeek API Key。" };
    case "generate_exercises":
      return { exercises: [
        { type: "detail", question: "AI not configured", options: ["Configure", "DeepSeek", "API", "Key"], answer: "Configure", explanation: "请在设置页面配置API密钥" },
      ] };
    default:
      return {};
  }
}

aiRouter.post("/translate-word", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { word, context_sentence } = req.body;
  if (!word) return res.status(400).json({ error: "Word is required" });

  try {
    const userAI = getUserAI(req);
    if (userAI.enabled) {
      const prompt = buildPrompt("translate_word", { word, context_sentence });
      const result = await aiChat(prompt, userAI.apiKey, userAI.baseURL);
      return res.json(JSON.parse(result));
    }
    return res.json(mockResponse("translate_word", { word, context_sentence }));
  } catch (err) {
    console.error("AI translate-word error:", err);
    return res.json(mockResponse("translate_word", { word, context_sentence }));
  }
});

aiRouter.post("/translate-paragraph", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { paragraph, article_id } = req.body;
  if (!paragraph) return res.status(400).json({ error: "Paragraph is required" });

  // Check cache
  const cacheKey = `translate_paragraph:${article_id || "unknown"}:${paragraph.slice(0, 100)}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  try {
    const userAI = getUserAI(req);
    if (userAI.enabled) {
      const prompt = buildPrompt("translate_paragraph", { paragraph });
      const result = await aiChat(prompt, userAI.apiKey, userAI.baseURL);
      const parsed = JSON.parse(result);
      setCache(cacheKey, "translate_paragraph", article_id, paragraph, result);
      return res.json(parsed);
    }
    return res.json(mockResponse("translate_paragraph", { paragraph }));
  } catch (err) {
    console.error("AI translate-paragraph error:", err);
    return res.json(mockResponse("translate_paragraph", { paragraph }));
  }
});

aiRouter.post("/analyze-grammar", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { sentence } = req.body;
  if (!sentence) return res.status(400).json({ error: "Sentence is required" });

  const cacheKey = `analyze_grammar:${sentence}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  try {
    const userAI = getUserAI(req);
    if (userAI.enabled) {
      const prompt = buildPrompt("analyze_grammar", { sentence });
      const result = await aiChat(prompt, userAI.apiKey, userAI.baseURL);
      const parsed = JSON.parse(result);
      setCache(cacheKey, "analyze_grammar", null, sentence, result);
      return res.json(parsed);
    }
    return res.json(mockResponse("analyze_grammar", { sentence }));
  } catch (err) {
    console.error("AI analyze-grammar error:", err);
    return res.json(mockResponse("analyze_grammar", { sentence }));
  }
});

aiRouter.post("/generate-exercises", authMiddleware, teacherOnly, async (req: AuthRequest, res: Response) => {
  const { article_id } = req.body;
  if (!article_id) return res.status(400).json({ error: "article_id is required" });

  const article = db.select().from(schema.articles).where(eq(schema.articles.id, article_id)).get();
  if (!article) return res.status(404).json({ error: "Article not found" });

  // Parse article content
  let articleText = "";
  try {
    const content = JSON.parse(article.content);
    articleText = content.paragraphs.map((p: { text: string }) => p.text).join("\n\n");
  } catch {
    articleText = article.content;
  }

  const cacheKey = `generate_exercises:${article_id}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  try {
    let result: { exercises: Array<{ type: string; question: string; options: string[]; answer: string; explanation: string }> };

    const userAI = getUserAI(req);
    if (userAI.enabled) {
      const prompt = buildPrompt("generate_exercises", {
        title: article.title,
        grade_level: article.gradeLevel,
        article_text: articleText.slice(0, 3000),
      });
      const aiResult = await aiChat(prompt, userAI.apiKey, userAI.baseURL);
      result = JSON.parse(aiResult);
      setCache(cacheKey, "generate_exercises", article_id, articleText, JSON.stringify(result));
    } else {
      result = mockResponse("generate_exercises", {}) as typeof result;
    }

    // Save generated exercises to DB
    const saved = result.exercises.map((ex, i) => {
      return db.insert(schema.exercises).values({
        articleId: article.id,
        type: ex.type as "detail" | "main_idea" | "cloze" | "grammar",
        question: ex.question,
        options: JSON.stringify(ex.options),
        answer: ex.answer,
        explanation: ex.explanation,
        orderIndex: i,
      }).returning().get();
    });

    return res.json({ exercises: saved });
  } catch (err) {
    console.error("AI generate-exercises error:", err);
    const mock = mockResponse("generate_exercises", {});
    const saved = (mock as { exercises: Array<{ type: string; question: string; options: string[]; answer: string; explanation: string }> }).exercises.map((ex, i) => {
      return db.insert(schema.exercises).values({
        articleId: article.id,
        type: ex.type as "detail" | "main_idea" | "cloze" | "grammar",
        question: ex.question,
        options: JSON.stringify(ex.options),
        answer: ex.answer,
        explanation: ex.explanation,
        orderIndex: i,
      }).returning().get();
    });
    return res.json({ exercises: saved });
  }
});
