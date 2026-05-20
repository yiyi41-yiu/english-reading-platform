import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import type { GrammarAnalysis } from "../../types";
import { GitBranch, Loader2, X } from "lucide-react";

interface GrammarPanelProps {
  sentence: string;
  onClose: () => void;
}

export function GrammarPanel({ sentence, onClose }: GrammarPanelProps) {
  const [analysis, setAnalysis] = useState<GrammarAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.ai.analyzeGrammar(sentence)
      .then(a => { setAnalysis(a); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sentence]);

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-white border-l shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-indigo-500" /> Grammar Analysis
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
          <p className="text-sm font-medium text-gray-700">{sentence}</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            <div>
              <span className="text-xs text-gray-400">Sentence Type</span>
              <span className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                {analysis.sentence_type}
              </span>
            </div>

            <div>
              <span className="text-xs text-gray-400 block mb-2">Clause Structure</span>
              <div className="space-y-2">
                {analysis.clauses.map((clause, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        clause.type === "main" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                      }`}>
                        {clause.type}
                      </span>
                      <span className="text-xs text-gray-500">{clause.function}</span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{clause.text}</p>
                    {clause.modifiers.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {clause.modifiers.map((mod, j) => (
                          <span key={j} className="px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded text-[10px] border border-yellow-200">
                            {mod.type}: {mod.text}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {analysis.structure_description && (
              <div className="p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700">
                {analysis.structure_description}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Failed to analyze sentence.</p>
        )}
      </div>
    </div>
  );
}
