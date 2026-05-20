import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { VocabEntry } from "../types";
import { useTTS } from "../hooks/useTTS";
import { Search, Trash2, Volume2, ExternalLink, BookMarked } from "lucide-react";

export function VocabularyPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const queryClient = useQueryClient();
  const { speakWord } = useTTS();

  const { data, isLoading } = useQuery({
    queryKey: ["vocabulary", search, sort],
    queryFn: () => api.vocabulary.list({ search, sort }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.vocabulary.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vocabulary"] }),
  });

  const entries = data?.items || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookMarked className="h-6 w-6 text-blue-500" /> My Vocabulary
        </h1>
        <p className="text-gray-500 text-sm mt-1">Words you've saved while reading</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search saved words..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="newest">Newest First</option>
          <option value="alphabetical">A-Z</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <BookMarked className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{search ? "No matching words" : "No saved words yet. Start reading and save words!"}</p>
          {!search && <Link to="/" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Browse articles</Link>}
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <VocabCard key={entry.id} entry={entry} onSpeak={() => speakWord(entry.word)} onDelete={() => deleteMutation.mutate(entry.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function VocabCard({ entry, onSpeak, onDelete }: { entry: VocabEntry; onSpeak: () => void; onDelete: () => void }) {
  const affixes = entry.affixes ? JSON.parse(entry.affixes) : null;
  const derivatives: Array<{ word: string; type: string; translation: string }> = entry.derivatives ? JSON.parse(entry.derivatives) : [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-gray-900">{entry.word}</span>
            {entry.pronunciation && <span className="text-sm text-gray-400 font-mono">{entry.pronunciation}</span>}
            <button onClick={onSpeak} className="p-1 hover:bg-gray-100 rounded">
              <Volume2 className="h-3.5 w-3.5 text-gray-400 hover:text-blue-500" />
            </button>
            {entry.wordType && (
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{entry.wordType}</span>
            )}
          </div>
          <p className="text-sm text-gray-600">{entry.translation}</p>

          {affixes && (affixes.prefix || affixes.root || affixes.suffix) && (
            <div className="flex items-center gap-1 mt-1.5">
              {affixes.prefix && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">prefix: {affixes.prefix}</span>}
              {affixes.root && <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[10px]">root: {affixes.root}</span>}
              {affixes.suffix && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px]">suffix: {affixes.suffix}</span>}
            </div>
          )}

          {derivatives.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {derivatives.map((d, i) => (
                <span key={i} className="text-[10px] text-gray-500">{d.word} ({d.type}) {d.translation}{i < derivatives.length - 1 ? "," : ""}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-3">
          {entry.articleId && (
            <Link to={`/article/${entry.articleId}`} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-500" title="Jump to article">
              <ExternalLink className="h-4 w-4" />
            </Link>
          )}
          <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
