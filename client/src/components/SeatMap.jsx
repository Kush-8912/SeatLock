import { memo, useMemo } from 'react';
import { money } from '../lib/format';

const tierColor = (tiers, name) => tiers.find((t) => t.name === name)?.color ?? '#6366f1';

const Seat = memo(function Seat({ seat, color, selected, interactive, onToggle }) {
  const takenByOthers = seat.status === 'sold' || (seat.status === 'held' && !seat.mine);
  const active = selected || seat.mine;
  const disabled = !interactive || takenByOthers;

  let style;
  let cls = 'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-t-lg rounded-b-sm text-[10px] font-semibold transition sm:h-8 sm:w-8';
  if (seat.status === 'sold') {
    cls += ' bg-slate-300 text-slate-400';
  } else if (takenByOthers) {
    cls += ' bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_3px,#f8fafc_3px,#f8fafc_6px)] text-slate-400';
  } else if (active) {
    style = { backgroundColor: color, borderColor: color };
    cls += ' border-2 text-white shadow-md scale-110';
  } else {
    style = { borderColor: color, color, backgroundColor: `${color}14` };
    cls += ' border-2';
    if (interactive) cls += ' hover:scale-110 hover:shadow';
  }

  const state = seat.status === 'sold' ? 'sold' : takenByOthers ? 'held by another buyer' : active ? 'selected' : 'available';
  return (
    <button
      type="button"
      className={cls}
      style={style}
      disabled={disabled}
      aria-pressed={interactive ? active : undefined}
      aria-label={`Seat ${seat.label}, ${seat.tier}, ${money(seat.price)}, ${state}`}
      title={`${seat.label} · ${seat.tier} · ${money(seat.price)} — ${state}`}
      onClick={() => onToggle?.(seat)}
    >
      {seat.status === 'sold' ? '×' : seat.number}
    </button>
  );
});

/**
 * Renders the venue as rows of seats in the organizer-defined order.
 * Without `onToggle` it is a read-only preview (used by the event editor).
 */
export function SeatMap({ rows, tiers, seats, selected = new Set(), onToggle }) {
  const byRow = useMemo(() => Map.groupBy(seats, (s) => s.row), [seats]);
  const interactive = Boolean(onToggle);

  return (
    <div>
      <div className="mx-auto mb-6 h-2 w-2/3 rounded-full bg-gradient-to-r from-slate-200 via-slate-400 to-slate-200" />
      <p className="-mt-4 mb-6 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Stage</p>
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto flex w-max flex-col gap-1.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-1.5">
              <span className="w-6 text-right text-xs font-semibold text-slate-400">{row.label}</span>
              <div className="flex flex-1 justify-center gap-1">
                {(byRow.get(row.label) ?? []).map((seat) => (
                  <Seat
                    key={seat.id}
                    seat={seat}
                    color={tierColor(tiers, seat.tier)}
                    selected={selected.has(String(seat.id))}
                    interactive={interactive}
                    onToggle={onToggle}
                  />
                ))}
              </div>
              <span className="w-6 text-xs font-semibold text-slate-400">{row.label}</span>
            </div>
          ))}
        </div>
      </div>
      <Legend tiers={tiers} />
    </div>
  );
}

function Legend({ tiers }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-600">
      {tiers.map((t) => (
        <span key={t.name} className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border-2" style={{ borderColor: t.color, backgroundColor: `${t.color}14` }} />
          {t.name} · {money(t.price)}
        </span>
      ))}
      <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_2px,#f8fafc_2px,#f8fafc_4px)]" /> On hold</span>
      <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-slate-300" /> Sold</span>
    </div>
  );
}

// Fake seats for previewing a layout before it is published.
export function previewSeats(rows, tiers) {
  return rows.flatMap((r) => {
    const tier = tiers.find((t) => t.name.toLowerCase() === String(r.tier).toLowerCase());
    return Array.from({ length: Number(r.seats) || 0 }, (_, i) => ({
      id: `${r.label}-${i + 1}`, row: r.label, number: i + 1, label: `${r.label}${i + 1}`,
      tier: tier?.name ?? r.tier, price: tier?.price ?? 0, status: 'available',
    }));
  });
}
