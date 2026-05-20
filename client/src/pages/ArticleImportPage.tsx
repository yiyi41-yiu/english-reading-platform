import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Upload, FileText, ArrowRight } from "lucide-react";

const GRADE_OPTIONS = [
  { value: "primary", label: "Primary School" },
  { value: "middle", label: "Middle School" },
  { value: "high", label: "High School" },
  { value: "cet4", label: "CET-4" },
  { value: "cet6", label: "CET-6" },
  { value: "tem4", label: "TEM-4" },
  { value: "tem8", label: "TEM-8" },
  { value: "ielts", label: "IELTS" },
  { value: "toefl", label: "TOEFL" },
];

const CATEGORY_OPTIONS = [
  { value: "narrative", label: "Narrative" },
  { value: "argumentative", label: "Argumentative" },
  { value: "news", label: "News" },
  { value: "academic", label: "Academic" },
];

export function ArticleImportPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [gradeLevel, setGradeLevel] = useState("cet4");
  const [category, setCategory] = useState("argumentative");
  const [author, setAuthor] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.articles.create(body),
    onSuccess: (article) => {
      navigate(`/article/${article.id}`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to import article");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim() || !contentText.trim()) {
      setError("Title and content are required");
      return;
    }
    mutation.mutate({
      title: title.trim(),
      content_text: contentText.trim(),
      grade_level: gradeLevel,
      category,
      author: author.trim() || undefined,
      source: source.trim() || undefined,
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Upload className="h-6 w-6 text-green-500" /> Import Article
        </h1>
        <p className="text-gray-500 text-sm mt-1">Paste an English article to read and study</p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Article Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="Enter article title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Article Content *
            </label>
            <textarea value={contentText} onChange={e => setContentText(e.target.value)} required
              rows={15}
              placeholder="Paste the full article text here. Separate paragraphs with blank lines."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono" />
            <p className="text-xs text-gray-400 mt-1">
              Word count: {contentText.split(/\s+/).filter(w => w.length > 0).length}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level *</label>
              <select value={gradeLevel} onChange={e => setGradeLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {GRADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Author (optional)</label>
              <input type="text" value={author} onChange={e => setAuthor(e.target.value)}
                placeholder="Author name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source (optional)</label>
              <input type="text" value={source} onChange={e => setSource(e.target.value)}
                placeholder="e.g. The Guardian"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <button type="submit" disabled={mutation.isPending}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2">
            {mutation.isPending ? "Importing..." : <><ArrowRight className="h-4 w-4" /> Import and Read</>}
          </button>
        </form>
      </div>
    </div>
  );
}
