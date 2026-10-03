import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy } from 'lucide-react';
import { Badge } from './States';
import { time } from '../lib/format';

export function TicketCard({ ticket, eventTitle }) {
  const [copied, setCopied] = useState(false);
  const used = Boolean(ticket.checkedInAt);
  const status = ticket.status === 'cancelled' ? 'cancelled' : used ? 'used' : 'valid';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ticket.qr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked; code is still visible to select */ }
  };

  return (
    <div className={`flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white p-4 ${status !== 'valid' ? 'opacity-60' : ''}`}>
      <div className="flex w-full items-center justify-between">
        <div>
          <p className="text-2xl font-bold">{ticket.label}</p>
          <p className="text-xs text-slate-500">{ticket.tier}</p>
        </div>
        <Badge status={status}>{used ? `Checked in ${time(ticket.checkedInAt)}` : status}</Badge>
      </div>
      {ticket.qr ? (
        <>
          <QRCodeSVG value={ticket.qr} size={168} level="M" marginSize={2} className="mt-3 rounded" title={`Ticket ${ticket.label} for ${eventTitle}`} />
          <button type="button" onClick={copy} className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy code'}
          </button>
        </>
      ) : (
        <p className="mt-6 py-10 text-sm text-slate-500">This ticket is no longer valid.</p>
      )}
    </div>
  );
}
