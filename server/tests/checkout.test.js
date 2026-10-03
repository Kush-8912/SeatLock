import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startDb, stopDb, clearDb, signUp, publishedEvent } from './helpers.js';
import { Seat } from '../src/models/Seat.js';
import { Hold } from '../src/models/Hold.js';
import { Order } from '../src/models/Order.js';
import { Event } from '../src/models/Event.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const card = (number = '4242424242424242') => ({ number, expMonth: 12, expYear: new Date().getFullYear() + 2, cvc: '123', name: 'Test Buyer' });
let keySeq = 0;
const key = () => `test-key-${Date.now()}-${keySeq++}`;

async function setup(seatCount = 2) {
  const org = await signUp('organizer');
  const buyer = await signUp();
  const { id, seats } = await publishedEvent(org);
  const picked = seats.slice(0, seatCount);
  const { body } = await buyer.agent.post(`/api/events/${id}/holds`).send({ seatIds: picked.map((s) => s.id) }).expect(201);
  return { org, buyer, eventId: id, seats: picked, holdId: body.hold._id };
}

const pay = (agent, holdId, { k = key(), c = card() } = {}) =>
  agent.post(`/api/holds/${holdId}/checkout`).set('Idempotency-Key', k).send({ card: c });

describe('checkout', () => {
  it('charges, sells the seats and issues one signed ticket per seat', async () => {
    const { buyer, holdId, seats } = await setup(2);
    const res = await pay(buyer.agent, holdId);

    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('paid');
    expect(res.body.order.amount).toBe(seats[0].price + seats[1].price);
    expect(res.body.order.payment.last4).toBe('4242');
    expect(res.body.tickets).toHaveLength(2);
    expect(res.body.tickets[0].qr).toMatch(/^SL1\.[a-f\d]{24}\./);
    expect(await Seat.countDocuments({ status: 'sold' })).toBe(2);
    expect((await Hold.findById(holdId)).status).toBe('converted');
  });

  it('is idempotent: retrying with the same key returns the same order without charging twice', async () => {
    const { buyer, holdId } = await setup(1);
    const k = key();
    const first = await pay(buyer.agent, holdId, { k });
    const retry = await pay(buyer.agent, holdId, { k });

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.replayed).toBe(true);
    expect(retry.body.order._id).toBe(first.body.order._id);
    expect(await Order.countDocuments()).toBe(1);
  });

  it('refuses a double-clicked checkout with different keys: one order only', async () => {
    const { buyer, holdId } = await setup(1);
    const [a, b] = await Promise.all([pay(buyer.agent, holdId), pay(buyer.agent, holdId)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(201);
    expect([200, 409]).toContain(statuses[1]);
    expect(await Order.countDocuments({ status: 'paid' })).toBe(1);
  });

  it('keeps the hold on a declined card so the buyer can retry with another card', async () => {
    const { buyer, holdId } = await setup(1);
    const declined = await pay(buyer.agent, holdId, { c: card('4000000000000002') });
    expect(declined.status).toBe(402);
    expect(declined.body.error.code).toBe('PAYMENT_FAILED');
    expect((await Hold.findById(holdId)).status).toBe('active');
    expect(await Seat.countDocuments({ status: 'held' })).toBe(1);

    const ok = await pay(buyer.agent, holdId);
    expect(ok.status).toBe(201);
  });

  it('rejects checkout of an expired hold and frees its seats', async () => {
    const { buyer, holdId } = await setup(1);
    await Hold.updateOne({ _id: holdId }, { expiresAt: new Date(Date.now() - 1000) });
    const res = await pay(buyer.agent, holdId);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('HOLD_EXPIRED');
    expect(await Seat.countDocuments({ status: 'held' })).toBe(0);
  });

  it('validates card input and the idempotency header', async () => {
    const { buyer, holdId } = await setup(1);
    await buyer.agent.post(`/api/holds/${holdId}/checkout`).send({ card: card() }).expect(400);
    const bad = await pay(buyer.agent, holdId, { c: { ...card(), cvc: '1' } });
    expect(bad.status).toBe(400);
    const luhn = await pay(buyer.agent, holdId, { c: card('4242424242424241') });
    expect(luhn.status).toBe(402);
  });

  it("does not let another user check out someone else's hold", async () => {
    const { holdId } = await setup(1);
    const thief = await signUp();
    const res = await pay(thief.agent, holdId);
    expect(res.status).toBe(404);
  });

  it('completes free events without card details', async () => {
    const org = await signUp('organizer');
    const buyer = await signUp();
    const { id, seats } = await publishedEvent(org, { tiers: [{ name: 'Free', price: 0 }], rows: [{ label: 'A', seats: 3, tier: 'Free' }] });
    const { body } = await buyer.agent.post(`/api/events/${id}/holds`).send({ seatIds: [seats[0].id] });
    const res = await buyer.agent.post(`/api/holds/${body.hold._id}/checkout`).set('Idempotency-Key', key()).send({});
    expect(res.status).toBe(201);
    expect(res.body.order.amount).toBe(0);
  });
});

describe('cancellation and refunds', () => {
  it('lets an attendee cancel, refunds them and puts the seats back on sale', async () => {
    const { buyer, holdId } = await setup(2);
    const { body } = await pay(buyer.agent, holdId);
    const res = await buyer.agent.post(`/api/orders/${body.order._id}/cancel`);

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('refunded');
    expect(res.body.order.payment.refundId).toMatch(/^re_/);
    expect(await Seat.countDocuments({ status: 'available' })).toBe(10);
    await buyer.agent.post(`/api/orders/${body.order._id}/cancel`).expect(409);
  });

  it('closes attendee cancellations 24h before the event', async () => {
    const { buyer, holdId, eventId } = await setup(1);
    const { body } = await pay(buyer.agent, holdId);
    await Event.updateOne({ _id: eventId }, { startsAt: new Date(Date.now() + 3_600_000) });
    const res = await buyer.agent.post(`/api/orders/${body.order._id}/cancel`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANCELLATION_CLOSED');
  });

  it('organizer cancelling the event refunds every order and stops sales', async () => {
    const { org, buyer, holdId, eventId } = await setup(1);
    await pay(buyer.agent, holdId);
    const other = await signUp();
    const free = await Seat.findOne({ event: eventId, status: 'available' });
    await other.agent.post(`/api/events/${eventId}/holds`).send({ seatIds: [free.id] }).expect(201);

    const res = await org.agent.post(`/api/events/${eventId}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.refunded).toBe(1);
    expect(await Order.countDocuments({ status: 'refunded' })).toBe(1);
    expect(await Hold.countDocuments({ status: 'active' })).toBe(0);
    const late = await other.agent.post(`/api/events/${eventId}/holds`).send({ seatIds: [free.id] });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('NOT_ON_SALE');
  });

  it('lists only the current user\'s orders with tickets', async () => {
    const { buyer, holdId } = await setup(2);
    await pay(buyer.agent, holdId);
    const someoneElse = await signUp();
    expect((await someoneElse.agent.get('/api/orders')).body.items).toHaveLength(0);
    const mine = await buyer.agent.get('/api/orders');
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].tickets).toHaveLength(2);
    expect(mine.body.items[0].event.title).toBe('Test Concert');
  });
});
