import crypto from 'node:crypto';
import { env } from '../config/env.js';

// QR payload format: SL1.<ticketId>.<signature>
// The HMAC means a QR code can't be forged or altered (e.g. by editing the
// ticket id) without the server secret; the DB lookup at check-in then
// confirms the ticket is still valid and unused.
const PREFIX = 'SL1';

function sign(ticketId) {
  return crypto.createHmac('sha256', env.TICKET_SIGNING_SECRET).update(`${PREFIX}.${ticketId}`).digest('base64url').slice(0, 22);
}

export function qrPayloadFor(ticketId) {
  return `${PREFIX}.${ticketId}.${sign(String(ticketId))}`;
}

// Returns the ticket id if the payload is authentic, otherwise null.
export function verifyQrPayload(payload) {
  if (typeof payload !== 'string') return null;
  const parts = payload.trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX || !/^[a-f\d]{24}$/i.test(parts[1])) return null;
  const expected = Buffer.from(sign(parts[1]));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return parts[1];
}
