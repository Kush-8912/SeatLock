import { Router } from 'express';
import { z } from 'zod';
import { Event } from '../models/Event.js';
import { Ticket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { checkInTicket } from '../services/checkinService.js';
import { eventStats } from '../services/statsService.js';

// Mounted at /api/events — organizer-only operations on one event. Guards are
// attached per route (not router.use) so public /events/:id stays public.
export const organizerEventRouter = Router();

const loadOwnedEvent = asyncHandler(async (req, _res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw AppError.badRequest('Invalid id');
  const event = await Event.findById(req.params.id);
  if (!event) throw AppError.notFound('Event');
  if (!event.organizer.equals(req.user._id)) throw AppError.forbidden('You can only manage your own events');
  req.event = event;
  next();
});
const owner = [requireAuth, requireRole('organizer'), loadOwnedEvent];

organizerEventRouter.post('/:id/checkin', owner, validate(z.object({ qr: z.string().trim().min(1, 'Scan or enter a ticket code').max(200) })), asyncHandler(async (req, res) => {
  const result = await checkInTicket({ event: req.event, qr: req.body.qr, staff: req.user });
  res.json({ checkin: result });
}));

organizerEventRouter.get('/:id/stats', owner, asyncHandler(async (req, res) => {
  res.json({ stats: await eventStats(req.event) });
}));

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Guest list with search by attendee name/email or seat, for manual lookup at the door.
organizerEventRouter.get('/:id/attendees', owner, validate(z.object({ q: z.string().trim().max(80).optional() }), 'query'), asyncHandler(async (req, res) => {
  const { q } = req.validatedQuery;
  const filter = { event: req.event._id, status: 'valid' };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const users = await User.find({ $or: [{ name: rx }, { email: rx }] }, '_id').limit(200);
    filter.$or = [{ label: new RegExp(`^${escapeRegex(q)}`, 'i') }, { user: { $in: users.map((u) => u._id) } }];
  }
  const tickets = await Ticket.find(filter, 'label tier price checkedInAt user order').populate('user', 'name email').sort({ label: 1 }).limit(500);
  res.json({ items: tickets });
}));
