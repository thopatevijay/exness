'use client';

import { DISPLAY_DECIMALS } from '@exness/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAssets } from '@/hooks/useAssets';
import { useOpenTrade, type OpenInput } from '@/hooks/useTradeMutations';
import { ApiResponseError } from '@/lib/api';
import { fmtPrice } from '@/lib/format';
import { usePrice } from '@/store/prices';
import { useSession } from '@/components/SessionProvider';
import { cn } from '@/lib/utils';

// All numeric inputs are registered with `valueAsNumber: true`, so the schema
// sees real numbers — no need for z.coerce (which would make the resolver's
// input type `unknown` and fight exactOptionalPropertyTypes).
const Schema = z.object({
  asset: z.enum(['BTC', 'ETH', 'SOL']),
  marginUsd: z.number().positive().min(1),
  leverage: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(20), z.literal(100)]),
  stopLossPrice: z.number().positive().optional(),
  takeProfitPrice: z.number().positive().optional(),
});
type Input = z.infer<typeof Schema>;

const LEVERAGES = [1, 5, 10, 20, 100] as const;
// Margin stepper increment. Sized for the default $100 starting margin —
// 10 clicks moves you across an order of magnitude. Hold for fast input.
const MARGIN_STEP_USD = 10;
const MARGIN_MIN_USD = 1;

type Side = 'buy' | 'sell';

type Props = { selected: 'BTC' | 'ETH' | 'SOL' };

