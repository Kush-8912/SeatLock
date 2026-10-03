import mongoose from 'mongoose';

export const CATEGORIES = ['music', 'comedy', 'theatre', 'sports', 'tech', 'workshop', 'other'];
export const EVENT_STATUS = ['draft', 'published', 'cancelled'];

const tierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 30 },
    price: { type: Number, required: true, min: 0 }, // whole INR
    color: { type: String, default: '#6366f1' },
  },
  { _id: false },
);

// A row of the seating chart. Seats are numbered 1..seats and all share a tier.
const rowSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 3 },
    seats: { type: Number, required: true, min: 1, max: 60 },
    tier: { type: String, required: true },
  },
  { _id: false },
);

const eventSchema = new mongoose.Schema(
  {
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 4000, default: '' },
    category: { type: String, enum: CATEGORIES, required: true },
    venue: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      city: { type: String, required: true, trim: true, maxlength: 60 },
    },
    startsAt: { type: Date, required: true },
    durationMinutes: { type: Number, min: 15, max: 24 * 60, default: 120 },
    coverImageUrl: { type: String, trim: true, default: '' },
    tiers: { type: [tierSchema], validate: (v) => v.length > 0 },
    rows: { type: [rowSchema], validate: (v) => v.length > 0 },
    status: { type: String, enum: EVENT_STATUS, default: 'draft' },
    publishedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true },
);

eventSchema.index({ status: 1, startsAt: 1 });
eventSchema.index({ 'venue.city': 1 });

eventSchema.virtual('capacity').get(function capacity() {
  return this.rows.reduce((sum, r) => sum + r.seats, 0);
});

// Sales close when the doors open.
eventSchema.methods.isOnSale = function isOnSale(now = new Date()) {
  return this.status === 'published' && this.startsAt > now;
};

eventSchema.set('toJSON', { virtuals: true, versionKey: false });

export const Event = mongoose.model('Event', eventSchema);
