// Starting points for the seating editor. Everything they fill in (tiers,
// prices, rows, aisles, wheelchair spaces) can be edited afterwards.

const letters = (from, to) => {
  const out = [];
  for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c += 1) out.push(String.fromCharCode(c));
  return out;
};

const rowsOf = (from, to, seats, tier, extra = {}) => letters(from, to).map((label) => ({ label, seats, tier, aisleAfter: [], blocked: [], accessible: [], ...extra }));

// Put options on one row of a list built by rowsOf.
const withRow = (rows, label, patch) => rows.map((r) => (r.label === label ? { ...r, ...patch } : r));

export const LAYOUT_TEMPLATES = [
  {
    id: 'theatre',
    name: 'Theatre',
    blurb: 'Stalls and balcony, two aisles',
    build: () => ({
      tiers: [
        { name: 'Front stalls', price: 1800, color: '#e11d48', description: 'Rows A–D, closest to the stage' },
        { name: 'Stalls', price: 1100, color: '#7c3aed', description: '' },
        { name: 'Balcony', price: 600, color: '#0891b2', description: 'Raised view from the back' },
      ],
      rows: [
        ...rowsOf('A', 'D', 14, 'Front stalls', { aisleAfter: [7] }),
        ...withRow(rowsOf('E', 'J', 16, 'Stalls', { aisleAfter: [4, 12] }), 'J', { accessible: [1, 16] }),
        ...rowsOf('K', 'M', 18, 'Balcony', { aisleAfter: [9] }),
      ],
    }),
  },
  {
    id: 'comedy',
    name: 'Comedy club',
    blurb: 'Tables up front, gallery behind',
    build: () => ({
      tiers: [
        { name: 'Table', price: 899, color: '#ea580c', description: 'Table seating, drinks served' },
        { name: 'Gallery', price: 499, color: '#16a34a', description: '' },
      ],
      rows: [
        ...rowsOf('A', 'C', 8, 'Table', { aisleAfter: [4] }),
        ...withRow(rowsOf('D', 'G', 12, 'Gallery', { aisleAfter: [6] }), 'G', { accessible: [1, 12] }),
      ],
    }),
  },
  {
    id: 'auditorium',
    name: 'Auditorium',
    blurb: 'Talks and conferences, camera platform',
    build: () => ({
      tiers: [
        { name: 'VIP', price: 1499, color: '#ca8a04', description: 'Front two rows, meet the speakers' },
        { name: 'General', price: 499, color: '#0891b2', description: '' },
      ],
      rows: [
        ...rowsOf('A', 'B', 20, 'VIP', { aisleAfter: [10] }),
        // Row N: wheelchair spaces on both ends, camera platform in the middle.
        ...withRow(rowsOf('C', 'N', 24, 'General', { aisleAfter: [6, 18] }), 'N', { accessible: [1, 2, 23, 24], blocked: [12, 13] }),
      ],
    }),
  },
  {
    id: 'workshop',
    name: 'Workshop',
    blurb: 'Small room, one price',
    build: () => ({
      tiers: [{ name: 'Seat', price: 1500, color: '#7c3aed', description: 'All materials included' }],
      rows: withRow(rowsOf('A', 'C', 8, 'Seat', { aisleAfter: [4] }), 'C', { accessible: [8] }),
    }),
  },
];