export function OrderPanel({ selected }: Props) {
  const { data: assetsData } = useAssets();
  const live = usePrice(selected);
  const open = useOpenTrade();
  const router = useRouter();
  const session = useSession();
  const authed = session.authed;
  const [stagedSide, setStagedSide] = useState<Side | null>(null);

  const { control, register, handleSubmit, setValue, watch } = useForm<Input>({
    resolver: zodResolver(Schema),
    defaultValues: { asset: selected, marginUsd: 100, leverage: 10 },
  });
  const marginUsd = watch('marginUsd') ?? 0;
  const leverage = watch('leverage');
  const slPrice = watch('stopLossPrice');
  const tpPrice = watch('takeProfitPrice');

  useEffect(() => {
    setValue('asset', selected);
    setStagedSide(null);
  }, [selected, setValue]);

  const asset = assetsData?.assets.find((a) => a.symbol === selected);
  // `decimals` = storage scale (used for input parsing + math). `displayDec`
  // = how many digits the user sees (Exness/MT5 convention).
  const decimals = asset?.decimals ?? 4;
  const displayDec = DISPLAY_DECIMALS[selected] ?? decimals;

  // Prefer the live WS price; fall back to the /assets snapshot only on
  // first paint before the socket has streamed its first frame.
  const ask = live?.ask ?? asset?.ask ?? null;
  const bid = live?.bid ?? asset?.bid ?? null;

  // Spread cost in USD on the user's planned position. This is what real
  // Exness shows in the spread pill (e.g. "14.00 USD") and is the actual
  // round-trip cost the user will pay (we don't charge separate fees —
  // the bid-ask gap IS our fee).
  //
  //   notional = marginUsd × leverage      (USD value of the position)
  //   cost     = notional × (ask − bid) / mid
  //
  // With our fixed 1% spread (SPREAD_BPS=100), (ask−bid)/mid ≡ 0.01, so
  // the cost simplifies to notional × 0.01. We compute from raw ask/bid
  // anyway so this stays correct if spread becomes variable later.
  const spreadCostUsd =
    ask !== null && bid !== null && ask + bid > 0
      ? (marginUsd * leverage * (ask - bid)) / ((ask + bid) / 2)
      : null;

  const stageSide = (side: Side) =>
    handleSubmit(() => {
      if (ask === null || bid === null) return;
      setStagedSide(side);
    });

  const confirm = async (): Promise<void> => {
    if (stagedSide === null) return;
    if (!authed) {
      router.push('/login?next=/webtrading');
      return;
    }
    await handleSubmit(async (data) => {
      try {
        const payload: OpenInput = {
          asset: data.asset,
          type: stagedSide,
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
        toast.success(`Opened ${stagedSide.toUpperCase()} ${data.asset} ${data.leverage}x`);
        setStagedSide(null);
      } catch (err) {
        if (err instanceof ApiResponseError) toast.error(err.message);
        else toast.error('Network error');
      }
    })();
  };

  return (
    <form className="space-y-3">
      {/* Twin price-buttons — sell at BID (left), buy at ASK (right). The
          live quote IS the button label and re-renders on every WS tick.
          The thin spread pill in the gutter shows the bid-ask gap. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <PriceButton
          side="sell"
          label="Sell"
          price={bid}
          decimals={decimals}
          displayDec={displayDec}
          disabled={open.isPending}
          onClick={stageSide('sell')}
        />
        <SpreadPill costUsd={spreadCostUsd} />
        <PriceButton
          side="buy"
          label="Buy"
          price={ask}
          decimals={decimals}
          displayDec={displayDec}
          disabled={open.isPending}
          onClick={stageSide('buy')}
        />
      </div>

      <div>
        <span className="text-xs text-[color:var(--color-fg-dim)]">Margin (USD)</span>
        <div className="mt-1 flex items-stretch gap-1">
          <button
            type="button"
            aria-label="Decrease margin"
            onClick={() =>
              setValue('marginUsd', Math.max(MARGIN_MIN_USD, marginUsd - MARGIN_STEP_USD), {
                shouldValidate: true,
              })
            }
            className="w-9 cursor-pointer rounded-md border border-[color:var(--color-border)] font-mono text-base hover:bg-[color:var(--color-bg-elevated)]"
          >
            −
          </button>
          <input
            type="number"
            step="0.01"
            min={MARGIN_MIN_USD}
            {...register('marginUsd', { valueAsNumber: true })}
            className="block w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-3 py-2 text-center font-mono"
          />
          <button
            type="button"
            aria-label="Increase margin"
            onClick={() =>
              setValue('marginUsd', marginUsd + MARGIN_STEP_USD, { shouldValidate: true })
            }
            className="w-9 cursor-pointer rounded-md border border-[color:var(--color-border)] font-mono text-base hover:bg-[color:var(--color-bg-elevated)]"
          >
            +
          </button>
        </div>
      </div>

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

      {/* Stop loss / take profit — flat, always visible (no collapse). Empty
          input shows the "Not set" placeholder; entering a value attaches
          it to the order at submit. */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-[color:var(--color-fg-dim)]">Stop loss</span>
          <input
            type="number"
            step={`0.${'0'.repeat(Math.max(0, decimals - 1))}1`}
            placeholder="Not set"
            {...register('stopLossPrice', {
              setValueAs: (v: string | number) => {
                if (v === '' || v === null) return undefined;
                const n = +v;
                return Number.isNaN(n) ? undefined : n;
              },
            })}
            className="mt-1 block w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-2 py-2 font-mono text-sm placeholder:text-[color:var(--color-fg-dim)]"
          />
        </label>
        <label className="block">
          <span className="text-xs text-[color:var(--color-fg-dim)]">Take profit</span>
          <input
            type="number"
            step={`0.${'0'.repeat(Math.max(0, decimals - 1))}1`}
            placeholder="Not set"
            {...register('takeProfitPrice', {
              setValueAs: (v: string | number) => {
                if (v === '' || v === null) return undefined;
                const n = +v;
                return Number.isNaN(n) ? undefined : n;
              },
            })}
            className="mt-1 block w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-2 py-2 font-mono text-sm placeholder:text-[color:var(--color-fg-dim)]"
          />
        </label>
      </div>

      {stagedSide !== null && ask !== null && bid !== null && (
        <ConfirmCard
          side={stagedSide}
          asset={selected}
          openPrice={stagedSide === 'buy' ? ask : bid}
          marginUsd={marginUsd}
          leverage={leverage}
          slPrice={slPrice}
          tpPrice={tpPrice}
          spreadCostUsd={spreadCostUsd ?? 0}
          decimals={decimals}
          displayDec={displayDec}
          submitting={open.isPending}
          authed={authed}
          onConfirm={confirm}
          onCancel={() => setStagedSide(null)}
        />
      )}
    </form>
  );
}

function PriceButton({
  side,
  label,
  price,
  decimals,
  displayDec,
  disabled,
  onClick,
}: {
  side: Side;
  label: string;
  price: number | null;
  decimals: number;
  displayDec: number;
  disabled: boolean;
  onClick: () => void;
}) {
  const isBuy = side === 'buy';
  return (
    <button
      type="button"
      disabled={disabled || price === null}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer flex-col items-stretch rounded-md py-3 text-left transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50',
        isBuy
          ? 'bg-[color:var(--color-accent)]/15 ring-1 ring-[color:var(--color-accent)]'
          : 'bg-[color:var(--color-down)]/15 ring-1 ring-[color:var(--color-down)]',
      )}
    >
      <span
        className={cn(
          'px-3 text-[10px] font-semibold uppercase tracking-wider',
          isBuy ? 'text-[color:var(--color-accent)]' : 'text-[color:var(--color-down)]',
        )}
      >
        {label}
      </span>
      <span className="mt-1 px-3 font-mono text-base tabular-nums text-[color:var(--color-fg)]">
        {price === null ? '—' : fmtPrice(price, decimals, displayDec)}
      </span>
    </button>
  );
}

