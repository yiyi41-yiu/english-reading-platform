import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Article } from "../types";
import { Search, BookOpen, CheckCircle2, Upload } from "lucide-react";
import { PetDisplay } from "../components/pet/PetDisplay";

const GRADE_LABELS: Record<string, string> = {
  primary: "Primary", middle: "Middle", high: "High",
  cet4: "CET-4", cet6: "CET-6", tem4: "TEM-4",
  tem8: "TEM-8", ielts: "IELTS", toefl: "TOEFL",
};
const GRADE_COLORS: Record<string, string> = {
  primary: "bg-green-100 text-green-700",
  middle: "bg-blue-100 text-blue-700",
  high: "bg-purple-100 text-purple-700",
  cet4: "bg-orange-100 text-orange-700",
  cet6: "bg-red-100 text-red-700",
  tem4: "bg-pink-100 text-pink-700",
  tem8: "bg-rose-100 text-rose-700",
  ielts: "bg-cyan-100 text-cyan-700",
  toefl: "bg-teal-100 text-teal-700",
};
const CATEGORY_LABELS: Record<string, string> = {
  narrative: "Narrative",
  argumentative: "Argumentative",
  news: "News",
  academic: "Academic",
};
const CATEGORY_COLORS: Record<string, string> = {
  narrative: "bg-orange-100 text-orange-700",
  argumentative: "bg-red-100 text-red-700",
  news: "bg-cyan-100 text-cyan-700",
  academic: "bg-indigo-100 text-indigo-700",
};

export function DashboardPage() {
  const [grade, setGrade] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["articles", grade, category, search, page],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), limit: "20" };
      if (grade) params.grade_level = grade;
      if (category) params.category = category;
      if (search) params.search = search;
      return api.articles.list(params);
    },
  });

  const articles = data?.items || [];
  const total = data?.total || 0;

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reading Library</h1>
          <p className="text-gray-500 text-sm mt-1">Choose an article to start reading</p>
        </div>
        <Link to="/import"
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-medium hover:from-green-600 hover:to-emerald-700 shadow-sm transition-all">
          <Upload className="h-4 w-4" /> Import Article
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text" placeholder="Search articles..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={grade} onChange={e => { setGrade(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Grades</option>
          <optgroup label="K-12"><option value="primary">Primary</option><option value="middle">Middle</option><option value="high">High</option></optgroup>
          <optgroup label="University"><option value="cet4">CET-4</option><option value="cet6">CET-6</option><option value="tem4">TEM-4</option><option value="tem8">TEM-8</option><option value="ielts">IELTS</option><option value="toefl">TOEFL</option></optgroup>
        </select>
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Categories</option>
          <option value="narrative">Narrative</option>
          <option value="argumentative">Argumentative</option>
          <option value="news">News</option>
          <option value="academic">Academic</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No articles found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
          {total > 20 && (
            <div className="flex justify-center gap-2 mt-6">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-30">Previous</button>
              <span className="px-3 py-1.5 text-sm text-gray-500">Page {page}</span>
              <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-30">Next</button>
            </div>
          )}
        </>
      )}
    </div>
      {/* Pet sidebar */}
      <div className="hidden lg:block w-56 flex-shrink-0">
        <div className="sticky top-20">
          <PetDisplay />
        </div>
      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link to={`/article/${article.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 text-sm leading-snug">
          {article.title}
        </h3>
        {article.progress?.completed ? (
          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${GRADE_COLORS[article.gradeLevel]}`}>
          {GRADE_LABELS[article.gradeLevel]}
        </span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[article.category]}`}>
          {CATEGORY_LABELS[article.category]}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{article.wordCount} words</span>
        {article.progress?.score != null && (
          <span className="text-green-600 font-medium">Score: {article.progress.score}%</span>
        )}
      </div>
    </Link>
  );
}
