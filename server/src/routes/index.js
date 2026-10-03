import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { eventsRouter } from './events.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/events', eventsRouter);
