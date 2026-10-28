import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';
const DATA_DIR = path.resolve(__dirname, 'data');
const MANIFEST_PATH = path.resolve(DATA_DIR, 'manifest.json');
const PUBLIC_MANIFEST_PATH = path.resolve(__dirname, 'public/manifest.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface TradeItem {
  id?: string;
  ticker: string;
  start_date: string; // YYYY-MM-DD
  start_price: number;
  end_date: string;   // YYYY-MM-DD
  target_price: number;
  doi: string;
  initiation_status_metric: number;
  pct_diff_current_vs_target: number;
}

interface TradingManifest {
  trader_first_name: string;
  trader_last_name: string;
  timestamp: string;
  trades: TradeItem[];
}

function loadManifest(): TradingManifest {
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading manifest file:', err);
  }

  const defaultManifest: TradingManifest = {
    trader_first_name: 'Jonathan',
    trader_last_name: 'Dang',
    timestamp: new Date().toISOString(),
    trades: [
      {
        ticker: 'NVDA',
        start_date: '2026-02-02',
        start_price: 172.5,
        end_date: '2026-12-18',
        target_price: 240.0,
        doi: '10.1016/j.jbankfin.2024.107120',
        initiation_status_metric: 1.45,
        pct_diff_current_vs_target: -9.19
      },
      {
        ticker: 'AAPL',
        start_date: '2026-01-15',
        start_price: 224.0,
        end_date: '2026-11-20',
        target_price: 260.0,
        doi: '10.1257/aer.20230894',
        initiation_status_metric: 0.82,
        pct_diff_current_vs_target: -0.73
      },
      {
        ticker: 'MSFT',
        start_date: '2026-03-10',
        start_price: 415.0,
        end_date: '2026-12-31',
        target_price: 500.0,
        doi: '10.1111/jofi.13289',
        initiation_status_metric: 1.12,
        pct_diff_current_vs_target: -11.6
      }
    ]
  };

  saveManifest(defaultManifest);
  return defaultManifest;
}

function saveManifest(manifest: TradingManifest) {
  try {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    // Also sync to public directory so it is directly served at /manifest.json
    fs.writeFileSync(PUBLIC_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving manifest:', err);
  }
}

interface OHLCPoint {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketDataResponse {
  ticker: string;
  current_price: number;
  previous_close: number;
  change: number;
  change_percent: number;
  currency: string;
  ohlc: OHLCPoint[];
  source: 'yahoo' | 'synthetic';
}

// Memory cache for market data to prevent hitting rate limits
const marketCache: Record<string, { data: MarketDataResponse; expiry: number }> = {};
const CACHE_TTL_MS = 60 * 1000; // 1 minute

async function fetchYahooOHLC(ticker: string, startDateStr: string, endDateStr?: string): Promise<MarketDataResponse> {
  const cacheKey = `${ticker.toUpperCase()}_${startDateStr}_${endDateStr || 'now'}`;
  const now = Date.now();
  if (marketCache[cacheKey] && marketCache[cacheKey].expiry > now) {
    return marketCache[cacheKey].data;
  }

  // Parse start date (origination date for OHLC time series)
  const startDate = new Date(startDateStr);
  const period1 = Math.floor((isNaN(startDate.getTime()) ? Date.now() - 90 * 86400000 : startDate.getTime()) / 1000);
  const period2 = endDateStr ? Math.floor(new Date(endDateStr).getTime() / 1000) : Math.floor(now / 1000);

  const cleanSymbol = encodeURIComponent(ticker.trim().toUpperCase());
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}?period1=${period1}&period2=${period2}&interval=1d`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance responded with status ${response.status}`);
    }

    const payload = await response.json();
    const result = payload?.chart?.result?.[0];

    if (!result || !result.timestamp || result.timestamp.length === 0) {
      throw new Error('No historical chart data available from Yahoo');
    }

    const timestamps: number[] = result.timestamp;
    const quote = result.indicators?.quote?.[0] || {};
    const opens: number[] = quote.open || [];
    const highs: number[] = quote.high || [];
    const lows: number[] = quote.low || [];
    const closes: number[] = quote.close || [];
    const volumes: number[] = quote.volume || [];

    const ohlc: OHLCPoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const closeVal = closes[i];
      if (closeVal === null || closeVal === undefined || isNaN(closeVal)) {
        continue;
      }
      const openVal = opens[i] ?? closeVal;
      const highVal = highs[i] ?? Math.max(openVal, closeVal);
      const lowVal = lows[i] ?? Math.min(openVal, closeVal);
      const volVal = volumes[i] ?? 0;
      const dateStr = new Date(timestamps[i] * 1000).toISOString().split('T')[0];

      ohlc.push({
        date: dateStr,
        timestamp: timestamps[i],
        open: Number(openVal.toFixed(2)),
        high: Number(highVal.toFixed(2)),
        low: Number(lowVal.toFixed(2)),
        close: Number(closeVal.toFixed(2)),
        volume: Math.round(volVal)
      });
    }

    if (ohlc.length === 0) {
      throw new Error('No valid OHLC rows parsed');
    }

    const latestPoint = ohlc[ohlc.length - 1];
    const prevPoint = ohlc.length > 1 ? ohlc[ohlc.length - 2] : latestPoint;
    const currentPrice = result.meta?.regularMarketPrice ?? latestPoint.close;
    const prevClose = result.meta?.chartPreviousClose ?? prevPoint.close;
    const change = Number((currentPrice - prevClose).toFixed(2));
    const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

    const data: MarketDataResponse = {
      ticker: cleanSymbol,
      current_price: Number(currentPrice.toFixed(2)),
      previous_close: Number(prevClose.toFixed(2)),
      change,
      change_percent: changePercent,
      currency: result.meta?.currency || 'USD',
      ohlc,
      source: 'yahoo'
    };

    marketCache[cacheKey] = { data, expiry: now + CACHE_TTL_MS };
    return data;
  } catch (err) {
    console.warn(`Falling back to synthetic data for ${cleanSymbol}:`, (err as Error).message);
    // Deterministic fallback based on ticker characters and start date
    return generateFallbackOHLC(cleanSymbol, startDateStr, period1, period2);
  }
}

