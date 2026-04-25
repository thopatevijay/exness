'use client';

import { DISPLAY_DECIMALS } from '@exness/shared';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { OpenOrder } from '@/hooks/useOpenOrders';
import { useModifyTrade, type ModifyInput } from '@/hooks/useTradeMutations';
import { ApiResponseError } from '@/lib/api';
import { fmtPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: OpenOrder | null;
};

export function EditPositionModal({ open, onOpenChange, order }: Props) {
  const modify = useModifyTrade();
  const [slInput, setSlInput] = useState('');
  const [tpInput, setTpInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    setSlInput(order.stopLoss !== null ? (order.stopLoss / 10 ** order.decimals).toString() : '');
    setTpInput(
      order.takeProfit !== null ? (order.takeProfit / 10 ** order.decimals).toString() : '',
    );
    setError(null);
  }, [order]);

  async function submit(body: ModifyInput): Promise<void> {
    if (!order) return;
    setError(null);
    try {
      await modify.mutateAsync({ orderId: order.orderId, body });
      toast.success('Position updated');
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiResponseError) setError(err.message);
      else setError('Network error');
    }
  }

  function buildBody(): ModifyInput | null {
    if (!order) return null;
    const body: ModifyInput = {};
    const origSlPrice = order.stopLoss !== null ? order.stopLoss / 10 ** order.decimals : null;
    const origTpPrice = order.takeProfit !== null ? order.takeProfit / 10 ** order.decimals : null;

    if (slInput === '') {
      if (origSlPrice !== null) body.stopLoss = null;
    } else {
      // eslint-disable-next-line no-restricted-syntax -- UI boundary: user input string to number
      const n = Number(slInput);
      if (!Number.isFinite(n) || n <= 0) {
        setError('SL must be a positive number');
        return null;
      }
      const rawInt = Math.round(n * 10 ** order.decimals);
      if (origSlPrice === null || rawInt !== order.stopLoss) body.stopLoss = rawInt;
    }

    if (tpInput === '') {
      if (origTpPrice !== null) body.takeProfit = null;
    } else {
      // eslint-disable-next-line no-restricted-syntax -- UI boundary: user input string to number
      const n = Number(tpInput);
      if (!Number.isFinite(n) || n <= 0) {
        setError('TP must be a positive number');
        return null;
      }
      const rawInt = Math.round(n * 10 ** order.decimals);
      if (origTpPrice === null || rawInt !== order.takeProfit) body.takeProfit = rawInt;
    }

    if (body.stopLoss === undefined && body.takeProfit === undefined) {
      setError('No changes to save');
      return null;
    }
    return body;
  }

  async function onSave() {
    const body = buildBody();
    if (!body) return;
    await submit(body);
  }

  async function onClearSL() {
    if (order?.stopLoss === null) return;
    await submit({ stopLoss: null });
  }

  async function onClearTP() {
    if (order?.takeProfit === null) return;
    await submit({ takeProfit: null });
  }

  if (!order) return null;
  const displayDec = DISPLAY_DECIMALS[order.asset] ?? order.decimals;
  const openPriceDisplay = fmtPrice(order.openPrice, order.decimals, displayDec);
  const step = `0.${'0'.repeat(Math.max(0, order.decimals - 1))}1`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-[oklch(0.27_0.012_260)] p-4 text-sm shadow-[0_16px_40px_rgba(0,0,0,0.65)] ring-1 ring-white/5">
          <Dialog.Title className="text-sm font-semibold">
            Edit SL/TP — {order.asset} {order.type.toUpperCase()}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-[color:var(--color-fg-dim)]">
            Open price <span className="font-mono">{openPriceDisplay}</span>. Leave blank to keep
            unchanged; empty a field and save to clear it.
          </Dialog.Description>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs text-[color:var(--color-fg-dim)]">Stop loss</span>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  step={step}
                  min="0"
                  value={slInput}
                  onChange={(e) => setSlInput(e.target.value)}
                  placeholder={order.type === 'buy' ? '< open' : '> open'}
                  className="block w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-2 py-1 font-mono"
                />
                <button
                  type="button"
                  onClick={onClearSL}
                  disabled={order.stopLoss === null || modify.isPending}
                  className="rounded-md border border-[color:var(--color-border)] px-2 text-xs text-[color:var(--color-fg-dim)] hover:bg-black/20 disabled:opacity-30"
                >
                  Clear
                </button>
              </div>
            </label>
            <label className="block">
              <span className="text-xs text-[color:var(--color-fg-dim)]">Take profit</span>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  step={step}
                  min="0"
                  value={tpInput}
                  onChange={(e) => setTpInput(e.target.value)}
                  placeholder={order.type === 'buy' ? '> open' : '< open'}
                  className="block w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-2 py-1 font-mono"
                />
                <button
                  type="button"
                  onClick={onClearTP}
                  disabled={order.takeProfit === null || modify.isPending}
                  className="rounded-md border border-[color:var(--color-border)] px-2 text-xs text-[color:var(--color-fg-dim)] hover:bg-black/20 disabled:opacity-30"
                >
                  Clear
                </button>
              </div>
            </label>
          </div>

          {error && (
            <div className="mt-3 rounded-md border border-[color:var(--color-down)] bg-[color:var(--color-down)]/10 px-3 py-2 text-xs text-[color:var(--color-down)]">
              {error}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={onSave}
              disabled={modify.isPending}
              className={cn(
                'rounded-md bg-[color:var(--color-accent)] px-3 py-1.5 text-xs font-medium text-black hover:opacity-90',
                'disabled:opacity-50',
              )}
            >
              {modify.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
