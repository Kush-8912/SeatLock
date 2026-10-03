import mongoose from 'mongoose';

export const TICKET_STATUS = ['valid', 'cancelled'];

const ticketSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seat: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat', required: true },
    label: { type: String, required: true },
    tier: String,
    price: Number,
    status: { type: String, enum: TICKET_STATUS, default: 'valid' },
    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

ticketSchema.index({ event: 1, status: 1, checkedInAt: 1 });

export const Ticket = mongoose.model('Ticket', ticketSchema);
