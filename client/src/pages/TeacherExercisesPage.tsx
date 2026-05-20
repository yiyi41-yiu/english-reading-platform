import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Exercise } from "../types";
import { ArrowLeft, Sparkles } from "lucide-react";

export function TeacherExercisesPage() {
  const { id } = useParams<{ id: string }>();
  const articleId = parseInt(id!);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const { data: article } = useQuery({
    queryKey: ["article", articleId],
    queryFn: () => api.articles.get(articleId),
  });

  const { data: exerciseData, isLoading } = useQuery({
    queryKey: ["exercises", articleId],
    queryFn: () => api.exercises.listForArticle(articleId),
  });

  const exercises = exerciseData?.items || [];

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.ai.generateExercises(articleId);
      queryClient.invalidateQueries({ queryKey: ["exercises", articleId] });
    } catch { /* ignore */ }
    setGenerating(false);
  };

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate("/teacher")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Exercises</h1>
          {article && <p className="text-sm text-gray-500 mt-1">{article.title}</p>}
        </div>
        <button onClick={handleGenerate} disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {generating ? (
            <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Generating...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Generate with AI</>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} />
          ))}
          {exercises.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border">
              <p className="text-gray-500 text-sm">No exercises yet. Click "Generate with AI" to auto-create them.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const options: string[] = exercise.options ? JSON.parse(exercise.options) : [];
  const typeColors: Record<string, string> = {
    detail: "bg-blue-50 text-blue-600 border-blue-200",
    main_idea: "bg-purple-50 text-purple-600 border-purple-200",
    cloze: "bg-orange-50 text-orange-600 border-orange-200",
    grammar: "bg-green-50 text-green-600 border-green-200",
  };

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${typeColors[exercise.type]}`}>
              {exercise.type}
            </span>
            <span className="text-xs text-gray-400">#{exercise.orderIndex + 1}</span>
          </div>
          <p className="text-sm font-medium text-gray-800">{exercise.question}</p>
          {options.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {options.map((opt, i) => (
                <span key={i} className={`px-2 py-0.5 rounded text-xs ${opt === exercise.answer ? "bg-green-100 text-green-700 font-medium" : "bg-gray-100 text-gray-500"}`}>
                  {String.fromCharCode(65 + i)}. {opt}
                </span>
              ))}
            </div>
          )}
          {exercise.explanation && <p className="mt-1.5 text-xs text-gray-400">{exercise.explanation}</p>}
        </div>
      </div>
    </div>
  );
}
