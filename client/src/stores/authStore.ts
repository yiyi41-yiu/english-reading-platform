import { create } from "zustand";
import type { User } from "../types";
import { api } from "../lib/api";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  guestLogin: () => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("token"),
  loading: true,

  login: async (email, password) => {
    const res = await api.auth.login({ email, password });
    localStorage.setItem("token", res.token);
    set({ user: res.user, token: res.token });
  },

  register: async (email, password, name, role) => {
    const res = await api.auth.register({ email, password, name, role });
    localStorage.setItem("token", res.token);
    set({ user: res.user, token: res.token });
  },

  guestLogin: async () => {
    const res = await api.auth.guest();
    localStorage.setItem("token", res.token);
    set({ user: res.user, token: res.token });
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const user = await api.auth.me();
      set({ user, loading: false });
    } catch {
      localStorage.removeItem("token");
      set({ user: null, token: null, loading: false });
    }
  },
}));
