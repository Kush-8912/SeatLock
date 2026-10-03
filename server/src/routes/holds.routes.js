import { Router } from 'express';
import { z } from 'zod';
import { Event } from '../models/Event.js';
import { Seat } from '../models/Seat.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { createHold, releaseHold, loadOwnedHold } from '../services/holdService.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// Mounted at /api/events/:id/holds
export const eventHoldsRouter = Router({ mergeParams: true });

eventHoldsRouter.post('/', requireAuth, validate(z.object({ seatIds: z.array(objectId).min(1) })), asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event || event.status === 'draft') throw AppError.notFound('Event');
  if (event.organizer.equals(req.user._id)) throw AppError.forbidden('Organizers cannot buy tickets to their own event');
  const hold = await createHold({ user: req.user, event, seatIds: req.body.seatIds });
  res.status(201).json({ hold });
}));

// Mounted at /api/holds
export const holdsRouter = Router();

holdsRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const hold = await loadOwnedHold(req.params.id, req.user);
  const [event, seats] = await Promise.all([
    Event.findById(hold.event, 'title venue startsAt tiers status'),
    Seat.find({ _id: { $in: hold.seats } }, 'label tier price row number').sort({ row: 1, number: 1 }).lean(),
  ]);
  const total = seats.reduce((s, x) => s + x.price, 0);
  res.json({ hold: { ...hold.toJSON(), live: hold.isLive() }, event, seats, total });
}));

holdsRouter.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const hold = await loadOwnedHold(req.params.id, req.user);
  await releaseHold(hold, 'released');
  res.status(204).end();
}));
