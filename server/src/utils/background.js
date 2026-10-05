// Fire-and-forget work (emails, waitlist alerts) that must not slow down or
// fail the request that triggered it. Errors are logged; tests can await
// backgroundIdle() so nothing is still running when the database closes.
const pending = new Set();

export function runInBackground(label, fn) {
  const job = Promise.resolve()
    .then(fn)
    .catch((err) => console.error(`[${label}]`, err?.message ?? err))
    .finally(() => pending.delete(job));
  pending.add(job);
}

export async function backgroundIdle() {
  while (pending.size) await Promise.all([...pending]);
}
