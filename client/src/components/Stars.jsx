import { useState } from 'react';
import { Star } from 'lucide-react';

// Read-only star rating.
export function Stars({ value, size = 'h-3.5 w-3.5' }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= Math.round(value) ? 'fill-warn text-warn' : 'text-line-strong'}`} aria-hidden />
      ))}
    </span>
  );
}

// Keyboard-accessible star picker (a radio group). `size` and `label` let it
// double as the smaller per-aspect rating in the feedback form.
export function StarInput({ value, onChange, size = 'h-7 w-7', label = 'Rating' }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const words = ['', 'Poor', 'Fair', 'Good', 'Great', 'Loved it'];
  return (
    <div>
      <div className="flex items-center gap-1" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className="rounded p-0.5"
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
          >
            <Star className={`${size} transition-colors ${n <= shown ? 'fill-warn text-warn' : 'text-line-strong'}`} aria-hidden />
          </button>
        ))}
        <span className="ml-2 w-16 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{words[shown]}</span>
      </div>
    </div>
  );
}
