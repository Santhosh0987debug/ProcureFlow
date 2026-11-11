import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { healthRouter } from './health.routes.js';
import { invitationRouter } from './invitation.routes.js';
import { workspaceRouter } from './workspace.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/health', healthRouter);
apiRouter.use('/workspaces', workspaceRouter);
apiRouter.use('/invitations', invitationRouter);
