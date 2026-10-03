import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { attachIO, eventRoom } from './bus.js';

const isObjectId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

// Viewers join one room per event page they have open and receive seat
// status changes for that event only. The channel is read-only: all writes go
// through the authenticated REST API.
export function initSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: env.CLIENT_ORIGIN, credentials: true } });

  io.on('connection', (socket) => {
    socket.on('event:join', (eventId) => {
      if (isObjectId(eventId)) socket.join(eventRoom(eventId));
    });
    socket.on('event:leave', (eventId) => {
      if (isObjectId(eventId)) socket.leave(eventRoom(eventId));
    });
  });

  attachIO(io);
  return io;
}
