import { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";

interface BackgroundCardProps {
  author: string | null;
  background: string | null;
  source: string | null;
}

export function BackgroundCard({ author, background, source }: BackgroundCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!author && !background && !source) return null;

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-500" />
          Article Background
          {author && <span className="text-gray-400">— {author}</span>}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 text-sm text-gray-600 space-y-2">
          {background && (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{
              __html: background.replace(/\n/g, "<br>").replace(/^### (.+)$/gm, "<strong>$1</strong>").replace(/^- (.+)$/gm, "· $1")
            }} />
          )}
          {source && <p className="text-xs text-gray-400">Source: {source}</p>}
        </div>
      )}
    </div>
  );
}
