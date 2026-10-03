import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, ExternalLink, Pencil, Rocket, Search, Trash2, XCircle, XOctagon } from 'lucide-react';
import { api } from '../../lib/api';
import { amount, dateTime, money, pct, plural, time } from '../../lib/format';
import { useEventChannel } from '../../hooks/useEventChannel';
import { useDebounced } from '../../hooks/useDebounced';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { QrScanner } from '../../components/QrScanner';
import { SeatMap, previewSeats } from '../../components/SeatMap';
import { Badge, EmptyState, ErrorState, PageLoader, Spinner } from '../../components/States';

export function ManageEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [dialog, setDialog] = useState(null); // 'publish' | 'delete' | 'cancel'
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api(`/events/${id}`)
      .then(({ event: e }) => {
        if (!e.isOwner) throw Object.assign(new Error('You can only manage your own events'), { status: 403 });
        setEvent(e);
        setError(null);
      })
      .catch(setError);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!event) return <PageLoader />;

  const isDraft = event.status === 'draft';
  const upcoming = new Date(event.startsAt) > new Date();

  const act = async (kind) => {
    setBusy(true);
    try {
      if (kind === 'publish') {
        await api(`/events/${id}/publish`, { method: 'POST' });
        toast.success('Published! Tickets are on sale.');
        load();
      } else if (kind === 'delete') {
        await api(`/events/${id}`, { method: 'DELETE' });
        toast.success('Draft deleted');
        navigate('/organizer', { replace: true });
        return;
      } else if (kind === 'cancel') {
        const { refunded } = await api(`/events/${id}/cancel`, { method: 'POST' });
        toast.success(`Event cancelled. ${refunded} order${refunded === 1 ? '' : 's'} refunded.`);
        load();
      }
      setDialog(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link to="/organizer" className="text-sm text-slate-500 hover:text-slate-800">← My events</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <Badge status={event.status} />
          </div>
          <p className="text-sm text-slate-500">{dateTime(event.startsAt)} · {event.venue.name}, {event.venue.city} · {event.capacity} seats</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <>
              <button type="button" className="btn-ghost text-rose-600" onClick={() => setDialog('delete')}><Trash2 className="h-4 w-4" aria-hidden /> Delete</button>
              <Link to={`/organizer/events/${id}/edit`} className="btn-secondary"><Pencil className="h-4 w-4" aria-hidden /> Edit</Link>
              <button type="button" className="btn-primary" onClick={() => setDialog('publish')}><Rocket className="h-4 w-4" aria-hidden /> Publish</button>
            </>
          ) : (
            <>
              <Link to={`/events/${id}`} className="btn-secondary"><ExternalLink className="h-4 w-4" aria-hidden /> Public page</Link>
              {event.status === 'published' && upcoming && (
                <button type="button" className="btn-ghost text-rose-600" onClick={() => setDialog('cancel')}><XOctagon className="h-4 w-4" aria-hidden /> Cancel event</button>
              )}
            </>
          )}
        </div>
      </div>

      {isDraft ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
            This event is a draft and isn&apos;t visible to the public. The layout and prices lock once you publish.
          </p>
          <div className="card p-6"><SeatMap rows={event.rows} tiers={event.tiers} seats={previewSeats(event.rows, event.tiers)} /></div>
        </div>
      ) : (
        <>
          <div className="mt-6 flex gap-1 border-b border-slate-200" role="tablist">
            {[['overview', 'Overview'], ['checkin', 'Check-in'], ['guests', 'Guest list']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-6">
            {tab === 'overview' && <Overview eventId={id} />}
            {tab === 'checkin' && <CheckIn eventId={id} disabled={event.status === 'cancelled'} />}
            {tab === 'guests' && <Guests eventId={id} />}
          </div>
        </>
      )}

      <ConfirmDialog open={dialog === 'publish'} title="Publish this event?" confirmLabel="Publish" busy={busy} onConfirm={() => act('publish')} onClose={() => setDialog(null)}>
        Tickets go on sale immediately. You won&apos;t be able to change the seating layout or prices afterwards.
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'delete'} title="Delete this draft?" confirmLabel="Delete" danger busy={busy} onConfirm={() => act('delete')} onClose={() => setDialog(null)}>
        This can&apos;t be undone.
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'cancel'} title="Cancel this event?" confirmLabel="Cancel event & refund all" cancelLabel="Keep event" danger busy={busy} onConfirm={() => act('cancel')} onClose={() => setDialog(null)}>
        Sales stop immediately, every ticket is voided and every buyer is refunded in full. This can&apos;t be undone.
      </ConfirmDialog>
    </div>
  );
}

