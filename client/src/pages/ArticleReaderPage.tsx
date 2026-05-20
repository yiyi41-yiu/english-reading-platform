import { useState, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { WordPopup } from "../components/reader/WordPopup";
import { ParagraphToolbar } from "../components/reader/ParagraphToolbar";
import { BackgroundCard } from "../components/reader/BackgroundCard";
import { ExercisePanel } from "../components/reader/ExercisePanel";
import { GrammarPanel } from "../components/reader/GrammarPanel";
import { CommentSection } from "../components/social/CommentSection";
import type { ParsedContent, ParagraphData } from "../types";
import { ArrowLeft, FileText, GitBranch, ChevronRight } from "lucide-react";

interface TextSelection {
  text: string;
  paragraphIndex: number;
  startOffset: number;
}

export function ArticleReaderPage() {
  const { id } = useParams<{ id: string }>();
  const articleId = parseInt(id!);
  const [selectedWord, setSelectedWord] = useState<{
    word: string; clean: string; contextSentence: string; position: { x: number; y: number };
  } | null>(null);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [grammarSentence, setGrammarSentence] = useState<string | null>(null);
  const [showExercises, setShowExercises] = useState(true);
  const [score, setScore] = useState<number | null>(null);
  const { data: article, isLoading } = useQuery({
    queryKey: ["article", articleId],
    queryFn: () => api.articles.get(articleId),
  });

  // Mark as reading
  useEffect(() => {
    if (articleId) {
      api.progress.update(articleId, false).catch(() => {});
    }
  }, [articleId]);

  const handleWordClick = useCallback((e: React.MouseEvent, word: string, clean: string, paragraph: ParagraphData) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setSelectedWord({
      word, clean,
      contextSentence: paragraph.text,
      position: { x: rect.left, y: rect.bottom + 4 },
    });
    setGrammarSentence(null);
  }, []);

  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (text && text.split(/\s+/).length >= 3) {
      // Find which paragraph contains the selection
      const anchorNode = sel.anchorNode;
      const paragraphEl = anchorNode?.parentElement?.closest("[data-paragraph-index]");
      const pIndex = paragraphEl ? parseInt(paragraphEl.getAttribute("data-paragraph-index") || "0") : 0;
      setSelectedText({ text, paragraphIndex: pIndex, startOffset: sel.anchorOffset });
      setTimeout(() => sel.removeAllRanges(), 100);
    }
  }, []);

  const handleAnalyzeSentence = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text && text.split(/\s+/).length >= 5) {
      setGrammarSentence(text);
      setSelectedWord(null);
      setTimeout(() => sel?.removeAllRanges(), 100);
    }
  }, []);

  const handleMarkComplete = async () => {
    await api.progress.update(articleId, true);
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Article not found</p>
        <Link to="/" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Back to library</Link>
      </div>
    );
  }

  let parsedContent: ParsedContent;
  try {
    parsedContent = JSON.parse(article.content);
  } catch {
    parsedContent = { paragraphs: [] };
  }

  const GRADE_LABELS: Record<string, string> = {
    primary: "Primary", middle: "Middle", high: "High",
    cet4: "CET-4", cet6: "CET-6", tem4: "TEM-4",
    tem8: "TEM-8", ielts: "IELTS", toefl: "TOEFL",
  };
  const CATEGORY_LABELS: Record<string, string> = { narrative: "Narrative", argumentative: "Argumentative", news: "News", academic: "Academic" };
  const content = parsedContent;

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to library
        </Link>
        <h1 className="text-xl font-bold text-gray-900 leading-snug">{article.title}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
            {GRADE_LABELS[article.gradeLevel]}
          </span>
          <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded text-xs font-medium">
            {CATEGORY_LABELS[article.category]}
          </span>
          {article.author && <span className="text-xs text-gray-400">by {article.author}</span>}
          <span className="text-xs text-gray-300">|</span>
          <span className="text-xs text-gray-400">{article.wordCount} words</span>
          {score != null && (
            <>
              <span className="text-xs text-gray-300">|</span>
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${score >= 60 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                Score: {score}%
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main reading area */}
        <div className={`${showExercises ? "w-[60%]" : "w-full max-w-3xl"} transition-all`}>
          <BackgroundCard author={article.author} background={article.background} source={article.source} />

          {/* Action toolbar */}
          <div className="flex items-center gap-2 my-4">
            <button onClick={handleMarkComplete}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium">
              <FileText className="h-3.5 w-3.5" /> Mark as complete
            </button>
            <button
              onClick={handleAnalyzeSentence}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium">
              <GitBranch className="h-3.5 w-3.5" /> Select sentence → Analyze
            </button>
            <button
              onClick={() => setShowExercises(!showExercises)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium ml-auto">
              {showExercises ? "Hide Exercises" : "Show Exercises"}
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showExercises ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* Article content */}
          <div className="bg-white rounded-xl border p-6" onMouseUp={handleTextSelection}>
            <div className="space-y-4">
              {content.paragraphs.map((para) => (
                <div key={para.index} data-paragraph-index={para.index} className="group leading-relaxed">
                  <div className="text-gray-800 text-[15px] leading-loose">
                    {para.words.map((w, wi) => (
                      <span
                        key={wi}
                        onClick={(e) => handleWordClick(e, w.word, w.clean, para)}
                        className="cursor-pointer hover:bg-yellow-100 hover:text-yellow-900 rounded px-[1px] transition-colors"
                      >
                        {w.word}{" "}
                      </span>
                    ))}
                  </div>
                  <ParagraphToolbar paragraphText={para.text} articleId={articleId} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Exercise sidebar */}
        {showExercises && (
          <div className="w-[40%] min-w-[340px]">
            <ExercisePanel articleId={articleId} onScoreUpdate={setScore} />
          </div>
        )}
      </div>

      {/* Comments section */}
      <div className="mt-6 max-w-3xl">
        <CommentSection articleId={articleId} />
      </div>

      {/* Word popup */}
      {selectedWord && (
        <WordPopup
          word={selectedWord.word}
          cleanWord={selectedWord.clean}
          contextSentence={selectedWord.contextSentence}
          position={selectedWord.position}
          onClose={() => setSelectedWord(null)}
          articleId={articleId}
        />
      )}

      {/* Grammar panel */}
      {grammarSentence && (
        <GrammarPanel sentence={grammarSentence} onClose={() => setGrammarSentence(null)} />
      )}

      {/* Selection action modal */}
      {selectedText && (
        <SelectionModal
          selection={selectedText}
          articleId={articleId}
          onClose={() => setSelectedText(null)}
        />
      )}
    </div>
  );
}

function SelectionModal({ selection, articleId, onClose }: { selection: TextSelection; articleId: number; onClose: () => void }) {
  const [tab, setTab] = useState<"translate" | "excerpt">("translate");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveExcerpt = async () => {
    setSaving(true);
    try {
      await api.excerpts.save({
        article_id: articleId,
        text: selection.text,
        note: note || undefined,
        paragraph_index: selection.paragraphIndex,
        start_offset: selection.startOffset,
      });
      setSaved(true);
      setTimeout(onClose, 800);
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setTab("translate")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "translate" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              Translate
            </button>
            <button onClick={() => setTab("excerpt")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "excerpt" ? "bg-white text-amber-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              Save Excerpt
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <p className="text-sm text-gray-600 mb-3 bg-gray-50 p-3 rounded-lg italic border-l-2 border-amber-200">
          &ldquo;{selection.text}&rdquo;
        </p>
        <p className="text-xs text-gray-400 mb-3">Paragraph {selection.paragraphIndex + 1}</p>

        {tab === "translate" ? (
          <TranslationBlock text={selection.text} articleId={articleId} />
        ) : (
          <div className="space-y-3">
            <textarea
              placeholder="Add a note (optional)..."
              value={note} onChange={e => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none"
            />
            <button onClick={handleSaveExcerpt} disabled={saving || saved}
              className="w-full py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors">
              {saved ? "Saved!" : saving ? "Saving..." : "Save to Excerpts"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TranslationBlock({ text, articleId }: { text: string; articleId: number }) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.ai.translateParagraph(text, articleId)
      .then(r => setTranslation(r.translation))
      .catch(() => setTranslation("Translation failed"))
      .finally(() => setLoading(false));
  }, [text, articleId]);

  if (loading) return <div className="animate-pulse h-16 bg-gray-100 rounded" />;
  return <p className="text-sm text-blue-800 bg-blue-50 p-3 rounded-lg">{translation}</p>;
}
