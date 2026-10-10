import mongoose from 'mongoose';

// "I'm interested": one per user per series (all showtimes of an event).
const interestSchema = new mongoose.Schema(
  {
    series: { type: mongoose.Schema.Types.ObjectId, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);

interestSchema.index({ series: 1, user: 1 }, { unique: true });
interestSchema.index({ user: 1, createdAt: -1 });
interestSchema.index({ series: 1, createdAt: -1 });

export const Interest = mongoose.model('Interest', interestSchema);
