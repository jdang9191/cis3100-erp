import { useState } from 'react';
import { Copy, Check, Database, BarChart3, Terminal, Cpu } from 'lucide-react';

export default function ERPIntegrationGuide() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const staticUrl = `${baseUrl}/manifest.json`;

  const copySnippet = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-[#0f172a] border border-neutral-800 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-5 h-5 text-sky-400" />
          <h2 className="text-base font-semibold">
            Enterprise Resource Planning (ERP) &amp; Business Intelligence (BI) Pipeline
          </h2>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed max-w-3xl">
          This system continuously serializes trader positions into the standardized{' '}
          <code className="text-sky-300 font-mono">trading_manifest_schema_8ef33500.json</code> specification.
          Any external enterprise software (SAP, Oracle, Workday, Power BI, Tableau, Snowflake, Databricks) can ingest this feed directly from the immutable static URL.
        </p>

        <div className="mt-4 p-3 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-sky-300 truncate">
            <span className="text-neutral-500 font-sans">Published URL:</span>
            <span className="truncate">{staticUrl}</span>
          </div>
          <button
            type="button"
            onClick={() => copySnippet('url', staticUrl)}
            className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {copiedKey === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'url' ? 'Copied' : 'Copy URL'}</span>
          </button>
        </div>
      </div>

      {/* Integration Methods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Power BI */}
        <div className="bg-[#0f172a] border border-neutral-800 rounded-xl p-5 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold">Microsoft Power BI / Excel</h3>
              </div>
              <span className="text-[10px] bg-neutral-800 px-2 py-0.5 rounded text-neutral-300 font-mono">
                Power Query M
              </span>
            </div>
            <p className="text-xs text-neutral-400 mb-3">
              In Power BI Desktop, click <strong>Get Data → From Web</strong> and enter the static URL, or paste the following M query into Advanced Editor:
            </p>
            <pre className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg font-mono text-[11px] text-sky-200 overflow-x-auto leading-relaxed">
{`let
    Source = Json.Document(Web.Contents("${staticUrl}")),
    Trades = Source[trades],
    Table = Table.FromList(Trades, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    Columns = Table.ExpandRecordColumn(Table, "Column1", 
      {"ticker", "start_date", "start_price", "end_date", "target_price", "doi", "initiation_status_metric", "pct_diff_current_vs_target"})
in
    Columns`}
            </pre>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-800 flex justify-end">
            <button
              type="button"
              onClick={() => copySnippet('powerbi', `let
    Source = Json.Document(Web.Contents("${staticUrl}")),
    Trades = Source[trades],
    Table = Table.FromList(Trades, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    Columns = Table.ExpandRecordColumn(Table, "Column1", 
      {"ticker", "start_date", "start_price", "end_date", "target_price", "doi", "initiation_status_metric", "pct_diff_current_vs_target"})
in
    Columns`)}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'powerbi' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy M Query</span>
            </button>
          </div>
        </div>

        {/* Python Data Science / ETL */}
        <div className="bg-[#0f172a] border border-neutral-800 rounded-xl p-5 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold">Python (Pandas / Polars / Airflow)</h3>
              </div>
              <span className="text-[10px] bg-neutral-800 px-2 py-0.5 rounded text-neutral-300 font-mono">
                ETL Pipeline
              </span>
            </div>
            <p className="text-xs text-neutral-400 mb-3">
              Standard automated data extraction for quantitative risk systems and automated reporting pipelines:
            </p>
            <pre className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg font-mono text-[11px] text-sky-200 overflow-x-auto leading-relaxed">
{`import requests
import pandas as pd

url = "${staticUrl}"
response = requests.get(url, headers={"Accept": "application/json"})
manifest = response.json()

# Extract trade positions dataframe
df = pd.DataFrame(manifest['trades'])
df['timestamp'] = manifest['timestamp']
df['trader'] = f"{manifest['trader_first_name']} {manifest['trader_last_name']}"

print("Total trades active:", len(df))
print(df[['ticker', 'start_price', 'target_price', 'pct_diff_current_vs_target']])`}
            </pre>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-800 flex justify-end">
            <button
              type="button"
              onClick={() => copySnippet('python', `import requests\nimport pandas as pd\n\nurl = "${staticUrl}"\nresponse = requests.get(url)\nmanifest = response.json()\ndf = pd.DataFrame(manifest['trades'])\nprint(df)`)}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'python' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Python Code</span>
            </button>
          </div>
        </div>

        {/* cURL & REST API */}
        <div className="bg-[#0f172a] border border-neutral-800 rounded-xl p-5 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold">cURL / Direct HTTP Ingest</h3>
              </div>
              <span className="text-[10px] bg-neutral-800 px-2 py-0.5 rounded text-neutral-300 font-mono">
                CORS Open
              </span>
            </div>
            <p className="text-xs text-neutral-400 mb-3">
              Static URL responds with <code className="text-sky-300">Content-Type: application/json</code> and <code className="text-sky-300">Access-Control-Allow-Origin: *</code>.
            </p>
            <pre className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg font-mono text-[11px] text-sky-200 overflow-x-auto leading-relaxed">
{`# Fetch JSON manifest
curl -i -X GET "${staticUrl}"

# Pipe to jq for pretty printing
curl -s "${staticUrl}" | jq .`}
            </pre>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-800 flex justify-end">
            <button
              type="button"
              onClick={() => copySnippet('curl', `curl -s "${staticUrl}"`)}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy cURL</span>
            </button>
          </div>
        </div>

        {/* Schema Mapping Reference */}
        <div className="bg-[#0f172a] border border-neutral-800 rounded-xl p-5 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold">Data Dictionary &amp; Schema Mapping</h3>
              </div>
              <span className="text-[10px] bg-neutral-800 px-2 py-0.5 rounded text-neutral-300 font-mono">
                Draft-07
              </span>
            </div>
            <div className="space-y-2 text-xs text-neutral-300">
              <div className="flex items-baseline justify-between border-b border-neutral-800 pb-1">
                <span className="font-mono text-sky-300">ticker</span>
                <span className="text-neutral-400">Equity/Asset Symbol (e.g. NVDA)</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-neutral-800 pb-1">
                <span className="font-mono text-sky-300">start_date / start_price</span>
                <span className="text-neutral-400">Origination date &amp; purchase price</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-neutral-800 pb-1">
                <span className="font-mono text-sky-300">end_date / target_price</span>
                <span className="text-neutral-400">Target resolution date &amp; exit price</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-neutral-800 pb-1">
                <span className="font-mono text-sky-300">doi</span>
                <span className="text-neutral-400">Research document identifier</span>
              </div>
              <div className="flex items-baseline justify-between pb-1">
                <span className="font-mono text-sky-300">initiation_status_metric</span>
                <span className="text-neutral-400">Health indicator status value</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
