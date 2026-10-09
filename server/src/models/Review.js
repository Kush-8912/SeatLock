import mongoose from 'mongoose';

// A rating from someone who was checked in at a show. `series` is the
// event's series key, so all showtimes of one production share reviews.
const reviewSchema = new mongoose.Schema(
  {
    series: { type: mongoose.Schema.Types.ObjectId, required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, trim: true, maxlength: 1000, default: '' },
    // Optional detail: 1-5 for each part of the night, whether they'd
    // recommend it, and a note only the organizer sees.
    aspects: {
      performance: { type: Number, min: 1, max: 5 },
      venue: { type: Number, min: 1, max: 5 },
      value: { type: Number, min: 1, max: 5 },
    },
    recommend: { type: Boolean, default: null },
    privateNote: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true, versionKey: false },
);

reviewSchema.index({ series: 1, user: 1 }, { unique: true });
reviewSchema.index({ series: 1, createdAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
