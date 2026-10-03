import { Router } from 'express';
import { z } from 'zod';
import { Order } from '../models/Order.js';
import { Ticket } from '../models/Ticket.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { checkout, cancelOrderByAttendee, CANCELLATION_CUTOFF_HOURS } from '../services/orderService.js';
import { qrPayloadFor } from '../services/ticketSigner.js';

const cardSchema = z.object({
  number: z.string().trim().regex(/^[\d ]{13,23}$/, 'Card number must be 13–19 digits'),
  expMonth: z.coerce.number().int().min(1, 'Invalid month').max(12, 'Invalid month'),
  expYear: z.coerce.number().int().min(2000).max(2100),
  cvc: z.string().regex(/^\d{3,4}$/, 'CVC must be 3 or 4 digits'),
  name: z.string().trim().min(2, 'Name on card is required').max(80),
});

// Mounted at /api/holds/:id/checkout
export const checkoutRouter = Router({ mergeParams: true });

checkoutRouter.post('/', requireAuth, validate(z.object({ card: cardSchema.optional() })), asyncHandler(async (req, res) => {
  const key = req.get('Idempotency-Key');
  if (!key || !/^[\w-]{8,100}$/.test(key)) throw AppError.badRequest('A valid Idempotency-Key header is required');
  const { order, tickets, replayed } = await checkout({ user: req.user, holdId: req.params.id, idempotencyKey: key, card: req.body.card });
  res.status(replayed ? 200 : 201).json({ order, tickets: tickets.map(withQr), replayed });
}));

const withQr = (t) => ({ ...(t.toJSON?.() ?? t), qr: t.status === 'valid' ? qrPayloadFor(t._id) : null });

// Mounted at /api/orders
export const ordersRouter = Router();

ordersRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id, status: { $in: ['paid', 'cancelled', 'refunded'] } })
    .sort({ createdAt: -1 })
    .populate('event', 'title venue startsAt status category coverImageUrl');
  const tickets = await Ticket.find({ order: { $in: orders.map((o) => o._id) } }).sort({ label: 1 });
  const byOrder = Map.groupBy(tickets, (t) => String(t.order));
  res.json({
    cancellationCutoffHours: CANCELLATION_CUTOFF_HOURS,
    items: orders.map((o) => ({ ...o.toJSON(), tickets: (byOrder.get(String(o._id)) ?? []).map(withQr) })),
  });
}));

ordersRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('event', 'title venue startsAt status');
  if (!order || !order.user.equals(req.user._id)) throw AppError.notFound('Order');
  const tickets = await Ticket.find({ order: order._id }).sort({ label: 1 });
  res.json({ order, tickets: tickets.map(withQr) });
}));

ordersRouter.post('/:id/cancel', requireAuth, asyncHandler(async (req, res) => {
  const order = await cancelOrderByAttendee({ user: req.user, orderId: req.params.id });
  res.json({ order });
}));
