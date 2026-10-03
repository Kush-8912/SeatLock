import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500" role="status">
      <Spinner className="h-8 w-8 text-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  const notFound = error?.status === 404;
  return (
    <div className="card mx-auto my-10 max-w-md p-8 text-center" role="alert">
      <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
      <h2 className="mt-3 text-lg font-semibold">{notFound ? 'Not found' : title}</h2>
      <p className="mt-1 text-sm text-slate-600">{error?.message ?? 'Please try again.'}</p>
      {onRetry && !notFound && (
        <button type="button" className="btn-secondary mt-5" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <Icon className="h-10 w-10 text-slate-300" aria-hidden />
      <h3 className="mt-3 font-semibold text-slate-800">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-slate-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const BADGE = {
  draft: 'bg-slate-100 text-slate-700',
  published: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-700',
  paid: 'bg-emerald-50 text-emerald-700',
  refunded: 'bg-amber-50 text-amber-700',
  valid: 'bg-emerald-50 text-emerald-700',
  used: 'bg-sky-50 text-sky-700',
  ended: 'bg-slate-100 text-slate-600',
};

export function Badge({ status, children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${BADGE[status] ?? BADGE.draft}`}>
      {children ?? status}
    </span>
  );
}

export function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-rose-600">{message}</p>;
}
