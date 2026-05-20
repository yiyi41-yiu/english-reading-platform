import { useState } from "react";
import { api } from "../../lib/api";
import { useTTS } from "../../hooks/useTTS";
import { Languages, Volume2, Loader2 } from "lucide-react";

interface ParagraphToolbarProps {
  paragraphText: string;
  articleId: number;
}

export function ParagraphToolbar({ paragraphText, articleId }: ParagraphToolbarProps) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const { speak } = useTTS();

  const handleTranslate = async () => {
    if (translation) { setShowTranslation(!showTranslation); return; }
    setLoading(true);
    try {
      const result = await api.ai.translateParagraph(paragraphText, articleId);
      setTranslation(result.translation);
      setShowTranslation(true);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
        <button onClick={handleTranslate} disabled={loading}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
          Translate
        </button>
        <button onClick={() => speak(paragraphText)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-green-50 hover:text-green-600 rounded transition-colors"
        >
          <Volume2 className="h-3 w-3" /> Read Aloud
        </button>
      </div>
      {showTranslation && translation && (
        <div className="mt-2 ml-2 pl-3 border-l-2 border-blue-300 text-sm text-gray-600 bg-blue-50/50 rounded-r p-2">
          {translation}
        </div>
      )}
    </div>
  );
}
