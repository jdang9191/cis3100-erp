import { useState, useId } from 'react';
import { Copy, Check, ExternalLink, Download, RefreshCw, FileCode, CheckCircle2 } from 'lucide-react';
import { TradingManifest } from '../types/trade';

interface PublishingBannerProps {
  manifest: TradingManifest | null;
  onRefreshMarket: () => void;
  onPublishManifest: () => void;
  onOpenRawJson: () => void;
  isPublishing: boolean;
  isMarketLoading: boolean;
}

export default function PublishingBanner({
  manifest,
  onRefreshMarket,
  onPublishManifest,
  onOpenRawJson,
  isPublishing,
  isMarketLoading
}: PublishingBannerProps) {
  const [copied, setCopied] = useState(false);
  const inputId = useId();

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const staticUrl = `${baseUrl}/manifest.json`;

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(staticUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!manifest) return;
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading_manifest_${manifest.trader_last_name.toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formattedTimestamp = manifest?.timestamp
    ? new Date(manifest.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      })
    : 'Not yet generated';

  return (
    <div className="bg-[#101827] border border-neutral-800 rounded-xl p-5 mb-6 text-white shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Column: Static URL and ERP BI status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 text-xs text-neutral-400">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Published Static Endpoint
            </span>
            <span>·</span>
            <span>ERP &amp; BI Consumable</span>
            <span>·</span>
            <span>Schema Draft-07 Compliant</span>
          </div>

          <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
            Trading Manifest Live Feed
          </h2>

          <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
            Trades are serialized to the verified schema and hosted at this permanent static URL for automated extraction into enterprise resource planning and business intelligence dashboards.
          </p>

          {/* Static URL Copy Field */}
          <div className="mt-3 flex items-center gap-2 max-w-2xl">
            <div className="flex-1 flex items-center bg-neutral-950/80 border border-neutral-700/80 rounded-lg px-3 py-2 text-xs font-mono text-sky-300 overflow-hidden">
              <span className="text-neutral-500 mr-2 select-none">GET</span>
              <input
                id={inputId}
                type="text"
                readOnly
                value={staticUrl}
                className="w-full bg-transparent border-none text-sky-300 focus:outline-none selection:bg-sky-900 select-all truncate"
                aria-label="Static manifest URL"
              />
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 border border-neutral-700 rounded-lg transition-colors shrink-0 cursor-pointer"
              title="Copy URL to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Copy URL</span>
                </>
              )}
            </button>

            <a
              href="/manifest.json"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 border border-neutral-700 rounded-lg transition-colors shrink-0"
              title="Open raw JSON URL in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
              <span>Visit URL</span>
            </a>
          </div>
        </div>

        {/* Right Column: Actions and Metadata */}
        <div className="flex flex-col sm:items-end justify-between gap-3 border-t lg:border-t-0 border-neutral-800 pt-3 lg:pt-0 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenRawJson}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-sky-400" />
              <span>Inspect JSON</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-neutral-400" />
              <span>Download .json</span>
            </button>

            <button
              type="button"
              onClick={onRefreshMarket}
              disabled={isMarketLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="Reload OHLC market data from Yahoo Finance"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-neutral-400 ${isMarketLoading ? 'animate-spin' : ''}`} />
              <span>{isMarketLoading ? 'Syncing...' : 'Sync Market'}</span>
            </button>

            <button
              type="button"
              onClick={onPublishManifest}
              disabled={isPublishing}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPublishing ? 'animate-spin' : ''}`} />
              <span>{isPublishing ? 'Publishing...' : 'Re-Publish Manifest'}</span>
            </button>
          </div>

          <div className="text-xs text-neutral-400 flex flex-wrap items-center gap-2 sm:justify-end">
            <span>
              Trader: <strong className="text-neutral-200">{manifest?.trader_first_name} {manifest?.trader_last_name}</strong>
            </span>
            <span>·</span>
            <span>
              Published: <span className="font-mono text-neutral-300">{formattedTimestamp}</span>
            </span>
            <span>·</span>
            <span>
              Count: <strong className="text-sky-400 font-mono">{manifest?.trades?.length ?? 0} Trades</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
