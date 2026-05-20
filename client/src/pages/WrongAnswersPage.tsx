import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { XCircle, RotateCcw, CheckCircle2, BookOpen, ArrowRight } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  detail: "Detail", main_idea: "Main Idea", cloze: "Cloze", grammar: "Grammar",
};

export function WrongAnswersPage() {
  const queryClient = useQueryClient();
  const [retryId, setRetryId] = useState<number | null>(null);
  const [retryAnswer, setRetryAnswer] = useState("");
  const [retryResult, setRetryResult] = useState<{ correct: boolean } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["wrongAnswers"],
    queryFn: () => api.wrongAnswers.list(),
  });

  const retryMutation = useMutation({
    mutationFn: ({ id, answer }: { id: number; answer: string }) => api.wrongAnswers.retry(id, answer),
    onSuccess: (data) => {
      setRetryResult(data);
      if (data.correct) queryClient.invalidateQueries({ queryKey: ["wrongAnswers"] });
    },
  });

  const items = data?.items || [];
  const unretried = items.filter(w => !w.retried);
  const retried = items.filter(w => w.retried);

  const handleRetry = (id: number) => {
    if (!retryAnswer.trim()) return;
    retryMutation.mutate({ id, answer: retryAnswer });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <XCircle className="h-6 w-6 text-red-500" /> Wrong Answers
        </h1>
        <p className="text-gray-500 text-sm mt-1">Review and retry questions you got wrong</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-red-500 border-t-transparent rounded-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-900 font-medium text-lg mb-1">No wrong answers!</p>
          <p className="text-gray-500 mb-4">Keep up the great work.</p>
          <Link to="/" className="text-blue-600 hover:underline text-sm">Read more articles</Link>
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {unretried.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-2">Needs Review ({unretried.length})</h2>
              {unretried.map(wa => (
                <WrongAnswerCard key={wa.id} wa={wa}
                  isRetry={retryId === wa.id}
                  retryAnswer={retryAnswer}
                  retryResult={retryResult}
                  onRetryClick={(id) => { setRetryId(id); setRetryAnswer(""); setRetryResult(null); }}
                  onRetryAnswerChange={setRetryAnswer}
                  onRetrySubmit={handleRetry}
                  retryPending={retryMutation.isPending}
                />
              ))}
            </div>
          )}
          {retried.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-2">Retried Successfully ({retried.length})</h2>
              {retried.map(wa => (
                <WrongAnswerCard key={wa.id} wa={wa} isRetry={false} retryAnswer="" retryResult={null}
                  onRetryClick={() => {}} onRetryAnswerChange={() => {}} onRetrySubmit={() => {}}
                  retryPending={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WrongAnswerCard({ wa, isRetry, retryAnswer, retryResult, onRetryClick, onRetryAnswerChange, onRetrySubmit, retryPending }: {
  wa: import("../types").WrongAnswer;
  isRetry: boolean;
  retryAnswer: string;
  retryResult: { correct: boolean } | null;
  onRetryClick: (id: number) => void;
  onRetryAnswerChange: (v: string) => void;
  onRetrySubmit: (id: number) => void;
  retryPending: boolean;
}) {
  const options = wa.options ? JSON.parse(wa.options) : null;

  return (
    <div className="bg-white rounded-xl border p-4 mb-2">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
            {TYPE_LABELS[wa.questionType] || wa.questionType}
          </span>
          {wa.retried ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" /> Retried
            </span>
          ) : null}
        </div>
        <Link to={`/article/${wa.articleId}`} className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1">
          <BookOpen className="h-3 w-3" /> {wa.articleTitle}
        </Link>
      </div>

      <p className="text-sm text-gray-900 font-medium mb-2">{wa.questionText}</p>

      {options && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {options.map((opt: string, i: number) => (
            <span key={i} className={`px-2 py-0.5 rounded text-xs ${
              opt === wa.correctAnswer ? "bg-green-50 text-green-700 border border-green-200" :
              opt === wa.userAnswer ? "bg-red-50 text-red-700 border border-red-200" :
              "bg-gray-50 text-gray-600 border border-gray-200"
            }`}>
              {opt}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-3 text-xs text-gray-500 mb-3">
        <span>Your answer: <span className="text-red-600 font-medium">{wa.userAnswer}</span></span>
        <span>Correct: <span className="text-green-600 font-medium">{wa.correctAnswer}</span></span>
      </div>

      {wa.grammarAnalysis && (
        <div className="mb-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-800">
          {wa.grammarAnalysis}
        </div>
      )}

      {!wa.retried && (
        isRetry ? (
          <div className="flex items-center gap-2">
            <input type="text" value={retryAnswer} onChange={e => onRetryAnswerChange(e.target.value)}
              placeholder="Type your new answer..."
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === "Enter" && onRetrySubmit(wa.id)}
            />
            <button onClick={() => onRetrySubmit(wa.id)} disabled={retryPending}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
              <ArrowRight className="h-3 w-3" /> Submit
            </button>
          </div>
        ) : retryResult ? (
          <div className={`text-xs ${retryResult.correct ? "text-green-600" : "text-red-600"}`}>
            {retryResult.correct ? "Correct!" : "Still incorrect. Study the answer and try again later."}
          </div>
        ) : (
          <button onClick={() => onRetryClick(wa.id)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <RotateCcw className="h-3 w-3" /> Retry this question
          </button>
        )
      )}
    </div>
  );
}
