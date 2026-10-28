import { useState, useMemo } from 'react';
import { Copy, Check, ExternalLink, CheckCircle2, AlertCircle, Code, Layers, FileJson } from 'lucide-react';
import { TradingManifest } from '../types/trade';

interface ManifestModalProps {
  manifest: TradingManifest | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ManifestModal({ manifest, isOpen, onClose }: ManifestModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeSnippetTab, setActiveSnippetTab] = useState<'powerbi' | 'python' | 'curl' | 'tableau'>('powerbi');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const staticUrl = `${baseUrl}/manifest.json`;

  const jsonString = useMemo(() => {
    return manifest ? JSON.stringify(manifest, null, 2) : '{}';
  }, [manifest]);

  // Schema Validation Check
  const validationResult = useMemo(() => {
    if (!manifest) return { valid: false, errors: ['Manifest data is null'] };
    const errors: string[] = [];

    if (!manifest.trader_first_name) errors.push('Missing required property: trader_first_name');
    if (!manifest.trader_last_name) errors.push('Missing required property: trader_last_name');
    if (!manifest.timestamp) errors.push('Missing required property: timestamp');
    if (!Array.isArray(manifest.trades)) errors.push('Property trades must be an array');

    if (Array.isArray(manifest.trades)) {
      manifest.trades.forEach((t, i) => {
        if (!t.ticker) errors.push(`Trade #${i + 1}: missing ticker`);
        if (!t.start_date) errors.push(`Trade #${i + 1}: missing start_date`);
        if (typeof t.start_price !== 'number') errors.push(`Trade #${i + 1}: missing start_price number`);
        if (!t.end_date) errors.push(`Trade #${i + 1}: missing end_date`);
        if (typeof t.target_price !== 'number') errors.push(`Trade #${i + 1}: missing target_price number`);
        if (!t.doi) errors.push(`Trade #${i + 1}: missing doi`);
        if (typeof t.initiation_status_metric !== 'number') errors.push(`Trade #${i + 1}: missing initiation_status_metric number`);
        if (typeof t.pct_diff_current_vs_target !== 'number') errors.push(`Trade #${i + 1}: missing pct_diff_current_vs_target number`);
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }, [manifest]);

  const handleCopyJson = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#0b101d] border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-950 border border-sky-800/60 text-sky-400">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                JSON Manifest Specification &amp; Published Endpoint
              </h2>
              <p className="text-xs text-neutral-400">
                Draft-07 schema compliant payload for ERP &amp; BI ingestion
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Static URL Bar */}
          <div className="p-4 bg-neutral-900/90 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
              <span className="font-semibold text-neutral-200 uppercase tracking-wider text-[11px]">
                Static Published URL (ERP/BI Ingestion Link)
              </span>
              {validationResult.valid ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Schema Validated (Draft-07)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {validationResult.errors.length} Schema Warnings
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-neutral-950 px-3 py-2 rounded-lg border border-neutral-700 font-mono text-xs text-sky-300 truncate selection:bg-sky-900 select-all">
                {staticUrl}
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(staticUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 border border-neutral-700 rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy URL</span>
              </button>

              <a
                href="/manifest.json"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 border border-neutral-700 rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Visit URL</span>
              </a>
            </div>
          </div>

          {/* ERP / BI Consumption Snippets */}
          <div className="bg-neutral-900/60 rounded-xl border border-neutral-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                <Layers className="w-4 h-4 text-sky-400" />
                <span>One-Click BI &amp; ERP Connectors</span>
              </div>

              <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveSnippetTab('powerbi')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${activeSnippetTab === 'powerbi' ? 'bg-sky-600 text-white font-medium' : 'text-neutral-400 hover:text-white'}`}
                >
                  Power BI (M)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSnippetTab('python')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${activeSnippetTab === 'python' ? 'bg-sky-600 text-white font-medium' : 'text-neutral-400 hover:text-white'}`}
                >
                  Python Pandas
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSnippetTab('curl')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${activeSnippetTab === 'curl' ? 'bg-sky-600 text-white font-medium' : 'text-neutral-400 hover:text-white'}`}
                >
                  cURL
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSnippetTab('tableau')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${activeSnippetTab === 'tableau' ? 'bg-sky-600 text-white font-medium' : 'text-neutral-400 hover:text-white'}`}
                >
                  Tableau / REST
                </button>
              </div>
            </div>

            <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 font-mono text-xs text-neutral-300 relative">
              {activeSnippetTab === 'powerbi' && (
                <code>{`let
    Source = Json.Document(Web.Contents("${staticUrl}")),
    Trades = Source[trades],
    TableFromList = Table.FromList(Trades, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    Expanded = Table.ExpandRecordColumn(TableFromList, "Column1", {"ticker", "start_date", "start_price", "end_date", "target_price", "doi", "initiation_status_metric", "pct_diff_current_vs_target"})
in
    Expanded`}</code>
              )}

              {activeSnippetTab === 'python' && (
                <code>{`import pandas as pd
import requests

url = "${staticUrl}"
data = requests.get(url).json()
df_trades = pd.DataFrame(data['trades'])
print(f"Trader: {data['trader_first_name']} {data['trader_last_name']}")
print(df_trades.head())`}</code>
              )}

              {activeSnippetTab === 'curl' && (
                <code>{`curl -s -X GET "${staticUrl}" \\
  -H "Accept: application/json"`}</code>
              )}

              {activeSnippetTab === 'tableau' && (
                <code>{`# Tableau Web Data Connector or HTTP JSON endpoint:
URL: ${staticUrl}
Method: GET
Format: JSON
Schema: Root object with 'trades' array`}</code>
              )}
            </div>
          </div>

          {/* Raw JSON Viewer */}
          <div className="bg-neutral-900/60 rounded-xl border border-neutral-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                <Code className="w-4 h-4 text-sky-400" />
                Raw Manifest Payload (trading_manifest_schema_8ef33500.json compliant)
              </span>

              <button
                type="button"
                onClick={handleCopyJson}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-700 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>

            <pre className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 font-mono text-xs text-sky-200 overflow-x-auto max-h-[280px] leading-relaxed">
              {jsonString}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-[#0f172a] flex items-center justify-between text-xs text-neutral-400">
          <span>Schema Title: TradingManifest · Draft-07</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
