import { Ticket } from '../models/Ticket.js';
import { AppError } from '../utils/AppError.js';
import { verifyQrPayload } from './ticketSigner.js';
import { emitCheckin } from '../realtime/bus.js';

// Doors are considered closed this long after the scheduled end.
const CHECKIN_GRACE_AFTER_END_MS = 6 * 3_600_000;

/**
 * Validate a scanned QR code and admit the holder exactly once.
 * Each failure has its own code so the scanner UI can tell staff precisely
 * what is wrong (forged code vs. wrong event vs. already used).
 */
export async function checkInTicket({ event, qr, staff }) {
  if (event.status === 'cancelled') throw AppError.conflict('This event has been cancelled', { code: 'EVENT_CANCELLED' });
  const endsAt = event.startsAt.getTime() + event.durationMinutes * 60_000;
  if (Date.now() > endsAt + CHECKIN_GRACE_AFTER_END_MS) throw AppError.conflict('Check-in for this event has closed', { code: 'CHECKIN_CLOSED' });

  const ticketId = verifyQrPayload(qr);
  if (!ticketId) throw AppError.badRequest('This QR code is not a valid SeatLock ticket', { code: 'INVALID_TICKET' });

  const ticket = await Ticket.findById(ticketId).populate('user', 'name');
  if (!ticket) throw AppError.badRequest('This QR code is not a valid SeatLock ticket', { code: 'INVALID_TICKET' });
  if (!ticket.event.equals(event._id)) throw AppError.conflict('This ticket is for a different event', { code: 'WRONG_EVENT' });
  if (ticket.status === 'cancelled') throw AppError.conflict(`Ticket ${ticket.label} was cancelled and refunded`, { code: 'TICKET_CANCELLED' });

  // Conditional update: two scanners reading the same code at once can't both admit it.
  const admitted = await Ticket.findOneAndUpdate(
    { _id: ticket._id, status: 'valid', checkedInAt: null },
    { checkedInAt: new Date(), checkedInBy: staff._id },
    { returnDocument: 'after' },
  );
  if (!admitted) {
    const current = await Ticket.findById(ticket._id, 'checkedInAt');
    throw AppError.conflict(`Ticket ${ticket.label} was already used`, {
      code: 'ALREADY_CHECKED_IN',
      details: { checkedInAt: current.checkedInAt, label: ticket.label, attendee: ticket.user?.name },
    });
  }

  const result = { ticketId: admitted._id, label: admitted.label, tier: admitted.tier, attendee: ticket.user?.name, checkedInAt: admitted.checkedInAt };
  emitCheckin(event._id, result);
  return result;
}
