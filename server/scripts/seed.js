// Populates a database with demo accounts and events.
// Usage: npm run seed            (refuses to run if users already exist)
//        npm run seed -- --reset (wipes SeatLock collections first)
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Event } from '../src/models/Event.js';
import { Seat } from '../src/models/Seat.js';
import { Hold } from '../src/models/Hold.js';
import { Order } from '../src/models/Order.js';
import { Ticket } from '../src/models/Ticket.js';
import { publishEvent } from '../src/services/eventService.js';

const DEMO_PASSWORD = 'demo1234';
const days = (n, hour = 19) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const rows = (spec) => spec.flatMap(([labels, seats, tier]) => [...labels].map((label) => ({ label, seats, tier })));

const EVENTS = [
  {
    title: 'Midnight Echoes — Acoustic Tour',
    category: 'music',
    venue: { name: 'Seaside Amphitheatre', city: 'Mumbai' },
    startsAt: days(12),
    description: 'An intimate acoustic evening with songs from the new album and fan favourites.',
    coverImageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&q=70',
    tiers: [{ name: 'Front Row', price: 4500, color: '#e11d48' }, { name: 'Premium', price: 2500, color: '#7c3aed' }, { name: 'Standard', price: 1200, color: '#0891b2' }],
    rows: rows([['AB', 14, 'Front Row'], ['CDE', 18, 'Premium'], ['FGHJ', 20, 'Standard']]),
  },
  {
    title: 'Stand-up Saturday: Open Mic Night',
    category: 'comedy',
    venue: { name: 'Laughter Loft', city: 'Mumbai' },
    startsAt: days(5, 21),
    description: 'Six comics, one mic, zero filters. 18+ only.',
    coverImageUrl: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=1200&q=70',
    tiers: [{ name: 'Table', price: 899, color: '#ea580c' }, { name: 'Gallery', price: 499, color: '#65a30d' }],
    rows: rows([['ABC', 10, 'Table'], ['DEF', 12, 'Gallery']]),
  },
  {
    title: 'Frontend Forward 2026',
    category: 'tech',
    venue: { name: 'Lakeside Convention Centre', city: 'Bengaluru' },
    startsAt: days(20, 9),
    durationMinutes: 480,
    description: 'A full day of talks on React Server Components, performance and the future of the web platform.',
    coverImageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=70',
    tiers: [{ name: 'Early Bird', price: 1999, color: '#2563eb' }, { name: 'Regular', price: 2999, color: '#4f46e5' }],
    rows: rows([['ABCD', 16, 'Early Bird'], ['EFGHJK', 16, 'Regular']]),
  },
  {
    title: 'Hamlet — A Modern Retelling',
    category: 'theatre',
    venue: { name: 'Curtain Call Theatre', city: 'Mumbai' },
    startsAt: days(9, 19),
    durationMinutes: 150,
    description: 'Shakespeare’s tragedy reimagined in a 2020s corporate boardroom.',
    coverImageUrl: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=1200&q=70',
    tiers: [{ name: 'Stalls', price: 1500, color: '#b45309' }, { name: 'Balcony', price: 750, color: '#0f766e' }],
    rows: rows([['ABCDE', 12, 'Stalls'], ['FGH', 14, 'Balcony']]),
  },
  {
    title: 'Pottery Basics Workshop',
    category: 'workshop',
    venue: { name: 'Clay Studio', city: 'Delhi' },
    startsAt: days(3, 11),
    durationMinutes: 180,
    description: 'Hands-on wheel throwing for complete beginners. All materials included.',
    coverImageUrl: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=1200&q=70',
    tiers: [{ name: 'Seat', price: 1800, color: '#a16207' }],
    rows: rows([['AB', 6, 'Seat']]),
  },
  {
    title: 'Community Football Screening',
    category: 'sports',
    venue: { name: 'Goal Post Café', city: 'Delhi' },
    startsAt: days(7, 20),
    description: 'Big screen, free entry, seat reservation required.',
    coverImageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=70',
    tiers: [{ name: 'Free', price: 0, color: '#16a34a' }],
    rows: rows([['ABCD', 10, 'Free']]),
  },
];

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  await mongoose.connection.syncIndexes();

  if (process.argv.includes('--reset')) {
    await Promise.all([User, Event, Seat, Hold, Order, Ticket].map((M) => M.deleteMany({})));
    console.log('Cleared existing data');
  } else if (await User.estimatedDocumentCount()) {
    console.log('Database already has users; run with --reset to wipe and reseed.');
    return;
  }

  const passwordHash = await User.hashPassword(DEMO_PASSWORD);
  const [organizer] = await User.create([
    { name: 'Riya Organiser', email: 'organizer@seatlock.dev', role: 'organizer', passwordHash },
    { name: 'Aarav Attendee', email: 'attendee@seatlock.dev', role: 'attendee', passwordHash },
  ]);

  for (const data of EVENTS) {
    const event = await Event.create({ ...data, organizer: organizer._id });
    await publishEvent(event);
  }
  await Event.create({
    ...EVENTS[0],
    title: 'Winter Jazz Festival (draft)',
    startsAt: days(45),
    organizer: organizer._id,
  });

  console.log(`Seeded ${EVENTS.length} published events + 1 draft.`);
  console.log(`Log in as organizer@seatlock.dev or attendee@seatlock.dev with password "${DEMO_PASSWORD}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
