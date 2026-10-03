import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { eventsRouter } from './events.routes.js';
import { eventHoldsRouter, holdsRouter } from './holds.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/events/:id/holds', eventHoldsRouter);
apiRouter.use('/events', eventsRouter);
apiRouter.use('/holds', holdsRouter);
