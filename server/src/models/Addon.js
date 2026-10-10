import mongoose from 'mongoose';

// Food, drink or merch sold alongside tickets for one show. `sold` only
// changes through conditional $inc updates, so stock can't be oversold.
const addonSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    kind: { type: String, enum: ['food', 'merch'], default: 'food' },
    price: { type: Number, required: true, min: 1 }, // whole INR
    stock: { type: Number, min: 0, default: null }, // null = unlimited
    sold: { type: Number, min: 0, default: 0 },
    maxPerOrder: { type: Number, min: 1, max: 20, default: 10 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

export const Addon = mongoose.model('Addon', addonSchema);
