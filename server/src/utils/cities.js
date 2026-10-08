// Old and alternate names people type for the same city, mapped to the name
// the app uses everywhere (and that the city picker's map knows).
const ALIASES = {
  bangalore: 'Bengaluru',
  bombay: 'Mumbai',
  'new delhi': 'Delhi',
  calcutta: 'Kolkata',
  madras: 'Chennai',
  gurgaon: 'Gurugram',
  trivandrum: 'Thiruvananthapuram',
  cochin: 'Kochi',
  ernakulam: 'Kochi',
  panaji: 'Goa',
  panjim: 'Goa',
  mysore: 'Mysuru',
  pondicherry: 'Puducherry',
  vizag: 'Visakhapatnam',
  baroda: 'Vadodara',
  poona: 'Pune',
};

// "  bangalore " -> "Bengaluru"; "navi mumbai" -> "Navi Mumbai".
export function canonicalCity(name) {
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ');
  const alias = ALIASES[clean.toLowerCase()];
  if (alias) return alias;
  return clean.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
