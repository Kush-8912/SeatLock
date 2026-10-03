import { useEffect, useState } from 'react';

// Seconds remaining until `target`, ticking every second; 0 once passed.
export function useCountdown(target) {
  const calc = () => (target ? Math.max(0, Math.floor((new Date(target).getTime() - Date.now()) / 1000)) : 0);
  const [left, setLeft] = useState(calc);

  useEffect(() => {
    setLeft(calc());
    if (!target) return undefined;
    const id = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return left;
}

export const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
