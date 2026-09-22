import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthStore {
  user: User | null;
  jwt: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setJwt: (jwt: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      jwt: null,
      isLoading: false,
      setUser: (user) => set({ user }),
      setJwt: (jwt) => set({ jwt }),
      logout: () => set({ user: null, jwt: null }),
    }),
    { name: "auth", partialize: (s) => ({ jwt: s.jwt }) }
  )
);
