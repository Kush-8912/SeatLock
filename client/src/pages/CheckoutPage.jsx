import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CreditCard, Lock, TimerOff } from 'lucide-react';
import { api } from '../lib/api';
import { dateTime, money } from '../lib/format';
import { mmss, useCountdown } from '../hooks/useCountdown';
import { ErrorState, FieldError, PageLoader, Spinner } from '../components/States';

const TEST_CARDS = [
  ['4242 4242 4242 4242', 'Succeeds'],
  ['4000 0000 0000 0002', 'Declined'],
  ['4000 0000 0000 9995', 'Insufficient funds'],
  ['4000 0000 0000 0119', 'Gateway error'],
];

const newKey = () => crypto.randomUUID();

export function CheckoutPage() {
  const { holdId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [card, setCard] = useState({ number: '', exp: '', cvc: '', name: '' });
  const [payError, setPayError] = useState(null);
  const [busy, setBusy] = useState(false);
  // The same key is reused if a request fails in transit (so a retry can never
  // double-charge) and replaced after a definitive answer from the server.
  const keyRef = useRef(newKey());

  const load = useCallback(async () => {
    try {
      setData(await api(`/holds/${holdId}`));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [holdId]);
  useEffect(() => { load(); }, [load]);

  const left = useCountdown(data?.hold.expiresAt);
  const expired = data && (data.hold.status !== 'active' || left === 0);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return <PageLoader label="Loading your seats…" />;

  if (data.hold.status === 'converted') {
    return (
      <ErrorState title="Already purchased" error={{ message: 'These seats have already been paid for.' }} />
    );
  }

  if (expired) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <TimerOff className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold">Your hold has expired</h1>
        <p className="mt-1 text-sm text-slate-600">We released your seats so others could book them. They may still be available.</p>
        <Link to={`/events/${data.hold.event}`} className="btn-primary mt-6">Pick seats again</Link>
      </div>
    );
  }

  const free = data.total === 0;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setPayError(null);
    const [mm, yy] = card.exp.split('/').map((s) => s.trim());
    const body = free ? {} : {
      card: { number: card.number, expMonth: Number(mm), expYear: 2000 + Number(yy), cvc: card.cvc, name: card.name },
    };
    try {
      const res = await api(`/holds/${holdId}/checkout`, { method: 'POST', body, headers: { 'Idempotency-Key': keyRef.current } });
      toast.success('Payment successful — your tickets are ready!');
      navigate(`/orders/${res.order._id}`, { replace: true });
    } catch (err) {
      if (err.code !== 'NETWORK' && err.status < 500) keyRef.current = newKey();
      if (err.code === 'HOLD_EXPIRED') { load(); return; }
      setPayError(err);
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    try {
      await api(`/holds/${holdId}`, { method: 'DELETE' });
    } catch { /* already released or expired: either way, go back */ }
    navigate(`/events/${data.hold.event}`);
  };

  const fe = payError?.fieldErrors ?? {};
  const urgent = left < 60;

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_20rem]">
      <form onSubmit={submit} noValidate className="card order-2 p-6 md:order-1">
        <h1 className="flex items-center gap-2 text-xl font-bold"><CreditCard className="h-5 w-5" aria-hidden /> Payment</h1>
        {free ? (
          <p className="mt-4 text-sm text-slate-600">This event is free — just confirm to get your tickets.</p>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="cc-name">Name on card</label>
              <input id="cc-name" className={`input ${fe['card.name'] ? 'input-error' : ''}`} autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
              <FieldError message={fe['card.name']} />
            </div>
            <div>
              <label className="label" htmlFor="cc-number">Card number</label>
              <input id="cc-number" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" className={`input font-mono ${fe['card.number'] ? 'input-error' : ''}`}
                value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, '').slice(0, 23) })} />
              <FieldError message={fe['card.number']} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="cc-exp">Expiry (MM/YY)</label>
                <input id="cc-exp" inputMode="numeric" autoComplete="cc-exp" placeholder="12/29" className={`input font-mono ${fe['card.expMonth'] || fe['card.expYear'] ? 'input-error' : ''}`}
                  value={card.exp} onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setCard({ ...card, exp: digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits });
                  }} />
                <FieldError message={fe['card.expMonth'] || fe['card.expYear']} />
              </div>
              <div>
                <label className="label" htmlFor="cc-cvc">CVC</label>
                <input id="cc-cvc" inputMode="numeric" autoComplete="cc-csc" placeholder="123" className={`input font-mono ${fe['card.cvc'] ? 'input-error' : ''}`}
                  value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
                <FieldError message={fe['card.cvc']} />
              </div>
            </div>
            <details className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold text-slate-700">Demo test cards (any future expiry, any CVC)</summary>
              <ul className="mt-2 space-y-1">
                {TEST_CARDS.map(([n, label]) => (
                  <li key={n}>
                    <button type="button" className="font-mono text-brand-700 hover:underline" onClick={() => setCard({ number: n, exp: '12/30', cvc: '123', name: card.name || 'Demo Buyer' })}>{n}</button> — {label}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}

        {payError && !Object.keys(fe).length && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {payError.message}
            {payError.code === 'PAYMENT_FAILED' && `${payError.message.endsWith('.') ? '' : '.'} Your seats are still held — you can try another card.`}
          </p>
        )}

        <button className="btn-primary mt-6 w-full py-3" disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : <Lock className="h-4 w-4" aria-hidden />}
          {busy ? 'Processing…' : free ? 'Confirm free tickets' : `Pay ${money(data.total)}`}
        </button>
        <button type="button" className="btn-ghost mt-2 w-full" onClick={release} disabled={busy}>Cancel and release seats</button>
      </form>

      <aside className="order-1 space-y-4 md:order-2">
        <div className={`card p-4 text-center ${urgent ? 'border-rose-300 bg-rose-50' : ''}`} role="timer" aria-live={urgent ? 'assertive' : 'off'}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seats held for</p>
          <p className={`mt-1 text-3xl font-bold tabular-nums ${urgent ? 'text-rose-600' : ''}`}>{mmss(left)}</p>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">{data.event.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{dateTime(data.event.startsAt)} · {data.event.venue.name}</p>
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {data.seats.map((s) => (
              <li key={s._id} className="flex justify-between py-2">
                <span><strong>{s.label}</strong> <span className="text-slate-500">· {s.tier}</span></span>
                <span>{money(s.price)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 font-semibold">
            <span>Total</span><span>{money(data.total)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
