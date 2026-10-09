import mongoose from 'mongoose';

export const WAITLIST_STATUS = ['waiting', 'notified'];

// One attendee waiting for seats on one sold-out event. Everyone waiting is
// told at the same time when seats free up; the seat map stays first come,
// first served, exactly as it is for everybody else.
const waitlistSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: WAITLIST_STATUS, default: 'waiting' },
    joinedAt: { type: Date, default: Date.now }, // reset on re-joining after a notification
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

waitlistSchema.index({ event: 1, user: 1 }, { unique: true });
waitlistSchema.index({ event: 1, status: 1, joinedAt: 1 });

export const WaitlistEntry = mongoose.model('WaitlistEntry', waitlistSchema);
