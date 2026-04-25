'use client';

import { DISPLAY_DECIMALS } from '@exness/shared';
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useCandles, type Candle } from '@/hooks/useCandles';
import { useOpenOrders, type OpenOrder } from '@/hooks/useOpenOrders';
import { useCloseTrade } from '@/hooks/useTradeMutations';
import { usePrice } from '@/store/prices';
import { fmtPnl, pnlClass } from '@/lib/format';
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
  onEditPosition: (o: OpenOrder) => void;
};

export function ChartPanel({ asset, tf, onTfChange, overlays = [], onEditPosition }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const { data } = useCandles(asset, tf);
  const live = usePrice(asset);
  const { data: openOrders } = useOpenOrders();

  // Bumped on chart pan/zoom so the position-marker overlays recompute their
  // y-coordinates (priceToCoordinate output shifts when the user drags or
  // zooms even though `live` and `data` haven't changed).
  const [, setRangeTick] = useState(0);

  // Candle the crosshair is currently hovering. When set, the OHLC readout
  // shows that candle's values; when null we fall back to the latest bar
  // (with the live mid folded in). Stored as float prices for easy display.
  const [hoveredCandle, setHoveredCandle] = useState<CandlestickData | null>(null);

  // Crosshair handler runs in a closure registered once; reach fresh `data`
  // through this ref so it always reads the latest candles array.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const ohlc = useMemo(
    () => computeOhlc(data?.candles ?? [], live, hoveredCandle),
    [data, live, hoveredCandle],
  );

  const positions = useMemo(
    () => openOrders?.trades.filter((t) => t.asset === asset) ?? [],
    [openOrders, asset],
  );

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

    // When the user pans / zooms the chart, the y-coordinate corresponding to
    // a fixed price changes. Bump rangeTick so the position-marker overlays
    // recompute their `top` styles.
    const ts = chart.timeScale();
    const onRange = (): void => setRangeTick((n) => n + 1);
    ts.subscribeVisibleLogicalRangeChange(onRange);

    // Crosshair tracking → drives the cursor-locked OHLC readout above the
    // chart. We look up the candle by `param.logical` (the bar index) from
    // our own `data` rather than `param.seriesData` — the seriesData lookup
    // proved unreliable across lightweight-charts versions, and we already
    // have the candle data locally, so it's both faster and correct.
    const onCrosshair = (param: MouseEventParams): void => {
      if (param.time === undefined || param.logical === undefined) {
        setHoveredCandle(null);
        return;
      }
      const candles = dataRef.current?.candles ?? [];
      const idx = Math.round(param.logical);
      const c = candles[idx];
      if (!c) {
        setHoveredCandle(null);
        return;
      }
      const scale = 10 ** c.decimal;
      setHoveredCandle({
        time: c.timestamp as UTCTimestamp,
        open: c.open / scale,
        high: c.high / scale,
        low: c.low / scale,
        close: c.close / scale,
      });
    };
    chart.subscribeCrosshairMove(onCrosshair);

    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;
    return () => {
      ts.unsubscribeVisibleLogicalRangeChange(onRange);
      chart.unsubscribeCrosshairMove(onCrosshair);
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
        value: c.volume / 1e8,
        color: c.close >= c.open ? UP_VOL : DOWN_VOL,
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  // Per-asset display precision for the y-axis labels and the right-edge live
  // price tag. Storage decimals (BTC=4, SOL=6) are still used for the math
  // that feeds the series; this only governs how lightweight-charts *renders*
  // those numbers to the user.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const dec = DISPLAY_DECIMALS[asset];
    series.applyOptions({
      priceFormat: { type: 'price', precision: dec, minMove: 1 / 10 ** dec },
    });
  }, [asset]);

  // Sync overlays to price lines (Liq / SL / TP — Entry is now the marker)
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

  // Live-tick the last candle on every price frame from the WS store. Uses
  // the BID (matches Exness's chart-line convention) so the chart's right-
  // edge live label aligns with the sidebar's Bid value.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !live || !data?.candles.length) return;
    const last = data.candles[data.candles.length - 1];
    if (!last) return;
    const dec = last.decimal;
    const liveBid = live.bid / 10 ** dec;
    const currentHigh = last.high / 10 ** dec;
    const currentLow = last.low / 10 ** dec;
    series.update({
      time: last.timestamp as UTCTimestamp,
      open: last.open / 10 ** dec,
      high: Math.max(currentHigh, liveBid),
      low: Math.min(currentLow, liveBid),
      close: liveBid,
    });
  }, [live, data]);

  return (
    <div className="flex h-full flex-col">
      {/* Header: asset name + OHLC readout + timeframe picker */}
      <div className="flex items-center justify-between gap-4 border-b border-[color:var(--color-border)] px-4 py-2">
        <div className="flex min-w-0 items-center gap-4">
          <h2 className="font-medium">
            {asset} <span className="text-xs text-[color:var(--color-fg-dim)]">USD</span>
          </h2>
          {ohlc && (
            <div className="hidden items-center gap-3 font-mono text-[11px] tabular-nums md:flex">
              <OhlcCell label="O" value={fmtFloat(ohlc.open, DISPLAY_DECIMALS[asset])} />
              <OhlcCell label="H" value={fmtFloat(ohlc.high, DISPLAY_DECIMALS[asset])} />
              <OhlcCell label="L" value={fmtFloat(ohlc.low, DISPLAY_DECIMALS[asset])} />
              <OhlcCell label="C" value={fmtFloat(ohlc.close, DISPLAY_DECIMALS[asset])} />
              <span className={cn('text-[11px]', ohlcChangeClass(ohlc.diff))}>
                {ohlc.diff >= 0 ? '+' : ''}
                {ohlc.diff.toFixed(DISPLAY_DECIMALS[asset])}{' '}
                ({ohlc.pct >= 0 ? '+' : ''}
                {ohlc.pct.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>
        <TimeframePicker value={tf} onChange={onTfChange} />
      </div>

      {/* Chart canvas + position markers */}
      <div className="relative flex-1">
        <div ref={containerRef} className="h-full w-full" />

        {/* In-chart position markers — replace static Entry price-lines */}
        {positions.map((p) => (
          <PositionMarker
            key={p.orderId}
            order={p}
            series={seriesRef.current}
            onEdit={onEditPosition}
          />
        ))}
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
  // Float prices (post-decimal-scaling). All four are in the asset's natural
  // unit (e.g. dollars for BTC, not the bigint integer at 4 decimals).
  open: number;
  high: number;
  low: number;
  close: number;
  decimal: number; // for display formatting
  diff: number;    // float, e.g. -29.47
  pct: number;     // human percent, e.g. -0.04
};

// Compute the OHLC values to display:
//   - If the user is hovering a candle, use that candle's values directly
//     (these come from lightweight-charts as floats).
//   - Otherwise show the latest candle, folding in the live mid so H/L/C
//     update on every WS tick (matches the chart's last-bar live update).
function computeOhlc(
  candles: Candle[],
  live: { ask: number; bid: number; decimals: number } | undefined,
  hovered: CandlestickData | null,
): Ohlc | null {
  // Decimal precision is stable across candles for a given asset; pull from
  // any candle (prefer the last so we have something even when hovering an
  // unrelated point).
  const last = candles[candles.length - 1];
  if (!last) return null;
  const dec = last.decimal;

  if (hovered) {
    const open = hovered.open;
    const close = hovered.close;
    const diff = close - open;
    const pct = open === 0 ? 0 : (diff / open) * 100;
    return { open, high: hovered.high, low: hovered.low, close, decimal: dec, diff, pct };
  }

  // Latest-bar fallback (live-tick-aware). All values in `last` are stored
  // as bigint-scaled integers; convert to floats once. Live update uses
  // the BID side so the OHLC readout matches the bid-priced chart line.
  const scale = 10 ** dec;
  let open = last.open / scale;
  let high = last.high / scale;
  let low = last.low / scale;
  let close = last.close / scale;
  if (live && live.decimals === dec) {
    const liveBid = live.bid / scale;
    high = Math.max(high, liveBid);
    low = Math.min(low, liveBid);
    close = liveBid;
  }
  const diff = close - open;
  const pct = open === 0 ? 0 : (diff / open) * 100;
  return { open, high, low, close, decimal: dec, diff, pct };
}

function fmtFloat(v: number, decimals: number): string {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Floating HTML pill anchored at the entry price's y-coordinate. Renders
// over the chart canvas via absolute positioning. Clicking the body opens
// the Edit modal (TP / SL); the ✕ button issues a direct close.
function PositionMarker({
  order,
  series,
  onEdit,
}: {
  order: OpenOrder;
  series: ISeriesApi<'Candlestick'> | null;
  onEdit: (o: OpenOrder) => void;
}) {
  const closeMut = useCloseTrade();
  const isLong = order.type === 'buy';
  const entryPrice = order.openPrice / 10 ** order.decimals;

  // priceToCoordinate is sync; safe to call on every render. Returns null
  // when the price is outside the visible price range — in that case we
  // pin the marker to top or bottom of the canvas so it remains visible.
  const yRaw = series ? series.priceToCoordinate(entryPrice) : null;
  if (yRaw === null || yRaw === undefined) return null;
  const y = yRaw;

  async function onCloseClick(e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    try {
      const r = await closeMut.mutateAsync(order.orderId);
      toast.success(`Closed ${order.asset} — pnl ${fmtPnl(r.pnl)}`);
    } catch {
      toast.error('Close failed (may already be closed)');
    }
  }

  return (
    <div
      // Anchor on the right side of the chart, vertically centred on the
      // entry price. Right-padded enough to clear the price axis label.
      className="absolute right-20"
      style={{ top: `${y - 14}px` }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onEdit(order)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onEdit(order);
        }}
        className={cn(
          'flex cursor-pointer items-stretch divide-x divide-black/30 overflow-hidden rounded-sm border text-[11px] font-medium tabular-nums shadow-sm transition-opacity hover:opacity-90',
          isLong
            ? 'border-[color:var(--color-up)] bg-[color:var(--color-up)]/15 text-[color:var(--color-up)]'
            : 'border-[color:var(--color-down)] bg-[color:var(--color-down)]/15 text-[color:var(--color-down)]',
        )}
        title={`Click to edit SL/TP for this ${isLong ? 'long' : 'short'} position`}
      >
        <span className="px-1.5 py-0.5">{isLong ? '▲' : '▼'}</span>
        <span className="px-1.5 py-0.5 font-mono">${(order.margin / 100).toFixed(2)}</span>
        <span
          className={cn(
            'px-1.5 py-0.5 font-mono text-[color:var(--color-fg)]',
            pnlClass(order.unrealizedPnl),
          )}
        >
          {fmtPnl(order.unrealizedPnl)}
        </span>
        <button
          type="button"
          onClick={onCloseClick}
          disabled={closeMut.isPending}
          aria-label="Close position"
          className="bg-black/30 px-2 py-0.5 text-[color:var(--color-fg)] hover:bg-black/50 disabled:opacity-50"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
