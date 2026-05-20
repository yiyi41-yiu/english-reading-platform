import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useTTS } from "../hooks/useTTS";
import { Brain, Volume2, CheckCircle2, ArrowRight, BookMarked, RefreshCw, BarChart3, Star, HelpCircle, Eye, EyeOff } from "lucide-react";

const QUALITY_LABELS: Record<number, { label: string; color: string; desc: string }> = {
  0: { label: "Blackout", color: "bg-red-500 hover:bg-red-600", desc: "Complete blackout" },
  1: { label: "Wrong", color: "bg-orange-500 hover:bg-orange-600", desc: "Incorrect, but familiar" },
  2: { label: "Wrong", color: "bg-amber-500 hover:bg-amber-600", desc: "Incorrect, easy recall" },
  3: { label: "Hard", color: "bg-yellow-500 hover:bg-yellow-600", desc: "Correct with difficulty" },
  4: { label: "Good", color: "bg-green-500 hover:bg-green-600", desc: "Correct with hesitation" },
  5: { label: "Easy", color: "bg-emerald-500 hover:bg-emerald-600", desc: "Perfect, effortless" },
};

type Screen = "loading" | "review" | "done";

export function ReviewPage() {
  const queryClient = useQueryClient();
  const { speakWord } = useTTS();
  const [screen, setScreen] = useState<Screen>("loading");
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [session, setSession] = useState<{ reviewed: number; ratings: number[] }>({ reviewed: 0, ratings: [] });

  const { data, isLoading } = useQuery({
    queryKey: ["vocabulary", "review"],
    queryFn: () => api.vocabulary.review(),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, quality }: { id: number; quality: number }) => api.vocabulary.submitReview(id, quality),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vocabulary"] }),
  });

  const items = data?.items || [];
  const currentItem = items[index];

  const handleReveal = useCallback(() => {
    setRevealed(true);
    if (currentItem) speakWord(currentItem.word);
  }, [currentItem, speakWord]);

  const handleRate = useCallback((quality: number) => {
    if (!currentItem) return;
    reviewMutation.mutate({ id: currentItem.id, quality });
    const newReviewed = session.reviewed + 1;
    const newRatings = [...session.ratings, quality];
    setSession({ reviewed: newReviewed, ratings: newRatings });

    if (index + 1 < items.length) {
      setIndex(index + 1);
      setRevealed(false);
    } else {
      setScreen("done");
    }
  }, [currentItem, index, items.length, reviewMutation, session]);

  const handleRestart = () => {
    queryClient.invalidateQueries({ queryKey: ["vocabulary", "review"] });
    setIndex(0);
    setRevealed(false);
    setSession({ reviewed: 0, ratings: [] });
    setScreen("loading");
  };

  if (isLoading || screen === "loading") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" /> Vocabulary Review
          </h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" /> Vocabulary Review
          </h1>
          <p className="text-gray-500 text-sm mt-1">Spaced repetition practice</p>
        </div>
        <div className="text-center py-16">
          {data && data.totalWords > 0 ? (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-900 font-medium text-lg mb-1">All caught up!</p>
              <p className="text-gray-500 mb-4">You've reviewed {data.mastered} of {data.totalWords} words. No words due right now.</p>
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="h-2 bg-gray-200 rounded-full w-40 overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.round((data.mastered / data.totalWords) * 100)}%` }} />
                </div>
                <span className="text-xs text-gray-500">{Math.round((data.mastered / data.totalWords) * 100)}% mastered</span>
              </div>
              <Link to="/vocabulary" className="text-blue-600 hover:underline text-sm">View all vocabulary</Link>
            </>
          ) : (
            <>
              <BookMarked className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-900 font-medium text-lg mb-1">No words to review yet</p>
              <p className="text-gray-500 mb-2">Here's how to get started:</p>
              <div className="max-w-sm mx-auto text-left text-sm text-gray-600 space-y-1.5 mb-4">
                <p><span className="font-medium">1.</span> Open any reading article</p>
                <p><span className="font-medium">2.</span> Click on a word you don't know</p>
                <p><span className="font-medium">3.</span> Click "Save to vocabulary"</p>
                <p><span className="font-medium">4.</span> Come back here to review!</p>
              </div>
              <Link to="/" className="inline-flex items-center gap-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                <BookMarked className="h-4 w-4" /> Browse articles
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  if (screen === "done") {
    const avgRating = session.ratings.length > 0
      ? Math.round((session.ratings.reduce((a, b) => a + b, 0) / session.ratings.length) * 10) / 10
      : 0;
    const correctCount = session.ratings.filter(r => r >= 3).length;

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" /> Review Complete
          </h1>
        </div>
        <div className="max-w-md mx-auto text-center py-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Great session!</h2>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-2xl font-bold text-gray-900">{session.reviewed}</p>
              <p className="text-xs text-gray-500">Reviewed</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-2xl font-bold text-green-600">{correctCount}</p>
              <p className="text-xs text-gray-500">Correct</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-2xl font-bold text-purple-600">{avgRating}</p>
              <p className="text-xs text-gray-500">Avg Rating</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleRestart}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
              <RefreshCw className="h-4 w-4" /> Review Again
            </button>
            <Link to="/vocabulary"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              <BookMarked className="h-4 w-4" /> All Words
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" /> Vocabulary Review
          </h1>
          <button onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-600 transition-colors">
            <HelpCircle className="h-4 w-4" />
            {showHelp ? "Hide guide" : "How to use"}
          </button>
        </div>
        <p className="text-gray-500 text-sm mt-1">Spaced repetition practice</p>

        {showHelp && (
          <div className="mt-3 bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm">
            <h3 className="font-semibold text-purple-800 mb-2">How it works</h3>
            <ol className="space-y-1.5 text-purple-700 text-xs leading-relaxed">
              <li><span className="font-medium">1. See the word</span> — Read it and try to recall the translation in your mind.</li>
              <li><span className="font-medium">2. Tap to reveal</span> — Click the card to reveal the translation and knowledge points.</li>
              <li><span className="font-medium">3. Rate your recall</span> — Choose how well you remembered (0 = forgot / 5 = perfect).</li>
              <li><span className="font-medium">4. Smart scheduling</span> — Words you know well appear less often. Difficult words repeat more.</li>
            </ol>
            <p className="mt-2 text-xs text-purple-500">
              This uses the SM-2 spaced repetition algorithm. Review daily for best results!
            </p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="max-w-lg mx-auto mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>{index + 1} of {items.length}</span>
          <span>{data?.mastered ?? 0} mastered · {data?.totalWords ?? 0} total</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${(index / items.length) * 100}%` }} />
        </div>
      </div>

      {/* Flashcard */}
      <div className="max-w-lg mx-auto">
        <div
          onClick={() => !revealed && handleReveal()}
          className={`bg-white rounded-2xl border-2 p-8 min-h-[220px] flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
            revealed ? "border-purple-200 shadow-lg" : "border-gray-200 hover:border-purple-300 hover:shadow-md"
          }`}>
          <div className="text-center mb-6">
            <button onClick={(e) => { e.stopPropagation(); speakWord(currentItem.word); }}
              className="mb-2 p-2 hover:bg-gray-100 rounded-full">
              <Volume2 className="h-5 w-5 text-gray-400 hover:text-purple-500" />
            </button>
            <p className="text-3xl font-bold text-gray-900">{currentItem.word}</p>
            {currentItem.pronunciation && (
              <p className="text-sm text-gray-400 font-mono mt-1">{currentItem.pronunciation}</p>
            )}
            {currentItem.wordType && (
              <span className="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{currentItem.wordType}</span>
            )}
          </div>

          {!revealed ? (
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2">Tap to reveal translation</p>
              <ArrowRight className="h-5 w-5 text-gray-300 mx-auto animate-pulse" />
            </div>
          ) : (
            <div className="text-center animate-fade-in">
              <p className="text-xl text-gray-700 font-medium mb-3">{currentItem.translation}</p>
              {currentItem.affixes && (() => {
                const a = JSON.parse(currentItem.affixes);
                return (a.prefix || a.root || a.suffix) ? (
                  <div className="flex justify-center gap-1.5 mb-2">
                    {a.prefix && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">prefix: {a.prefix}</span>}
                    {a.root && <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-xs">root: {a.root}</span>}
                    {a.suffix && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">suffix: {a.suffix}</span>}
                  </div>
                ) : null;
              })()}
              {currentItem.derivatives && (() => {
                const d: Array<{ word: string; type: string; translation: string }> = JSON.parse(currentItem.derivatives);
                return d.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                    {d.map((der, i) => (
                      <span key={i} className="text-xs text-gray-500">{der.word} <span className="text-gray-400">({der.type})</span> {der.translation}</span>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>

        {/* Rating buttons (visible after reveal) */}
        <div className={`mt-6 transition-all duration-300 ${revealed ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <p className="text-center text-xs text-gray-500 mb-3">How well did you remember?</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {[0, 1, 2, 3, 4, 5].map(q => (
              <button key={q} onClick={() => handleRate(q)}
                className={`px-3 py-2 rounded-lg text-white text-xs font-medium transition-all ${QUALITY_LABELS[q].color} hover:scale-105`}
                title={QUALITY_LABELS[q].desc}>
                <div>{QUALITY_LABELS[q].label}</div>
                <div className="opacity-80">{q}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Stats footer */}
        <div className="flex items-center justify-center gap-4 mt-6 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            Reps: {currentItem.repetitions}
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            Ease: {currentItem.easeFactor.toFixed(1)}
          </span>
          <span className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Interval: {currentItem.interval}d
          </span>
        </div>
      </div>
    </div>
  );
}
