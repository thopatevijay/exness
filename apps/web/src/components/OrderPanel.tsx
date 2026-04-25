'use client';

import { DISPLAY_DECIMALS } from '@exness/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAssets } from '@/hooks/useAssets';
import { useOpenTrade, type OpenInput } from '@/hooks/useTradeMutations';
import { ApiResponseError } from '@/lib/api';
import { fmtPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

// All numeric inputs are registered with `valueAsNumber: true`, so the schema
// sees real numbers — no need for z.coerce (which would make the resolver's
// input type `unknown` and fight exactOptionalPropertyTypes).
const Schema = z.object({
  asset: z.enum(['BTC', 'ETH', 'SOL']),
  type: z.enum(['buy', 'sell']),
  marginUsd: z.number().positive().min(1),
  leverage: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(20), z.literal(100)]),
  stopLossPrice: z.number().positive().optional(),
  takeProfitPrice: z.number().positive().optional(),
});
type Input = z.infer<typeof Schema>;

const LEVERAGES = [1, 5, 10, 20, 100] as const;

type Props = { selected: 'BTC' | 'ETH' | 'SOL' };

export function OrderPanel({ selected }: Props) {
  const { data: assetsData } = useAssets();
  const open = useOpenTrade();

  const { control, register, handleSubmit, setValue, watch } = useForm<Input>({
    resolver: zodResolver(Schema),
    defaultValues: { asset: selected, type: 'buy', marginUsd: 100, leverage: 10 },
  });

  useEffect(() => {
    setValue('asset', selected);
  }, [selected, setValue]);

  const asset = assetsData?.assets.find((a) => a.symbol === selected);
  const type = watch('type');
  const marginUsd = watch('marginUsd') ?? 0;
  const leverage = watch('leverage');

  const exposure = marginUsd * leverage;
  // Long opens at ASK (the higher quote). Short opens at BID.
  const openPrice = type === 'buy' ? asset?.ask : asset?.bid;
  // `decimals` = storage scale (used for input parsing + math). `displayDec`
  // = how many digits the user sees (Exness/MT5 convention).
  const decimals = asset?.decimals ?? 4;
  const displayDec = DISPLAY_DECIMALS[selected] ?? decimals;
  const liqPrice = openPrice
    ? type === 'buy'
      ? (openPrice * (1 - 1 / leverage)) / 10 ** decimals
      : (openPrice * (1 + 1 / leverage)) / 10 ** decimals
    : null;

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload: OpenInput = {
        asset: data.asset,
        type: data.type,
        margin: Math.round(data.marginUsd * 100), // dollars → cents
        leverage: data.leverage,
      };
      if (data.stopLossPrice !== undefined) {
        payload.stopLoss = Math.round(data.stopLossPrice * 10 ** decimals);
      }
      if (data.takeProfitPrice !== undefined) {
        payload.takeProfit = Math.round(data.takeProfitPrice * 10 ** decimals);
      }
      await open.mutateAsync(payload);
      toast.success(`Opened ${data.type.toUpperCase()} ${data.asset} ${data.leverage}x`);
    } catch (err) {
      if (err instanceof ApiResponseError) toast.error(err.message);
      else toast.error('Network error');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <>
              <button
                type="button"
                onClick={() => field.onChange('buy')}
                className={cn(
                  'rounded-md py-2 text-sm font-medium',
                  field.value === 'buy'
                    ? 'bg-[color:var(--color-up)] text-black'
                    : 'border border-[color:var(--color-border)]',
                )}
              >
                Buy / Long
              </button>
              <button
                type="button"
                onClick={() => field.onChange('sell')}
                className={cn(
                  'rounded-md py-2 text-sm font-medium',
                  field.value === 'sell'
                    ? 'bg-[color:var(--color-down)] text-black'
                    : 'border border-[color:var(--color-border)]',
                )}
              >
                Sell / Short
              </button>
            </>
          )}
        />
      </div>

      <label className="block">
        <span className="text-xs text-[color:var(--color-fg-dim)]">Margin (USD)</span>
        <input
          type="number"
          step="0.01"
          min="1"
          {...register('marginUsd', { valueAsNumber: true })}
          className="mt-1 block w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-3 py-2 font-mono"
        />
      </label>

      <div>
        <span className="text-xs text-[color:var(--color-fg-dim)]">Leverage</span>
        <Controller
          control={control}
          name="leverage"
          render={({ field }) => (
            <div className="mt-1 inline-flex rounded-md border border-[color:var(--color-border)]">
              {LEVERAGES.map((L) => (
                <button
                  type="button"
                  key={L}
                  onClick={() => field.onChange(L)}
                  className={cn(
                    'px-3 py-1 text-sm font-mono',
                    field.value === L
                      ? 'bg-[color:var(--color-accent)] text-black'
                      : 'hover:bg-[color:var(--color-bg-elevated)]',
                  )}
                >
                  {L}x
                </button>
              ))}
            </div>
          )}
        />
      </div>

      <details className="rounded-md border border-[color:var(--color-border)] px-3 py-2">
        <summary className="cursor-pointer text-xs text-[color:var(--color-fg-dim)]">
          Stop loss / take profit (optional)
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-[color:var(--color-fg-dim)]">SL price</span>
            <input
              type="number"
              step={`0.${'0'.repeat(Math.max(0, decimals - 1))}1`}
              {...register('stopLossPrice', {
                setValueAs: (v: string | number) => {
                  if (v === '' || v === null) return undefined;
                  const n = +v;
                  return Number.isNaN(n) ? undefined : n;
                },
              })}
              className="mt-1 block w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-2 py-1 font-mono text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[color:var(--color-fg-dim)]">TP price</span>
            <input
              type="number"
              step={`0.${'0'.repeat(Math.max(0, decimals - 1))}1`}
              {...register('takeProfitPrice', {
                setValueAs: (v: string | number) => {
                  if (v === '' || v === null) return undefined;
                  const n = +v;
                  return Number.isNaN(n) ? undefined : n;
                },
              })}
              className="mt-1 block w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-2 py-1 font-mono text-sm"
            />
          </label>
        </div>
      </details>

      <div className="rounded-md bg-[color:var(--color-bg-elevated)] p-3 text-xs">
        <div className="flex justify-between">
          <span className="text-[color:var(--color-fg-dim)]">Exposure</span>
          <span className="font-mono">${exposure.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[color:var(--color-fg-dim)]">
            Open price ({type === 'buy' ? 'ask' : 'bid'})
          </span>
          <span className="font-mono">
            {openPrice ? fmtPrice(openPrice, decimals, displayDec) : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[color:var(--color-fg-dim)]">Liquidation</span>
          <span className="font-mono">{liqPrice ? liqPrice.toFixed(displayDec) : '—'}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={open.isPending}
        className={cn(
          'w-full rounded-md py-2 text-sm font-medium text-black',
          type === 'buy' ? 'bg-[color:var(--color-up)]' : 'bg-[color:var(--color-down)]',
          'disabled:opacity-50',
        )}
      >
        {open.isPending ? 'Opening...' : `Open ${type === 'buy' ? 'Long' : 'Short'}`}
      </button>
    </form>
  );
}