// `costUsd` is the round-trip spread cost on the planned position (notional ×
// spread rate). Updates as the user changes margin/leverage AND as the live
// quotes tick. Matches what real Exness's "14.00 USD" pill shows.
function SpreadPill({ costUsd }: { costUsd: number | null }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 text-[9px]">
      <span className="uppercase tracking-wider text-[color:var(--color-fg-dim)]">Spread</span>
      <span className="mt-1 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-2 py-0.5 font-mono tabular-nums">
        {costUsd === null ? '—' : `$${costUsd.toFixed(2)}`}
      </span>
    </div>
  );
}

function ConfirmCard({
  side,
  asset,
  openPrice,
  marginUsd,
  leverage,
  slPrice,
  tpPrice,
  spreadCostUsd,
  decimals,
  displayDec,
  submitting,
  authed,
  onConfirm,
  onCancel,
}: {
  side: Side;
  asset: 'BTC' | 'ETH' | 'SOL';
  openPrice: number;
  marginUsd: number;
  leverage: number;
  slPrice: number | undefined;
  tpPrice: number | undefined;
  spreadCostUsd: number;
  decimals: number;
  displayDec: number;
  submitting: boolean;
  authed: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isBuy = side === 'buy';
  const notional = marginUsd * leverage;
  const liqRaw = isBuy ? openPrice * (1 - 1 / leverage) : openPrice * (1 + 1 / leverage);

  const ctaCls = isBuy
    ? 'bg-[color:var(--color-accent)] hover:opacity-90'
    : 'bg-[color:var(--color-down)] hover:opacity-90';

  return (
    <div className="space-y-3 rounded-md border border-[color:var(--color-border)] p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-fg-dim)]">
        Confirm order
      </h3>

      <button
        type="button"
        disabled={submitting}
        onClick={onConfirm}
        className={cn(
          'w-full cursor-pointer rounded-md py-3 text-sm font-semibold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-50',
          ctaCls,
        )}
      >
        {submitting
          ? 'Opening…'
          : !authed
            ? `Sign in to ${isBuy ? 'Buy' : 'Sell'} $${marginUsd.toFixed(2)} @ ${fmtPrice(openPrice, decimals, displayDec)}`
            : `Confirm ${isBuy ? 'Buy' : 'Sell'} $${marginUsd.toFixed(2)} @ ${fmtPrice(openPrice, decimals, displayDec)}`}
      </button>

      <button
        type="button"
        disabled={submitting}
        onClick={onCancel}
        className="w-full cursor-pointer rounded-md border border-[color:var(--color-border)] py-2 text-sm hover:bg-[color:var(--color-bg-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>

      <dl className="space-y-1 rounded-md bg-[color:var(--color-bg-elevated)] p-3 text-xs">
        <Row label="Asset" value={asset} />
        <Row label="Side" value={isBuy ? 'Buy / Long' : 'Sell / Short'} />
        <Row label="Margin" value={`$${marginUsd.toFixed(2)}`} mono />
        <Row label="Leverage" value={`${leverage}x`} mono />
        <Row label="Notional" value={`$${notional.toFixed(2)}`} mono />
        <Row label="Open price" value={fmtPrice(openPrice, decimals, displayDec)} mono />
        <Row label="Liquidation" value={(liqRaw / 10 ** decimals).toFixed(displayDec)} mono />
        <Row label="Spread cost" value={`$${spreadCostUsd.toFixed(2)}`} mono />
        <Row label="Stop loss" value={slPrice !== undefined ? slPrice.toFixed(displayDec) : '—'} mono />
        <Row label="Take profit" value={tpPrice !== undefined ? tpPrice.toFixed(displayDec) : '—'} mono />
      </dl>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[color:var(--color-fg-dim)]">{label}</dt>
      <dd className={cn('text-[color:var(--color-fg)]', mono && 'font-mono tabular-nums')}>
        {value}
      </dd>
    </div>
  );
}
