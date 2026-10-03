import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { startDb, stopDb, clearDb, app, signUp, publishedEvent } from './helpers.js';
import { Seat } from '../src/models/Seat.js';
import { Hold } from '../src/models/Hold.js';
import { sweepExpiredHolds } from '../src/jobs/holdSweeper.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

describe('seat holds', () => {
  it('holds seats and shows them as held to others and mine to the holder', async () => {
    const org = await signUp('organizer');
    const buyer = await signUp();
    const { id, seats } = await publishedEvent(org);

    const res = await buyer.agent.post(`/api/events/${id}/holds`).send({ seatIds: [seats[0].id, seats[1].id] });
    expect(res.status).toBe(201);
    expect(res.body.hold.seats).toHaveLength(2);

    const anon = await request(app).get(`/api/events/${id}`);
    expect(anon.body.seats.filter((s) => s.status === 'held')).toHaveLength(2);
    const mine = await buyer.agent.get(`/api/events/${id}`);
    expect(mine.body.seats.filter((s) => s.mine)).toHaveLength(2);
  });

  it('lets exactly one of many concurrent buyers win the same seat', async () => {
    const org = await signUp('organizer');
    const { id, seats } = await publishedEvent(org);
    const buyers = await Promise.all(Array.from({ length: 15 }, () => signUp()));

    const results = await Promise.all(
      buyers.map((b) => b.agent.post(`/api/events/${id}/holds`).send({ seatIds: [seats[0].id] })),
    );

    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(14);
    expect(results.find((r) => r.status === 409).body.error.code).toBe('SEATS_UNAVAILABLE');
  });

  it('is all-or-nothing: a partially available selection claims nothing', async () => {
    const org = await signUp('organizer');
    const a = await signUp();
    const b = await signUp();
    const { id, seats } = await publishedEvent(org);

    await a.agent.post(`/api/events/${id}/holds`).send({ seatIds: [seats[1].id] }).expect(201);
    const res = await b.agent.post(`/api/events/${id}/holds`).send({ seatIds: [seats[0].id, seats[1].id, seats[2].id] });

    expect(res.status).toBe(409);
    expect(res.body.error.details.labels).toEqual([seats[1].label]);
    const held = await Seat.find({ event: id, status: 'held' });
    expect(held.map((s) => s.label)).toEqual([seats[1].label]); // only A's seat
  });

  it('replaces the previous hold when the buyer changes their selection', async () => {
    const org = await signUp('organizer');
    const buyer = await signUp();
    const { id, seats } = await publishedEvent(org);

    await buyer.agent.post(`/api/events/${id}/holds`).send({ seatIds: [seats[0].id] }).expect(201);
    await buyer.agent.post(`/api/events/${id}/holds`).send({ seatIds: [seats[5].id] }).expect(201);

    expect((await Seat.findById(seats[0].id)).status).toBe('available');
    expect((await Seat.findById(seats[5].id)).status).toBe('held');
    expect(await Hold.countDocuments({ status: 'active' })).toBe(1);
  });

  it('treats expired holds as available and the sweeper releases them', async () => {
    const org = await signUp('organizer');
    const a = await signUp();
    const b = await signUp();
    const { id, seats } = await publishedEvent(org);

    const { body } = await a.agent.post(`/api/events/${id}/holds`).send({ seatIds: [seats[0].id] }).expect(201);
    const past = new Date(Date.now() - 1000);
    await Hold.updateOne({ _id: body.hold._id }, { expiresAt: past });
    await Seat.updateOne({ _id: seats[0].id }, { holdExpiresAt: past });

    // Visible as available before the sweeper even runs...
    const view = await request(app).get(`/api/events/${id}`);
    expect(view.body.seats[0].status).toBe('available');
    // ...and claimable by someone else.
    await b.agent.post(`/api/events/${id}/holds`).send({ seatIds: [seats[0].id] }).expect(201);

    // Sweeping must not release B's fresh claim on the same seat.
    await sweepExpiredHolds();
    expect((await Hold.findById(body.hold._id)).status).toBe('expired');
    const seat = await Seat.findById(seats[0].id);
    expect(seat.status).toBe('held');
  });

  it('releases a hold on request and rejects other users touching it', async () => {
    const org = await signUp('organizer');
    const a = await signUp();
    const b = await signUp();
    const { id, seats } = await publishedEvent(org);
    const { body } = await a.agent.post(`/api/events/${id}/holds`).send({ seatIds: [seats[0].id] });

    await b.agent.delete(`/api/holds/${body.hold._id}`).expect(404);
    await a.agent.delete(`/api/holds/${body.hold._id}`).expect(204);
    expect((await Seat.findById(seats[0].id)).status).toBe('available');
  });

  it('validates limits and ownership rules', async () => {
    const org = await signUp('organizer');
    const buyer = await signUp();
    const { id, seats } = await publishedEvent(org);

    const tooMany = await buyer.agent.post(`/api/events/${id}/holds`).send({ seatIds: seats.slice(0, 7).map((s) => s.id) });
    expect(tooMany.status).toBe(400);
    await org.agent.post(`/api/events/${id}/holds`).send({ seatIds: [seats[0].id] }).expect(403);
    await request(app).post(`/api/events/${id}/holds`).send({ seatIds: [seats[0].id] }).expect(401);
  });
});
