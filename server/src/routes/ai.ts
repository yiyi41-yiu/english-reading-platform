import { Router, Response } from "express";
import { authMiddleware, teacherOnly, AuthRequest } from "../middleware/auth";
import { chat as aiChat } from "../ai/client";
import { buildPrompt } from "../ai/prompts";
import { getCached, setCache } from "../ai/cache";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

export const aiRouter = Router();

function getUserAI(req: AuthRequest): { apiKey?: string; baseURL?: string; enabled: boolean; isUserKey: boolean } {
  if (!req.userId) return { enabled: false, isUserKey: false };
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.userId)).get();
  if (!user) return { enabled: false, isUserKey: false };
  const apiKey = user.apiKey || undefined;
  const serverEnabled = !!process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== "sk-your-deepseek-api-key";
  const enabled = !!(apiKey || serverEnabled);
  // Map provider name to full URL
  let baseURL: string | undefined;
  if (user.apiProvider === "openai") baseURL = "https://api.openai.com/v1";
  else if (user.apiProvider) baseURL = "https://api.deepseek.com"; // deepseek or any other defaults to deepseek
  return { apiKey, baseURL, enabled, isUserKey: !!apiKey };
}

function notConfiguredResponse(operation: string) {
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

function callFailedResponse(operation: string) {
  switch (operation) {
    case "translate_word":
      return { translation: "API调用失败", word_type: "", pronunciation: "", affixes: {}, example_sentence: { en: "AI call failed — your API key may be invalid. Check Settings.", zh: "AI调用失败，请检查设置页面中的API密钥是否正确。" }, derivatives: [] };
    case "translate_paragraph":
      return { translation: "AI调用失败，请检查设置页面中的API密钥是否正确。" };
    case "analyze_grammar":
      return { sentence_type: "", clauses: [], structure_description: "AI调用失败，请检查设置页面中的API密钥是否正确。" };
    default:
      return {};
  }
}

aiRouter.post("/translate-word", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { word, context_sentence } = req.body;
  if (!word) return res.status(400).json({ error: "Word is required" });

  const userAI = getUserAI(req);
  if (!userAI.enabled) {
    return res.json(notConfiguredResponse("translate_word"));
  }

  try {
    const prompt = buildPrompt("translate_word", { word, context_sentence });
    const result = await aiChat(prompt, userAI.apiKey, userAI.baseURL);
    return res.json(JSON.parse(result));
  } catch (err) {
    console.error("AI translate-word error:", err);
    return res.json(userAI.isUserKey ? callFailedResponse("translate_word") : notConfiguredResponse("translate_word"));
  }
});

aiRouter.post("/translate-paragraph", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { paragraph, article_id } = req.body;
  if (!paragraph) return res.status(400).json({ error: "Paragraph is required" });

  const cacheKey = `translate_paragraph:${article_id || "unknown"}:${paragraph.slice(0, 100)}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  const userAI = getUserAI(req);
  if (!userAI.enabled) {
    return res.json(notConfiguredResponse("translate_paragraph"));
  }

  try {
    const prompt = buildPrompt("translate_paragraph", { paragraph });
    const result = await aiChat(prompt, userAI.apiKey, userAI.baseURL);
    const parsed = JSON.parse(result);
    setCache(cacheKey, "translate_paragraph", article_id, paragraph, result);
    return res.json(parsed);
  } catch (err) {
    console.error("AI translate-paragraph error:", err);
    return res.json(userAI.isUserKey ? callFailedResponse("translate_paragraph") : notConfiguredResponse("translate_paragraph"));
  }
});

aiRouter.post("/analyze-grammar", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { sentence } = req.body;
  if (!sentence) return res.status(400).json({ error: "Sentence is required" });

  const cacheKey = `analyze_grammar:${sentence}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  const userAI = getUserAI(req);
  if (!userAI.enabled) {
    return res.json(notConfiguredResponse("analyze_grammar"));
  }

  try {
    const prompt = buildPrompt("analyze_grammar", { sentence });
    const result = await aiChat(prompt, userAI.apiKey, userAI.baseURL);
    const parsed = JSON.parse(result);
    setCache(cacheKey, "analyze_grammar", null, sentence, result);
    return res.json(parsed);
  } catch (err) {
    console.error("AI analyze-grammar error:", err);
    return res.json(userAI.isUserKey ? callFailedResponse("analyze_grammar") : notConfiguredResponse("analyze_grammar"));
  }
});

aiRouter.post("/generate-exercises", authMiddleware, teacherOnly, async (req: AuthRequest, res: Response) => {
  const { article_id } = req.body;
  if (!article_id) return res.status(400).json({ error: "article_id is required" });

  const article = db.select().from(schema.articles).where(eq(schema.articles.id, article_id)).get();
  if (!article) return res.status(404).json({ error: "Article not found" });

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

  const userAI = getUserAI(req);
  if (!userAI.enabled) {
    const mock = notConfiguredResponse("generate_exercises") as { exercises: Array<{ type: string; question: string; options: string[]; answer: string; explanation: string }> };
    const saved = mock.exercises.map((ex, i) => {
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

  try {
    const prompt = buildPrompt("generate_exercises", {
      title: article.title,
      grade_level: article.gradeLevel,
      article_text: articleText.slice(0, 3000),
    });
    const aiResult = await aiChat(prompt, userAI.apiKey, userAI.baseURL);
    const result = JSON.parse(aiResult);

    const saved = result.exercises.map((ex: { type: string; question: string; options: string[]; answer: string; explanation: string }, i: number) => {
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
    setCache(cacheKey, "generate_exercises", article_id, articleText, JSON.stringify(result));
    return res.json({ exercises: saved });
  } catch (err) {
    console.error("AI generate-exercises error:", err);
    const mock = userAI.isUserKey ? notConfiguredResponse("generate_exercises") : notConfiguredResponse("generate_exercises");
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
