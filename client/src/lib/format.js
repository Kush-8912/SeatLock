const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const money = (n) => (n === 0 ? 'Free' : inr.format(n));

export const dateTime = (d) =>
  new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(d));

export const dateLong = (d) =>
  new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));

export const time = (d) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(d));

export const dayMonth = (d) => {
  const date = new Date(d);
  return { day: date.getDate(), month: date.toLocaleString('en-IN', { month: 'short' }).toUpperCase() };
};

export const pct = (x) => `${Math.round(x * 100)}%`;

export const CATEGORY_LABELS = {
  music: 'Music', comedy: 'Comedy', theatre: 'Theatre', sports: 'Sports', tech: 'Tech', workshop: 'Workshop', other: 'Other',
};
