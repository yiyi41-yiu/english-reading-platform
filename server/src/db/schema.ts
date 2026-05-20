import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["student", "teacher"] }).notNull().default("student"),
  isGuest: integer("is_guest").notNull().default(0),
  guestId: text("guest_id"),
  apiKey: text("api_key"),
  apiProvider: text("api_provider"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(), // JSON: {paragraphs: [{index, text, words: [{word, start, end}]}]}
  gradeLevel: text("grade_level", { enum: ["primary", "middle", "high", "cet4", "cet6", "tem4", "tem8", "ielts", "toefl"] }).notNull(),
  category: text("category", { enum: ["narrative", "argumentative", "news", "academic"] }).notNull(),
  author: text("author"),
  background: text("background"), // Markdown
  source: text("source"),
  sourceType: text("source_type", { enum: ["seed", "teacher", "student"] }).notNull().default("seed"),
  wordCount: integer("word_count").notNull().default(0),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const vocabulary = sqliteTable("vocabulary", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  word: text("word").notNull(),
  translation: text("translation").notNull(),
  wordType: text("word_type"),
  pronunciation: text("pronunciation"),
  affixes: text("affixes"), // JSON: {prefix, suffix, root}
  derivatives: text("derivatives"), // JSON: [{word, type, translation}]
  exampleSentence: text("example_sentence"), // JSON: {en, zh}
  articleId: integer("article_id").references(() => articles.id, { onDelete: "set null" }),
  interval: real("interval").notNull().default(0),       // Current interval in days
  easeFactor: real("ease_factor").notNull().default(2.5), // SM-2 ease factor
  repetitions: integer("repetitions").notNull().default(0), // Times successfully recalled
  nextReview: text("next_review"),                        // Next review date (ISO string)
  lastReviewed: text("last_reviewed"),                    // Last review date
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
}, (table) => ({
  userWordIdx: uniqueIndex("user_word_idx").on(table.userId, table.word),
}));

export const excerpts = sqliteTable("excerpts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  note: text("note"),
  paragraphIndex: integer("paragraph_index").notNull().default(0),
  startOffset: integer("start_offset").notNull().default(0),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const exercises = sqliteTable("exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["detail", "main_idea", "cloze", "grammar"] }).notNull(),
  question: text("question").notNull(),
  options: text("options"), // JSON array of 4 options, null for open-ended
  answer: text("answer").notNull(),
  explanation: text("explanation"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const exerciseAttempts = sqliteTable("exercise_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  userAnswer: text("user_answer"),
  isCorrect: integer("is_correct"), // 0 or 1, null if ungraded
  attemptedAt: text("attempted_at").notNull().default("(datetime('now'))"),
});

export const readingProgress = sqliteTable("reading_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  completed: integer("completed").notNull().default(0),
  score: real("score"),
  readAt: text("read_at"),
}, (table) => ({
  userArticleIdx: uniqueIndex("user_article_idx").on(table.userId, table.articleId),
}));

export const pets = sqliteTable("pets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  stage: integer("stage").notNull().default(0), // 0=egg, 1=baby, 2=child, 3=teen, 4=adult
  happiness: integer("happiness").notNull().default(80),
  experience: integer("experience").notNull().default(0),
  lastFedAt: text("last_fed_at"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"), // null = top-level, non-null = reply
  content: text("content").notNull(),
  likes: integer("likes").notNull().default(0),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  gradeLevel: text("grade_level"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  memberCount: integer("member_count").notNull().default(0),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const groupMembers = sqliteTable("group_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["member", "admin"] }).notNull().default("member"),
  joinedAt: text("joined_at").notNull().default("(datetime('now'))"),
}, (table) => ({
  uniqueMembership: uniqueIndex("unique_membership").on(table.groupId, table.userId),
}));

export const activityFeed = sqliteTable("activity_feed", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: integer("group_id"), // null = public
  activityType: text("activity_type", { enum: ["read_article", "complete_exercise", "save_vocab", "share_note", "join_group"] }).notNull(),
  targetId: integer("target_id"),
  summary: text("summary"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const wrongAnswers = sqliteTable("wrong_answers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  userAnswer: text("user_answer").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  questionText: text("question_text").notNull(),
  questionType: text("question_type").notNull(),
  options: text("options"), // JSON
  grammarAnalysis: text("grammar_analysis"), // JSON with grammar explanation
  retried: integer("retried").notNull().default(0),
  retriedAt: text("retried_at"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const grammarHistory = sqliteTable("grammar_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sentence: text("sentence").notNull(),
  analysis: text("analysis").notNull(), // JSON: GrammarAnalysis
  articleId: integer("article_id"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const aiCache = sqliteTable("ai_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cacheKey: text("cache_key").notNull().unique(),
  operation: text("operation").notNull(),
  articleId: integer("article_id").references(() => articles.id, { onDelete: "cascade" }),
  inputHash: text("input_hash").notNull(),
  result: text("result").notNull(), // JSON
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});
