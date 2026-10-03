import { Router } from 'express';
import { z } from 'zod';
import { Event, CATEGORIES } from '../models/Event.js';
import { Seat } from '../models/Seat.js';
import { Hold } from '../models/Hold.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole, verifyToken, AUTH_COOKIE } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { cancelEvent } from '../services/orderService.js';
import { assertValidLayout, publishEvent, availabilityFor, seatMapFor, minPrice } from '../services/eventService.js';

export const eventsRouter = Router();

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tier = z.object({
  name: z.string().trim().min(1, 'Tier name is required').max(30),
  price: z.number('Price must be a number').int('Price must be a whole number').min(0, 'Price cannot be negative').max(100000, 'Price can be at most ₹1,00,000'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Color must be a hex code like #6366f1').optional(),
});
const row = z.object({
  label: z.string().trim().min(1).max(3).regex(/^[A-Za-z0-9]+$/, 'Row labels are letters/numbers').transform((s) => s.toUpperCase()),
  seats: z.number('Seats must be a number').int().min(1, 'A row needs at least 1 seat').max(60, 'A row can have at most 60 seats'),
  tier: z.string().trim().min(1, 'Pick a tier for every row'),
});

const eventBody = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120, 'Title must be 120 characters or fewer'),
  description: z.string().trim().max(4000).default(''),
  category: z.enum(CATEGORIES, 'Choose a category'),
  venue: z.object({
    name: z.string().trim().min(2, 'Venue name is required').max(120),
    city: z.string().trim().min(2, 'City is required').max(60),
  }),
  startsAt: z.coerce.date('Enter a valid start date and time').refine((d) => d > new Date(), 'Start time must be in the future'),
  durationMinutes: z.number('Duration must be a number').int().min(15, 'Duration must be at least 15 minutes').max(1440, 'Duration can be at most 24 hours').default(120),
  coverImageUrl: z.union([z.url('Cover image must be a valid URL'), z.literal('')], 'Cover image must be a valid URL').default(''),
  tiers: z.array(tier).min(1, 'Add at least one ticket tier').max(6, 'At most 6 tiers'),
  rows: z.array(row).min(1, 'Add at least one row').max(40, 'At most 40 rows'),
});

// Once published the layout and price are frozen: buyers have already seen them.
const publishedPatch = eventBody.pick({ description: true, coverImageUrl: true }).partial();

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  city: z.string().trim().max(60).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

async function loadOwnedEvent(req) {
  const event = await Event.findById(req.params.id);
  if (!event) throw AppError.notFound('Event');
  if (!event.organizer.equals(req.user._id)) throw AppError.forbidden('You can only manage your own events');
  return event;
}

// Public browse/search: upcoming published events only.
eventsRouter.get('/', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const { q, category, city, from, to, page, limit } = req.validatedQuery;
  const filter = { status: 'published', startsAt: { $gt: new Date() } };
  if (from && from > filter.startsAt.$gt) filter.startsAt.$gt = from;
  if (to) filter.startsAt.$lte = to;
  if (category) filter.category = category;
  if (city) filter['venue.city'] = new RegExp(`^${escapeRegex(city)}$`, 'i');
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { 'venue.name': rx }, { description: rx }];
  }

  const [items, total] = await Promise.all([
    Event.find(filter).sort({ startsAt: 1 }).skip((page - 1) * limit).limit(limit).populate('organizer', 'name'),
    Event.countDocuments(filter),
  ]);
  const avail = await availabilityFor(items.map((e) => e._id));
  res.json({
    items: items.map((e) => ({ ...e.toJSON(), rows: undefined, minPrice: minPrice(e), availability: avail(e._id) })),
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
}));

eventsRouter.get('/cities', asyncHandler(async (_req, res) => {
  const cities = await Event.distinct('venue.city', { status: 'published', startsAt: { $gt: new Date() } });
  res.json({ cities: cities.sort() });
}));

// Organizer's own events, every status.
eventsRouter.get('/mine', requireAuth, requireRole('organizer'), asyncHandler(async (req, res) => {
  const events = await Event.find({ organizer: req.user._id }).sort({ startsAt: -1 });
  const avail = await availabilityFor(events.map((e) => e._id));
  res.json({ items: events.map((e) => ({ ...e.toJSON(), availability: avail(e._id) })) });
}));

// Event detail + live seat map. Auth is optional here: a logged-in viewer gets
// their own held seats flagged as `mine`, and owners can preview drafts.
eventsRouter.get('/:id', validate(z.object({ id: objectId }), 'params'), asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id).populate('organizer', 'name');
  if (!event) throw AppError.notFound('Event');

  const viewer = verifyToken(req.cookies?.[AUTH_COOKIE]);
  const isOwner = viewer && String(event.organizer._id) === viewer.sub;
  if (event.status === 'draft' && !isOwner) throw AppError.notFound('Event');

  const hold = viewer
    ? await Hold.findOne({ user: viewer.sub, event: event._id, status: 'active', expiresAt: { $gt: new Date() } })
    : null;
  const seats = event.status === 'draft' ? [] : await seatMapFor(event._id, hold?._id);
  res.json({ event: { ...event.toJSON(), minPrice: minPrice(event), onSale: event.isOnSale(), isOwner: Boolean(isOwner) }, seats, hold });
}));

eventsRouter.post('/', requireAuth, requireRole('organizer'), validate(eventBody), asyncHandler(async (req, res) => {
  assertValidLayout(req.body);
  const event = await Event.create({ ...req.body, organizer: req.user._id });
  res.status(201).json({ event });
}));

eventsRouter.patch('/:id', requireAuth, requireRole('organizer'), asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req);
  if (event.status === 'cancelled') throw AppError.conflict('Cancelled events cannot be edited');

  const schema = event.status === 'draft' ? eventBody.partial() : publishedPatch.strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    const message = event.status === 'published' ? 'Only the description and cover image can change after publishing' : 'Some fields are invalid';
    throw AppError.badRequest(message, { code: 'VALIDATION_ERROR', details });
  }
  Object.assign(event, parsed.data);
  if (event.status === 'draft') assertValidLayout(event);
  await event.save();
  res.json({ event });
}));

eventsRouter.post('/:id/publish', requireAuth, requireRole('organizer'), asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req);
  const published = await publishEvent(event);
  res.json({ event: published });
}));

eventsRouter.delete('/:id', requireAuth, requireRole('organizer'), asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req);
  if (event.status !== 'draft') throw AppError.conflict('Only drafts can be deleted. Cancel a published event instead.');
  await Promise.all([event.deleteOne(), Seat.deleteMany({ event: event._id })]);
  res.status(204).end();
}));

// Cancels sales, releases holds and refunds every paid order.
eventsRouter.post('/:id/cancel', requireAuth, requireRole('organizer'), asyncHandler(async (req, res) => {
  const event = await loadOwnedEvent(req);
  const { event: cancelled, refunded } = await cancelEvent(event);
  res.json({ event: cancelled, refunded });
}));
