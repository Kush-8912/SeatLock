import mongoose from 'mongoose';

export const HOLD_STATUS = ['active', 'converted', 'released', 'expired'];

// A temporary reservation of seats while the buyer checks out.
const holdSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    seats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Seat' }],
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: HOLD_STATUS, default: 'active' },
  },
  { timestamps: true, versionKey: false },
);

// At most one active hold per user per event. This also makes two racing
// "hold" requests from the same user fail cleanly instead of leaking seats.
holdSchema.index({ user: 1, event: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
holdSchema.index({ status: 1, expiresAt: 1 });

holdSchema.methods.isLive = function isLive(now = new Date()) {
  return this.status === 'active' && this.expiresAt > now;
};

export const Hold = mongoose.model('Hold', holdSchema);
