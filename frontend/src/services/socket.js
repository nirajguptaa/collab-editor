import { io } from 'socket.io-client';

// True singleton — only one socket instance ever exists
let socket = null;

export function getSocket() {
  if (!socket) {
    const stored = localStorage.getItem('collab-auth');
    const token = stored ? JSON.parse(stored)?.state?.accessToken : null;

    socket = io(import.meta.env.VITE_WS_URL || window.location.origin, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}