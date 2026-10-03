import { Seat } from '../models/Seat.js';
import { Order } from '../models/Order.js';
import { Ticket } from '../models/Ticket.js';

const TZ = 'Asia/Kolkata';

// Everything the organizer dashboard shows, computed with aggregations so the
// numbers always match the source of truth instead of drifting counters.
export async function eventStats(event) {
  const now = new Date();
  const [tierRows, orderTotals, salesByDay, checkins, recentCheckins] = await Promise.all([
    Seat.aggregate([
      { $match: { event: event._id } },
      {
        $group: {
          _id: '$tier',
          capacity: { $sum: 1 },
          sold: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] } },
          held: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'held'] }, { $gt: ['$holdExpiresAt', now] }] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, '$price', 0] } },
          price: { $first: '$price' },
        },
      },
    ]),
    Order.aggregate([
      { $match: { event: event._id, status: { $in: ['paid', 'refunded', 'cancelled'] } } },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    Order.aggregate([
      { $match: { event: event._id, status: 'paid' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: TZ } },
          tickets: { $sum: { $size: '$items' } },
          revenue: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Ticket.aggregate([
      { $match: { event: event._id, status: 'valid' } },
      { $group: { _id: null, issued: { $sum: 1 }, checkedIn: { $sum: { $cond: [{ $ne: ['$checkedInAt', null] }, 1, 0] } } } },
    ]),
    Ticket.find({ event: event._id, checkedInAt: { $ne: null } }, 'label tier checkedInAt user')
      .sort({ checkedInAt: -1 })
      .limit(8)
      .populate('user', 'name'),
  ]);

  // Keep tiers in the organizer's defined order.
  const tierOrder = event.tiers.map((t) => t.name);
  const tiers = tierRows
    .map((r) => ({ tier: r._id, price: r.price, capacity: r.capacity, sold: r.sold, held: r.held, available: r.capacity - r.sold - r.held, revenue: r.revenue }))
    .sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier));

  const byStatus = Object.fromEntries(orderTotals.map((o) => [o._id, o]));
  const capacity = tiers.reduce((s, t) => s + t.capacity, 0);
  const sold = tiers.reduce((s, t) => s + t.sold, 0);
  const held = tiers.reduce((s, t) => s + t.held, 0);

  return {
    capacity,
    sold,
    held,
    available: capacity - sold - held,
    sellThrough: capacity ? sold / capacity : 0,
    revenue: byStatus.paid?.amount ?? 0,
    ordersPaid: byStatus.paid?.count ?? 0,
    refunds: { count: (byStatus.refunded?.count ?? 0) + (byStatus.cancelled?.count ?? 0), amount: byStatus.refunded?.amount ?? 0 },
    tiers,
    salesByDay: salesByDay.map((d) => ({ date: d._id, tickets: d.tickets, revenue: d.revenue })),
    checkins: { issued: checkins[0]?.issued ?? 0, checkedIn: checkins[0]?.checkedIn ?? 0 },
    recentCheckins: recentCheckins.map((t) => ({ label: t.label, tier: t.tier, attendee: t.user?.name, checkedInAt: t.checkedInAt })),
  };
}
