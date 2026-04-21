import { Router, type Router as ExpressRouter } from 'express';
import { SigninSchema, SignupSchema } from '@exness/shared';
import { signin } from '../auth/signin.js';
import { signup } from '../auth/signup.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { getBalance } from './balance.js';

export const router: ExpressRouter = Router();

router.post('/user/signup', validateBody(SignupSchema), signup);
router.post('/user/signin', validateBody(SigninSchema), signin);
router.get('/user/balance', requireAuth, getBalance);
