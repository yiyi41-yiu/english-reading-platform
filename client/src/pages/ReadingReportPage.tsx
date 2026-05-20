import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { TrendingUp, BookOpen, Target, BookMarked, Award, Calendar, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const GRADE_COLORS: Record<string, string> = {
  primary: "bg-green-500", middle: "bg-blue-500", high: "bg-purple-500",
  cet4: "bg-orange-500", cet6: "bg-red-500", tem4: "bg-pink-500",
  tem8: "bg-rose-500", ielts: "bg-cyan-500", toefl: "bg-teal-500",
};

const GRADE_LABELS: Record<string, string> = {
  primary: "Primary", middle: "Middle", high: "High",
  cet4: "CET-4", cet6: "CET-6", tem4: "TEM-4",
  tem8: "TEM-8", ielts: "IELTS", toefl: "TOEFL",
};

export function ReadingReportPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["readingReport"],
    queryFn: () => api.progress.report(),
  });

  const summary = data?.summary;
  const weeklyData = data?.weeklyData || [];
  const gradeDist = data?.gradeDistribution || {};

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const maxWeeklyActivity = Math.max(...weeklyData.map(w => w.articles + w.exercises + w.vocab), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-500" /> My Learning Report
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track your English reading progress</p>
        </div>
        <button onClick={() => navigate("/leaderboard")}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-100 border border-yellow-200">
          <Award className="h-4 w-4" /> View Leaderboard
        </button>
      </div>

      {summary && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard icon={<BookOpen className="h-5 w-5 text-blue-500" />} label="Articles Read" value={summary.totalArticles} />
            <StatCard icon={<Target className="h-5 w-5 text-green-500" />} label="Accuracy" value={`${summary.accuracy}%`} sub={`${summary.correctExercises}/${summary.totalExercises} correct`} />
            <StatCard icon={<BookMarked className="h-5 w-5 text-purple-500" />} label="Vocabulary" value={summary.vocabularySaved} />
            <StatCard icon={<Award className="h-5 w-5 text-yellow-500" />} label="Points" value={summary.points} sub={`Rank #${summary.rank} of ${summary.totalStudents}`} />
          </div>

          {/* Weekly activity chart */}
          <div className="bg-white rounded-xl border p-6 mb-6">
            <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" /> Weekly Activity (Last 4 Weeks)
            </h3>
            <div className="flex items-end gap-6 h-40 px-4">
              {weeklyData.map((w, i) => {
                const total = w.articles + w.exercises + w.vocab;
                const heightPct = (total / maxWeeklyActivity) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex flex-col justify-end" style={{ height: "140px" }}>
                      <div className="w-full flex justify-center gap-0.5" style={{ height: `${Math.max(heightPct, 4)}%` }}>
                        {w.articles > 0 && (
                          <div className="w-4 bg-blue-400 rounded-t-sm" style={{ height: `${(w.articles / total) * 100}%` }} title={`${w.articles} articles`} />
                        )}
                        {w.exercises > 0 && (
                          <div className="w-4 bg-green-400 rounded-t-sm" style={{ height: `${(w.exercises / total) * 100}%` }} title={`${w.exercises} exercises`} />
                        )}
                        {w.vocab > 0 && (
                          <div className="w-4 bg-purple-400 rounded-t-sm" style={{ height: `${(w.vocab / total) * 100}%` }} title={`${w.vocab} vocab`} />
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{w.week}</span>
                    <span className="text-[10px] text-gray-400">{total} activities</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center gap-4 mt-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-400 rounded-sm" /> Articles</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-400 rounded-sm" /> Exercises</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-400 rounded-sm" /> Vocabulary</span>
            </div>
          </div>

          {/* Grade distribution */}
          {Object.keys(gradeDist).length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" /> Reading Level Distribution
              </h3>
              <div className="space-y-3">
                {Object.entries(gradeDist).map(([grade, count]) => {
                  const total = Object.values(gradeDist).reduce((s, c) => s + c, 0);
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={grade} className="flex items-center gap-3">
                      <span className="w-16 text-xs text-gray-600">{GRADE_LABELS[grade] || grade}</span>
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${GRADE_COLORS[grade] || "bg-gray-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-xs text-gray-500 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
