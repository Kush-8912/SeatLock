import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { Badge, EmptyState, ErrorState, PageLoader } from '../../components/States';

export function OrganizerHome() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => { api('/events/mine').then((d) => { setItems(d.items); setError(null); }).catch(setError); }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!items) return <PageLoader />;

  const now = new Date();
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My events</h1>
          <p className="text-sm text-slate-500">Create events, track sales and check guests in at the door.</p>
        </div>
        <Link to="/organizer/events/new" className="btn-primary"><CalendarPlus className="h-4 w-4" aria-hidden /> New event</Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={CalendarPlus} title="No events yet" action={<Link to="/organizer/events/new" className="btn-primary">Create your first event</Link>}>
            Design your seating layout, set ticket prices, then publish when you&apos;re ready to sell.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((e) => {
            const a = e.availability;
            const soldPct = a ? (a.sold / a.total) * 100 : 0;
            const ended = new Date(e.startsAt) < now;
            return (
              <li key={e.id}>
                <Link to={`/organizer/events/${e.id}`} className="card flex items-center gap-4 p-4 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{e.title}</h2>
                      <Badge status={ended && e.status === 'published' ? 'ended' : e.status} />
                    </div>
                    <p className="text-sm text-slate-500">{dateTime(e.startsAt)} · {e.venue.name}, {e.venue.city}</p>
                    {a ? (
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${soldPct}%` }} />
                        </div>
                        <span className="text-xs text-slate-600">{a.sold} / {a.total} sold</span>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">{e.capacity} seats · not on sale yet</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
