import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import type { GrammarAnalysis, GrammarHistoryEntry } from "../types";
import { GitBranch, ArrowRight, Loader2, History, Trash2, ChevronRight } from "lucide-react";

export function GrammarPage() {
  const [sentence, setSentence] = useState("");
  const [analysis, setAnalysis] = useState<GrammarAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"analyze" | "history">("analyze");
  const [history, setHistory] = useState<GrammarHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = useCallback(() => {
    setHistoryLoading(true);
    api.grammar.list()
      .then(r => setHistory(r.items))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, fetchHistory]);

  const handleAnalyze = async () => {
    const trimmed = sentence.trim();
    if (!trimmed || trimmed.split(/\s+/).length < 3) {
      setError("Please enter a sentence with at least 3 words.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await api.ai.analyzeGrammar(trimmed);
      setAnalysis(result);
      if (result && (result.sentence_type || result.clauses.length > 0 || result.structure_description)) {
        api.grammar.save({ sentence: trimmed, analysis: result }).catch(() => {});
      }
    } catch {
      setError("Analysis failed. Check your API key in Settings.");
    }
    setLoading(false);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.grammar.remove(id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  const handleSelectEntry = (entry: GrammarHistoryEntry) => {
    setSentence(entry.sentence);
    setAnalysis(entry.analysis);
    setTab("analyze");
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-indigo-500" /> Grammar Analysis
        </h1>
        <p className="text-gray-500 text-sm mt-1">Analyze the structure of any English sentence</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-6 w-fit">
        <button onClick={() => setTab("analyze")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "analyze" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          Analyze
        </button>
        <button onClick={() => setTab("history")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${tab === "history" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <History className="h-3.5 w-3.5" /> History
        </button>
      </div>

      {tab === "analyze" ? (
        <div className="max-w-2xl">
          {/* Input */}
          <div className="bg-white rounded-xl border p-4 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter a sentence to analyze
            </label>
            <textarea
              value={sentence}
              onChange={e => setSentence(e.target.value)}
              placeholder="e.g. Although the experiment failed, the data we collected provided valuable insights for future research."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleAnalyze(); }}
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-[10px] text-gray-400">Tip: Select a sentence in any article and click "Analyze" to auto-fill</p>
              <button
                onClick={handleAnalyze}
                disabled={loading || !sentence.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? "Analyzing..." : "Analyze"}
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>

          {/* Results */}
          {analysis && (analysis.sentence_type || analysis.clauses.length > 0) ? (
            <div className="bg-white rounded-xl border p-6">
              <div className="mb-5">
                <span className="text-xs text-gray-400 uppercase tracking-wide">Sentence Type</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium capitalize">
                    {analysis.sentence_type}
                  </span>
                </div>
              </div>

              {analysis.clauses.length > 0 && (
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wide block mb-3">Clause Structure</span>
                  <div className="space-y-3">
                    {analysis.clauses.map((clause, i) => (
                      <div key={i} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            clause.type === "main" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
                          }`}>
                            {clause.type} clause
                          </span>
                          <span className="text-xs text-gray-500">{clause.function}</span>
                        </div>
                        <p className="text-sm text-gray-800 font-medium mb-2">{clause.text}</p>
                        {clause.modifiers.length > 0 && (
                          <div>
                            <span className="text-[10px] text-gray-400 block mb-1">Modifiers:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {clause.modifiers.map((mod, j) => (
                                <span key={j} className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs border border-yellow-200">
                                  <span className="font-medium">{mod.type}</span>: {mod.text}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.structure_description && (
                <div className="mt-5 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800 leading-relaxed">
                  {analysis.structure_description}
                </div>
              )}
            </div>
          ) : analysis ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <p className="text-gray-400 text-sm">Analysis returned empty results. Try a different sentence.</p>
            </div>
          ) : !loading && (
            <div className="text-center py-12 bg-white rounded-xl border">
              <GitBranch className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Enter a sentence above to see its grammatical structure</p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-2xl">
          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <History className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No grammar analysis history yet</p>
              <p className="text-gray-400 text-xs mt-1">Analyze a sentence to see it here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(entry => (
                <div
                  key={entry.id}
                  onClick={() => handleSelectEntry(entry)}
                  className="bg-white rounded-xl border p-4 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium truncate">{entry.sentence}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-medium capitalize">
                          {entry.analysis.sentence_type || "Unknown"}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {entry.analysis.clauses.length} clause{entry.analysis.clauses.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[10px] text-gray-300">|</span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                      <button
                        onClick={(e) => handleDelete(entry.id, e)}
                        className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
