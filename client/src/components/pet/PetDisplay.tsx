import { useEffect } from "react";
import { usePetStore } from "../../stores/petStore";
import { Heart, Star } from "lucide-react";

const STAGES = [
  { emoji: "🥚", name: "Egg", color: "from-amber-100 to-yellow-100" },
  { emoji: "🐣", name: "Baby", color: "from-yellow-100 to-orange-100" },
  { emoji: "🐥", name: "Child", color: "from-orange-100 to-amber-100" },
  { emoji: "🐤", name: "Teen", color: "from-amber-100 to-rose-100" },
  { emoji: "🦉", name: "Adult", color: "from-purple-100 to-indigo-100" },
];

export function PetDisplay() {
  const { pet, loading, reaction, fetch } = usePetStore();

  useEffect(() => {
    fetch();
  }, []);

  if (loading) return null;
  if (!pet) return null;

  const stage = STAGES[pet.stage];
  const xpProgress = pet.nextStage
    ? Math.round((pet.experience / pet.nextStage.xpToNext) * 100)
    : 100;
  const happinessColor = pet.happiness > 60 ? "bg-green-400" : pet.happiness > 30 ? "bg-yellow-400" : "bg-red-400";

  return (
    <div className="relative">
      <div className={`bg-gradient-to-br ${stage.color} rounded-xl border p-4 text-center`}>
        <div className="text-4xl mb-2">{stage.emoji}</div>
        <p className="text-sm font-semibold text-gray-800">{pet.name}</p>
        <p className="text-xs text-gray-500">{stage.name} Stage</p>

        {/* XP bar */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-0.5">
            <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-amber-500" /> XP</span>
            <span>{pet.experience}{pet.nextStage ? ` / ${pet.nextStage.xpToNext}` : ""}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${xpProgress}%` }} />
          </div>
        </div>

        {/* Happiness bar */}
        <div className="mt-1.5">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-0.5">
            <span className="flex items-center gap-0.5"><Heart className="h-3 w-3 text-red-400" /> Mood</span>
            <span>{pet.happiness}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${happinessColor}`} style={{ width: `${pet.happiness}%` }} />
          </div>
        </div>
      </div>

      {/* Reaction popup */}
      {reaction && (
        <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-sm font-bold shadow-lg animate-fade-in whitespace-nowrap ${
          reaction.type === "level" ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-white" :
          reaction.type === "xp" ? "bg-blue-500 text-white" :
          reaction.type === "happy" ? "bg-green-500 text-white" :
          "bg-gray-500 text-white"
        }`}>
          {reaction.text}
        </div>
      )}
    </div>
  );
}
