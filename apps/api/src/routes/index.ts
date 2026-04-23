import { Router, type Router as ExpressRouter } from 'express';
import { ModifyTradeSchema, OpenTradeSchema, SigninSchema, SignupSchema } from '@exness/shared';
import { signin } from '../auth/signin.js';
import { signup } from '../auth/signup.js';
import { requireAuth } from '../middleware/auth.js';
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

// Public
router.post('/user/signup', validateBody(SignupSchema), signup);
router.post('/user/signin', validateBody(SigninSchema), signin);
router.get('/assets', getAssets);

// Protected
router.get('/user/me', requireAuth, getMe);
router.get('/user/balance', requireAuth, getBalance);
router.post('/user/deposit', requireAuth, deposit);
router.post('/user/reset-demo', requireAuth, resetDemo);
router.post('/trade', requireAuth, validateBody(OpenTradeSchema), openTrade);
router.post('/trade/:id/modify', requireAuth, validateBody(ModifyTradeSchema), modifyTrade);
router.post('/trade/:id/close', requireAuth, closeTrade);
router.get('/trades/open', requireAuth, getOpenTrades);
router.get('/trades', requireAuth, getClosedTrades);
router.get('/candles', requireAuth, getCandles);

// Admin (unauthenticated for V0 demo; V1 will add isAdmin flag + middleware)
router.get('/admin/platform', getPlatformSummary);
