import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDays, Clock, MapPin, Settings, Timer } from 'lucide-react';
import { api } from '../lib/api';
import { CATEGORY_LABELS, dateLong, money, time } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useEventChannel } from '../hooks/useEventChannel';
import { mmss, useCountdown } from '../hooks/useCountdown';
import { SeatMap } from '../components/SeatMap';
import { ErrorState, PageLoader, Spinner } from '../components/States';

const MAX_SEATS = 8; // mirrors the server limit; the server stays authoritative

export function EventPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  // Our own hold request broadcasts 'held' for our seats before the HTTP
  // response arrives; those must not be reported as taken by someone else.
  const holdingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await api(`/events/${id}`);
      setData(d);
      setSeats(d.seats);
      setError(null);
      // Drop selections that are no longer available after a refresh.
      setSelected((prev) => new Set([...prev].filter((sid) => d.seats.some((s) => String(s.id) === sid && s.status === 'available'))));
    } catch (err) {
      setError(err);
    }
  }, [id]);

  useEffect(() => { load(); }, [load, user]);

  // Live updates: merge status changes from other buyers into the map.
  useEventChannel(id, {
    onSeats: (changes) => {
      const byId = new Map(changes.map((c) => [String(c.id), c.status]));
      setSeats((prev) => prev.map((s) => {
        const status = byId.get(String(s.id));
        if (!status) return s;
        return { ...s, status, mine: status === 'held' ? s.mine : false };
      }));
      // Side effects stay outside state updaters (StrictMode runs updaters twice).
      const lost = holdingRef.current ? [] : [...selected].filter((sid) => byId.has(sid) && byId.get(sid) !== 'available');
      if (lost.length) {
        const labels = seats.filter((s) => lost.includes(String(s.id))).map((s) => s.label);
        toast.warning(`${labels.join(', ') || 'A seat you picked'} ${labels.length > 1 ? 'were' : 'was'} just taken by someone else`);
        setSelected((prev) => new Set([...prev].filter((sid) => !lost.includes(sid))));
      }
    },
    onReconnect: load,
  });

  const toggle = useCallback((seat) => {
    const key = String(seat.id);
    if (!selected.has(key) && selected.size >= MAX_SEATS) {
      toast.error(`You can pick up to ${MAX_SEATS} seats per order`);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [selected]);

  const picked = useMemo(() => seats.filter((s) => selected.has(String(s.id))), [seats, selected]);
  const total = picked.reduce((s, x) => s + x.price, 0);

  const holdSeats = async () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/events/${id}`)}`);
      return;
    }
    setBusy(true);
    holdingRef.current = true;
    try {
      const { hold } = await api(`/events/${id}/holds`, { method: 'POST', body: { seatIds: [...selected] } });
      navigate(`/checkout/${hold._id}`);
    } catch (err) {
      holdingRef.current = false;
      if (err.code === 'SEATS_UNAVAILABLE') {
        const lost = new Set(err.details.seatIds.map(String));
        setSeats((prev) => prev.map((s) => (lost.has(String(s.id)) ? { ...s, status: 'held', mine: false } : s)));
        setSelected((prev) => new Set([...prev].filter((sid) => !lost.has(sid))));
      }
      toast.error(err.message);
      if (err.code === 'NOT_ON_SALE') load();
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return <PageLoader label="Loading seat map…" />;

  const { event, hold } = data;
  const available = seats.filter((s) => s.status === 'available').length;
  const canBuy = event.onSale && !event.isOwner && user?.role !== 'organizer';

  return (
    <div className="pb-28">
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          <p className="text-sm font-semibold text-brand-600">{CATEGORY_LABELS[event.category]}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{event.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden /> {dateLong(event.startsAt)}</span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden /> {time(event.startsAt)} · {event.durationMinutes} min</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden /> {event.venue.name}, {event.venue.city}</span>
          </div>
        </div>
        <div className="flex items-start lg:justify-end">
          {event.isOwner && (
            <Link to={`/organizer/events/${event.id}`} className="btn-secondary"><Settings className="h-4 w-4" aria-hidden /> Manage event</Link>
          )}
        </div>
      </div>

      <StatusBanner event={event} available={available} isOrganizer={user?.role === 'organizer' && !event.isOwner} />
      {hold && <ActiveHoldBanner hold={hold} onReleased={load} />}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section className="card p-4 sm:p-6" aria-label="Seat map">
          {event.status === 'draft' ? (
            <p className="py-10 text-center text-sm text-slate-500">This is a draft. Seats are created when you publish it.</p>
          ) : (
            <SeatMap rows={event.rows} tiers={event.tiers} seats={seats} selected={selected} onToggle={canBuy ? toggle : undefined} />
          )}
        </section>
        <aside className="space-y-4">
          {event.coverImageUrl && <img src={event.coverImageUrl} alt="" className="aspect-video w-full rounded-xl object-cover" />}
          <div className="card p-5">
            <h2 className="font-semibold">About this event</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{event.description || 'No description provided.'}</p>
            <p className="mt-4 text-xs text-slate-500">Hosted by {event.organizer?.name}</p>
          </div>
        </aside>
      </div>

      {canBuy && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              {picked.length ? (
                <>
                  <p className="truncate text-sm font-semibold">{picked.map((s) => s.label).join(', ')}</p>
                  <p className="text-xs text-slate-500">{picked.length} seat{picked.length > 1 ? 's' : ''} · {money(total)}</p>
                </>
              ) : (
                <p className="text-sm text-slate-500">Tap seats on the map to select them</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {picked.length > 0 && <button type="button" className="btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>}
              <button type="button" className="btn-primary" disabled={!picked.length || busy} onClick={holdSeats}>
                {busy ? <Spinner className="h-4 w-4" /> : <Timer className="h-4 w-4" aria-hidden />} Hold &amp; checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBanner({ event, available, isOrganizer }) {
  let msg = null;
  let tone = 'bg-amber-50 text-amber-800 ring-amber-200';
  if (event.status === 'cancelled') { msg = 'This event has been cancelled. All ticket holders have been refunded.'; tone = 'bg-rose-50 text-rose-800 ring-rose-200'; }
  else if (event.status === 'draft') msg = 'Draft preview — only you can see this page.';
  else if (!event.onSale) msg = 'Ticket sales for this event have closed.';
  else if (available === 0) msg = 'Sold out. Seats on hold may come back if buyers don’t complete checkout — this map updates live.';
  else if (isOrganizer) msg = 'You’re signed in as an organizer. Use an attendee account to buy tickets.';
  if (!msg) return null;
  return <p className={`mt-6 rounded-lg px-4 py-3 text-sm ring-1 ${tone}`} role="status">{msg}</p>;
}

function ActiveHoldBanner({ hold, onReleased }) {
  const left = useCountdown(hold.expiresAt);
  const [busy, setBusy] = useState(false);
  if (left === 0) return null;
  const release = async () => {
    setBusy(true);
    try {
      await api(`/holds/${hold._id}`, { method: 'DELETE' });
      toast.success('Seats released');
      onReleased();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-50 px-4 py-3 ring-1 ring-brand-100">
      <p className="text-sm text-brand-800">
        You&apos;re holding <strong>{hold.seats.length} seat{hold.seats.length > 1 ? 's' : ''}</strong> for another <strong className="tabular-nums">{mmss(left)}</strong>.
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" onClick={release} disabled={busy}>Release</button>
        <Link to={`/checkout/${hold._id}`} className="btn-primary">Continue to checkout</Link>
      </div>
    </div>
  );
}
