import { io } from 'socket.io-client';

// One shared connection for the whole app (same origin; Vite proxies in dev).
let socket;
export function getSocket() {
  if (!socket) socket = io({ path: '/socket.io', withCredentials: true, transports: ['websocket', 'polling'] });
  return socket;
}
