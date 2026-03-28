import { create } from 'zustand';

export const useEditorStore = create((set) => ({
  // Document
  content:  '',
  revision: 0,
  language: 'javascript',

  // Presence
  users: [],  // [{ userId, username, color, cursor }]

  // UI
  isConnected: false,
  isSaving:    false,

  setDocument:    ({ content, revision }) => set({ content, revision }),
  setRevision:    (revision)             => set({ revision }),
  setLanguage:    (language)             => set({ language }),
  setUsers:       (users)                => set({ users }),
  setConnected:   (v)                    => set({ isConnected: v }),

  applyRemoteContent: (content) => set({ content }),
}));
