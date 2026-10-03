import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { api } from '../../lib/api';
import { CATEGORY_LABELS } from '../../lib/format';
import { SeatMap, previewSeats } from '../../components/SeatMap';
import { ErrorState, FieldError, PageLoader, Spinner } from '../../components/States';

const PALETTE = ['#e11d48', '#7c3aed', '#0891b2', '#ea580c', '#16a34a', '#ca8a04'];
const MAX_CAPACITY = 1500;

const toLocalInput = (iso) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const blank = () => ({
  title: '', description: '', category: 'music', venue: { name: '', city: '' },
  startsAt: toLocalInput(Date.now() + 14 * 86_400_000).slice(0, 11) + '19:00', durationMinutes: 120, coverImageUrl: '',
  tiers: [{ name: 'Premium', price: 1500, color: PALETTE[1] }, { name: 'Standard', price: 700, color: PALETTE[2] }],
  rows: [
    ...'ABC'.split('').map((label) => ({ label, seats: 12, tier: 'Premium' })),
    ...'DEFG'.split('').map((label) => ({ label, seats: 14, tier: 'Standard' })),
  ],
});

// Next row label after the last one: A..Z, then AA, AB, ...
function nextLabel(rows) {
  const last = rows.at(-1)?.label;
  if (!last) return 'A';
  if (/^[A-Y]$/.test(last)) return String.fromCharCode(last.charCodeAt(0) + 1);
  if (last === 'Z') return 'AA';
  if (/^[A-Z]{2}$/.test(last) && last[1] !== 'Z') return last[0] + String.fromCharCode(last.charCodeAt(1) + 1);
  return `${last}1`.slice(0, 3);
}

