import React, { useState } from 'react';
import { Search, Loader2, ArrowUpRight, ArrowDownRight, Info, Plus } from 'lucide-react';
import { TradeItem } from '../types/trade';
import { formatCurrency } from '../utils/calculations';

interface TradeInputFormProps {
  onAddTrade: (trade: TradeItem) => Promise<boolean>;
  isOpen?: boolean;
  onClose?: () => void;
  isInline?: boolean;
}

const POPULAR_TICKERS = ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'TSLA', 'SPY', 'AMD'];

export default function TradeInputForm({
  onAddTrade,
  isOpen = true,
  onClose,
  isInline = false
}: TradeInputFormProps) {
  const [ticker, setTicker] = useState('NVDA');
  const [startDate, setStartDate] = useState(() => {
    // Default to ~60 days ago
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().split('T')[0];
  });
  const [startPrice, setStartPrice] = useState<string>('180.50');
  const [endDate, setEndDate] = useState(() => {
    // Default to ~60 days in the future
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().split('T')[0];
  });
  const [targetPrice, setTargetPrice] = useState<string>('240.00');
  const [doi, setDoi] = useState('10.1016/j.jbankfin.2024.107120');
  const [initiationStatusMetric, setInitiationStatusMetric] = useState<string>('1.35');

  // Live quote lookup state
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [quoteInfo, setQuoteInfo] = useState<{ price: number; change: number; pct: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch real-time market quote from backend Yahoo Finance proxy
  const handleFetchQuote = async (symbolToFetch: string) => {
    if (!symbolToFetch.trim()) return;
    setIsFetchingQuote(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/quote/${encodeURIComponent(symbolToFetch.trim())}`);
      if (!res.ok) throw new Error('Symbol not found on Yahoo Finance');
      const data = await res.json();
      setQuoteInfo({
        price: data.current_price,
        change: data.change,
        pct: data.change_percent
      });
      // Optionally suggest start price if empty or 0
      if (!startPrice || Number(startPrice) === 0) {
        setStartPrice(data.current_price.toString());
      }
    } catch (err) {
      console.warn('Quote fetch notice:', err);
      setQuoteInfo(null);
    } finally {
      setIsFetchingQuote(false);
    }
  };

  const handleSelectTicker = (sym: string) => {
    setTicker(sym);
    handleFetchQuote(sym);
  };

  // Quick target percentage calculators
  const applyTargetMultiplier = (pct: number) => {
    const sp = parseFloat(startPrice);
    if (!isNaN(sp) && sp > 0) {
      const computed = sp * (1 + pct / 100);
      setTargetPrice(computed.toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const sPrice = parseFloat(startPrice);
    const tPrice = parseFloat(targetPrice);
    const initMetric = parseFloat(initiationStatusMetric);

    if (!ticker.trim()) {
      setErrorMessage('Ticker symbol is required.');
      return;
    }
    if (!startDate) {
      setErrorMessage('Start date is required.');
      return;
    }
    if (isNaN(sPrice) || sPrice <= 0) {
      setErrorMessage('Start price must be a positive number.');
      return;
    }
    if (!endDate) {
      setErrorMessage('End date is required.');
      return;
    }
    if (isNaN(tPrice) || tPrice <= 0) {
      setErrorMessage('Target price must be a positive number.');
      return;
    }
    if (!doi.trim()) {
      setErrorMessage('Document ID (DOI) is required per schema specification.');
      return;
    }

    // Calculate pct_diff_current_vs_target
    // Percentage deviation from target price
    const currentRef = quoteInfo?.price ?? sPrice;
    const pctDiff = Number((((currentRef - tPrice) / tPrice) * 100).toFixed(2));

    const newTrade: TradeItem = {
      ticker: ticker.trim().toUpperCase(),
      start_date: startDate,
      start_price: sPrice,
      end_date: endDate,
      target_price: tPrice,
      doi: doi.trim(),
      initiation_status_metric: isNaN(initMetric) ? 0 : initMetric,
      pct_diff_current_vs_target: pctDiff
    };

    setIsSubmitting(true);
    const success = await onAddTrade(newTrade);
    setIsSubmitting(false);

    if (success) {
      if (onClose) onClose();
      // Reset or pick next popular ticker
      setTicker('MSFT');
      setQuoteInfo(null);
    } else {
      setErrorMessage('Failed to save trade to manifest. Please try again.');
    }
  };

  const sPriceNum = parseFloat(startPrice) || 0;
  const tPriceNum = parseFloat(targetPrice) || 0;
  const projectedReturn = sPriceNum > 0 ? ((tPriceNum - sPriceNum) / sPriceNum) * 100 : 0;

  const content = (
    <div className="bg-[#0f172a] border border-neutral-800 rounded-xl p-5 text-white shadow-lg">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
        <div>
          <h3 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
            <Plus className="w-4 h-4 text-sky-400" />
            Input New Trade
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Add trade parameters for OHLC origin series download and ERP manifest publication.
          </p>
        </div>

        {onClose && !isInline && (
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 cursor-pointer text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 text-rose-200 text-xs rounded-lg flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Popular Ticker Quick Chips */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
          <span>Quick Select Asset Ticker:</span>
          {quoteInfo && (
            <span className="font-mono text-xs">
              Live Yahoo Quote: <strong className="text-white">{formatCurrency(quoteInfo.price)}</strong>
              <span className={quoteInfo.change >= 0 ? ' text-emerald-400 ml-1' : ' text-rose-400 ml-1'}>
                ({quoteInfo.pct >= 0 ? '+' : ''}{quoteInfo.pct}%)
              </span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_TICKERS.map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => handleSelectTicker(sym)}
              className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md border transition-colors cursor-pointer ${
                ticker === sym
                  ? 'bg-sky-950/80 border-sky-500 text-sky-200 font-semibold'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Ticker & Live Fetch */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Ticker Symbol <span className="text-rose-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="e.g. AAPL, NVDA, SPY"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500 font-mono uppercase"
              />
              <button
                type="button"
                onClick={() => handleFetchQuote(ticker)}
                disabled={isFetchingQuote || !ticker.trim()}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs text-neutral-200 rounded-lg flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                title="Fetch live market quote from Yahoo Finance"
              >
                {isFetchingQuote ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span>Quote</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Initiation Status Metric <span className="text-neutral-400 font-normal">(Health)</span>
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={initiationStatusMetric}
              onChange={(e) => setInitiationStatusMetric(e.target.value)}
              placeholder="e.g. 1.45 or -0.50"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Row 2: Start Date & Start Price (Origination of OHLC) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-neutral-950/40 rounded-lg border border-neutral-800/80">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-neutral-300">
                Start Date (OHLC Origin) <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-neutral-500 font-mono">YYYY-MM-DD</span>
            </div>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              Date where Yahoo Finance OHLC price series originates.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-neutral-300">
                Start Price (Purchase Price) <span className="text-rose-400">*</span>
              </label>
              {quoteInfo && (
                <button
                  type="button"
                  onClick={() => setStartPrice(quoteInfo.price.toString())}
                  className="text-[11px] text-sky-400 hover:text-sky-300 underline cursor-pointer"
                >
                  Use Live Quote (${quoteInfo.price})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-neutral-500 font-mono">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={startPrice}
                onChange={(e) => setStartPrice(e.target.value)}
                placeholder="100.00"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Purchase price used to calculate % up/down gain.
            </p>
          </div>
        </div>

        {/* Row 3: End Date & Target Price */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-neutral-950/40 rounded-lg border border-neutral-800/80">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-neutral-300">
                End Date (Target Resolution) <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-neutral-500 font-mono">YYYY-MM-DD</span>
            </div>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              Target resolution date of the trade.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-neutral-300">
                Target Price (Exit Strategy) <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyTargetMultiplier(15)}
                  className="text-[10px] bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 rounded text-neutral-300 cursor-pointer"
                >
                  +15%
                </button>
                <button
                  type="button"
                  onClick={() => applyTargetMultiplier(25)}
                  className="text-[10px] bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 rounded text-neutral-300 cursor-pointer"
                >
                  +25%
                </button>
                <button
                  type="button"
                  onClick={() => applyTargetMultiplier(50)}
                  className="text-[10px] bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 rounded text-neutral-300 cursor-pointer"
                >
                  +50%
                </button>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-neutral-500 font-mono">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="150.00"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Used to calculate percentage complete progress.
            </p>
          </div>
        </div>

        {/* Row 4: DOI (Document ID for Research Paper / Source) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-neutral-300">
              Document ID (DOI / Research Attribution) <span className="text-rose-400">*</span>
            </label>
            <span className="text-[11px] text-neutral-400">Where research originated</span>
          </div>
          <input
            type="text"
            required
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder="e.g. 10.1016/j.jbankfin.2024.107120 or ERP-RES-492"
            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
          />
          <p className="text-[11px] text-neutral-400 mt-1">
            Standard research identifier or paper DOI backing this trade initiation.
          </p>
        </div>

        {/* Trade Metrics Preview Bar */}
        <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400">Target Upside:</span>
            <span className={`font-mono font-semibold flex items-center ${projectedReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {projectedReturn >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
              {projectedReturn >= 0 ? '+' : ''}{projectedReturn.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-400">Entry:</span>
            <span className="font-mono text-neutral-200">{formatCurrency(sPriceNum)}</span>
            <span className="text-neutral-500">→</span>
            <span className="text-neutral-400">Target:</span>
            <span className="font-mono text-emerald-400 font-semibold">{formatCurrency(tPriceNum)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Recording to Manifest...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Publish Trade to Manifest</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );

  return content;
}
