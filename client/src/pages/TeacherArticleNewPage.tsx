import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ArrowLeft, Upload, Sparkles } from "lucide-react";

export function TeacherArticleNewPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [gradeLevel, setGradeLevel] = useState("middle");
  const [category, setCategory] = useState("narrative");
  const [author, setAuthor] = useState("");
  const [background, setBackground] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.articles.create(body),
    onSuccess: (article) => {
      // Auto-generate exercises after upload
      api.ai.generateExercises(article.id).then(() => {
        navigate(`/teacher/article/${article.id}/exercises`);
      }).catch(() => {
        navigate(`/teacher/article/${article.id}/exercises`);
      });
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !contentText) {
      setError("Title and content are required");
      return;
    }
    setError("");
    createMutation.mutate({ title, content_text: contentText, grade_level: gradeLevel, category, author: author || null, background: background || null, source: source || null });
  };

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate("/teacher")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload New Article</h1>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
            <select value={gradeLevel} onChange={e => setGradeLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <optgroup label="K-12"><option value="primary">Primary</option><option value="middle">Middle</option><option value="high">High</option></optgroup>
              <optgroup label="University"><option value="cet4">CET-4</option><option value="cet6">CET-6</option><option value="tem4">TEM-4</option><option value="tem8">TEM-8</option><option value="ielts">IELTS</option><option value="toefl">TOEFL</option></optgroup>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="narrative">Narrative</option>
              <option value="argumentative">Argumentative</option>
              <option value="news">News</option>
              <option value="academic">Academic</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
          <p className="text-xs text-gray-400 mb-1">Paste the full article text. Separate paragraphs with blank lines.</p>
          <textarea value={contentText} onChange={e => setContentText(e.target.value)} required rows={16}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y" />
          <p className="text-xs text-gray-400 mt-1">
            {contentText ? `${contentText.split(/\s+/).filter(w => w.trim()).length} words, ${contentText.split(/\n\s*\n/).filter(p => p.trim()).length} paragraphs` : "..."}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
          <input type="text" value={author} onChange={e => setAuthor(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Background / Introduction (Markdown)</label>
          <textarea value={background} onChange={e => setBackground(e.target.value)} rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
          <input type="text" value={source} onChange={e => setSource(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <button type="submit" disabled={createMutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {createMutation.isPending ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Uploading & generating exercises...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> Upload & <Sparkles className="h-4 w-4 ml-0.5" /> Auto-Generate Exercises
            </>
          )}
        </button>
      </form>
    </div>
  );
}
