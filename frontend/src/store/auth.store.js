import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,

      setTokens: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),

      logout: async () => {
        const { refreshToken } = get();
        try {
          await api.post('/auth/logout', { refreshToken });
        } catch (_) {}
        set({ user: null, accessToken: null, refreshToken: null });
      },

      refreshAccess: async () => {
        const { refreshToken } = get();
        if (!refreshToken) throw new Error('No refresh token.');
        const { data } = await api.post('/auth/refresh', { refreshToken });
        set({ accessToken: data.accessToken });
        return data.accessToken;
      },
    }),
    {
      name: 'collab-auth',
      partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user }),
    }
  )
);
