import { amount } from '../lib/format';

/**
 * The price breakdown printed on receipts: tickets, promo, add-ons, booking
 * fee and GST. Works for a checkout quote and for a stored order.
 */
export function BillLines({ bill, promoCode, className = '' }) {
  const addons = bill.addons ?? [];
  const fee = bill.bookingFee ?? 0;
  const gst = bill.gst ?? 0;
  if (!bill.discount && !addons.length && !fee && !gst) return null;
  const row = 'flex justify-between gap-3';
  return (
    <div className={`mt-3 space-y-1 font-mono text-sm ${className}`}>
      <div className={`${row} text-paper-ink/60`}><span>Tickets</span><span>{amount(bill.subtotal ?? 0)}</span></div>
      {bill.discount > 0 && <div className={`${row} text-emerald-800`}><span>Promo {promoCode}</span><span>−{amount(bill.discount)}</span></div>}
      {addons.map((a) => (
        <div key={String(a.addon)} className={`${row} text-paper-ink/60`}><span className="truncate">{a.name} × {a.qty}</span><span>{amount(a.price * a.qty)}</span></div>
      ))}
      {fee > 0 && <div className={`${row} text-paper-ink/60`}><span>Booking fee{bill.feePercent ? ` (${bill.feePercent}%)` : ''}</span><span>{amount(fee)}</span></div>}
      {gst > 0 && <div className={`${row} text-paper-ink/60`}><span>GST on fee (18%)</span><span>{amount(gst)}</span></div>}
    </div>
  );
}
