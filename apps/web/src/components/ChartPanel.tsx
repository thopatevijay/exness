'use client';

import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { useCandles, type Candle } from '@/hooks/useCandles';
import { TimeframePicker, type TF } from './TimeframePicker';

type Props = {
  asset: 'BTC' | 'ETH' | 'SOL';
  tf: TF;
  onTfChange: (tf: TF) => void;
};

export function ChartPanel({ asset, tf, onTfChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const { data, isLoading } = useCandles(asset, tf);

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
      timeScale: { rightOffset: 6, borderColor: 'rgba(255,255,255,0.1)' },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
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
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-2">
        <h2 className="font-medium">
          {asset} <span className="text-xs text-[color:var(--color-fg-dim)]">USD</span>
        </h2>
        <TimeframePicker value={tf} onChange={onTfChange} />
      </div>
      <div className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 grid place-items-center text-sm text-[color:var(--color-fg-dim)]">
            Loading candles…
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
