import { useState } from "react";
import { api } from "../lib/api";
import type { GrammarAnalysis } from "../types";
import { GitBranch, ArrowRight, Loader2 } from "lucide-react";

export function GrammarPage() {
  const [sentence, setSentence] = useState("");
  const [analysis, setAnalysis] = useState<GrammarAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    } catch {
      setError("Analysis failed. Check your API key in Settings.");
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-indigo-500" /> Grammar Analysis
        </h1>
        <p className="text-gray-500 text-sm mt-1">Analyze the structure of any English sentence</p>
      </div>

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
        {analysis && (
          <div className="bg-white rounded-xl border p-6">
            {/* Sentence type */}
            <div className="mb-5">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Sentence Type</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium capitalize">
                  {analysis.sentence_type}
                </span>
                {analysis.structure_description && (
                  <span className="text-xs text-gray-500">{analysis.structure_description}</span>
                )}
              </div>
            </div>

            {/* Clauses */}
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

            {/* Description */}
            {analysis.structure_description && (
              <div className="mt-5 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800 leading-relaxed">
                {analysis.structure_description}
              </div>
            )}
          </div>
        )}

        {/* Empty state after analysis */}
        {!analysis && !loading && (
          <div className="text-center py-12 bg-white rounded-xl border">
            <GitBranch className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Enter a sentence above to see its grammatical structure</p>
          </div>
        )}
      </div>
    </div>
  );
}
