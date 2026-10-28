import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  Target,
  FileJson,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  FolderOpen
} from 'lucide-react';
import TopBar from './components/TopBar';
import PublishingBanner from './components/PublishingBanner';
import TradeInputForm from './components/TradeInputForm';
import TradeCard from './components/TradeCard';
import ManifestModal from './components/ManifestModal';
import TraderProfileModal from './components/TraderProfileModal';
import ERPIntegrationGuide from './components/ERPIntegrationGuide';
import OHLCChart from './components/OHLCChart';
import { TradeItem, TradingManifest, MarketDataResponse } from './types/trade';
import { calculateTradeMetrics, formatCurrency, formatPercent } from './utils/calculations';

export default function App() {
  const [manifest, setManifest] = useState<TradingManifest | null>(null);
  const [marketDataMap, setMarketDataMap] = useState<Record<string, MarketDataResponse>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isMarketLoading, setIsMarketLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Navigation & Modals
  const [activeTab, setActiveTab] = useState('trades');
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isManifestModalOpen, setIsManifestModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showInlineAdd, setShowInlineAdd] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'progress' | 'return' | 'date' | 'ticker'>('progress');
  const [selectedChartTicker, setSelectedChartTicker] = useState<string>('NVDA');

  // 1. Boot up: Load trades and manifest from server
  const loadManifest = useCallback(async () => {
    try {
      const res = await fetch('/api/trades');
      if (res.ok) {
        const data: TradingManifest = await res.json();
        setManifest(data);
        return data;
      }
    } catch (err) {
      console.error('Failed to load trades manifest:', err);
    }
    return null;
  }, []);

  // 2. Boot up requirement: "For each trade, when the system boots up, OHLC price data is downloaded for each trade, from yahoo finance, for each symbol.
  // Use the start date as the date where OHLC must originate, as a start date for the OHLC time series data. The end date should be now, or the time that the system starts, today."
  const fetchMarketDataForTrades = useCallback(async (trades: TradeItem[]) => {
    if (!trades || trades.length === 0) return;
    setIsMarketLoading(true);

    const newMap: Record<string, MarketDataResponse> = {};

    // Download in parallel for each unique trade symbol & start_date
    const promises = trades.map(async (trade) => {
      try {
        const url = `/api/ohlc?ticker=${encodeURIComponent(trade.ticker)}&startDate=${encodeURIComponent(trade.start_date)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data: MarketDataResponse = await res.json();
          newMap[trade.ticker] = data;
        }
      } catch (err) {
        console.warn(`Error downloading OHLC for ${trade.ticker}:`, err);
      }
    });

    await Promise.allSettled(promises);
    setMarketDataMap((prev) => ({ ...prev, ...newMap }));
    setIsMarketLoading(false);
  }, []);

  useEffect(() => {
    async function boot() {
      setIsLoading(true);
      const data = await loadManifest();
      if (data && data.trades && data.trades.length > 0) {
        setSelectedChartTicker(data.trades[0].ticker);
        await fetchMarketDataForTrades(data.trades);
      }
      setIsLoading(false);
    }
    boot();
  }, [loadManifest, fetchMarketDataForTrades]);

  // Handle adding new trade
  const handleAddTrade = async (newTrade: TradeItem): Promise<boolean> => {
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTrade)
      });

      if (!res.ok) throw new Error('Server returned error adding trade');
      const data = await res.json();

      if (data.manifest) {
        setManifest(data.manifest);
        // Immediately trigger OHLC price download for new symbol starting at trade.start_date
        fetchMarketDataForTrades([newTrade]);
        return true;
      }
    } catch (err) {
      console.error('Error adding trade:', err);
    }
    return false;
  };

  // Handle deleting trade
  const handleDeleteTrade = async (index: number) => {
    if (!window.confirm('Are you sure you want to remove this trade from the manifest?')) return;

    try {
      const res = await fetch(`/api/trades/${index}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        setManifest(data.manifest);
      }
    } catch (err) {
      console.error('Error deleting trade:', err);
    }
  };

  // Handle updating trader profile
  const handleSaveProfile = async (firstName: string, lastName: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/trader-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trader_first_name: firstName, trader_last_name: lastName })
      });
      if (res.ok) {
        const data = await res.json();
        setManifest(data.manifest);
        return true;
      }
    } catch (err) {
      console.error('Error saving profile:', err);
    }
    return false;
  };

  // Handle re-publishing manifest
  const handlePublishManifest = async () => {
    if (!manifest) return;
    setIsPublishing(true);
    try {
      const res = await fetch('/api/manifest/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trader_first_name: manifest.trader_first_name,
          trader_last_name: manifest.trader_last_name,
          trades: manifest.trades
        })
      });
      if (res.ok) {
        const data = await res.json();
        setManifest(data.manifest);
      }
    } catch (err) {
      console.error('Error publishing manifest:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  // Calculate aggregated portfolio stats
  const aggregateStats = useMemo(() => {
    if (!manifest || !manifest.trades || manifest.trades.length === 0) {
      return {
        totalTrades: 0,
        avgProgress: 0,
        avgReturn: 0,
        profitableCount: 0,
        totalTargetValue: 0
      };
    }

    let sumProgress = 0;
    let sumReturn = 0;
    let profitCount = 0;
    let totalTargetVal = 0;

    manifest.trades.forEach((trade) => {
      const market = marketDataMap[trade.ticker];
      const m = calculateTradeMetrics(trade, market);
      sumProgress += m.percentComplete;
      sumReturn += m.percentReturn;
      if (m.isProfit) profitCount++;
      totalTargetVal += trade.target_price;
    });

    const count = manifest.trades.length;
    return {
      totalTrades: count,
      avgProgress: sumProgress / count,
      avgReturn: sumReturn / count,
      profitableCount: profitCount,
      totalTargetValue: totalTargetVal
    };
  }, [manifest, marketDataMap]);

  // Filtered and sorted trade list
  const filteredTrades = useMemo(() => {
    if (!manifest || !manifest.trades) return [];

    let list = manifest.trades.map((t, idx) => ({ trade: t, originalIndex: idx }));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(({ trade }) =>
        trade.ticker.toLowerCase().includes(q) ||
        trade.doi.toLowerCase().includes(q) ||
        trade.start_date.includes(q)
      );
    }

    list.sort((a, b) => {
      const mA = calculateTradeMetrics(a.trade, marketDataMap[a.trade.ticker]);
      const mB = calculateTradeMetrics(b.trade, marketDataMap[b.trade.ticker]);

      if (sortBy === 'progress') {
        return mB.percentComplete - mA.percentComplete;
      } else if (sortBy === 'return') {
        return mB.percentReturn - mA.percentReturn;
      } else if (sortBy === 'date') {
        return new Date(b.trade.start_date).getTime() - new Date(a.trade.start_date).getTime();
      } else {
        return a.trade.ticker.localeCompare(b.trade.ticker);
      }
    });

    return list;
  }, [manifest, searchQuery, sortBy, marketDataMap]);

  const activeTradeForChart = useMemo(() => {
    return manifest?.trades.find((t) => t.ticker === selectedChartTicker) || manifest?.trades[0];
  }, [manifest, selectedChartTicker]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-neutral-100 flex flex-col font-sans selection:bg-sky-900 selection:text-white">
      {/* Top Bar following Top Bar Contract */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenTradeModal={() => setIsTradeModalOpen(true)}
        onOpenPublishModal={() => setIsManifestModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Core Objective: Static Published URL Banner */}
        <PublishingBanner
          manifest={manifest}
          onRefreshMarket={() => manifest?.trades && fetchMarketDataForTrades(manifest.trades)}
          onPublishManifest={handlePublishManifest}
          onOpenRawJson={() => setIsManifestModalOpen(true)}
          isPublishing={isPublishing}
          isMarketLoading={isMarketLoading}
        />

        {/* Tab 1: Active Trades View (Default) */}
        {activeTab === 'trades' && (
          <div className="space-y-6">
            {/* KPI Summary Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#101827] border border-neutral-800 rounded-xl p-4">
                <span className="text-xs text-neutral-400 block mb-1">Active Positions</span>
                <div className="text-2xl font-bold font-mono text-white tabular-nums">
                  {aggregateStats.totalTrades}
                </div>
                <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1.5">
                  <span className="text-emerald-400 font-semibold">{aggregateStats.profitableCount} Profitable</span>
                  <span>·</span>
                  <span>{aggregateStats.totalTrades - aggregateStats.profitableCount} Drawdown</span>
                </div>
              </div>

              <div className="bg-[#101827] border border-neutral-800 rounded-xl p-4">
                <span className="text-xs text-neutral-400 block mb-1">Mean Target Progress</span>
                <div className="text-2xl font-bold font-mono text-sky-400 tabular-nums">
                  {aggregateStats.avgProgress.toFixed(1)}%
                </div>
                <div className="text-[11px] text-neutral-400 mt-1">
                  Across all active trade exits
                </div>
              </div>

              <div className="bg-[#101827] border border-neutral-800 rounded-xl p-4">
                <span className="text-xs text-neutral-400 block mb-1">Mean Return vs Entry</span>
                <div className={`text-2xl font-bold font-mono tabular-nums ${aggregateStats.avgReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatPercent(aggregateStats.avgReturn)}
                </div>
                <div className="text-[11px] text-neutral-400 mt-1">
                  Purchase price to current OHLC
                </div>
              </div>

              <div className="bg-[#101827] border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs text-neutral-400 block mb-1">Executing Trader</span>
                  <div className="text-lg font-bold text-white truncate">
                    {manifest?.trader_first_name} {manifest?.trader_last_name}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-sky-400 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    className="hover:underline cursor-pointer"
                  >
                    Edit Profile
                  </button>
                  <span className="text-neutral-400">ERP ID Verified</span>
                </div>
              </div>
            </div>

            {/* Quick Inline Trade Entry Bar (Accessibility Requirement: "very easy, legible and the UI for inputting a trade should be easily accessible from the main page") */}
            <div className="flex items-center justify-between bg-[#101827] border border-neutral-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-950/60 border border-sky-800/60 text-sky-400">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Record &amp; Input Trade</h3>
                  <p className="text-xs text-neutral-400">
                    Input start/end dates, purchase &amp; target prices, DOI research source, and ticker symbol.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowInlineAdd(!showInlineAdd)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    showInlineAdd
                      ? 'bg-neutral-800 text-white border-neutral-700'
                      : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
                  }`}
                >
                  {showInlineAdd ? 'Hide Inline Form' : 'Show Inline Form'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsTradeModalOpen(true)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Open Full Form</span>
                </button>
              </div>
            </div>

            {/* Inline Trade Input Form if toggled */}
            {showInlineAdd && (
              <TradeInputForm
                onAddTrade={handleAddTrade}
                isInline={true}
                onClose={() => setShowInlineAdd(false)}
              />
            )}

            {/* Controls Bar: Search, Sort, Sync Status */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by ticker, DOI, or date..."
                  className="w-full bg-[#101827] border border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-[#101827] border border-neutral-800 text-xs text-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="progress">Target Progress</option>
                    <option value="return">% Return vs Entry</option>
                    <option value="date">Start Date</option>
                    <option value="ticker">Ticker Symbol</option>
                  </select>
                </div>

                <div className="text-xs text-neutral-400 flex items-center gap-1.5 font-mono">
                  <span>{filteredTrades.length} displayed</span>
                </div>
              </div>
            </div>

            {/* Trade List Container */}
            {isLoading ? (
              <div className="p-12 text-center bg-[#101827] border border-neutral-800 rounded-xl">
                <RefreshCw className="w-6 h-6 text-sky-400 animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium text-neutral-300">
                  Booting TradeManifest engine...
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Connecting to Yahoo Finance to download OHLC price data for each trade from its start date...
                </p>
              </div>
            ) : filteredTrades.length === 0 ? (
              <div className="p-12 text-center bg-[#101827] border border-neutral-800 rounded-xl">
                <FolderOpen className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-neutral-200">No Trades Recorded</h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                  No active trades found matching your filter. Use the input form above to record your first trade.
                </p>
                <button
                  type="button"
                  onClick={() => setIsTradeModalOpen(true)}
                  className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Input First Trade</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTrades.map(({ trade, originalIndex }) => (
                  <TradeCard
                    key={`${trade.ticker}-${trade.start_date}-${originalIndex}`}
                    trade={trade}
                    market={marketDataMap[trade.ticker]}
                    index={originalIndex}
                    onDelete={handleDeleteTrade}
                    isExpandedInitial={originalIndex === 0}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Raw Manifest JSON & Static URL Inspector */}
        {activeTab === 'manifest' && (
          <div className="space-y-6">
            <div className="bg-[#101827] border border-neutral-800 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <FileJson className="w-5 h-5 text-sky-400" />
                    Published JSON Manifest (Schema Compliant)
                  </h2>
                  <p className="text-xs text-neutral-400 mt-1">
                    This payload is hosted at the static URL <code className="text-sky-300 font-mono">/manifest.json</code> and strictly implements <code className="text-sky-300 font-mono">trading_manifest_schema_8ef33500.json</code>.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="/manifest.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg border border-neutral-700 transition-colors"
                  >
                    Open Live JSON
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (manifest) {
                        navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
                        alert('JSON manifest copied to clipboard!');
                      }
                    }}
                    className="px-3.5 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    Copy JSON
                  </button>
                </div>
              </div>

              <pre className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg font-mono text-xs text-sky-200 overflow-x-auto max-h-[600px] leading-relaxed">
                {manifest ? JSON.stringify(manifest, null, 2) : '{}'}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: OHLC Terminal View */}
        {activeTab === 'charts' && (
          <div className="space-y-6">
            <div className="bg-[#101827] border border-neutral-800 rounded-xl p-6 text-white">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-800 mb-4">
                <div>
                  <h2 className="text-base font-semibold">Yahoo Finance OHLC Price Terminal</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Historical series originated from trade start date to today, showing purchase and target lines.
                  </p>
                </div>

                {/* Ticker Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">Select Position:</span>
                  <div className="flex flex-wrap gap-1">
                    {manifest?.trades.map((t) => (
                      <button
                        key={t.ticker}
                        type="button"
                        onClick={() => setSelectedChartTicker(t.ticker)}
                        className={`px-3 py-1 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                          selectedChartTicker === t.ticker
                            ? 'bg-sky-600 text-white border-sky-500 font-semibold'
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                      >
                        {t.ticker}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {activeTradeForChart ? (
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-neutral-950 rounded-lg border border-neutral-800 text-xs">
                    <div>
                      <span className="text-neutral-400 block">Asset / Symbol</span>
                      <strong className="text-sm font-mono text-white">{activeTradeForChart.ticker}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-400 block">Start Date (OHLC Origin)</span>
                      <span className="font-mono text-neutral-200">{activeTradeForChart.start_date}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block">Purchase Price</span>
                      <span className="font-mono text-sky-400 font-semibold">{formatCurrency(activeTradeForChart.start_price)}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block">Target Exit Price</span>
                      <span className="font-mono text-emerald-400 font-semibold">{formatCurrency(activeTradeForChart.target_price)}</span>
                    </div>
                  </div>

                  <OHLCChart
                    ohlc={marketDataMap[activeTradeForChart.ticker]?.ohlc || []}
                    startPrice={activeTradeForChart.start_price}
                    targetPrice={activeTradeForChart.target_price}
                    ticker={activeTradeForChart.ticker}
                    startDate={activeTradeForChart.start_date}
                    height={380}
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-neutral-500 text-sm">
                  No active trades available to display in terminal.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: ERP / BI Integration Guide */}
        {activeTab === 'integration' && <ERPIntegrationGuide />}

        {/* Tab 5: Trader Profile View */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-[#101827] border border-neutral-800 rounded-xl p-6 text-white">
              <h2 className="text-base font-semibold mb-1">Trader Profile &amp; Manifest Sign-off</h2>
              <p className="text-xs text-neutral-400 mb-4">
                The manifest schema requires trader first and last name for attribution and audit logs in external ERP systems.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-950 rounded-lg border border-neutral-800">
                    <span className="text-xs text-neutral-400 block mb-1">First Name</span>
                    <span className="text-sm font-semibold text-white">{manifest?.trader_first_name}</span>
                  </div>
                  <div className="p-4 bg-neutral-950 rounded-lg border border-neutral-800">
                    <span className="text-xs text-neutral-400 block mb-1">Last Name</span>
                    <span className="text-sm font-semibold text-white">{manifest?.trader_last_name}</span>
                  </div>
                </div>

                <div className="p-4 bg-neutral-950 rounded-lg border border-neutral-800 text-xs space-y-2">
                  <div className="flex justify-between text-neutral-300">
                    <span className="text-neutral-400">Last Manifest Timestamp:</span>
                    <span className="font-mono text-sky-400">{manifest?.timestamp}</span>
                  </div>
                  <div className="flex justify-between text-neutral-300">
                    <span className="text-neutral-400">Total Manifest Trades:</span>
                    <span className="font-mono">{manifest?.trades.length}</span>
                  </div>
                  <div className="flex justify-between text-neutral-300">
                    <span className="text-neutral-400">Draft-07 Schema File:</span>
                    <span className="font-mono text-neutral-400">trading_manifest_schema_8ef33500.json</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="w-full py-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors cursor-pointer"
                >
                  Edit Trader Information
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800/80 bg-[#0a0e17] py-4 px-6 text-xs text-neutral-400 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-300">TradeManifest ERP Engine</span>
            <span>·</span>
            <span>Yahoo Finance OHLC Sync</span>
            <span>·</span>
            <span className="font-mono text-sky-400">/manifest.json</span>
          </div>
          <div className="text-neutral-400 text-center sm:text-right">
            Enterprise Resource Planning &amp; Business Intelligence Manifest Pipeline
          </div>
        </div>
      </footer>

      {/* Modals */}
      {isTradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <TradeInputForm
              onAddTrade={handleAddTrade}
              isOpen={isTradeModalOpen}
              onClose={() => setIsTradeModalOpen(false)}
            />
          </div>
        </div>
      )}

      {isManifestModalOpen && (
        <ManifestModal
          manifest={manifest}
          isOpen={isManifestModalOpen}
          onClose={() => setIsManifestModalOpen(false)}
        />
      )}

      {isProfileModalOpen && manifest && (
        <TraderProfileModal
          firstName={manifest.trader_first_name}
          lastName={manifest.trader_last_name}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
}
