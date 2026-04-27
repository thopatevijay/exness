const isProd = process.env.NODE_ENV === 'production';

export const ACCESS_COOKIE = isProd ? '__Host-token' : 'token';
export const REFRESH_COOKIE = isProd ? '__Secure-refresh-token' : 'refresh-token';

export const ACCESS_COOKIE_MAX_AGE_S = 15 * 60;
export const REFRESH_COOKIE_MAX_AGE_S = 7 * 24 * 60 * 60;

export const ACCESS_COOKIE_PATH = '/';
export const REFRESH_COOKIE_PATH = '/api/auth/refresh';
