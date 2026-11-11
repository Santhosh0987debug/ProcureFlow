import { Router } from 'express';
import { acceptWorkspaceInvitation } from '../controllers/invitation.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate.js';
import { acceptInvitationSchema } from '../validators/workspace.schemas.js';

export const invitationRouter = Router();

invitationRouter.post(
  '/accept',
  authenticate,
  validateBody(acceptInvitationSchema),
  acceptWorkspaceInvitation,
);
