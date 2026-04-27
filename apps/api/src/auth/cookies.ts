import { env } from '@exness/config';

const isProd = env.NODE_ENV === 'production';

export const ACCESS_COOKIE = isProd ? '__Host-token' : 'token';
export const REFRESH_COOKIE = isProd ? '__Secure-refresh-token' : 'refresh-token';

export const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const ACCESS_COOKIE_PATH = '/';
export const REFRESH_COOKIE_PATH = '/api/v1/auth/refresh';
