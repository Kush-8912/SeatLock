import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarSearch, Search } from 'lucide-react';
import { api, isAbort } from '../lib/api';
import { CATEGORY_LABELS } from '../lib/format';
import { useDebounced } from '../hooks/useDebounced';
import { EventCard } from '../components/EventCard';
import { EmptyState, ErrorState, Spinner } from '../components/States';

const WHEN = {
  any: { label: 'Any date' },
  week: { label: 'Next 7 days', days: 7 },
  month: { label: 'Next 30 days', days: 30 },
};

// Filters live in the URL so searches are shareable and survive refresh/back.
export function HomePage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebounced(q.trim());
  const category = params.get('category') ?? '';
  const city = params.get('city') ?? '';
  const when = params.get('when') ?? 'any';
  const page = Number(params.get('page') ?? 1);

  const [cities, setCities] = useState([]);
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [reload, setReload] = useState(0);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === '' || v == null || (k === 'when' && v === 'any') || (k === 'page' && v === 1)) next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (debouncedQ !== (params.get('q') ?? '')) update({ q: debouncedQ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  useEffect(() => {
    api('/events/cities').then((d) => setCities(d.cities)).catch(() => {});
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ page: String(page) });
    if (params.get('q')) qs.set('q', params.get('q'));
    if (category) qs.set('category', category);
    if (city) qs.set('city', city);
    if (WHEN[when]?.days) qs.set('to', new Date(Date.now() + WHEN[when].days * 86_400_000).toISOString());

    setState((s) => ({ ...s, status: 'loading', error: null }));
    api(`/events?${qs}`, { signal: ctrl.signal })
      .then((data) => setState({ status: 'ok', data, error: null }))
      .catch((error) => !isAbort(error) && setState({ status: 'error', data: null, error }));
    return () => ctrl.abort();
  }, [params, category, city, when, page, reload]);

  const filtered = params.get('q') || category || city || when !== 'any';

  return (
    <div>
      <section className="mb-8 rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-fuchsia-700 px-6 py-10 text-white sm:px-10">
        <h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">Pick your exact seat. We&apos;ll hold it while you pay.</h1>
        <p className="mt-3 max-w-lg text-brand-100">Live seat maps, no double-booking, and a QR ticket that gets you through the door.</p>
        <label className="relative mt-6 block max-w-xl">
          <span className="sr-only">Search events</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by event, artist or venue"
            className="w-full rounded-xl border-0 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-lg placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-white/30"
          />
        </label>
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
          <Chip active={!category} onClick={() => update({ category: '' })}>All</Chip>
          {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
            <Chip key={k} active={category === k} onClick={() => update({ category: k })}>{label}</Chip>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <select className="input w-auto" value={city} onChange={(e) => update({ city: e.target.value })} aria-label="City">
            <option value="">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input w-auto" value={when} onChange={(e) => update({ when: e.target.value })} aria-label="Date">
            {Object.entries(WHEN).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {state.status === 'error' ? (
        <ErrorState error={state.error} onRetry={() => setReload((n) => n + 1)} />
      ) : !state.data ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8 text-brand-600" /></div>
      ) : state.data.items.length === 0 ? (
        <EmptyState
          icon={CalendarSearch}
          title={filtered ? 'No events match your filters' : 'No upcoming events yet'}
          action={filtered && <button type="button" className="btn-secondary" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>Clear filters</button>}
        >
          {filtered ? 'Try a different search, city or date range.' : 'Check back soon — organizers are setting things up.'}
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500" aria-live="polite">
            {state.data.total} event{state.data.total === 1 ? '' : 's'} {state.status === 'loading' && <Spinner className="ml-1 inline h-3.5 w-3.5" />}
          </p>
          <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${state.status === 'loading' ? 'opacity-60' : ''}`}>
            {state.data.items.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
          {state.data.pages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
              <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>Previous</button>
              <span className="text-sm text-slate-600">Page {page} of {state.data.pages}</span>
              <button type="button" className="btn-secondary" disabled={page >= state.data.pages} onClick={() => update({ page: page + 1 })}>Next</button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}
    >
      {children}
    </button>
  );
}
