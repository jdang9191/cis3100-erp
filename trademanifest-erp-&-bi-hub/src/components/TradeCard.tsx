import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileText,
  Clock,
  Target
} from 'lucide-react';
import { TradeItem, MarketDataResponse } from '../types/trade';
import { calculateTradeMetrics, formatCurrency, formatPercent, formatDate } from '../utils/calculations';
import OHLCChart from './OHLCChart';

interface TradeCardProps {
  trade: TradeItem;
  market?: MarketDataResponse;
  index: number;
  onDelete: (index: number) => void;
  isExpandedInitial?: boolean;
}

export default function TradeCard({
  trade,
  market,
  index,
  onDelete,
  isExpandedInitial = false
}: TradeCardProps) {
  const [isExpanded, setIsExpanded] = useState(isExpandedInitial);
  const metrics = calculateTradeMetrics(trade, market);

  // Check if DOI is a standard DOI (starting with 10.)
  const isStandardDoi = trade.doi.startsWith('10.');
  const doiUrl = isStandardDoi ? `https://doi.org/${encodeURIComponent(trade.doi)}` : null;

  // Percentage complete bounds and styling
  // e.g. 0 to 100+
  const progressClamped = Math.max(0, Math.min(100, metrics.percentComplete));
  const isOverachieved = metrics.percentComplete > 100;

  return (
    <div className="bg-[#0f172a] border border-neutral-800 rounded-xl overflow-hidden transition-all hover:border-neutral-700 shadow-sm">
      {/* Main Row / Card Summary */}
      <div className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Section 1: Ticker & Live Price & DOI */}
          <div className="flex items-start gap-4 min-w-[240px]">
            <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-700/80 flex items-center justify-center font-bold text-lg text-white font-mono shrink-0 shadow-inner">
              {trade.ticker}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white tracking-tight">{trade.ticker}</span>
                <span className="text-xs text-neutral-400 font-mono">
                  {market?.currency || 'USD'}
                </span>
                {market?.source === 'yahoo' && (
                  <span className="text-[10px] text-emerald-400 font-medium bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                    Yahoo Live
                  </span>
                )}
              </div>

              {/* Research Attribution DOI */}
              <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-1">
                <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span className="text-neutral-400">DOI:</span>
                {doiUrl ? (
                  <a
                    href={doiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 truncate max-w-[200px]"
                    title={`Open research DOI: ${trade.doi}`}
                  >
                    <span className="truncate">{trade.doi}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <span className="font-mono text-neutral-300 truncate max-w-[200px]" title={trade.doi}>
                    {trade.doi}
                  </span>
                )}
              </div>

              {/* Initiation status health metric */}
              <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-1">
                <span>Health Metric:</span>
                <span className={`font-mono font-semibold ${trade.initiation_status_metric >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {trade.initiation_status_metric >= 0 ? '+' : ''}{trade.initiation_status_metric}
                </span>
                <span>·</span>
                <span>Target Dev:</span>
                <span className="font-mono text-neutral-300">
                  {trade.pct_diff_current_vs_target >= 0 ? '+' : ''}{trade.pct_diff_current_vs_target}%
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Current Price & Return from Purchase (Start Price) */}
          <div className="flex items-center gap-6 border-y lg:border-y-0 lg:border-x border-neutral-800/80 py-3 lg:py-0 lg:px-6">
            <div>
              <span className="text-xs text-neutral-400 block mb-0.5">Current Market Price</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-white tabular-nums">
                  {formatCurrency(metrics.currentPrice)}
                </span>
                <span className={`text-xs font-mono font-semibold flex items-center ${metrics.dailyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {metrics.dailyChange >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> : <TrendingDown className="w-3.5 h-3.5 mr-0.5" />}
                  {metrics.dailyChange >= 0 ? '+' : ''}{metrics.dailyChange} ({formatPercent(metrics.dailyChangePercent)})
                </span>
              </div>
              <span className="text-[11px] text-neutral-400 mt-0.5 block">
                Purchase: <span className="font-mono text-neutral-300">{formatCurrency(trade.start_price)}</span> on {trade.start_date}
              </span>
            </div>

            {/* Core Metric 1: % Up or Down from Purchase (Start Price) */}
            <div className="bg-neutral-950/70 border border-neutral-800 rounded-lg p-2.5 min-w-[125px]">
              <span className="text-[11px] text-neutral-400 block uppercase tracking-wider font-semibold">
                Return vs Entry
              </span>
              <div className={`text-base font-bold font-mono tabular-nums flex items-center mt-0.5 ${metrics.isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                {metrics.isProfit ? <TrendingUp className="w-4 h-4 mr-1 shrink-0" /> : <TrendingDown className="w-4 h-4 mr-1 shrink-0" />}
                {formatPercent(metrics.percentReturn)}
              </div>
              <span className="text-[10px] text-neutral-400 block mt-0.5 font-mono">
                {metrics.isProfit ? 'Unrealized Gain' : 'Unrealized Drawdown'}
              </span>
            </div>
          </div>

          {/* Section 3: Percentage Complete relative to Target Price */}
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-neutral-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-sky-400" />
                Target Progress
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className={`font-mono font-bold text-sm tabular-nums ${metrics.isTargetHit ? 'text-emerald-400' : 'text-sky-300'}`}>
                  {metrics.percentComplete.toFixed(1)}% Complete
                </span>
                {isOverachieved && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950 px-1 py-0.2 rounded border border-emerald-800">
                    EXCEEDED
                  </span>
                )}
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-neutral-950 rounded-full h-2.5 overflow-hidden border border-neutral-800 relative">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  metrics.isTargetHit
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : 'bg-gradient-to-r from-sky-500 to-indigo-500'
                }`}
                style={{ width: `${progressClamped}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-1 font-mono">
              <span>Start: {formatCurrency(trade.start_price)}</span>
              <span>Target: <strong className="text-emerald-300">{formatCurrency(trade.target_price)}</strong></span>
            </div>
          </div>

          {/* Section 4: Resolution Date & Expand / Actions */}
          <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-neutral-800">
            <div className="text-right">
              <div className="flex items-center gap-1 text-xs text-neutral-300 justify-end">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span>Target: {formatDate(trade.end_date)}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-neutral-400 justify-end mt-0.5">
                <Clock className="w-3 h-3 text-neutral-400" />
                <span>
                  {metrics.daysRemaining >= 0
                    ? `${metrics.daysRemaining} days remaining`
                    : `${Math.abs(metrics.daysRemaining)} days past target`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 ml-2">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-2 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  isExpanded
                    ? 'bg-sky-950/60 border-sky-600 text-sky-200'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                }`}
                title={isExpanded ? 'Hide OHLC Chart' : 'Show OHLC Market Chart'}
              >
                <span className="hidden sm:inline">OHLC</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => onDelete(index)}
                className="p-2 rounded-lg bg-neutral-900 hover:bg-rose-950/60 border border-neutral-800 hover:border-rose-800 text-neutral-400 hover:text-rose-300 transition-colors cursor-pointer"
                title="Remove trade from manifest"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable OHLC Price Chart Container */}
      {isExpanded && (
        <div className="border-t border-neutral-800 bg-neutral-950/70 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-neutral-300">
              <strong>Yahoo Finance Historical Series</strong>: Downloaded from trade initiation date (
              <span className="font-mono text-sky-400">{trade.start_date}</span>) through today (
              <span className="font-mono text-sky-400">{new Date().toISOString().split('T')[0]}</span>).
            </div>
            <div className="flex items-center gap-3 text-neutral-400 font-mono text-[11px]">
              <span>Start: {formatCurrency(trade.start_price)}</span>
              <span>·</span>
              <span>Current: {formatCurrency(metrics.currentPrice)}</span>
              <span>·</span>
              <span>Target: {formatCurrency(trade.target_price)}</span>
            </div>
          </div>

          <OHLCChart
            ohlc={metrics.ohlc}
            startPrice={trade.start_price}
            targetPrice={trade.target_price}
            ticker={trade.ticker}
            startDate={trade.start_date}
            height={280}
          />
        </div>
      )}
    </div>
  );
}