function Overview({ eventId }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const load = useCallback(() => {
    api(`/events/${eventId}/stats`).then((d) => { setStats(d.stats); setError(null); }).catch(setError);
  }, [eventId]);
  useEffect(() => { load(); return () => clearTimeout(timer.current); }, [load]);

  // Coalesce bursts of live events into one refetch.
  const refreshSoon = () => { clearTimeout(timer.current); timer.current = setTimeout(load, 800); };
  useEventChannel(eventId, { onSeats: refreshSoon, onCheckin: refreshSoon, onReconnect: load });

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!stats) return <PageLoader />;

  const cards = [
    ['Revenue', amount(stats.revenue), plural(stats.ordersPaid, 'order')],
    ['Tickets sold', `${stats.sold} / ${stats.capacity}`, `${stats.held} on hold right now`],
    ['Sell-through', pct(stats.sellThrough), `${stats.available} seats left`],
    ['Checked in', `${stats.checkins.checkedIn} / ${stats.checkins.issued}`, stats.checkins.issued ? pct(stats.checkins.checkedIn / stats.checkins.issued) : '—'],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value, sub]) => (
          <div key={label} className="card p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{sub}</p>
          </div>
        ))}
      </div>
      {stats.refunds.count > 0 && (
        <p className="text-sm text-slate-500">{stats.refunds.count} order{stats.refunds.count > 1 ? 's' : ''} cancelled · {amount(stats.refunds.amount)} refunded</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Sales by tier</h2>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr><th className="pb-2 font-medium">Tier</th><th className="pb-2 font-medium">Sold</th><th className="pb-2 text-right font-medium">Revenue</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.tiers.map((t) => (
                <tr key={t.tier}>
                  <td className="py-2.5">{t.tier} <span className="text-xs text-slate-400">· {money(t.price)}</span></td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-500" style={{ width: pct(t.sold / t.capacity) }} /></div>
                      <span className="tabular-nums text-slate-600">{t.sold}/{t.capacity}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{amount(t.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Tickets sold per day</h2>
          {stats.salesByDay.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">No sales yet.</p>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.salesByDay} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip formatter={(v) => [v, 'Tickets']} />
                  <Bar dataKey="tickets" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">Recent check-ins</h2>
        {stats.recentCheckins.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nobody has checked in yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {stats.recentCheckins.map((c) => (
              <li key={c.label + c.checkedInAt} className="flex justify-between py-2">
                <span><strong>{c.label}</strong> · {c.attendee}</span><span className="text-slate-500">{time(c.checkedInAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const CHECKIN_MESSAGES = {
  ALREADY_CHECKED_IN: 'Already used',
  WRONG_EVENT: 'Wrong event',
  TICKET_CANCELLED: 'Cancelled ticket',
  INVALID_TICKET: 'Invalid ticket',
};

function CheckIn({ eventId, disabled }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (qr) => {
    if (!qr.trim() || busy) return;
    setBusy(true);
    try {
      const { checkin } = await api(`/events/${eventId}/checkin`, { method: 'POST', body: { qr } });
      setResult({ ok: true, ...checkin });
      setCode('');
    } catch (err) {
      setResult({ ok: false, title: CHECKIN_MESSAGES[err.code] ?? 'Could not check in', message: err.message, details: err.details });
    } finally {
      setBusy(false);
    }
  };

  if (disabled) return <EmptyState icon={XOctagon} title="Event cancelled">Check-in is disabled for cancelled events.</EmptyState>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Scan ticket QR</h2>
        <QrScanner onScan={submit} paused={busy} />
        <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(code); }}>
          <label className="sr-only" htmlFor="code">Ticket code</label>
          <input id="code" className="input font-mono" placeholder="Or paste a ticket code: SL1.…" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn-secondary whitespace-nowrap" disabled={busy || !code.trim()}>{busy ? <Spinner className="h-4 w-4" /> : 'Check in'}</button>
        </form>
      </section>
      <section aria-live="assertive">
        {!result ? (
          <div className="card flex h-full min-h-64 items-center justify-center p-8 text-center text-sm text-slate-500">Scan a ticket to see the result here.</div>
        ) : result.ok ? (
          <div className="card flex h-full min-h-64 flex-col items-center justify-center border-emerald-300 bg-emerald-50 p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-600" aria-hidden />
            <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">Admit</p>
            <p className="mt-1 text-4xl font-bold">{result.label}</p>
            <p className="mt-1 text-slate-700">{result.attendee} · {result.tier}</p>
          </div>
        ) : (
          <div className="card flex h-full min-h-64 flex-col items-center justify-center border-rose-300 bg-rose-50 p-8 text-center">
            <XCircle className="h-16 w-16 text-rose-600" aria-hidden />
            <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-rose-700">Do not admit — {result.title}</p>
            <p className="mt-2 text-slate-700">{result.message}</p>
            {result.details?.checkedInAt && (
              <p className="mt-1 text-sm text-slate-600">First scanned at {time(result.details.checkedInAt)}{result.details.attendee && ` · ${result.details.attendee}`}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Guests({ eventId }) {
  const [q, setQ] = useState('');
  const debounced = useDebounced(q.trim());
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api(`/events/${eventId}/attendees${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`, { signal: ctrl.signal })
      .then((d) => { setItems(d.items); setError(null); })
      .catch((err) => err.name !== 'AbortError' && setError(err));
    return () => ctrl.abort();
  }, [eventId, debounced]);

  return (
    <section className="card p-5">
      <label className="relative block max-w-sm">
        <span className="sr-only">Search guests</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input className="input pl-9" placeholder="Search name, email or seat" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {error ? <ErrorState error={error} /> : !items ? <PageLoader /> : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">{debounced ? 'No guests match that search.' : 'No tickets sold yet.'}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr><th className="pb-2 font-medium">Seat</th><th className="pb-2 font-medium">Guest</th><th className="pb-2 font-medium">Tier</th><th className="pb-2 font-medium">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((t) => (
                <tr key={t._id}>
                  <td className="py-2 font-semibold">{t.label}</td>
                  <td className="py-2">{t.user?.name}<div className="text-xs text-slate-500">{t.user?.email}</div></td>
                  <td className="py-2">{t.tier}</td>
                  <td className="py-2">{t.checkedInAt ? <Badge status="used">In at {time(t.checkedInAt)}</Badge> : <Badge status="draft">Not arrived</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
