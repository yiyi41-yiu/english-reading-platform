const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth
export const api = {
  auth: {
    register: (body: { email: string; password: string; name: string; role: string }) =>
      request<{ token: string; user: import("../types").User }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) =>
      request<{ token: string; user: import("../types").User }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
    guest: () =>
      request<{ token: string; user: import("../types").User }>("/auth/guest", { method: "POST", body: JSON.stringify({}) }),
    me: () => request<import("../types").User>("/auth/me"),
    getSettings: () => request<import("../types").UserSettings>("/auth/settings"),
    updateSettings: (body: { api_key?: string; api_provider?: string }) =>
      request<{ success: boolean }>("/auth/settings", { method: "PUT", body: JSON.stringify(body) }),
  },

  articles: {
    list: (params: Record<string, string> = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request<{ items: import("../types").Article[]; total: number }>(`/articles${qs ? `?${qs}` : ""}`);
    },
    get: (id: number) => request<import("../types").Article>(`/articles/${id}`),
    create: (body: Record<string, unknown>) =>
      request<import("../types").Article>("/articles", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: number) => request<{ success: boolean }>(`/articles/${id}`, { method: "DELETE" }),
  },

  vocabulary: {
    list: (params: Record<string, string> = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request<{ items: import("../types").VocabEntry[] }>(`/vocabulary${qs ? `?${qs}` : ""}`);
    },
    save: (body: Record<string, unknown>) =>
      request<import("../types").VocabEntry>("/vocabulary", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: number) => request<{ success: boolean }>(`/vocabulary/${id}`, { method: "DELETE" }),
    review: () => request<{ items: import("../types").VocabEntry[]; totalWords: number; mastered: number; due: number }>("/vocabulary/review"),
    submitReview: (id: number, quality: number) =>
      request<import("../types").VocabEntry>(`/vocabulary/review/${id}`, { method: "POST", body: JSON.stringify({ quality }) }),
  },

  exercises: {
    listForArticle: (articleId: number) =>
      request<{ items: import("../types").Exercise[] }>(`/exercises/article/${articleId}`),
    submit: (exerciseId: number, answer: string, articleId?: number) =>
      request<{ id: number; isCorrect: boolean; explanation: string; correctAnswer: string; grammarAnalysis?: string }>(
        `/exercises/${exerciseId}/submit`, { method: "POST", body: JSON.stringify({ answer, article_id: articleId }) }
      ),
    results: (articleId: number) =>
      request<{ results: import("../types").ExerciseResult[]; score: number; total: number; correct: number }>(
        `/exercises/article/${articleId}/results`
      ),
  },

  wrongAnswers: {
    list: () => request<{ items: import("../types").WrongAnswer[] }>("/wrong-answers"),
    retry: (id: number, answer: string) =>
      request<{ correct: boolean }>(`/wrong-answers/${id}/retry`, { method: "POST", body: JSON.stringify({ answer }) }),
  },

  comments: {
    list: (articleId: number) =>
      request<{ items: Array<{ id: number; articleId: number; userId: number; parentId: number | null; content: string; likes: number; createdAt: string; userName: string }> }>(`/comments/article/${articleId}`),
    add: (body: { article_id: number; content: string; parent_id?: number }) =>
      request<{ id: number }>("/comments", { method: "POST", body: JSON.stringify(body) }),
    like: (commentId: number) =>
      request<{ likes: number }>(`/comments/${commentId}/like`, { method: "POST" }),
    remove: (commentId: number) =>
      request<{ success: boolean }>(`/comments/${commentId}`, { method: "DELETE" }),
  },

  groups: {
    list: () => request<{ items: Array<{ id: number; name: string; description: string | null; gradeLevel: string | null; memberCount: number; createdAt: string }> }>("/groups"),
    get: (id: number) => request<{ id: number; name: string; description: string | null; members: Array<{ id: number; userName: string; role: string }>; feed: Array<{ id: number; userId: number; userName: string; activityType: string; summary: string | null; createdAt: string }> }>(`/groups/${id}`),
    create: (body: { name: string; description?: string; grade_level?: string }) =>
      request<{ id: number }>("/groups", { method: "POST", body: JSON.stringify(body) }),
    join: (groupId: number) =>
      request<{ success: boolean }>(`/groups/${groupId}/join`, { method: "POST" }),
    leave: (groupId: number) =>
      request<{ success: boolean }>(`/groups/${groupId}/leave`, { method: "POST" }),
  },

  feed: {
    list: () => request<{ items: Array<{ id: number; userId: number; userName: string; activityType: string; targetId: number | null; summary: string | null; createdAt: string }> }>("/feed"),
  },

  excerpts: {
    list: () => request<{ items: import("../types").Excerpt[] }>("/excerpts"),
    save: (body: { article_id: number; text: string; note?: string; paragraph_index?: number; start_offset?: number }) =>
      request<import("../types").Excerpt>("/excerpts", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: number) => request<{ success: boolean }>(`/excerpts/${id}`, { method: "DELETE" }),
  },

  grammar: {
    list: () => request<{ items: import("../types").GrammarHistoryEntry[] }>("/grammar"),
    get: (id: number) => request<import("../types").GrammarHistoryEntry>(`/grammar/${id}`),
    save: (body: { sentence: string; analysis: object; article_id?: number }) =>
      request<import("../types").GrammarHistoryEntry>("/grammar", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: number) => request<{ success: boolean }>(`/grammar/${id}`, { method: "DELETE" }),
  },

  ai: {
    translateWord: (word: string, contextSentence: string) =>
      request<import("../types").WordTranslation>("/ai/translate-word", { method: "POST", body: JSON.stringify({ word, context_sentence: contextSentence }) }),
    translateParagraph: (paragraph: string, articleId?: number) =>
      request<import("../types").ParagraphTranslation>("/ai/translate-paragraph", { method: "POST", body: JSON.stringify({ paragraph, article_id: articleId }) }),
    analyzeGrammar: (sentence: string) =>
      request<import("../types").GrammarAnalysis>("/ai/analyze-grammar", { method: "POST", body: JSON.stringify({ sentence }) }),
    generateExercises: (articleId: number) =>
      request<{ exercises: import("../types").Exercise[] }>("/ai/generate-exercises", { method: "POST", body: JSON.stringify({ article_id: articleId }) }),
  },

  progress: {
    update: (articleId: number, completed: boolean) =>
      request<import("../types").ReadingProgress>("/progress", { method: "POST", body: JSON.stringify({ article_id: articleId, completed }) }),
    list: () => request<{ items: import("../types").ReadingProgress[] }>("/progress"),
    student: (userId: number) =>
      request<{ items: import("../types").ReadingProgress[]; stats: Record<string, number> }>(`/progress/student/${userId}`),
    analytics: () => request<{
      students: Array<{
        id: number; name: string; email: string;
        articlesCompleted: number; articlesTotal: number;
        exercisesCorrect: number; exercisesTotal: number;
        accuracy: number; vocabularySaved: number;
        weeklyActivity: number; lastActive: string | null;
      }>;
      classSummary: { totalStudents: number; totalArticles: number; averageAccuracy: number; totalExercisesDone: number; averageVocabPerStudent: number };
    }>("/progress/analytics"),
    leaderboard: () => request<{
      leaderboard: Array<{ id: number; name: string; points: number; articlesCompleted: number; exercisesCorrect: number; vocabularySaved: number }>;
    }>("/progress/leaderboard"),
    report: () => request<{
      summary: { totalArticles: number; totalExercises: number; correctExercises: number; accuracy: number; vocabularySaved: number; points: number; rank: number; totalStudents: number };
      weeklyData: Array<{ week: string; articles: number; exercises: number; vocab: number }>;
      gradeDistribution: Record<string, number>;
    }>("/progress/report"),
  },
};
