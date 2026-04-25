'use client';

import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef } from 'react';
import { useCandles, type Candle } from '@/hooks/useCandles';
import { useOpenOrders } from '@/hooks/useOpenOrders';
import { usePrice } from '@/store/prices';
import { fmtPnl, fmtPrice, pnlClass } from '@/lib/format';
import { cn } from '@/lib/utils';
import { TimeframePicker, type TF } from './TimeframePicker';

// Exness-style colour convention: blue (up) / red (down).
const UP_COLOR = '#2962ff';
const DOWN_COLOR = '#ef4444';
const UP_VOL = 'rgba(41,98,255,0.5)';
const DOWN_VOL = 'rgba(239,68,68,0.5)';

export type ChartOverlay = {
  price: number;
  color: string;
  label: string;
};

type Props = {
  asset: 'BTC' | 'ETH' | 'SOL';
  tf: TF;
  onTfChange: (tf: TF) => void;
  overlays?: ChartOverlay[];
};

export function ChartPanel({ asset, tf, onTfChange, overlays = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const { data } = useCandles(asset, tf);
  const live = usePrice(asset);
  const { data: openOrders } = useOpenOrders();

  // OHLC for the current (last) candle. High/Low/Close fold in the live mid
  // so the readout updates on every price tick — matches the live-tick that
  // mutates the chart's last bar in the effect below.
  const ohlc = useMemo(() => computeOhlc(data?.candles ?? [], live), [data, live]);

  // Cumulative unrealized P/L on positions in the currently-charted asset.
  const assetPnl = useMemo(() => {
    const positions = openOrders?.trades.filter((t) => t.asset === asset) ?? [];
    return positions.length === 0
      ? null
      : positions.reduce((sum, t) => sum + t.unrealizedPnl, 0);
  }, [openOrders, asset]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' },
        textColor: '#bbb',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      timeScale: {
        rightOffset: 6,
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      localization: {
        timeFormatter: (ts: number) => {
          const d = new Date(ts * 1000);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const hh = String(d.getHours()).padStart(2, '0');
          const mi = String(d.getMinutes()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
        },
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderVisible: false,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      linesRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !data) return;
    const candles: Candle[] = data.candles;
    const points = candles.map((c) => ({
      time: c.timestamp as UTCTimestamp,
      open: c.open / 10 ** c.decimal,
      high: c.high / 10 ** c.decimal,
      low: c.low / 10 ** c.decimal,
      close: c.close / 10 ** c.decimal,
    }));
    seriesRef.current.setData(points);
    volumeRef.current?.setData(
      candles.map((c) => ({
        time: c.timestamp as UTCTimestamp,
        value: c.volume / 1e8, // qty stored at 8 decimals
        color: c.close >= c.open ? UP_VOL : DOWN_VOL,
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  // Sync overlays to price lines
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const line of linesRef.current) series.removePriceLine(line);
    linesRef.current = overlays.map((o) =>
      series.createPriceLine({
        price: o.price,
        color: o.color,
        lineWidth: 1,
        lineStyle: 2, // dashed
        title: o.label,
        axisLabelVisible: true,
      }),
    );
  }, [overlays]);

  // Live-tick the last candle on every price frame from the WS store
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !live || !data?.candles.length) return;
    const last = data.candles[data.candles.length - 1];
    if (!last) return;
    const dec = last.decimal;
    const liveMid = (live.ask + live.bid) / 2 / 10 ** dec;
    const currentHigh = last.high / 10 ** dec;
    const currentLow = last.low / 10 ** dec;
    series.update({
      time: last.timestamp as UTCTimestamp,
      open: last.open / 10 ** dec,
      high: Math.max(currentHigh, liveMid),
      low: Math.min(currentLow, liveMid),
      close: liveMid,
    });
  }, [live, data]);

  return (
    <div className="flex h-full flex-col">
      {/* Header row 1: asset name + OHLC readout + timeframe picker */}
      <div className="flex items-center justify-between gap-4 border-b border-[color:var(--color-border)] px-4 py-2">
        <div className="flex min-w-0 items-center gap-4">
          <h2 className="font-medium">
            {asset} <span className="text-xs text-[color:var(--color-fg-dim)]">USD</span>
          </h2>
          {ohlc && (
            <div className="hidden items-center gap-3 font-mono text-[11px] tabular-nums md:flex">
              <OhlcCell label="O" value={fmtPrice(ohlc.open, ohlc.decimal)} />
              <OhlcCell label="H" value={fmtPrice(ohlc.high, ohlc.decimal)} />
              <OhlcCell label="L" value={fmtPrice(ohlc.low, ohlc.decimal)} />
              <OhlcCell label="C" value={fmtPrice(ohlc.close, ohlc.decimal)} />
              <span className={cn('text-[11px]', ohlcChangeClass(ohlc.diff))}>
                {ohlc.diff >= 0 ? '+' : ''}
                {(ohlc.diff / 10 ** ohlc.decimal).toFixed(2)}{' '}
                ({ohlc.pct >= 0 ? '+' : ''}
                {ohlc.pct.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>
        <TimeframePicker value={tf} onChange={onTfChange} />
      </div>

      {/* Chart canvas + floating P/L chip overlay */}
      <div className="relative flex-1">
        <div ref={containerRef} className="h-full w-full" />
        {assetPnl !== null && (
          <div
            className={cn(
              'pointer-events-none absolute right-2 top-2 rounded border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)]/85 px-2 py-1 font-mono text-xs tabular-nums backdrop-blur-sm',
              pnlClass(assetPnl),
            )}
          >
            {fmtPnl(assetPnl)} USD
          </div>
        )}
      </div>
    </div>
  );
}

function OhlcCell({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-[color:var(--color-fg-dim)]">{label}</span>{' '}
      <span className="text-[color:var(--color-fg)]">{value}</span>
    </span>
  );
}

function ohlcChangeClass(diff: number): string {
  if (diff > 0) return 'text-[color:var(--color-up)]';
  if (diff < 0) return 'text-[color:var(--color-down)]';
  return 'text-[color:var(--color-fg-dim)]';
}

type Ohlc = {
  open: number;
  high: number;
  low: number;
  close: number;
  decimal: number;
  diff: number; // close − open, raw integer at `decimal` precision
  pct: number;  // human percent (e.g. -0.06)
};

// Compute OHLC for the most recent candle, folding in the live tick so the
// readout matches what the chart's last-bar update is rendering.
function computeOhlc(
  candles: Candle[],
  live: { ask: number; bid: number; decimals: number } | undefined,
): Ohlc | null {
  const last = candles[candles.length - 1];
  if (!last) return null;
  const dec = last.decimal;
  let { open, high, low, close } = last;
  if (live && live.decimals === dec) {
    const mid = Math.round((live.ask + live.bid) / 2);
    high = Math.max(high, mid);
    low = Math.min(low, mid);
    close = mid;
  }
  const diff = close - open;
  const pct = open === 0 ? 0 : (diff / open) * 100;
  return { open, high, low, close, decimal: dec, diff, pct };
}
