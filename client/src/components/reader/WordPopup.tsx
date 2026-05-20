import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useTTS } from "../../hooks/useTTS";
import type { WordTranslation } from "../../types";
import { Volume2, BookMarked, Loader2 } from "lucide-react";

interface WordPopupProps {
  word: string;
  cleanWord: string;
  contextSentence: string;
  position: { x: number; y: number };
  onClose: () => void;
  articleId: number;
}

export function WordPopup({ cleanWord, contextSentence, position, onClose, articleId }: WordPopupProps) {
  const [data, setData] = useState<WordTranslation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { speakWord } = useTTS();

  useEffect(() => {
    setLoading(true);
    api.ai.translateWord(cleanWord, contextSentence)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [cleanWord, contextSentence]);

  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener("click", handleClick, { once: true });
    return () => document.removeEventListener("click", handleClick);
  }, [onClose]);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await api.vocabulary.save({
        word: cleanWord,
        translation: data.translation,
        word_type: data.word_type,
        pronunciation: data.pronunciation,
        affixes: data.affixes,
        derivatives: data.derivatives,
        example_sentence: data.example_sentence,
        article_id: articleId,
      });
      setSaved(true);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const popupStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.min(position.x, window.innerWidth - 280),
    top: Math.min(position.y, window.innerHeight - 320),
    zIndex: 100,
  };

  return (
    <div style={popupStyle} className="w-64 bg-white rounded-xl shadow-xl border p-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-bold text-gray-900">{cleanWord}</span>
        <button onClick={() => speakWord(cleanWord)} className="p-1 hover:bg-gray-100 rounded">
          <Volume2 className="h-4 w-4 text-gray-400 hover:text-blue-500" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Translating...
        </div>
      ) : data ? (
        <div className="space-y-2 text-sm">
          <div><span className="text-xs text-gray-400">Translation</span>
            <p className="text-gray-700">{data.translation}</p>
          </div>
          {data.pronunciation && (
            <div><span className="text-xs text-gray-400">Pronunciation</span>
              <p className="text-gray-600 font-mono">{data.pronunciation}</p>
            </div>
          )}
          {data.word_type && (
            <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{data.word_type}</span>
          )}
          {data.affixes && (data.affixes.prefix || data.affixes.root || data.affixes.suffix) && (
            <div><span className="text-xs text-gray-400">Word Structure</span>
              <div className="flex items-center gap-1 text-xs mt-0.5">
                {data.affixes.prefix && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">prefix: {data.affixes.prefix}</span>}
                {data.affixes.root && <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded">root: {data.affixes.root}</span>}
                {data.affixes.suffix && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">suffix: {data.affixes.suffix}</span>}
              </div>
            </div>
          )}
          {data.example_sentence && (
            <div><span className="text-xs text-gray-400">Example</span>
              <p className="text-gray-600 text-xs">{data.example_sentence.en}</p>
              <p className="text-gray-400 text-xs mt-0.5">{data.example_sentence.zh}</p>
            </div>
          )}
          {data.derivatives && data.derivatives.length > 0 && (
            <div><span className="text-xs text-gray-400">Derivatives</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {data.derivatives.map((d, i) => (
                  <span key={i} className="text-xs text-gray-600">{d.word} ({d.type}) {d.translation}</span>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleSave} disabled={saving || saved}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:text-green-600 font-medium">
            <BookMarked className="h-3.5 w-3.5" />
            {saved ? "Saved!" : saving ? "Saving..." : "Save to vocabulary"}
          </button>
        </div>
      ) : data ? (
        data.translation === "API调用失败" || data.translation === "AI未配置" ? (
          <div className="space-y-2 text-sm">
            <p className="text-orange-600 bg-orange-50 p-2 rounded text-xs">{data.example_sentence?.zh || data.translation}</p>
            <Link to="/settings" className="inline-block text-xs text-blue-600 hover:underline font-medium">Go to Settings →</Link>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Could not load translation</p>
        )
      ) : (
        <p className="text-sm text-gray-400">Could not load translation</p>
      )}
    </div>
  );
}
