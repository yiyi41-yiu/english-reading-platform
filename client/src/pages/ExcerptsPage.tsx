import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Quote, Trash2, ExternalLink } from "lucide-react";

export function ExcerptsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["excerpts"],
    queryFn: () => api.excerpts.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.excerpts.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["excerpts"] }),
  });

  const excerpts = data?.items || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Quote className="h-6 w-6 text-amber-500" /> My Excerpts
        </h1>
        <p className="text-gray-500 text-sm mt-1">Passages you've saved while reading</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : excerpts.length === 0 ? (
        <div className="text-center py-16">
          <Quote className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No excerpts saved yet. Select text while reading to save passages!</p>
          <Link to="/" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Browse articles</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {excerpts.map(excerpt => (
            <div key={excerpt.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-amber-200 transition-colors group">
              <div className="flex items-start gap-3">
                <Quote className="h-5 w-5 text-amber-300 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-relaxed italic border-l-2 border-amber-200 pl-3">
                    {excerpt.text}
                  </p>
                  {excerpt.note && (
                    <p className="mt-1.5 text-xs text-gray-400 pl-3">{excerpt.note}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 pl-3">
                    <span className="text-xs text-gray-400">
                      From: <span className="text-gray-600 font-medium">{excerpt.articleTitle}</span>
                      {excerpt.paragraphIndex != null && ` · Paragraph ${excerpt.paragraphIndex + 1}`}
                    </span>
                    <span className="text-xs text-gray-300">
                      {new Date(excerpt.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    to={`/article/${excerpt.articleId}`}
                    state={{ scrollTo: { paragraphIndex: excerpt.paragraphIndex, offset: excerpt.startOffset } }}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-500"
                    title="Jump to article"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => deleteMutation.mutate(excerpt.id)}
                    className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
