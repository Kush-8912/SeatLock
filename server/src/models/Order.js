import mongoose from 'mongoose';

export const ORDER_STATUS = ['pending', 'paid', 'failed', 'cancelled', 'refunded'];

const itemSchema = new mongoose.Schema(
  {
    seat: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat', required: true },
    label: String,
    tier: String,
    price: Number,
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    hold: { type: mongoose.Schema.Types.ObjectId, ref: 'Hold', required: true },
    items: [itemSchema],
    amount: { type: Number, required: true, min: 0 }, // whole INR, snapshotted at purchase
    status: { type: String, enum: ORDER_STATUS, default: 'pending' },
    // Client-generated key; retries of the same checkout return the same order.
    idempotencyKey: { type: String, required: true },
    payment: {
      provider: { type: String, default: 'mock' },
      chargeId: String,
      last4: String,
      refundId: String,
    },
    failureReason: String,
    paidAt: Date,
    cancelledAt: Date,
    cancelledBy: { type: String, enum: ['attendee', 'organizer'] },
  },
  { timestamps: true, versionKey: false },
);

orderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ event: 1, status: 1, paidAt: 1 });

export const Order = mongoose.model('Order', orderSchema);
