import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Trophy, Medal, BookOpen, Target, BookMarked } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

const RANK_COLORS: Record<number, string> = {
  1: "text-yellow-500",
  2: "text-gray-400",
  3: "text-amber-600",
};

export function LeaderboardPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.progress.leaderboard(),
    refetchInterval: 60000,
  });

  const leaderboard = data?.leaderboard || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" /> Leaderboard
        </h1>
        <p className="text-gray-500 text-sm mt-1">Top learners this week</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No data yet. Start reading to earn points!</p>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {leaderboard.slice(0, 3).map((entry, i) => {
              const rank = i + 1;
              const isMe = entry.id === user?.id;
              return (
                <div key={entry.id}
                  className={`bg-white rounded-xl border p-5 text-center ${rank === 1 ? "border-yellow-300 shadow-lg ring-1 ring-yellow-200" : ""} ${isMe ? "ring-2 ring-blue-300" : ""}`}>
                  <div className="flex justify-center mb-2">
                    <Medal className={`h-8 w-8 ${RANK_COLORS[rank]}`} />
                  </div>
                  <p className="font-bold text-gray-900">{entry.name} {isMe && <span className="text-blue-500 text-xs">(You)</span>}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{entry.points}</p>
                  <p className="text-xs text-gray-400">points</p>
                  <div className="flex justify-center gap-3 mt-2 text-xs text-gray-500">
                    <span>{entry.articlesCompleted} articles</span>
                    <span>{entry.exercisesCorrect} correct</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full list */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900 text-sm">All Rankings</h3>
            </div>
            <div className="divide-y">
              {leaderboard.map((entry, i) => {
                const rank = i + 1;
                const isMe = entry.id === user?.id;
                return (
                  <div key={entry.id} className={`flex items-center px-4 py-3 hover:bg-gray-50 ${isMe ? "bg-blue-50/50" : ""}`}>
                    <div className="w-10 text-center">
                      {rank <= 3 ? (
                        <Trophy className={`h-5 w-5 mx-auto ${RANK_COLORS[rank]}`} />
                      ) : (
                        <span className="text-sm font-medium text-gray-400">{rank}</span>
                      )}
                    </div>
                    <div className="flex-1 ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {entry.name} {isMe && <span className="text-blue-500 text-xs">(You)</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{entry.articlesCompleted}</span>
                      <span className="flex items-center gap-1"><Target className="h-3 w-3" />{entry.exercisesCorrect}</span>
                      <span className="flex items-center gap-1"><BookMarked className="h-3 w-3" />{entry.vocabularySaved}</span>
                    </div>
                    <div className="w-20 text-right">
                      <span className="text-sm font-bold text-gray-900">{entry.points}</span>
                      <span className="text-xs text-gray-400 ml-1">pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Points legend */}
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-700 mb-1">How to earn points:</p>
            <p>· Complete an article: <strong>10 points</strong></p>
            <p>· Answer an exercise correctly: <strong>2 points</strong></p>
            <p>· Save a vocabulary word: <strong>1 point</strong></p>
          </div>
        </>
      )}
    </div>
  );
}
