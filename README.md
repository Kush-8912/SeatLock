# SeatLock

**Reserved-seat event ticketing where two people can never buy the same seat.**

Pick your exact seat on a live map, hold it for a few minutes while you pay, and walk in with a signed QR ticket. Organizers design the seating layout, watch sales live, and check guests in by scanning QR codes at the door.

| | |
|---|---|
| **Live app** | _add your Render URL here after deploying (see [Deployment](#deployment))_ |
| **Demo video** | _add link_ |
| **Demo logins** | `attendee@seatlock.dev` / `organizer@seatlock.dev`, password `demo1234` |
| **Test card** | `4242 4242 4242 4242`, any future expiry, any CVC ([more](#test-cards)) |

---

## Problem Statement

Small and mid-sized venues (comedy clubs, college auditoriums, indie gigs, theatre groups, workshops) sell reserved seating through spreadsheets, WhatsApp, or general-admission ticket tools that don't understand seats. This leads to:

- **Double-booking.** Two buyers pay for seat B7 because the "is it free?" check and the "sell it" step aren't atomic.
- **Phantom availability.** Someone starts paying, abandons the payment, and the seat stays locked forever (or is never locked at all).
- **Duplicate charges.** A slow network makes the buyer click "Pay" twice.
- **Ticket fraud at the door.** Screenshots of a ticket get shared, or someone edits a ticket ID, and staff have no reliable way to tell.

## Target Users

- **Attendees** who want to choose exactly where they sit and need confidence that the seat they paid for is theirs.
- **Organizers** (small venues, college clubs, independent promoters) who need a seat-aware box office, live sales numbers, and a fast door check-in without buying hardware.

## Solution

SeatLock models each seat as its own record and treats a purchase as a short **state machine** rather than a single form submit:

```
 available ──hold (atomic)──▶ held ──checkout──▶ sold ──cancel/refund──▶ available
     ▲                          │
     └──── expires / released ──┘
```

- A **hold** reserves seats for 8 minutes. Claims are atomic per seat, so exactly one of any number of simultaneous buyers wins.
- **Checkout** locks the hold, charges once (idempotently), then converts the seats to sold and issues tickets.
- Every seat state change is **pushed live** to everyone viewing that event.
- **Tickets** carry an HMAC-signed QR code that is verified and burned once at the door.

## Key Features (core workflows)

1. **Discover events.** Search by text, filter by category, city and date, with pagination. Filters live in the URL, so searches can be shared and survive a refresh.
2. **Choose and hold seats.** The interactive seat map updates live over WebSockets as other people hold or buy seats. If a seat you selected is taken, you're told immediately. Holds are all-or-nothing and expire automatically.
3. **Pay and receive tickets.** A countdown shows how long the hold has left. Payment goes through a mock card processor with realistic declines. Retries are idempotent, and a declined card keeps your hold so you can try another card. You receive one QR ticket per seat.
4. **Manage and refund orders.** "My tickets" lists upcoming and past orders. You can cancel for a full refund up to 24 hours before the event, and the seats go straight back on sale.
5. **Organizer tools:**
   - **Event builder:** tiers, prices, and a row-by-row seating layout with a live preview. Draft, then publish, which locks the layout.
   - **Live dashboard:** revenue, sell-through, per-tier sales, daily sales chart and check-in rate.
   - **Door check-in:** camera QR scanner or a pasted code, with clear admit / do-not-admit results (already used, wrong event, refunded, forged).
   - **Guest list search** and **event cancellation**, which refunds every buyer automatically.

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19, React Router 7, Vite 8, Tailwind CSS 4 | Component model suits the stateful seat map; Vite for fast dev and code-splitting |
| Realtime | Socket.IO | Room-per-event broadcast with automatic reconnect and polling fallback |
| Backend | Node.js, Express 5 | Native async error handling; simple REST surface |
| Database | MongoDB with Mongoose | Atomic single-document conditional updates are exactly what seat claiming needs |
| Validation | Zod (server) | One schema both validates and coerces input; field-level errors flow to the UI |
| Auth | JWT in an httpOnly cookie, bcrypt | No token in JS-readable storage; same-origin deployment means no cross-site cookie issues |
| Security | Helmet (CSP), express-rate-limit, CORS | Sensible defaults plus brute-force protection on login/register |
| Charts / QR | Recharts, qrcode.react, html5-qrcode | Dashboard chart, ticket QR rendering, camera scanning |
| Testing | Vitest, Supertest, mongodb-memory-server | Real HTTP and database integration tests, including concurrency races |
| Hosting | Render (web service) + MongoDB Atlas | One service serves API + client |

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[React SPA]
    WS[Socket.IO client]
  end
  subgraph "Node.js (single Render service)"
    ST[Static client build]
    API[Express REST API]
    IO[Socket.IO server]
    SW[Hold sweeper job]
    SVC[Services: holds, orders, check-in, stats]
    PAY[Payment adapter: mock]
  end
  DB[(MongoDB Atlas)]

  UI -- "HTTPS /api (cookie auth)" --> API
  WS <-- "event rooms: seats:update, checkin" --> IO
  UI -. loads .-> ST
  API --> SVC --> DB
  SVC --> PAY
  SVC -- emit --> IO
  SW -- every 15s --> SVC
```

**Request flow for a purchase**

```
POST /api/events/:id/holds        claim each seat: findOneAndUpdate({_id, status claimable}) ─▶ broadcast "held"
POST /api/holds/:id/checkout      Idempotency-Key header
   ├─ replay? same key ─────────▶ return original order (200)
   ├─ lock hold: active ─▶ converting   (second concurrent checkout ─▶ 409)
   ├─ create pending order
   ├─ charge card ──fail──▶ order failed, hold back to active, 402
   ├─ seats held ─▶ sold (only if still ours)
   └─ issue tickets, order paid, hold converted ─▶ broadcast "sold"
```

### Main components

| Path | Responsibility |
|---|---|
| `server/src/services/holdService.js` | Atomic seat claiming, all-or-nothing rollback, release |
| `server/src/services/orderService.js` | Checkout state machine, idempotency, refunds, event cancellation |
| `server/src/services/checkinService.js` | QR verification and exactly-once admission |
| `server/src/services/statsService.js` | Aggregation pipelines for the organizer dashboard |
| `server/src/services/ticketSigner.js` | HMAC-signed QR payloads (`SL1.<ticketId>.<sig>`) |
| `server/src/services/paymentService.js` | Mock gateway with the same contract as a real one (charge with idempotency key, refund) |
| `server/src/jobs/holdSweeper.js` | Releases expired holds; recovers checkouts that crashed mid-way |
| `server/src/realtime/` | Socket.IO rooms and a small emit bus used by services |
| `client/src/components/SeatMap.jsx` | Seat map rendering (buy mode and editor preview) |
| `client/src/hooks/useEventChannel.js` | Joins event rooms, re-syncs after reconnect |
| `client/src/lib/api.js` | Fetch wrapper that turns every failure into a typed `ApiError` |

### Data model

```
User      { name, email (unique), passwordHash, role: attendee|organizer }
Event     { organizer, title, category, venue{name,city}, startsAt, durationMinutes,
            tiers[{name, price, color}], rows[{label, seats, tier}], status: draft|published|cancelled }
Seat      { event, row, number, label, tier, price, status: available|held|sold,
            hold, holdExpiresAt, order }                      unique(event, label)
Hold      { user, event, seats[], expiresAt, status: active|converting|converted|released|expired }
                                                              unique(user, event) where status = active
Order     { user, event, hold, items[{seat,label,tier,price}], amount, status: pending|paid|failed|cancelled|refunded,
            idempotencyKey, payment{chargeId,last4,refundId} }  unique(user, idempotencyKey)
Ticket    { order, event, user, seat, label, tier, status: valid|cancelled, checkedInAt, checkedInBy }
```

### Key engineering decisions

- **One document per seat instead of an array inside the event.** MongoDB updates to a single document are atomic, so `findOneAndUpdate({ _id, status: 'available' }, { status: 'held' })` is a race-free compare-and-set. No transactions or replica set are needed, so the app runs on the Atlas free tier and in a plain local `mongod`.
- **All-or-nothing holds without transactions.** Seats are claimed in parallel. If any claim fails, the seats already claimed are handed back (a compensating action), and the buyer learns exactly which seats were lost.
- **Expiry is correct even if the background job is down.** A held seat whose `holdExpiresAt` has passed counts as available on every read and claim. The sweeper only makes the UI fresher; correctness doesn't depend on it.
- **Two layers against double charging.** A client-generated `Idempotency-Key` replays the original order. Separately, the `active → converting` lock on the hold refuses a second concurrent checkout *before* any money moves. The client reuses the key after network errors and generates a new one after a definitive decline.
- **Never keep money for undeliverable seats.** If seats somehow can't be marked sold after a successful charge, the order is refunded automatically.
- **Signed, single-use tickets.** QR payloads are HMAC-signed, so editing a ticket ID is detected without a database lookup. Admission is a conditional update on `checkedInAt: null`, so two scanners reading the same code admit it exactly once.
- **Single origin in production.** Express serves the built React app, which removes CORS and third-party-cookie issues and lets the auth cookie be `httpOnly; SameSite=Lax`. In development, Vite's proxy recreates the same setup.
- **Numbers are aggregated, never stored as counters.** Dashboard stats come from aggregation pipelines over the source data, so they can't drift.

### Error handling

| Situation | What happens |
|---|---|
| Seat taken between viewing and holding | `409 SEATS_UNAVAILABLE` naming the seats; UI greys them out and keeps the rest of the selection |
| Hold expires during checkout | `410 HOLD_EXPIRED`; UI shows an expired screen with a link back to the seat map |
| Card declined / gateway down | `402 PAYMENT_FAILED`; hold stays active so the buyer can retry with another card |
| Double-click / retry of "Pay" | Same key: original order returned. Different key: `409 CHECKOUT_IN_PROGRESS` |
| Ticket scanned twice / forged / wrong event / refunded | Distinct codes (`ALREADY_CHECKED_IN`, `INVALID_TICKET`, `WRONG_EVENT`, `TICKET_CANCELLED`) shown as "Do not admit" |
| Invalid input | `400 VALIDATION_ERROR` with per-field messages rendered under each input |
| Not logged in / wrong role / not the owner | 401 / 403; private resources owned by others return 404 to avoid revealing they exist |
| Network offline | Client shows "Can't reach SeatLock"; the socket reconnects and re-syncs the seat map |
| Unexpected server error | Logged server-side; client gets a generic message (no stack traces leaked) |
| Bad config at boot | Server refuses to start and lists the missing or invalid environment variables |

## Local Setup

**Prerequisites:** Node.js 20+ and MongoDB, either running locally (`brew services start mongodb-community`) or as a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

```bash
git clone <your-repo-url> seatlock && cd seatlock
npm run install:all                     # installs server and client dependencies

cp server/.env.example server/.env      # then fill in the secrets (see below)
npm run seed                            # demo users and events (add -- --reset to wipe)

# terminal 1: API on http://localhost:4000
npm run dev --prefix server
# terminal 2: React app on http://localhost:5173 (proxies /api and websockets)
npm run dev --prefix client
```

Open <http://localhost:5173> and log in with one of the demo accounts. To try the real-time behaviour, open the same event in two browsers (or one normal and one private window) logged in as different users.

**Tests:**

```bash
npm test     # 24 integration tests: holds, races, checkout, refunds, check-in, stats
```

Tests start their own in-memory MongoDB, so they need no database or `.env`.

## Environment Variables

All variables live in `server/.env` (template: [`server/.env.example`](server/.env.example)). They're validated at startup.

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGODB_URI` | yes | — | MongoDB connection string |
| `JWT_SECRET` | yes | — | ≥ 32 chars; signs session tokens |
| `TICKET_SIGNING_SECRET` | yes | — | ≥ 32 chars; signs ticket QR codes (keep different from `JWT_SECRET`) |
| `NODE_ENV` | no | `development` | `production` enables secure cookies, CSP and static client serving |
| `PORT` | no | `4000` | HTTP port |
| `HOLD_TTL_MINUTES` | no | `8` | How long seats stay held during checkout |
| `MAX_SEATS_PER_HOLD` | no | `8` | Seat limit per order |
| `CLIENT_ORIGIN` | no | `http://localhost:5173` | Only needed if the client is served from a different origin |

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. `.env` is git-ignored; no secrets are committed.

## Deployment

The app deploys as **one Render web service** (API + client) backed by **MongoDB Atlas**.

1. **Atlas:** create a free M0 cluster, add a database user, allow network access from `0.0.0.0/0` (Render's free tier has no fixed IPs), and copy the connection string, e.g. `mongodb+srv://user:pass@cluster.mongodb.net/seatlock`.
2. **Render:** *New → Blueprint*, then select this repository. [`render.yaml`](render.yaml) configures the build (`npm run install:all && npm run build`), the start command, the health check and auto-generated secrets.
3. When prompted, set `MONGODB_URI` to your Atlas string.
4. After the first deploy, seed the demo data from your machine: `MONGODB_URI="<atlas uri>" npm run seed`.
5. Put the live URL at the top of this README.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the server test suite, then the client lint and build on every push.

> Render's free tier sleeps after inactivity, so the first request can take around 30 seconds.

## Test cards

The payment processor is a **mock**: no real money moves and no payment provider is contacted. Only the last 4 digits are stored.

| Card number | Result |
|---|---|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0119` | Gateway error |

Use any future expiry and any 3-digit CVC. Free events skip payment entirely.

## Project Structure

```
seatlock/
├── server/
│   ├── src/
│   │   ├── config/        env validation, db connection
│   │   ├── models/        User, Event, Seat, Hold, Order, Ticket
│   │   ├── services/      business logic (holds, orders, check-in, stats, payments, signing)
│   │   ├── routes/        thin HTTP layer: validation → service → response
│   │   ├── middleware/    auth, validation, error handling
│   │   ├── realtime/      Socket.IO server and emit bus
│   │   ├── jobs/          hold sweeper
│   │   ├── app.js         Express app (exported for tests)
│   │   └── server.js      process entry: DB, HTTP, sockets, jobs, graceful shutdown
│   ├── scripts/seed.js
│   └── tests/             Vitest + Supertest integration tests
├── client/
│   └── src/
│       ├── pages/         Home, Event, Checkout, Tickets, Auth, organizer/*
│       ├── components/    SeatMap, QrScanner, TicketCard, dialogs, states
│       ├── hooks/         live event channel, countdown, debounce
│       ├── context/       auth
│       └── lib/           API client, socket, formatting
├── render.yaml
└── .github/workflows/ci.yml
```

## Known limitations and next steps

- **Payments are mocked.** `paymentService.js` mirrors a real gateway's contract, so integrating Stripe or Razorpay would replace only that file and move card entry to the provider's hosted fields (card data should not touch our server in production).
- **Single-instance realtime.** Running several server instances would need the Socket.IO Redis adapter so broadcasts reach every instance.
- **No email delivery.** Tickets are available in-app under "My tickets".
- **One organizer account per event.** There's no separate door-staff role yet; the organizer scans tickets.
