import { create } from "zustand";

export interface PetState {
  id: number;
  userId: number;
  name: string;
  stage: number;
  happiness: number;
  experience: number;
  stageInfo: { stage: number; name: string; emoji: string; xpToNext: number };
  nextStage: { stage: number; name: string; emoji: string; xpToNext: number } | null;
}

interface PetStoreState {
  pet: PetState | null;
  loading: boolean;
  reaction: { text: string; type: "xp" | "level" | "happy" | "sad" } | null;
  fetch: () => Promise<void>;
  feed: () => Promise<void>;
  setName: (name: string) => Promise<void>;
  addXP: (amount: number) => Promise<boolean>;
  showReaction: (text: string, type: "xp" | "level" | "happy" | "sad") => void;
  clearReaction: () => void;
}

export const usePetStore = create<PetStoreState>((set, get) => ({
  pet: null,
  loading: false,
  reaction: null,

  fetch: async () => {
    set({ loading: true });
    try {
      const pet = await requestPet();
      set({ pet, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  feed: async () => {
    try {
      const res = await fetch("/api/pet/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
      }).then(r => r.json());
      const pet = get().pet;
      if (pet) set({ pet: { ...pet, happiness: res.happiness } });
      get().showReaction("+10 Happiness! 😊", "happy");
    } catch { /* ignore */ }
  },

  setName: async (name: string) => {
    try {
      await fetch("/api/pet/name", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ name }),
      }).then(r => r.json());
      const pet = get().pet;
      if (pet) set({ pet: { ...pet, name } });
    } catch { /* ignore */ }
  },

  addXP: async (amount: number) => {
    const token = localStorage.getItem("token");
    if (!token) return false;
    try {
      const pet = get().pet;
      if (!pet) return false;
      const newXP = pet.experience + amount;
      const stageInfo = pet.stageInfo;
      const leveled = pet.stage < 4 && newXP >= stageInfo.xpToNext;
      let stage = pet.stage;
      if (leveled) stage = Math.min(4, stage + 1);
      set({ pet: { ...pet, experience: newXP, stage } });
      get().showReaction(
        leveled ? `Level up! ${["🥚","🐣","🐥","🐤","🦉"][stage]} Stage ${stage}!` : `+${amount} XP!`,
        leveled ? "level" : "xp"
      );
      setTimeout(() => get().clearReaction(), 2500);
      return leveled;
    } catch { return false; }
  },

  showReaction: (text: string, type: "xp" | "level" | "happy" | "sad") => {
    set({ reaction: { text, type } });
    setTimeout(() => set({ reaction: null }), 2500);
  },

  clearReaction: () => set({ reaction: null }),
}));

async function requestPet(): Promise<PetState> {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/pet", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch pet");
  return res.json();
}
