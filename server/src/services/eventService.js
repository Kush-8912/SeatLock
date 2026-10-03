import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { Seat, effectiveStatus } from '../models/Seat.js';
import { AppError } from '../utils/AppError.js';

export const MAX_CAPACITY = 1500;

// Cross-field rules zod can't express per-field: tiers referenced by rows must
// exist, labels must be unique, and the venue can't exceed MAX_CAPACITY.
export function assertValidLayout({ tiers, rows }) {
  const tierNames = new Set();
  for (const t of tiers) {
    const key = t.name.toLowerCase();
    if (tierNames.has(key)) throw AppError.badRequest(`Duplicate tier "${t.name}"`);
    tierNames.add(key);
  }
  const labels = new Set();
  for (const r of rows) {
    const label = r.label.toUpperCase();
    if (labels.has(label)) throw AppError.badRequest(`Duplicate row "${r.label}"`);
    labels.add(label);
    if (!tierNames.has(r.tier.toLowerCase())) throw AppError.badRequest(`Row ${r.label} uses unknown tier "${r.tier}"`);
  }
  const capacity = rows.reduce((s, r) => s + r.seats, 0);
  if (capacity > MAX_CAPACITY) throw AppError.badRequest(`Capacity ${capacity} exceeds the ${MAX_CAPACITY}-seat limit`);
}

export function buildSeats(event) {
  const priceOf = new Map(event.tiers.map((t) => [t.name.toLowerCase(), t]));
  return event.rows.flatMap((row) => {
    const tier = priceOf.get(row.tier.toLowerCase());
    return Array.from({ length: row.seats }, (_, i) => ({
      event: event._id,
      row: row.label,
      number: i + 1,
      label: `${row.label}${i + 1}`,
      tier: tier.name,
      price: tier.price,
    }));
  });
}

// Publishing locks the layout and materialises one Seat document per seat.
// The draft->published transition is a conditional update so two concurrent
// publish requests can't both generate seats; the unique (event,label) index
// is the second line of defence.
export async function publishEvent(event) {
  if (event.startsAt <= new Date()) throw AppError.badRequest('Cannot publish an event that starts in the past');

  const claimed = await Event.findOneAndUpdate(
    { _id: event._id, status: 'draft' },
    { status: 'published', publishedAt: new Date() },
    { new: true },
  );
  if (!claimed) throw AppError.conflict('Only draft events can be published');

  try {
    await Seat.insertMany(buildSeats(claimed), { ordered: true });
  } catch (err) {
    // Roll back so the organizer can retry from a clean draft.
    await Seat.deleteMany({ event: claimed._id });
    await Event.updateOne({ _id: claimed._id }, { status: 'draft', $unset: { publishedAt: 1 } });
    throw err;
  }
  return claimed;
}

// Seat counts per event, with expired holds counted as available.
export async function availabilityFor(eventIds) {
  const now = new Date();
  const ids = eventIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const rows = await Seat.aggregate([
    { $match: { event: { $in: ids } } },
    {
      $group: {
        _id: '$event',
        total: { $sum: 1 },
        sold: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] } },
        held: {
          $sum: { $cond: [{ $and: [{ $eq: ['$status', 'held'] }, { $gt: ['$holdExpiresAt', now] }] }, 1, 0] },
        },
      },
    },
  ]);
  const map = new Map(rows.map((r) => [String(r._id), { total: r.total, sold: r.sold, held: r.held, available: r.total - r.sold - r.held }]));
  return (id) => map.get(String(id)) ?? null;
}

export async function seatMapFor(eventId, viewerHoldId = null) {
  const now = new Date();
  const seats = await Seat.find({ event: eventId }).sort({ row: 1, number: 1 }).lean();
  return seats.map((s) => {
    const status = effectiveStatus(s, now);
    return {
      id: s._id,
      label: s.label,
      row: s.row,
      number: s.number,
      tier: s.tier,
      price: s.price,
      status,
      mine: status === 'held' && viewerHoldId != null && String(s.hold) === String(viewerHoldId),
    };
  });
}

export function minPrice(event) {
  return Math.min(...event.tiers.map((t) => t.price));
}
