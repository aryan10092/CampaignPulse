import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

let socket: Socket | null = null;

function currentToken(explicit?: string | null): string | null {
  if (explicit) return explicit;
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('cp_token');
}

export const getSocket = (token?: string | null): Socket => {
  const authToken = currentToken(token);

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token: authToken },
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    return socket;
  }

  const previous = (socket.auth as { token?: string } | undefined)?.token;
  if (authToken && previous !== authToken) {
    socket.auth = { token: authToken };
    if (socket.connected) {
      socket.disconnect();
    }
    socket.connect();
  }

  return socket;
};

export const disconnectSocket = (): void => {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
};
