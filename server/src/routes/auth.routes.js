import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User, ROLES } from '../models/User.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, signToken, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const authRouter = Router();

// Slow down credential stuffing / brute force on the auth endpoints only.
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Try again in a few minutes.', code: 'RATE_LIMITED' } } });

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.email('Enter a valid email').transform((e) => e.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role: z.enum(ROLES).default('attendee'),
});

const loginSchema = z.object({
  email: z.email('Enter a valid email').transform((e) => e.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

authRouter.post('/register', authLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (await User.exists({ email })) throw AppError.conflict('An account with this email already exists');
  const user = await User.create({ name, email, role, passwordHash: await User.hashPassword(password) });
  setAuthCookie(res, signToken(user));
  res.status(201).json({ user });
}));

authRouter.post('/login', authLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  // Same message for unknown email and wrong password: don't reveal which accounts exist.
  if (!user || !(await user.verifyPassword(req.body.password))) {
    throw new AppError(401, 'Incorrect email or password', { code: 'BAD_CREDENTIALS' });
  }
  setAuthCookie(res, signToken(user));
  res.json({ user });
}));

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
