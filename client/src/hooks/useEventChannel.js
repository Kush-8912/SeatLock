import { useEffect, useLayoutEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';

/**
 * Subscribe to live updates for one event. Re-joins the room after a
 * reconnect and calls onReconnect so the caller can refetch anything missed
 * while offline (socket.io does not replay messages).
 */
export function useEventChannel(eventId, handlers) {
  const ref = useRef(handlers);
  useLayoutEffect(() => { ref.current = handlers; });

  useEffect(() => {
    if (!eventId) return undefined;
    const socket = getSocket();
    let connectedBefore = socket.connected;

    const join = () => {
      socket.emit('event:join', eventId);
      if (connectedBefore) ref.current.onReconnect?.();
      connectedBefore = true;
    };
    const onSeats = (msg) => msg.eventId === eventId && ref.current.onSeats?.(msg.seats);
    const onCheckin = (msg) => msg.eventId === eventId && ref.current.onCheckin?.(msg);

    if (socket.connected) socket.emit('event:join', eventId);
    socket.on('connect', join);
    socket.on('seats:update', onSeats);
    socket.on('checkin', onCheckin);
    return () => {
      socket.emit('event:leave', eventId);
      socket.off('connect', join);
      socket.off('seats:update', onSeats);
      socket.off('checkin', onCheckin);
    };
  }, [eventId]);
}
