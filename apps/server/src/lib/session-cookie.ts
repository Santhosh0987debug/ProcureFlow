import type { CookieOptions, Response } from 'express';
import { env } from '../config/env.js';

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: '/',
  ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
};

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(env.cookieName, token, {
    ...baseCookieOptions,
    maxAge: env.sessionTtlHours * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(env.cookieName, baseCookieOptions);
}
