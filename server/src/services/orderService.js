import { Hold } from '../models/Hold.js';
import { Seat } from '../models/Seat.js';
import { Order } from '../models/Order.js';
import { Ticket } from '../models/Ticket.js';
import { Event } from '../models/Event.js';
import { AppError } from '../utils/AppError.js';
import { emitSeatChanges } from '../realtime/bus.js';
import * as payments from './paymentService.js';
import { releaseHold } from './holdService.js';

// Attendees can cancel for a refund until this long before the event starts.
export const CANCELLATION_CUTOFF_HOURS = 24;
// Payment must not be cut short by the hold expiring mid-checkout.
const CHECKOUT_GRACE_MS = 2 * 60_000;

async function orderWithTickets(order) {
  const tickets = await Ticket.find({ order: order._id }).sort({ label: 1 });
  return { order, tickets };
}

/**
 * Turn a hold into a paid order with tickets.
 *
 *   hold: active --lock--> converting --pay ok--> converted
 *                              \--pay fails--> active (buyer may retry)
 *
 * Duplicate submissions are absorbed two ways: the same Idempotency-Key
 * returns the original order, and the active->converting lock means a second
 * concurrent checkout of the same hold is refused before any charge happens.
 */
export async function checkout({ user, holdId, idempotencyKey, card }) {
  const existing = await Order.findOne({ user: user._id, idempotencyKey });
  if (existing) {
    if (existing.status === 'pending') throw AppError.conflict('This payment is still being processed', { code: 'CHECKOUT_IN_PROGRESS' });
    if (existing.status === 'failed') throw new AppError(402, existing.failureReason, { code: 'PAYMENT_FAILED' });
    return { ...(await orderWithTickets(existing)), replayed: true };
  }

  const hold = await Hold.findById(holdId);
  if (!hold || !hold.user.equals(user._id)) throw AppError.notFound('Hold');

  if (hold.status === 'converted') {
    const order = await Order.findOne({ hold: hold._id, status: { $in: ['paid', 'cancelled', 'refunded'] } });
    if (order) return { ...(await orderWithTickets(order)), replayed: true };
  }
  if (hold.status === 'converting') throw AppError.conflict('Checkout for these seats is already in progress', { code: 'CHECKOUT_IN_PROGRESS' });
  if (hold.status !== 'active' || hold.expiresAt <= new Date()) {
    if (hold.status === 'active') await releaseHold(hold, 'expired');
    throw AppError.gone('Your seat hold has expired. Please pick your seats again.', { code: 'HOLD_EXPIRED' });
  }

  const event = await Event.findById(hold.event);
  if (!event?.isOnSale()) {
    await releaseHold(hold, 'released');
    throw AppError.conflict('Tickets for this event are no longer on sale', { code: 'NOT_ON_SALE' });
  }

  // Lock the hold for this checkout.
  const now = new Date();
  const locked = await Hold.findOneAndUpdate(
    { _id: hold._id, status: 'active', expiresAt: { $gt: now } },
    { status: 'converting' },
    { returnDocument: 'after' },
  );
  if (!locked) throw AppError.conflict('Checkout for these seats is already in progress', { code: 'CHECKOUT_IN_PROGRESS' });

  const graceUntil = new Date(Math.max(locked.expiresAt.getTime(), now.getTime() + CHECKOUT_GRACE_MS));
  await Seat.updateMany({ hold: locked._id, status: 'held' }, { holdExpiresAt: graceUntil });
  const seats = await Seat.find({ _id: { $in: locked.seats }, hold: locked._id, status: 'held' }).sort({ row: 1, number: 1 });

  const unlock = (status) => Hold.updateOne({ _id: locked._id, status: 'converting' }, { status });
  if (seats.length !== locked.seats.length) {
    await unlock('expired');
    await Seat.updateMany({ hold: locked._id, status: 'held' }, { status: 'available', hold: null, holdExpiresAt: null });
    throw AppError.gone('Some of your seats were released. Please pick your seats again.', { code: 'HOLD_EXPIRED' });
  }

  const amount = seats.reduce((sum, s) => sum + s.price, 0);
  let order;
  try {
    order = await Order.create({
      user: user._id,
      event: locked.event,
      hold: locked._id,
      items: seats.map((s) => ({ seat: s._id, label: s.label, tier: s.tier, price: s.price })),
      amount,
      idempotencyKey,
    });
  } catch (err) {
    await unlock('active');
    if (err?.code === 11000) throw AppError.conflict('This payment is still being processed', { code: 'CHECKOUT_IN_PROGRESS' });
    throw err;
  }

  // 1. Take payment (free events skip the processor).
  let paid = { chargeId: null, last4: null };
  if (amount > 0) {
    if (!card) {
      await Promise.all([unlock('active'), Order.updateOne({ _id: order._id }, { status: 'failed', failureReason: 'Card details are required' })]);
      throw AppError.badRequest('Card details are required', { code: 'CARD_REQUIRED' });
    }
    try {
      paid = await payments.charge({ amount, card, idempotencyKey: `${user._id}:${idempotencyKey}` });
    } catch (err) {
      const reason = err instanceof payments.PaymentError ? err.message : 'Payment could not be completed';
      await Promise.all([
        Order.updateOne({ _id: order._id }, { status: 'failed', failureReason: reason }),
        unlock('active'),
        // restore the original expiry so the grace period isn't a free extension
        Seat.updateMany({ hold: locked._id, status: 'held' }, { holdExpiresAt: locked.expiresAt }),
      ]);
      throw new AppError(402, reason, { code: 'PAYMENT_FAILED', details: { reason: err.code } });
    }
  }

  // 2. Mark seats sold — only if they are still ours.
  const sold = await Seat.updateMany(
    { _id: { $in: seats.map((s) => s._id) }, hold: locked._id, status: 'held' },
    { status: 'sold', order: order._id, hold: null, holdExpiresAt: null },
  );
  if (sold.modifiedCount !== seats.length) {
    // Should be unreachable thanks to the lock + grace window, but never keep
    // money for seats we can't deliver.
    await Seat.updateMany({ order: order._id, status: 'sold' }, { status: 'available', order: null });
    const refund = paid.chargeId ? await payments.refund({ chargeId: paid.chargeId }) : {};
    await Promise.all([
      Order.updateOne({ _id: order._id }, { status: 'refunded', failureReason: 'Seats became unavailable', 'payment.refundId': refund.refundId }),
      unlock('expired'),
    ]);
    throw AppError.conflict('Your seats became unavailable during payment. You have been refunded.', { code: 'SEATS_UNAVAILABLE' });
  }

  // 3. Issue tickets and finalise.
  const tickets = await Ticket.insertMany(
    seats.map((s) => ({ order: order._id, event: locked.event, user: user._id, seat: s._id, label: s.label, tier: s.tier, price: s.price })),
  );
  order.status = 'paid';
  order.paidAt = new Date();
  order.payment = { provider: 'mock', chargeId: paid.chargeId, last4: paid.last4 };
  await order.save();
  await unlock('converted');

  emitSeatChanges(locked.event, seats.map((s) => ({ id: s._id, status: 'sold' })));
  return { order, tickets, replayed: false };
}

