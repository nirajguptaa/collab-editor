import axios from 'axios';

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
  withCredentials: true,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  // Import here to avoid circular dep at module load time
  const { accessToken } = JSON.parse(
    localStorage.getItem('collab-auth') || '{}'
  )?.state || {};

  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let pendingQueue = [];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status !== 401 || original._retried) return Promise.reject(err);

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retried = true;
    isRefreshing = true;

    try {
      // Dynamically import store to avoid circular
      const { useAuthStore } = await import('../store/auth.store');
      const newToken = await useAuthStore.getState().refreshAccess();

      pendingQueue.forEach((p) => p.resolve(newToken));
      pendingQueue = [];
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshErr) {
      pendingQueue.forEach((p) => p.reject(refreshErr));
      pendingQueue = [];
      const { useAuthStore } = await import('../store/auth.store');
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);
