import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Exercise, ExerciseResult } from "../../types";
import { ChevronRight, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  detail: "Detail",
  main_idea: "Main Idea",
  cloze: "Cloze",
  grammar: "Grammar",
};

interface ExercisePanelProps {
  articleId: number;
  onScoreUpdate?: (score: number) => void;
}

export function ExercisePanel({ articleId, onScoreUpdate }: ExercisePanelProps) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [submittedIds, setSubmittedIds] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  const { data: exerciseData, isLoading } = useQuery({
    queryKey: ["exercises", articleId],
    queryFn: () => api.exercises.listForArticle(articleId),
  });

  const { data: resultData } = useQuery({
    queryKey: ["exerciseResults", articleId],
    queryFn: () => api.exercises.results(articleId),
    refetchInterval: false,
  });

  // Track grammar analysis for each submitted exercise
  const [grammarInfo, setGrammarInfo] = useState<Record<number, string | null>>({});

  const allExercises = exerciseData?.items || [];
  const filtered = activeTab === "all" ? allExercises : allExercises.filter(e => e.type === activeTab);
  const resultMap = new Map<number, ExerciseResult>();
  if (resultData?.results) {
    resultData.results.forEach(r => resultMap.set(r.exerciseId, r));
  }

  useEffect(() => {
    if (resultData && onScoreUpdate) onScoreUpdate(resultData.score);
  }, [resultData, onScoreUpdate]);

  const types = ["all", ...new Set(allExercises.map(e => e.type))];

  const handleSubmit = async (exercise: Exercise) => {
    const answer = userAnswers[exercise.id] || "";
    if (!answer) return;
    try {
      const result = await api.exercises.submit(exercise.id, answer, articleId);
      if (result.grammarAnalysis) {
        setGrammarInfo(prev => ({ ...prev, [exercise.id]: result.grammarAnalysis! }));
      }
      setSubmittedIds(prev => new Set([...prev, exercise.id]));
      queryClient.invalidateQueries({ queryKey: ["exerciseResults", articleId] });
    } catch { /* ignore */ }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Exercises</h3>
        <div className="space-y-3">{[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
        ))}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">Exercises</h3>
        {resultData && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${resultData.score >= 60 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            Score: {resultData.score}%
          </span>
        )}
      </div>

      <div className="flex border-b overflow-x-auto">
        {types.map(type => (
          <button key={type} onClick={() => setActiveTab(type)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === type ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {type === "all" ? "All" : TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
        {filtered.map(exercise => {
          const options: string[] = exercise.options ? JSON.parse(exercise.options) : [];
          const result = resultMap.get(exercise.id);
          const isSubmitted = submittedIds.has(exercise.id) || !!result;

          return (
            <div key={exercise.id} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                  exercise.type === "detail" ? "bg-blue-100 text-blue-600" :
                  exercise.type === "main_idea" ? "bg-purple-100 text-purple-600" :
                  exercise.type === "cloze" ? "bg-orange-100 text-orange-600" :
                  "bg-green-100 text-green-600"
                }`}>
                  {TYPE_LABELS[exercise.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-relaxed">{exercise.question}</p>

                  {options.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const isSelected = userAnswers[exercise.id] === opt;
                        const isCorrectAnswer = result && opt === result.correctAnswer;
                        const isWrongSelected = result && isSelected && opt !== result.correctAnswer;

                        let btnClass = "w-full text-left px-2.5 py-1.5 rounded text-sm border ";
                        if (isWrongSelected) {
                          btnClass += "bg-red-50 border-red-300 text-red-700";
                        } else if (isCorrectAnswer && isSubmitted) {
                          btnClass += "bg-green-50 border-green-300 text-green-700";
                        } else if (isSelected) {
                          btnClass += "bg-blue-50 border-blue-300 text-blue-700";
                        } else {
                          btnClass += "border-gray-200 hover:bg-gray-50 text-gray-700";
                        }

                        return (
                          <button key={i} disabled={isSubmitted} onClick={() => setUserAnswers(prev => ({ ...prev, [exercise.id]: opt }))}
                            className={btnClass}>
                            <span className="font-medium">{letter}.</span> {opt}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      type="text" placeholder="Your answer..."
                      value={userAnswers[exercise.id] || ""}
                      onChange={e => setUserAnswers(prev => ({ ...prev, [exercise.id]: e.target.value }))}
                      disabled={isSubmitted}
                      className="mt-2 w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    {!isSubmitted && (
                      <button onClick={() => handleSubmit(exercise)}
                        disabled={!userAnswers[exercise.id]}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-30">
                        <ChevronRight className="h-3 w-3" /> Submit
                      </button>
                    )}
                    {isSubmitted && result && (
                      <div className="flex items-center gap-2">
                        {result.isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                        <span className={`text-xs ${result.isCorrect ? "text-green-600" : "text-red-500"}`}>
                          {result.isCorrect ? "Correct!" : `Answer: ${result.correctAnswer}`}
                        </span>
                        <button
                          onClick={() => {
                            setUserAnswers(prev => ({ ...prev, [exercise.id]: "" }));
                            setSubmittedIds(prev => { const next = new Set(prev); next.delete(exercise.id); return next; });
                            setGrammarInfo(prev => { const next = { ...prev }; delete next[exercise.id]; return next; });
                            queryClient.invalidateQueries({ queryKey: ["exerciseResults", articleId] });
                          }}
                          className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-600"
                        >
                          <RotateCcw className="h-3 w-3" /> Retry
                        </button>
                      </div>
                    )}
                  </div>
                  {result?.explanation && (
                    <p className="mt-1.5 text-xs text-gray-500 bg-gray-50 p-2 rounded leading-relaxed">{result.explanation}</p>
                  )}
                  {grammarInfo[exercise.id] && (
                    <div className="mt-1.5 p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800 leading-relaxed">
                      <span className="font-medium">Grammar: </span>
                      {grammarInfo[exercise.id]}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No exercises yet for this article.</p>
        )}
      </div>
    </div>
  );
}
