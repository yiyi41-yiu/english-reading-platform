import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { ArrowLeft, Users, BookOpen, Target, TrendingUp, BarChart3, Award } from "lucide-react";

interface StudentStats {
  id: number; name: string; email: string;
  articlesCompleted: number; articlesTotal: number;
  exercisesCorrect: number; exercisesTotal: number;
  accuracy: number; vocabularySaved: number;
  weeklyActivity: number; lastActive: string | null;
}

export function TeacherStudentsPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api.progress.analytics(),
    refetchInterval: 30000,
  });

  const students = data?.students || [];
  const summary = data?.classSummary;

  return (
    <div>
      <button onClick={() => navigate("/teacher")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-green-500" /> Student Analytics
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track class performance and individual progress</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <SummaryCard icon={<Users className="h-5 w-5 text-blue-500" />} label="Students" value={summary.totalStudents} color="bg-blue-50" />
              <SummaryCard icon={<BookOpen className="h-5 w-5 text-green-500" />} label="Articles" value={summary.totalArticles} color="bg-green-50" />
              <SummaryCard icon={<Target className="h-5 w-5 text-purple-500" />} label="Avg Accuracy" value={`${summary.averageAccuracy}%`} color="bg-purple-50" />
              <SummaryCard icon={<Award className="h-5 w-5 text-amber-500" />} label="Avg Vocab/Student" value={summary.averageVocabPerStudent} color="bg-amber-50" />
            </div>
          )}

          {/* Accuracy bar chart */}
          <div className="bg-white rounded-xl border p-6 mb-6">
            <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" /> Student Accuracy
            </h3>
            {students.length > 0 ? (
              <div className="space-y-3">
                {students.map(s => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-32 text-sm text-gray-700 truncate" title={s.name}>{s.name}</div>
                    <div className="flex-1">
                      <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${s.accuracy >= 80 ? "bg-green-500" : s.accuracy >= 60 ? "bg-blue-500" : s.accuracy >= 40 ? "bg-yellow-500" : "bg-red-400"}`}
                          style={{ width: `${Math.max(s.accuracy, 4)}%` }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                          {s.accuracy}% ({s.exercisesCorrect}/{s.exercisesTotal})
                        </span>
                      </div>
                    </div>
                    <span className="w-20 text-xs text-gray-400 text-right">{s.articlesCompleted} articles</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">No students registered yet.</p>
            )}
          </div>

          {/* Student table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900 text-sm">Student Details</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Student</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Accuracy</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Articles</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Exercises</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Vocabulary</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Week Activity</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Last Active</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Suggestion</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </td>
                      <td className="text-center px-3 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.accuracy >= 80 ? "bg-green-100 text-green-700" : s.accuracy >= 60 ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {s.accuracy}%
                        </span>
                      </td>
                      <td className="text-center px-3 py-3 text-gray-600">{s.articlesCompleted}</td>
                      <td className="text-center px-3 py-3 text-gray-600">{s.exercisesTotal}</td>
                      <td className="text-center px-3 py-3 text-gray-600">{s.vocabularySaved}</td>
                      <td className="text-center px-3 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${s.weeklyActivity >= 5 ? "bg-green-100 text-green-700" : s.weeklyActivity > 0 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                          {s.weeklyActivity > 0 ? `${s.weeklyActivity} actions` : "Inactive"}
                        </span>
                      </td>
                      <td className="text-center px-3 py-3 text-xs text-gray-400">
                        {s.lastActive ? new Date(s.lastActive).toLocaleDateString() : "Never"}
                      </td>
                      <td className="text-right px-4 py-3 text-xs">
                        <SuggestionBadge stats={s} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {students.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <Users className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">No students registered yet.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function SuggestionBadge({ stats }: { stats: StudentStats }) {
  let suggestion = "";
  let color = "";

  if (stats.accuracy < 40 && stats.exercisesTotal > 0) {
    suggestion = "Review basics";
    color = "bg-red-100 text-red-700";
  } else if (stats.articlesCompleted === 0) {
    suggestion = "Start reading!";
    color = "bg-blue-100 text-blue-700";
  } else if (stats.vocabularySaved < 5) {
    suggestion = "Save more words";
    color = "bg-yellow-100 text-yellow-700";
  } else if (stats.accuracy >= 80 && stats.articlesCompleted >= 3) {
    suggestion = "Try harder articles";
    color = "bg-green-100 text-green-700";
  } else if (stats.weeklyActivity === 0) {
    suggestion = "Needs encouragement";
    color = "bg-orange-100 text-orange-700";
  } else {
    suggestion = "Keep going!";
    color = "bg-gray-100 text-gray-600";
  }

  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{suggestion}</span>;
}
