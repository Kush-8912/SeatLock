import mongoose from 'mongoose';

export const PROMO_KINDS = ['percent', 'flat'];

// A discount code scoped to one event. `uses` is only ever changed with
// conditional $inc updates, so a code with maxUses can't be over-redeemed
// by concurrent checkouts.
const promoSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 24 },
    kind: { type: String, enum: PROMO_KINDS, required: true },
    value: { type: Number, required: true, min: 1 }, // percent (1-100) or whole INR
    maxUses: { type: Number, min: 1, default: null }, // null = unlimited
    uses: { type: Number, min: 0, default: 0 },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

promoSchema.index({ event: 1, code: 1 }, { unique: true });

export const PromoCode = mongoose.model('PromoCode', promoSchema);
