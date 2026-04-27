import { Router, type Router as ExpressRouter } from 'express';
import {
  ModifyTradeSchema,
  OpenTradeSchema,
  ResetDemoSchema,
  SigninSchema,
  SignupSchema,
} from '@exness/shared';
import { signin } from '../auth/signin.js';
import { signup } from '../auth/signup.js';
import { requireAdmin } from '../middleware/admin.js';
import { requireAuth } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { ipRateLimit, userRateLimit } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { getPlatformSummary } from './admin.js';
import { getAssets } from './assets.js';
import { getBalance } from './balance.js';
import { getCandles } from './candles.js';
import { closeTrade } from './tradeClose.js';
import { modifyTrade } from './tradeModify.js';
import { openTrade } from './trade.js';
import { getClosedTrades } from './tradesClosed.js';
import { getOpenTrades } from './tradesOpen.js';
import { deposit } from './userDeposit.js';
import { getMe } from './userMe.js';
import { resetDemo } from './userReset.js';

export const router: ExpressRouter = Router();

// Per-route rate limiters (created once, reused for every request). Keys are
// userId after requireAuth, IP for unauth'd routes. Sized for normal usage:
//   signup:  5/min/IP   — bcrypt(12) is intentionally slow, prevents CPU DoS
//   deposit: 1/hour/UID — pre-audit this was unbounded; pair with idempotency
//   trade:   30/min/UID — generous for active trading, blocks botting
//   close:   60/min/UID — closes can stack with autoclose events
const signupLimit = ipRateLimit({ limit: 5, windowMs: 60_000 });
const depositLimit = userRateLimit({ limit: 1, windowMs: 60 * 60_000 });
const tradeLimit = userRateLimit({ limit: 30, windowMs: 60_000 });
const closeLimit = userRateLimit({ limit: 60, windowMs: 60_000 });

// Public — market data endpoints have no per-user component, so they're
// open to guests powering the showroom-mode trading view.
router.post('/user/signup', signupLimit, validateBody(SignupSchema), signup);
router.post('/user/signin', validateBody(SigninSchema), signin);
router.get('/assets', getAssets);
router.get('/candles', getCandles);

// Protected
router.get('/user/me', requireAuth, getMe);
router.get('/user/balance', requireAuth, getBalance);
router.post('/user/deposit', requireAuth, depositLimit, idempotency, deposit);
router.post(
  '/user/reset-demo',
  requireAuth,
  validateBody(ResetDemoSchema),
  resetDemo,
);
router.post(
  '/trade',
  requireAuth,
  tradeLimit,
  idempotency,
  validateBody(OpenTradeSchema),
  openTrade,
);
router.post(
  '/trade/:id/modify',
  requireAuth,
  tradeLimit,
  validateBody(ModifyTradeSchema),
  modifyTrade,
);
router.post('/trade/:id/close', requireAuth, closeLimit, closeTrade);
router.get('/trades/open', requireAuth, getOpenTrades);
router.get('/trades', requireAuth, getClosedTrades);

// Admin — gated by users.is_admin. Promote a user with:
//   UPDATE users SET is_admin = true WHERE email = 'you@example.com';
router.get('/admin/platform', requireAuth, requireAdmin, getPlatformSummary);