export function EventEditor() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(editing ? null : blank());
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState({ count: 3, seats: 12, tier: '' });

  useEffect(() => {
    if (!editing) return;
    api(`/events/${id}`)
      .then(({ event }) => {
        if (event.status !== 'draft') { navigate(`/organizer/events/${id}`, { replace: true }); return; }
        setForm({ ...event, startsAt: toLocalInput(event.startsAt) });
      })
      .catch(setLoadError);
  }, [editing, id, navigate]);

  const seats = useMemo(() => (form ? previewSeats(form.rows, form.tiers) : []), [form]);

  if (loadError) return <ErrorState error={loadError} />;
  if (!form) return <PageLoader />;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setTier = (i, patch) => {
    const old = form.tiers[i].name;
    const tiers = form.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t));
    // Renaming a tier carries its rows along.
    const rows = patch.name !== undefined ? form.rows.map((r) => (r.tier === old ? { ...r, tier: patch.name } : r)) : form.rows;
    set({ tiers, rows });
  };
  const setRow = (i, patch) => set({ rows: form.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const capacity = seats.length;

  const generateRows = () => {
    const tier = gen.tier || form.tiers.at(-1)?.name;
    const rows = [...form.rows];
    for (let n = 0; n < gen.count; n += 1) rows.push({ label: nextLabel(rows), seats: Number(gen.seats), tier });
    set({ rows });
  };

  const fe = error?.fieldErrors ?? {};
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      title: form.title, description: form.description, category: form.category,
      venue: form.venue, startsAt: new Date(form.startsAt).toISOString(),
      durationMinutes: Number(form.durationMinutes), coverImageUrl: form.coverImageUrl.trim(),
      tiers: form.tiers.map((t) => ({ name: t.name, price: Number(t.price), color: t.color })),
      rows: form.rows.map((r) => ({ label: r.label, seats: Number(r.seats), tier: r.tier })),
    };
    try {
      const { event } = await api(editing ? `/events/${id}` : '/events', { method: editing ? 'PATCH' : 'POST', body });
      toast.success(editing ? 'Draft saved' : 'Draft created — review it and publish when ready');
      navigate(`/organizer/events/${event.id}`);
    } catch (err) {
      setError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{editing ? 'Edit draft' : 'New event'}</h1>
        <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Save draft</button>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <p className="font-semibold">{error.message}</p>
          {Array.isArray(error.details) && (
            <ul className="mt-1 list-inside list-disc">{error.details.map((d) => <li key={d.field + d.message}>{d.field && <code>{d.field}</code>} {d.message}</li>)}</ul>
          )}
        </div>
      )}

      <section className="card grid gap-4 p-6 md:grid-cols-2">
        <h2 className="font-semibold md:col-span-2">Basics</h2>
        <div className="md:col-span-2">
          <label className="label" htmlFor="title">Title</label>
          <input id="title" className={`input ${fe.title ? 'input-error' : ''}`} value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} />
          <FieldError message={fe.title} />
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <select id="category" className="input" value={form.category} onChange={(e) => set({ category: e.target.value })}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="startsAt">Starts</label>
            <input id="startsAt" type="datetime-local" className={`input ${fe.startsAt ? 'input-error' : ''}`} value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
            <FieldError message={fe.startsAt} />
          </div>
          <div>
            <label className="label" htmlFor="duration">Duration (min)</label>
            <input id="duration" type="number" min={15} max={1440} className="input" value={form.durationMinutes} onChange={(e) => set({ durationMinutes: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="venue">Venue</label>
          <input id="venue" className={`input ${fe['venue.name'] ? 'input-error' : ''}`} value={form.venue.name} onChange={(e) => set({ venue: { ...form.venue, name: e.target.value } })} />
          <FieldError message={fe['venue.name']} />
        </div>
        <div>
          <label className="label" htmlFor="city">City</label>
          <input id="city" className={`input ${fe['venue.city'] ? 'input-error' : ''}`} value={form.venue.city} onChange={(e) => set({ venue: { ...form.venue, city: e.target.value } })} />
          <FieldError message={fe['venue.city']} />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="desc">Description</label>
          <textarea id="desc" rows={4} className="input" value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={4000} />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="cover">Cover image URL <span className="font-normal text-slate-400">(optional)</span></label>
          <input id="cover" type="url" className={`input ${fe.coverImageUrl ? 'input-error' : ''}`} placeholder="https://…" value={form.coverImageUrl} onChange={(e) => set({ coverImageUrl: e.target.value })} />
          <FieldError message={fe.coverImageUrl} />
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ticket tiers</h2>
          <button type="button" className="btn-ghost" disabled={form.tiers.length >= 6}
            onClick={() => set({ tiers: [...form.tiers, { name: `Tier ${form.tiers.length + 1}`, price: 500, color: PALETTE[form.tiers.length % PALETTE.length] }] })}>
            <Plus className="h-4 w-4" aria-hidden /> Add tier
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {form.tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="color" aria-label="Tier colour" className="h-9 w-10 cursor-pointer rounded border border-slate-300" value={t.color} onChange={(e) => setTier(i, { color: e.target.value })} />
              <input aria-label="Tier name" className="input flex-1" value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} maxLength={30} />
              <div className="relative w-32">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                <input aria-label="Price" type="number" min={0} step={1} className="input pl-7" value={t.price} onChange={(e) => setTier(i, { price: e.target.value })} />
              </div>
              <button type="button" className="btn-ghost px-2" aria-label={`Remove ${t.name}`} disabled={form.tiers.length === 1}
                onClick={() => set({ tiers: form.tiers.filter((_, j) => j !== i), rows: form.rows.filter((r) => r.tier !== t.name) })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <p className="text-xs text-slate-500">Set a price of 0 for free seats. Removing a tier removes its rows.</p>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Seating layout</h2>
          <span className={`text-sm ${capacity > MAX_CAPACITY ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>{capacity} / {MAX_CAPACITY} seats</span>
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-[22rem_1fr]">
          <div>
            <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
              <label className="text-xs">Add
                <input type="number" min={1} max={20} className="input mt-1 w-16" value={gen.count} onChange={(e) => setGen({ ...gen, count: e.target.value })} />
              </label>
              <label className="text-xs">rows of
                <input type="number" min={1} max={60} className="input mt-1 w-16" value={gen.seats} onChange={(e) => setGen({ ...gen, seats: e.target.value })} />
              </label>
              <label className="text-xs">in
                <select className="input mt-1 w-28" value={gen.tier || form.tiers.at(-1)?.name} onChange={(e) => setGen({ ...gen, tier: e.target.value })}>
                  {form.tiers.map((t) => <option key={t.name}>{t.name}</option>)}
                </select>
              </label>
              <button type="button" className="btn-secondary" onClick={generateRows}><Wand2 className="h-4 w-4" aria-hidden /> Add</button>
            </div>
            <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
              {form.rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input aria-label="Row label" className="input w-14 text-center font-semibold uppercase" value={r.label} maxLength={3} onChange={(e) => setRow(i, { label: e.target.value.toUpperCase() })} />
                  <input aria-label="Seats in row" type="number" min={1} max={60} className="input w-20" value={r.seats} onChange={(e) => setRow(i, { seats: e.target.value })} />
                  <select aria-label="Row tier" className="input flex-1" value={r.tier} onChange={(e) => setRow(i, { tier: e.target.value })}>
                    {form.tiers.map((t) => <option key={t.name}>{t.name}</option>)}
                  </select>
                  <button type="button" className="btn-ghost px-2" aria-label={`Remove row ${r.label}`} disabled={form.rows.length === 1} onClick={() => set({ rows: form.rows.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 p-4">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
            <SeatMap rows={form.rows} tiers={form.tiers.map((t) => ({ ...t, price: Number(t.price) }))} seats={seats} />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Save draft</button>
      </div>
    </form>
  );
}
