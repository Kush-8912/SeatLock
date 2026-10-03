import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, ChevronDown, MapPin, Ticket } from 'lucide-react';
import { api } from '../lib/api';
import { dateTime, money } from '../lib/format';
import { TicketCard } from '../components/TicketCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Badge, EmptyState, ErrorState, PageLoader } from '../components/States';

function OrderCard({ order, cutoffHours, onCancelled, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const event = order.event;
  const past = new Date(event.startsAt) < new Date();
  const cancellable = order.status === 'paid' && event.status === 'published'
    && new Date(event.startsAt).getTime() - cutoffHours * 3_600_000 > Date.now()
    && !order.tickets.some((t) => t.checkedInAt);

  const cancel = async () => {
    setBusy(true);
    try {
      const { order: updated } = await api(`/orders/${order._id}/cancel`, { method: 'POST' });
      toast.success(updated.amount ? `Order cancelled — ${money(updated.amount)} refunded to card ••${updated.payment.last4}` : 'Order cancelled');
      setConfirming(false);
      onCancelled();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const status = event.status === 'cancelled' && order.status === 'refunded' ? 'refunded' : past && order.status === 'paid' ? 'ended' : order.status;

  return (
    <article className="card overflow-hidden">
      <button type="button" className="flex w-full items-center gap-4 p-4 text-left hover:bg-slate-50" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{event.title}</h2>
            <Badge status={status} />
            {event.status === 'cancelled' && <Badge status="cancelled">event cancelled</Badge>}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-slate-500">
            <span>{dateTime(event.startsAt)}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{event.venue.name}</span>
          </p>
          <p className="mt-0.5 text-sm text-slate-600">{order.items.map((i) => i.label).join(', ')} · {money(order.amount)}</p>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {order.tickets.map((t) => <TicketCard key={t._id} ticket={t} eventTitle={event.title} />)}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Order #{order._id.slice(-8).toUpperCase()}
              {order.payment?.last4 && ` · paid with card ••${order.payment.last4}`}
              {order.payment?.refundId && ' · refunded'}
            </span>
            <div className="flex gap-2">
              <Link to={`/events/${event._id}`} className="btn-ghost">View event</Link>
              {cancellable && <button type="button" className="btn-secondary text-rose-600" onClick={() => setConfirming(true)}>Cancel &amp; refund</button>}
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog open={confirming} title="Cancel this order?" confirmLabel="Cancel order" cancelLabel="Keep tickets" danger busy={busy} onConfirm={cancel} onClose={() => setConfirming(false)}>
        All {order.tickets.length} ticket{order.tickets.length > 1 ? 's' : ''} will be voided and {money(order.amount)} refunded. Your seats go back on sale immediately.
      </ConfirmDialog>
    </article>
  );
}

export function TicketsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    api('/orders').then((d) => { setData(d); setError(null); }).catch(setError);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return <PageLoader label="Loading your tickets…" />;

  const now = new Date();
  const upcoming = data.items.filter((o) => new Date(o.event.startsAt) >= now);
  const past = data.items.filter((o) => new Date(o.event.startsAt) < now);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">My tickets</h1>
      <p className="mt-1 text-sm text-slate-500">Show the QR code at the door. You can cancel for a full refund up to {data.cancellationCutoffHours} hours before an event.</p>
      {data.items.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Ticket} title="No tickets yet" action={<Link to="/" className="btn-primary">Browse events</Link>}>
            When you book seats they&apos;ll show up here with their QR codes.
          </EmptyState>
        </div>
      ) : (
        <>
          <Section title="Upcoming" orders={upcoming} cutoff={data.cancellationCutoffHours} onChange={load} openFirst />
          <Section title="Past" orders={past} cutoff={data.cancellationCutoffHours} onChange={load} />
        </>
      )}
    </div>
  );
}

function Section({ title, orders, cutoff, onChange, openFirst }) {
  if (!orders.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="space-y-3">
        {orders.map((o, i) => <OrderCard key={o._id} order={o} cutoffHours={cutoff} onCancelled={onChange} defaultOpen={openFirst && i === 0} />)}
      </div>
    </section>
  );
}

// Confirmation page right after checkout.
export function OrderPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => { api(`/orders/${id}`).then(setData).catch(setError); }, [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return <PageLoader />;
  const { order, tickets } = data;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="card p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden />
        <h1 className="mt-3 text-2xl font-bold">You&apos;re going to {order.event.title}!</h1>
        <p className="mt-1 text-sm text-slate-600">{dateTime(order.event.startsAt)} · {order.event.venue.name}, {order.event.venue.city}</p>
        <p className="mt-1 text-sm text-slate-500">
          {money(order.amount)}{order.payment?.last4 ? ` charged to card ••${order.payment.last4}` : ''} · Order #{order._id.slice(-8).toUpperCase()}
        </p>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tickets.map((t) => <TicketCard key={t._id} ticket={t} eventTitle={order.event.title} />)}
      </div>
      <div className="mt-6 flex justify-center gap-2">
        <Link to="/tickets" className="btn-primary">All my tickets</Link>
        <Link to="/" className="btn-secondary">Browse more events</Link>
      </div>
    </div>
  );
}
