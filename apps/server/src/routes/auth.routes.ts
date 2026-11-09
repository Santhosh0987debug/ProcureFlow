import { Router } from 'express';
import { login, logout, me, register } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authRateLimiter } from '../middleware/rate-limit.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/auth.schemas.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validateBody(registerSchema), register);
authRouter.post('/login', authRateLimiter, validateBody(loginSchema), login);
authRouter.post('/logout', logout);
authRouter.get('/me', authenticate, me);
