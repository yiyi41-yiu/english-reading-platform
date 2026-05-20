import { useEffect } from "react";
import { usePetStore } from "../../stores/petStore";
import { Heart, Zap, TrendingUp } from "lucide-react";

const STAGES = [
  { emoji: "🥚", name: "Egg" },
  { emoji: "🐣", name: "Baby" },
  { emoji: "🐥", name: "Child" },
  { emoji: "🐤", name: "Teen" },
  { emoji: "🦉", name: "Adult" },
];

export function PetDisplay() {
  const { pet, loading, reaction, fetch, feed } = usePetStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-16" />
            <div className="h-2 bg-gray-200 rounded w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="bg-white rounded-xl border p-4 text-center">
        <span className="text-2xl grayscale opacity-50">🥚</span>
        <p className="text-xs text-gray-400 mt-1">Your pet is waiting... start reading!</p>
      </div>
    );
  }

  const stage = STAGES[pet.stage] || STAGES[0];
  const xpProgress = pet.nextStage
    ? Math.round((pet.experience / pet.nextStage.xpToNext) * 100)
    : 100;

  return (
    <div className="relative">
      <div className="bg-white rounded-xl border overflow-hidden">
        {/* Pet info */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-3xl">{stage.emoji}</span>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{pet.name}</h3>
                <p className="text-[10px] text-gray-400">{stage.name} stage</p>
              </div>
            </div>
            <button
              onClick={() => feed()}
              className="p-1.5 hover:bg-pink-50 rounded-lg text-gray-400 hover:text-pink-500 transition-colors"
              title="Feed: +10 happiness"
            >
              <Heart className={`h-4 w-4 ${pet.happiness > 60 ? "text-pink-400" : "text-gray-300"}`} />
            </button>
          </div>

          {/* Happiness */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
              <span>Happiness</span>
              <span>{pet.happiness}/100</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pet.happiness > 60 ? "bg-pink-400" : pet.happiness > 30 ? "bg-amber-400" : "bg-red-400"
                }`}
                style={{ width: `${pet.happiness}%` }}
              />
            </div>
          </div>

          {/* XP */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
              <span className="flex items-center gap-0.5"><Zap className="h-3 w-3" /> XP</span>
              <span>
                {pet.experience}
                {pet.nextStage ? ` / ${pet.nextStage.xpToNext}` : " (max)"}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(xpProgress, 100)}%` }}
              />
            </div>
            {pet.nextStage && (
              <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" />
                Next: {STAGES[pet.nextStage.stage]?.emoji} {pet.nextStage.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Reaction popup */}
      {reaction && (
        <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap animate-bounce z-10 ${
          reaction.type === "level" ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-white" :
          reaction.type === "xp" ? "bg-blue-500 text-white" :
          reaction.type === "happy" ? "bg-green-500 text-white" :
          "bg-red-500 text-white"
        }`}>
          {reaction.text}
        </div>
      )}
    </div>
  );
}

// Compact floating version for ArticleReaderPage
export function PetFloating() {
  const { pet, reaction, fetch, feed } = usePetStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (!pet) return null;

  const stage = STAGES[pet.stage] || STAGES[0];

  return (
    <div className="relative">
      {reaction && (
        <div className={`absolute -top-8 right-0 px-2 py-1 rounded-full text-xs font-bold shadow whitespace-nowrap animate-bounce z-10 ${
          reaction.type === "level" ? "bg-yellow-400 text-white" :
          reaction.type === "xp" ? "bg-blue-500 text-white" :
          reaction.type === "happy" ? "bg-green-500 text-white" :
          "bg-red-500 text-white"
        }`}>
          {reaction.text}
        </div>
      )}
      <div className="flex items-center gap-2 bg-white rounded-full border shadow-sm px-3 py-1.5">
        <span className="text-xl">{stage.emoji}</span>
        <span className="text-xs font-medium text-gray-700">{pet.name}</span>
        <button
          onClick={() => feed()}
          className="p-0.5 hover:bg-pink-50 rounded text-gray-400 hover:text-pink-500"
          title="Feed (+10 happiness)"
        >
          <Heart className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
