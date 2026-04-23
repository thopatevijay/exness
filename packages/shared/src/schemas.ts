import { z } from 'zod';
import { SYMBOLS } from './symbols.js';

export const SignupSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
export type SignupInput = z.infer<typeof SignupSchema>;

// Signin accepts any non-empty password — min-length is a signup-time policy.
// Enforcing it at signin would leak policy via 411 and block legacy users.
export const SigninSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type SigninInput = z.infer<typeof SigninSchema>;

export const OpenTradeSchema = z.object({
  asset: z.enum(SYMBOLS),
  type: z.enum(['buy', 'sell']),
  margin: z.number().int().positive().min(100), // ≥ $1
  leverage: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(20), z.literal(100)]),
  stopLoss: z.number().int().positive().optional(),
  takeProfit: z.number().int().positive().optional(),
});
export type OpenTradeInput = z.infer<typeof OpenTradeSchema>;

export const ModifyTradeSchema = z
  .object({
    stopLoss: z.number().int().positive().nullable().optional(),
    takeProfit: z.number().int().positive().nullable().optional(),
  })
  .refine((d) => d.stopLoss !== undefined || d.takeProfit !== undefined, {
    message: 'at least one of stopLoss/takeProfit must be provided',
  });
export type ModifyTradeInput = z.infer<typeof ModifyTradeSchema>;

export const CandlesQuerySchema = z.object({
  asset: z.enum(SYMBOLS),
  startTime: z.coerce.number().int().nonnegative(),
  endTime: z.coerce.number().int().nonnegative(),
  ts: z.enum(['1m', '5m', '15m', '1h', '1d', '1w']),
});
