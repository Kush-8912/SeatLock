import { useState } from 'react';

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/**
 * A person's profile photo, or their initials when there isn't one (or it
 * fails to load). `className` sets size and the initials' colours/typography.
 */
export function Avatar({ name, src, className = 'h-8 w-8 bg-ink-800 text-fg font-mono text-[11px] font-semibold' }) {
  const [broken, setBroken] = useState(null);
  const showPhoto = src && broken !== src;
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`} aria-hidden>
      {showPhoto ? <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(src)} /> : initials(name)}
    </span>
  );
}
