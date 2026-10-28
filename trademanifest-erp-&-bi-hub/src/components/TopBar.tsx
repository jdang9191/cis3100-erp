interface TopBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenTradeModal: () => void;
  onOpenPublishModal: () => void;
}

export default function TopBar({
  activeTab,
  setActiveTab,
  onOpenTradeModal,
  onOpenPublishModal
}: TopBarProps) {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-neutral-800 bg-[#0d1322] sticky top-0 z-30">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="/"
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2 hover:text-sky-400 transition-colors"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block shadow-[0_0_8px_rgba(56,189,248,0.6)]"></span>
          TradeManifest
        </a>
      </div>

      {/* Zone 2: 4–5 clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-400">
        <button
          type="button"
          onClick={() => setActiveTab('trades')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 border-b-2 cursor-pointer ${
            activeTab === 'trades' ? 'border-sky-500 text-white font-semibold' : 'border-transparent'
          }`}
        >
          Active Trades
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('manifest')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 border-b-2 cursor-pointer ${
            activeTab === 'manifest' ? 'border-sky-500 text-white font-semibold' : 'border-transparent'
          }`}
        >
          JSON Manifest &amp; Static URL
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('charts')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 border-b-2 cursor-pointer ${
            activeTab === 'charts' ? 'border-sky-500 text-white font-semibold' : 'border-transparent'
          }`}
        >
          OHLC Terminal
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('integration')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 border-b-2 cursor-pointer ${
            activeTab === 'integration' ? 'border-sky-500 text-white font-semibold' : 'border-transparent'
          }`}
        >
          ERP / BI Integration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 border-b-2 cursor-pointer ${
            activeTab === 'profile' ? 'border-sky-500 text-white font-semibold' : 'border-transparent'
          }`}
        >
          Trader Profile
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenTradeModal}
          className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-500 active:bg-sky-700 transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer flex items-center gap-1.5"
        >
          <span className="text-sm font-bold leading-none">+</span>
          <span>Input Trade</span>
        </button>
      </div>
    </header>
  );
}
