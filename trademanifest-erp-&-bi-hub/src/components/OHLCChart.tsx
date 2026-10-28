import { useState, useMemo } from 'react';
import { OHLCPoint } from '../types/trade';
import { formatCurrency, formatPercent } from '../utils/calculations';

interface OHLCChartProps {
  ohlc: OHLCPoint[];
  startPrice: number;
  targetPrice: number;
  ticker: string;
  startDate: string;
  height?: number;
}

export default function OHLCChart({
  ohlc,
  startPrice,
  targetPrice,
  ticker,
  startDate,
  height = 260
}: OHLCChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<'candles' | 'line'>('candles');

  const width = 800; // viewBox width
  const padding = { top: 24, right: 70, bottom: 36, left: 16 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = width - padding.left - padding.right;

  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (!ohlc || ohlc.length === 0) {
      const min = Math.min(startPrice, targetPrice) * 0.95;
      const max = Math.max(startPrice, targetPrice) * 1.05;
      return { minPrice: min, maxPrice: max, priceRange: max - min || 1 };
    }

    let min = Math.min(...ohlc.map(p => p.low), startPrice, targetPrice);
    let max = Math.max(...ohlc.map(p => p.high), startPrice, targetPrice);

    // Add 5% breathing room
    const paddingVal = (max - min) * 0.08 || 1;
    min -= paddingVal;
    max += paddingVal;

    return { minPrice: min, maxPrice: max, priceRange: max - min };
  }, [ohlc, startPrice, targetPrice]);

  const maxVolume = useMemo(() => {
    if (!ohlc || ohlc.length === 0) return 1;
    return Math.max(...ohlc.map(p => p.volume || 0), 1);
  }, [ohlc]);

  // Coordinate mapping
  const getY = (val: number) => {
    return padding.top + chartHeight - ((val - minPrice) / priceRange) * chartHeight;
  };

  const getX = (index: number) => {
    if (ohlc.length <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (ohlc.length - 1)) * chartWidth;
  };

  const candleWidth = useMemo(() => {
    if (ohlc.length === 0) return 6;
    const computed = (chartWidth / ohlc.length) * 0.7;
    return Math.max(2, Math.min(12, computed));
  }, [ohlc.length, chartWidth]);

  const activePoint = hoverIndex !== null && ohlc[hoverIndex] ? ohlc[hoverIndex] : ohlc[ohlc.length - 1];

  // Generate SVG path for line chart mode
  const linePath = useMemo(() => {
    if (ohlc.length === 0) return '';
    return ohlc.reduce((acc, point, idx) => {
      const x = getX(idx);
      const y = getY(point.close);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [ohlc, minPrice, priceRange]);

  const areaPath = useMemo(() => {
    if (ohlc.length === 0) return '';
    const firstX = getX(0);
    const lastX = getX(ohlc.length - 1);
    const bottomY = padding.top + chartHeight;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePath, ohlc.length]);

  if (!ohlc || ohlc.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-neutral-400 bg-neutral-950/40 rounded-lg border border-neutral-800">
        <span className="text-sm">Downloading OHLC market series from Yahoo Finance...</span>
        <span className="text-xs text-neutral-500 mt-1">Origin date: {startDate}</span>
      </div>
    );
  }

  const startPriceY = getY(startPrice);
  const targetPriceY = getY(targetPrice);

  return (
    <div className="w-full bg-neutral-950/60 rounded-lg border border-neutral-800/80 p-4 relative font-sans">
      {/* Chart Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800 mb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-wide text-neutral-200">
            {ticker} OHLC Series
          </span>
          <span className="text-xs text-neutral-400">
            Origin: <span className="font-mono text-neutral-300">{startDate}</span>
          </span>
          <span className="text-xs text-neutral-500">·</span>
          <span className="text-xs text-neutral-400">
            {ohlc.length} Daily Candles
          </span>
        </div>

        {/* Live Candle Inspector HUD */}
        {activePoint && (
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
            <span className="text-neutral-400">{activePoint.date}</span>
            <span className="text-neutral-400">
              O: <span className="text-neutral-200">{formatCurrency(activePoint.open)}</span>
            </span>
            <span className="text-neutral-400">
              H: <span className="text-emerald-400">{formatCurrency(activePoint.high)}</span>
            </span>
            <span className="text-neutral-400">
              L: <span className="text-rose-400">{formatCurrency(activePoint.low)}</span>
            </span>
            <span className="text-neutral-400">
              C: <span className={activePoint.close >= activePoint.open ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {formatCurrency(activePoint.close)}
              </span>
            </span>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="flex items-center bg-neutral-900 rounded p-0.5 border border-neutral-800 text-xs">
          <button
            type="button"
            onClick={() => setChartMode('candles')}
            className={`px-2 py-0.5 rounded transition-colors ${
              chartMode === 'candles' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Candles
          </button>
          <button
            type="button"
            onClick={() => setChartMode('line')}
            className={`px-2 py-0.5 rounded transition-colors ${
              chartMode === 'line' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Line
          </button>
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible cursor-crosshair"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * width;
            const innerX = mouseX - padding.left;
            const progress = Math.max(0, Math.min(1, innerX / chartWidth));
            const idx = Math.round(progress * (ohlc.length - 1));
            setHoverIndex(idx);
          }}
        >
          <defs>
            <linearGradient id={`areaGrad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const price = minPrice + (1 - pct) * priceRange;
            const y = padding.top + pct * chartHeight;
            return (
              <g key={pct}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={width - padding.right + 8}
                  y={y + 3}
                  fontSize="9"
                  fontFamily="JetBrains Mono"
                  fill="#64748b"
                  textAnchor="start"
                >
                  ${price.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Reference Line: Purchase / Start Price */}
          {startPriceY >= padding.top && startPriceY <= padding.top + chartHeight && (
            <g>
              <line
                x1={padding.left}
                y1={startPriceY}
                x2={width - padding.right}
                y2={startPriceY}
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <rect
                x={width - padding.right + 4}
                y={startPriceY - 8}
                width="62"
                height="16"
                rx="2"
                fill="#0369a1"
              />
              <text
                x={width - padding.right + 8}
                y={startPriceY + 3}
                fontSize="9"
                fontFamily="JetBrains Mono"
                fill="#e0f2fe"
                fontWeight="600"
              >
                ENTRY ${startPrice.toFixed(1)}
              </text>
            </g>
          )}

          {/* Reference Line: Target Price */}
          {targetPriceY >= padding.top && targetPriceY <= padding.top + chartHeight && (
            <g>
              <line
                x1={padding.left}
                y1={targetPriceY}
                x2={width - padding.right}
                y2={targetPriceY}
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <rect
                x={width - padding.right + 4}
                y={targetPriceY - 8}
                width="64"
                height="16"
                rx="2"
                fill="#065f46"
              />
              <text
                x={width - padding.right + 8}
                y={targetPriceY + 3}
                fontSize="9"
                fontFamily="JetBrains Mono"
                fill="#ecfdf5"
                fontWeight="600"
              >
                TARGET ${targetPrice.toFixed(1)}
              </text>
            </g>
          )}

          {/* Volume bars at bottom (occupying bottom 22% of chart) */}
          {ohlc.map((p, idx) => {
            const x = getX(idx);
            const volPct = p.volume / maxVolume;
            const barHeight = volPct * (chartHeight * 0.22);
            const y = padding.top + chartHeight - barHeight;
            const isBull = p.close >= p.open;
            return (
              <rect
                key={`vol-${idx}`}
                x={x - candleWidth / 2}
                y={y}
                width={candleWidth}
                height={Math.max(1, barHeight)}
                fill={isBull ? '#059669' : '#dc2626'}
                opacity="0.22"
              />
            );
          })}

          {/* Line Chart Mode */}
          {chartMode === 'line' && (
            <>
              <path d={areaPath} fill={`url(#areaGrad-${ticker})`} />
              <path
                d={linePath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Candlestick Chart Mode */}
          {chartMode === 'candles' &&
            ohlc.map((p, idx) => {
              const x = getX(idx);
              const highY = getY(p.high);
              const lowY = getY(p.low);
              const openY = getY(p.open);
              const closeY = getY(p.close);
              const isBull = p.close >= p.open;

              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));
              const color = isBull ? '#10b981' : '#f43f5e';

              return (
                <g key={`candle-${idx}`}>
                  {/* Wick */}
                  <line
                    x1={x}
                    y1={highY}
                    x2={x}
                    y2={lowY}
                    stroke={color}
                    strokeWidth="1"
                    strokeOpacity="0.8"
                  />
                  {/* Candle Body */}
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyTop}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={color}
                    rx="0.5"
                  />
                </g>
              );
            })}

          {/* Hover Crosshair */}
          {hoverIndex !== null && ohlc[hoverIndex] && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padding.top}
                x2={getX(hoverIndex)}
                y2={padding.top + chartHeight}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(ohlc[hoverIndex].close)}
                r="3.5"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Date Axis (first, middle, last) */}
          {ohlc.length > 0 && (
            <g>
              <text
                x={padding.left}
                y={height - 12}
                fontSize="10"
                fontFamily="JetBrains Mono"
                fill="#64748b"
                textAnchor="start"
              >
                {ohlc[0].date} (Origin)
              </text>
              {ohlc.length > 2 && (
                <text
                  x={padding.left + chartWidth / 2}
                  y={height - 12}
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                  fill="#64748b"
                  textAnchor="middle"
                >
                  {ohlc[Math.floor(ohlc.length / 2)].date}
                </text>
              )}
              <text
                x={width - padding.right}
                y={height - 12}
                fontSize="10"
                fontFamily="JetBrains Mono"
                fill="#64748b"
                textAnchor="end"
              >
                {ohlc[ohlc.length - 1].date} (Latest)
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend below */}
      <div className="flex flex-wrap items-center justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-900 mt-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-sky-400 inline-block border-b border-sky-300"></span>
            <span>Purchase Price ({formatCurrency(startPrice)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-emerald-500 inline-block"></span>
            <span>Target Price ({formatCurrency(targetPrice)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block"></span>
            <span className="w-2 h-2 rounded-xs bg-rose-500 inline-block"></span>
            <span>Daily Bull/Bear Candle</span>
          </div>
        </div>

        <div className="text-neutral-500 font-mono text-[11px]">
          Live Yahoo Finance OHLC feed · Cached &amp; synchronized
        </div>
      </div>
    </div>
  );
}
