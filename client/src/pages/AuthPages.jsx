import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { FieldError, Spinner } from '../components/States';

// Only allow redirects back into the app (no open redirect via ?next=).
const safeNext = (next) => (next && next.startsWith('/') && !next.startsWith('//') ? next : null);

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={safeNext(params.get('next')) ?? (user.role === 'organizer' ? '/organizer' : '/')} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(form.email, form.password);
      toast.success(`Welcome back, ${u.name.split(' ')[0]}`);
      navigate(safeNext(params.get('next')) ?? (u.role === 'organizer' ? '/organizer' : '/'), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const fe = error?.fieldErrors ?? {};
  return (
    <AuthShell title="Log in" subtitle="Welcome back to SeatLock.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && !Object.keys(fe).length && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error.message}</p>}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" className={`input ${fe.email ? 'input-error' : ''}`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <FieldError message={fe.email} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" className={`input ${fe.password ? 'input-error' : ''}`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <FieldError message={fe.password} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Log in</button>
      </form>
      <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">Demo accounts (password <code>demo1234</code>)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {['attendee@seatlock.dev', 'organizer@seatlock.dev'].map((email) => (
            <button key={email} type="button" className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200 hover:bg-slate-100" onClick={() => setForm({ email, password: 'demo1234' })}>
              {email}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-slate-600">
        New here? <Link className="font-semibold text-brand-600 hover:underline" to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : ''}`}>Create an account</Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'attendee' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await register(form);
      toast.success('Account created');
      navigate(safeNext(params.get('next')) ?? (u.role === 'organizer' ? '/organizer' : '/'), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const fe = error?.fieldErrors ?? {};
  const field = (name, label, props) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} className={`input ${fe[name] ? 'input-error' : ''}`} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} {...props} />
      <FieldError message={fe[name]} />
    </div>
  );

  return (
    <AuthShell title="Create your account" subtitle="Book seats or sell tickets to your own events.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && !Object.keys(fe).length && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error.message}</p>}
        <fieldset>
          <legend className="label">I want to</legend>
          <div className="grid grid-cols-2 gap-2">
            {[['attendee', 'Buy tickets'], ['organizer', 'Host events']].map(([value, label]) => (
              <label key={value} className={`cursor-pointer rounded-lg border px-3 py-2.5 text-center text-sm font-medium ${form.role === value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 hover:bg-slate-50'}`}>
                <input type="radio" name="role" value={value} className="sr-only" checked={form.role === value} onChange={() => setForm({ ...form, role: value })} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {field('name', 'Full name', { autoComplete: 'name', required: true })}
        {field('email', 'Email', { type: 'email', autoComplete: 'email', required: true })}
        {field('password', 'Password', { type: 'password', autoComplete: 'new-password', required: true, minLength: 8, placeholder: 'At least 8 characters' })}
        <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Create account</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account? <Link className="font-semibold text-brand-600 hover:underline" to="/login">Log in</Link>
      </p>
    </AuthShell>
  );
}
