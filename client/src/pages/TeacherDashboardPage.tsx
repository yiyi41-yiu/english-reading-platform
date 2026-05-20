import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PlusCircle, Users, BookOpen, FileText, ChevronRight } from "lucide-react";

export function TeacherDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["teacherArticles"],
    queryFn: () => api.articles.list({ limit: "100" }),
  });

  const articles = data?.items || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Manage articles, exercises, and students</p>
        </div>
        <Link to="/teacher/article/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <PlusCircle className="h-4 w-4" /> Upload Article
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><BookOpen className="h-5 w-5 text-blue-500" /></div>
          <div><p className="text-2xl font-bold text-gray-900">{articles.length}</p><p className="text-xs text-gray-500">Articles</p></div>
        </div>
        <Link to="/teacher/students" className="bg-white rounded-xl border p-4 flex items-center gap-3 hover:border-blue-300 transition-colors">
          <div className="p-2 bg-green-50 rounded-lg"><Users className="h-5 w-5 text-green-500" /></div>
          <div className="flex-1"><p className="text-xs text-gray-500">Students</p></div>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </Link>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg"><FileText className="h-5 w-5 text-purple-500" /></div>
          <div><p className="text-xs text-gray-500">Exercises</p></div>
        </div>
      </div>

      {/* Articles list */}
      <div className="bg-white rounded-xl border">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-900 text-sm">My Articles</h2>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : articles.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No articles yet. Upload your first article!</div>
        ) : (
          <div className="divide-y">
            {articles.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-400">{a.wordCount} words · {a.gradeLevel} · {a.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/article/${a.id}`} className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">Preview</Link>
                  <Link to={`/teacher/article/${a.id}/exercises`} className="px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded">Exercises</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
