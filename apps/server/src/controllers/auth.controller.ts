import type { AuthSessionResponse, LoginRequest, RegisterRequest } from '@procureflow/shared';
import type { RequestHandler } from 'express';
import { requireAuthenticatedUser } from '../lib/auth-context.js';
import { clearSessionCookie, setSessionCookie } from '../lib/session-cookie.js';
import { loginUser, registerUser, toAuthSession } from '../services/auth.service.js';

export const register: RequestHandler = async (request, response) => {
  const result = await registerUser(request.body as RegisterRequest);

  setSessionCookie(response, result.token);

  const body: AuthSessionResponse = { data: result.session };
  response.status(201).json(body);
};

export const login: RequestHandler = async (request, response) => {
  const result = await loginUser(request.body as LoginRequest);

  setSessionCookie(response, result.token);

  const body: AuthSessionResponse = { data: result.session };
  response.status(200).json(body);
};

export const logout: RequestHandler = (_request, response) => {
  clearSessionCookie(response);
  response.status(204).end();
};

export const me: RequestHandler = (request, response) => {
  const user = requireAuthenticatedUser(request);
  const body: AuthSessionResponse = { data: toAuthSession(user) };
  response.status(200).json(body);
};
