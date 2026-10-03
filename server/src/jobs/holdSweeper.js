import { Hold } from '../models/Hold.js';
import { releaseHold } from '../services/holdService.js';

// Periodically returns expired holds' seats to the pool and broadcasts the
// change so open seat maps update. Reads already treat expired holds as
// available, so this job affects freshness of the UI, not correctness.
export async function sweepExpiredHolds(now = new Date()) {
  const expired = await Hold.find({ status: 'active', expiresAt: { $lte: now } }).limit(500);
  let released = 0;
  for (const hold of expired) {
    if (await releaseHold(hold, 'expired')) released += 1;
  }
  return released;
}

export function startHoldSweeper(intervalMs = 15_000) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return; // never overlap runs
    running = true;
    try {
      const n = await sweepExpiredHolds();
      if (n) console.log(`[sweeper] released ${n} expired hold(s)`);
    } catch (err) {
      console.error('[sweeper] failed:', err);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