function generateFallbackOHLC(ticker: string, startDateStr: string, period1: number, period2: number): MarketDataResponse {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash << 5) - hash + ticker.charCodeAt(i);
    hash |= 0;
  }
  const basePrice = Math.abs(hash % 300) + 50;
  const ohlc: OHLCPoint[] = [];

  const startMs = period1 * 1000;
  const endMs = period2 * 1000;
  const dayMs = 86400000;

  let current = basePrice;
  for (let t = startMs; t <= endMs; t += dayMs) {
    const dayOfWeek = new Date(t).getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

    const daySeed = Math.sin(t / 100000 + hash);
    const pctChange = daySeed * 0.025 + 0.001; // slight upward drift
    const open = current;
    current = current * (1 + pctChange);
    const high = Math.max(open, current) * (1 + Math.abs(daySeed) * 0.01);
    const low = Math.min(open, current) * (1 - Math.abs(daySeed) * 0.01);

    ohlc.push({
      date: new Date(t).toISOString().split('T')[0],
      timestamp: Math.floor(t / 1000),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(current.toFixed(2)),
      volume: Math.floor(1000000 + Math.abs(daySeed) * 5000000)
    });
  }

  const latest = ohlc[ohlc.length - 1] || { close: basePrice };
  const prev = ohlc[ohlc.length - 2] || latest;
  const change = Number((latest.close - prev.close).toFixed(2));
  const changePercent = prev.close > 0 ? Number(((change / prev.close) * 100).toFixed(2)) : 0;

  return {
    ticker,
    current_price: Number(latest.close.toFixed(2)),
    previous_close: Number(prev.close.toFixed(2)),
    change,
    change_percent: changePercent,
    currency: 'USD',
    ohlc,
    source: 'synthetic'
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // CORS middleware for API and static manifest endpoints so ERP / BI tools can ingest it freely
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // 1. Static Published Manifest endpoint (Standard URL requirement)
  // Accessible at /manifest.json and /api/manifest.json
  const serveManifest = (req: express.Request, res: express.Response) => {
    const manifest = loadManifest();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=10');
    return res.json(manifest);
  };

  app.get('/manifest.json', serveManifest);
  app.get('/api/manifest.json', serveManifest);
  app.get('/api/manifest', serveManifest);

  // 2. Publish updated manifest endpoint
  app.post('/api/manifest/publish', async (req, res) => {
    try {
      const { trader_first_name, trader_last_name, trades } = req.body;
      const current = loadManifest();

      const updated: TradingManifest = {
        trader_first_name: trader_first_name ?? current.trader_first_name ?? 'Trader',
        trader_last_name: trader_last_name ?? current.trader_last_name ?? 'User',
        timestamp: new Date().toISOString(),
        trades: trades ?? current.trades
      };

      saveManifest(updated);
      return res.json({ success: true, manifest: updated, message: 'Manifest published successfully to static URL' });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // 3. Get all trades with calculated live OHLC and metrics
  app.get('/api/trades', async (req, res) => {
    try {
      const manifest = loadManifest();
      return res.json({
        trader_first_name: manifest.trader_first_name,
        trader_last_name: manifest.trader_last_name,
        timestamp: manifest.timestamp,
        trades: manifest.trades
      });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // 4. Create new trade
  app.post('/api/trades', async (req, res) => {
    try {
      const { ticker, start_date, start_price, end_date, target_price, doi, initiation_status_metric, pct_diff_current_vs_target } = req.body;

      if (!ticker || !start_date || start_price === undefined || !end_date || target_price === undefined || !doi) {
        return res.status(400).json({
          error: 'Missing required trade properties: ticker, start_date, start_price, end_date, target_price, doi'
        });
      }

      const manifest = loadManifest();

      // Fetch latest quote to compute pct_diff_current_vs_target if not supplied
      let pctDiff = pct_diff_current_vs_target;
      if (pctDiff === undefined || pctDiff === null) {
        try {
          const market = await fetchYahooOHLC(ticker, start_date);
          pctDiff = Number((((market.current_price - Number(target_price)) / Number(target_price)) * 100).toFixed(2));
        } catch {
          pctDiff = Number((((Number(start_price) - Number(target_price)) / Number(target_price)) * 100).toFixed(2));
        }
      }

      const newTrade: TradeItem = {
        ticker: String(ticker).trim().toUpperCase(),
        start_date: String(start_date),
        start_price: Number(start_price),
        end_date: String(end_date),
        target_price: Number(target_price),
        doi: String(doi).trim(),
        initiation_status_metric: Number(initiation_status_metric ?? 0),
        pct_diff_current_vs_target: Number(pctDiff)
      };

      manifest.trades.unshift(newTrade);
      manifest.timestamp = new Date().toISOString();
      saveManifest(manifest);

      return res.json({ success: true, trade: newTrade, manifest });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // 5. Delete trade
  app.delete('/api/trades/:index', (req, res) => {
    try {
      const index = parseInt(req.params.index, 10);
      const manifest = loadManifest();

      if (isNaN(index) || index < 0 || index >= manifest.trades.length) {
        return res.status(404).json({ error: 'Trade index not found' });
      }

      manifest.trades.splice(index, 1);
      manifest.timestamp = new Date().toISOString();
      saveManifest(manifest);

      return res.json({ success: true, manifest });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // 6. Update trader profile
  app.post('/api/trader-profile', (req, res) => {
    try {
      const { trader_first_name, trader_last_name } = req.body;
      const manifest = loadManifest();

      if (trader_first_name) manifest.trader_first_name = String(trader_first_name).trim();
      if (trader_last_name) manifest.trader_last_name = String(trader_last_name).trim();
      manifest.timestamp = new Date().toISOString();

      saveManifest(manifest);
      return res.json({ success: true, manifest });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // 7. OHLC market data endpoint for a given symbol
  app.get('/api/ohlc', async (req, res) => {
    try {
      const ticker = String(req.query.ticker || 'AAPL').toUpperCase();
      const startDate = String(req.query.startDate || '2026-01-01');
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const data = await fetchYahooOHLC(ticker, startDate, endDate);
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // 8. Quick quote preview for the trade input form
  app.get('/api/quote/:ticker', async (req, res) => {
    try {
      const ticker = req.params.ticker.toUpperCase();
      const data = await fetchYahooOHLC(ticker, new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
      return res.json({
        ticker,
        current_price: data.current_price,
        previous_close: data.previous_close,
        change: data.change,
        change_percent: data.change_percent,
        currency: data.currency
      });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // Serve static UI / Vite middlewares
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TradeManifest] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[TradeManifest] Static manifest available at http://0.0.0.0:${PORT}/manifest.json`);
  });
}

startServer();
