import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { CATEGORY_LABELS, dateTime, dayMonth, money } from '../lib/format';

export function EventCard({ event }) {
  const { day, month } = dayMonth(event.startsAt);
  const a = event.availability;
  const soldOut = a && a.available === 0;
  const few = a && !soldOut && a.available <= Math.max(5, a.total * 0.1);

  return (
    <Link to={`/events/${event.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[16/9] bg-gradient-to-br from-brand-500 to-fuchsia-500">
        {event.coverImageUrl && (
          <img src={event.coverImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        )}
        <div className="absolute left-3 top-3 rounded-lg bg-white/95 px-2.5 py-1 text-center shadow">
          <div className="text-lg font-bold leading-none">{day}</div>
          <div className="text-[10px] font-semibold text-brand-600">{month}</div>
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-slate-900/70 px-2.5 py-0.5 text-xs font-medium text-white">
          {CATEGORY_LABELS[event.category]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold leading-snug text-slate-900 group-hover:text-brand-700">{event.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /> {event.venue.name}, {event.venue.city}
        </p>
        <p className="mt-0.5 text-sm text-slate-500">{dateTime(event.startsAt)}</p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-sm font-semibold">{event.minPrice === 0 ? 'Free' : `from ${money(event.minPrice)}`}</span>
          {soldOut ? (
            <span className="text-xs font-semibold text-rose-600">Sold out</span>
          ) : few ? (
            <span className="text-xs font-semibold text-amber-600">Only {a.available} left</span>
          ) : a ? (
            <span className="text-xs text-slate-500">{a.available} seats left</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