// Refund an order, void its tickets and (optionally) put seats back on sale.
async function refundOrder(order, { by, reopenSeats }) {
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, status: 'paid' },
    { status: 'cancelled', cancelledAt: new Date(), cancelledBy: by },
    { returnDocument: 'after' },
  );
  if (!claimed) return null;

  if (claimed.payment?.chargeId) {
    const { refundId } = await payments.refund({ chargeId: claimed.payment.chargeId });
    claimed.payment.refundId = refundId;
    claimed.status = 'refunded';
    await claimed.save();
  }
  await Ticket.updateMany({ order: claimed._id }, { status: 'cancelled' });

  if (reopenSeats) {
    const seatIds = claimed.items.map((i) => i.seat);
    await Seat.updateMany({ _id: { $in: seatIds }, order: claimed._id, status: 'sold' }, { status: 'available', order: null });
    emitSeatChanges(claimed.event, seatIds.map((id) => ({ id, status: 'available' })));
  }
  return claimed;
}

export async function cancelOrderByAttendee({ user, orderId }) {
  const order = await Order.findById(orderId);
  if (!order || !order.user.equals(user._id)) throw AppError.notFound('Order');
  if (order.status !== 'paid') throw AppError.conflict(`This order is ${order.status} and cannot be cancelled`);

  const event = await Event.findById(order.event, 'startsAt');
  const cutoff = new Date(event.startsAt.getTime() - CANCELLATION_CUTOFF_HOURS * 3_600_000);
  if (new Date() > cutoff) {
    throw AppError.conflict(`Cancellations close ${CANCELLATION_CUTOFF_HOURS} hours before the event starts`, { code: 'CANCELLATION_CLOSED' });
  }
  if (await Ticket.exists({ order: order._id, checkedInAt: { $ne: null } })) {
    throw AppError.conflict('Tickets that have been checked in cannot be refunded');
  }

  const refunded = await refundOrder(order, { by: 'attendee', reopenSeats: true });
  if (!refunded) throw AppError.conflict('This order was already cancelled');
  return refunded;
}

// Organizer cancels the whole event: stop sales, release holds, refund everyone.
export async function cancelEvent(event) {
  const claimed = await Event.findOneAndUpdate(
    { _id: event._id, status: 'published', startsAt: { $gt: new Date() } },
    { status: 'cancelled', cancelledAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!claimed) throw AppError.conflict('Only upcoming published events can be cancelled');

  const holds = await Hold.find({ event: event._id, status: 'active' });
  for (const h of holds) await releaseHold(h, 'released');

  let refunded = 0;
  for await (const order of Order.find({ event: event._id, status: 'paid' }).cursor()) {
    if (await refundOrder(order, { by: 'organizer', reopenSeats: false })) refunded += 1;
  }
  return { event: claimed, refunded };
}
