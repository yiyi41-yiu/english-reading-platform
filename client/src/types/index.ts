export interface User {
  id: number;
  email: string;
  name: string;
  role: "student" | "teacher";
  isGuest?: boolean;
}

export interface UserSettings {
  apiKey: string | null;
  apiProvider: string | null;
  hasApiKey: boolean;
}

export interface Article {
  id: number;
  title: string;
  content: string; // JSON string with paragraphs
  gradeLevel: "primary" | "middle" | "high" | "cet4" | "cet6" | "tem4" | "tem8" | "ielts" | "toefl";
  category: "narrative" | "argumentative" | "news" | "academic";
  author: string | null;
  background: string | null;
  source: string | null;
  sourceType: "seed" | "teacher" | "student";
  wordCount: number;
  createdBy: number | null;
  createdAt: string;
  progress?: ReadingProgress | null;
}

export interface WrongAnswer {
  id: number;
  userId: number;
  exerciseId: number;
  articleId: number;
  userAnswer: string;
  correctAnswer: string;
  questionText: string;
  questionType: string;
  options: string | null;
  grammarAnalysis: string | null;
  retried: number;
  retriedAt: string | null;
  createdAt: string;
  articleTitle?: string;
}

export interface ParsedContent {
  paragraphs: ParagraphData[];
}

export interface ParagraphData {
  index: number;
  text: string;
  words: WordData[];
}

export interface WordData {
  word: string;
  clean: string;
}

export interface VocabEntry {
  id: number;
  userId: number;
  word: string;
  translation: string;
  wordType: string | null;
  pronunciation: string | null;
  affixes: string | null; // JSON {prefix, suffix, root}
  derivatives: string | null; // JSON [{word, type, translation}]
  exampleSentence: string | null; // JSON {en, zh}
  articleId: number | null;
  interval: number;
  easeFactor: number;
  repetitions: number;
  nextReview: string | null;
  lastReviewed: string | null;
  createdAt: string;
}

export interface Exercise {
  id: number;
  articleId: number;
  type: "detail" | "main_idea" | "cloze" | "grammar";
  question: string;
  options: string | null; // JSON array
  answer?: string;
  explanation: string | null;
  orderIndex: number;
  userAttempt?: ExerciseAttempt | null;
}

export interface ExerciseAttempt {
  id: number;
  userId: number;
  exerciseId: number;
  userAnswer: string | null;
  isCorrect: number | null;
  attemptedAt: string;
}

export interface ReadingProgress {
  id: number;
  userId: number;
  articleId: number;
  completed: number;
  score: number | null;
  readAt: string | null;
}

export interface ExerciseResult {
  exerciseId: number;
  type: string;
  question: string;
  attempted: boolean;
  isCorrect: number | null;
  userAnswer: string | null;
  correctAnswer: string;
  explanation: string | null;
}

export interface Excerpt {
  id: number;
  userId: number;
  articleId: number;
  text: string;
  note: string | null;
  paragraphIndex: number;
  startOffset: number;
  articleTitle?: string;
  createdAt: string;
}

export interface WordTranslation {
  translation: string;
  word_type: string;
  pronunciation: string;
  affixes: { prefix: string; root: string; suffix: string };
  example_sentence?: { en: string; zh: string };
  derivatives: Array<{ word: string; type: string; translation: string }>;
}

export interface ParagraphTranslation {
  translation: string;
}

export interface GrammarHistoryEntry {
  id: number;
  userId: number;
  sentence: string;
  analysis: GrammarAnalysis;
  articleId: number | null;
  createdAt: string;
}

export interface GrammarAnalysis {
  sentence_type: string;
  clauses: Array<{
    text: string;
    type: string;
    function: string;
    modifiers: Array<{ text: string; type: string }>;
  }>;
  structure_description?: string;
}
