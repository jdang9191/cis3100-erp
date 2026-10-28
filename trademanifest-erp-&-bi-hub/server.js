// server.ts
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var PORT = 3e3;
var isProd = process.env.NODE_ENV === "production";
var DATA_DIR = path.resolve(__dirname, "data");
var MANIFEST_PATH = path.resolve(DATA_DIR, "manifest.json");
var PUBLIC_MANIFEST_PATH = path.resolve(__dirname, "public/manifest.json");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
function loadManifest() {
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading manifest file:", err);
  }
  const defaultManifest = {
    trader_first_name: "Jonathan",
    trader_last_name: "Dang",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    trades: [
      {
        ticker: "NVDA",
        start_date: "2026-02-02",
        start_price: 172.5,
        end_date: "2026-12-18",
        target_price: 240,
        doi: "10.1016/j.jbankfin.2024.107120",
        initiation_status_metric: 1.45,
        pct_diff_current_vs_target: -9.19
      },
      {
        ticker: "AAPL",
        start_date: "2026-01-15",
        start_price: 224,
        end_date: "2026-11-20",
        target_price: 260,
        doi: "10.1257/aer.20230894",
        initiation_status_metric: 0.82,
        pct_diff_current_vs_target: -0.73
      },
      {
        ticker: "MSFT",
        start_date: "2026-03-10",
        start_price: 415,
        end_date: "2026-12-31",
        target_price: 500,
        doi: "10.1111/jofi.13289",
        initiation_status_metric: 1.12,
        pct_diff_current_vs_target: -11.6
      }
    ]
  };
  saveManifest(defaultManifest);
  return defaultManifest;
}
function saveManifest(manifest) {
  try {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
    fs.writeFileSync(PUBLIC_MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving manifest:", err);
  }
}
var marketCache = {};
var CACHE_TTL_MS = 60 * 1e3;
async function fetchYahooOHLC(ticker, startDateStr, endDateStr) {
  const cacheKey = `${ticker.toUpperCase()}_${startDateStr}_${endDateStr || "now"}`;
  const now = Date.now();
  if (marketCache[cacheKey] && marketCache[cacheKey].expiry > now) {
    return marketCache[cacheKey].data;
  }
  const startDate = new Date(startDateStr);
  const period1 = Math.floor((isNaN(startDate.getTime()) ? Date.now() - 90 * 864e5 : startDate.getTime()) / 1e3);
  const period2 = endDateStr ? Math.floor(new Date(endDateStr).getTime() / 1e3) : Math.floor(now / 1e3);
  const cleanSymbol = encodeURIComponent(ticker.trim().toUpperCase());
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}?period1=${period1}&period2=${period2}&interval=1d`;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    if (!response.ok) {
      throw new Error(`Yahoo Finance responded with status ${response.status}`);
    }
    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    if (!result || !result.timestamp || result.timestamp.length === 0) {
      throw new Error("No historical chart data available from Yahoo");
    }
    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0] || {};
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];
    const ohlc = [];
    for (let i = 0; i < timestamps.length; i++) {
      const closeVal = closes[i];
      if (closeVal === null || closeVal === void 0 || isNaN(closeVal)) {
        continue;
      }
      const openVal = opens[i] ?? closeVal;
      const highVal = highs[i] ?? Math.max(openVal, closeVal);
      const lowVal = lows[i] ?? Math.min(openVal, closeVal);
      const volVal = volumes[i] ?? 0;
      const dateStr = new Date(timestamps[i] * 1e3).toISOString().split("T")[0];
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
      throw new Error("No valid OHLC rows parsed");
    }
    const latestPoint = ohlc[ohlc.length - 1];
    const prevPoint = ohlc.length > 1 ? ohlc[ohlc.length - 2] : latestPoint;
    const currentPrice = result.meta?.regularMarketPrice ?? latestPoint.close;
    const prevClose = result.meta?.chartPreviousClose ?? prevPoint.close;
    const change = Number((currentPrice - prevClose).toFixed(2));
    const changePercent = prevClose > 0 ? Number((change / prevClose * 100).toFixed(2)) : 0;
    const data = {
      ticker: cleanSymbol,
      current_price: Number(currentPrice.toFixed(2)),
      previous_close: Number(prevClose.toFixed(2)),
      change,
      change_percent: changePercent,
      currency: result.meta?.currency || "USD",
      ohlc,
      source: "yahoo"
    };
    marketCache[cacheKey] = { data, expiry: now + CACHE_TTL_MS };
    return data;
  } catch (err) {
    console.warn(`Falling back to synthetic data for ${cleanSymbol}:`, err.message);
    return generateFallbackOHLC(cleanSymbol, startDateStr, period1, period2);
  }
}
function generateFallbackOHLC(ticker, startDateStr, period1, period2) {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash << 5) - hash + ticker.charCodeAt(i);
    hash |= 0;
  }
  const basePrice = Math.abs(hash % 300) + 50;
  const ohlc = [];
  const startMs = period1 * 1e3;
  const endMs = period2 * 1e3;
  const dayMs = 864e5;
  let current = basePrice;
  for (let t = startMs; t <= endMs; t += dayMs) {
    const dayOfWeek = new Date(t).getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    const daySeed = Math.sin(t / 1e5 + hash);
    const pctChange = daySeed * 0.025 + 1e-3;
    const open = current;
    current = current * (1 + pctChange);
    const high = Math.max(open, current) * (1 + Math.abs(daySeed) * 0.01);
    const low = Math.min(open, current) * (1 - Math.abs(daySeed) * 0.01);
    ohlc.push({
      date: new Date(t).toISOString().split("T")[0],
      timestamp: Math.floor(t / 1e3),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(current.toFixed(2)),
      volume: Math.floor(1e6 + Math.abs(daySeed) * 5e6)
    });
  }
  const latest = ohlc[ohlc.length - 1] || { close: basePrice };
  const prev = ohlc[ohlc.length - 2] || latest;
  const change = Number((latest.close - prev.close).toFixed(2));
  const changePercent = prev.close > 0 ? Number((change / prev.close * 100).toFixed(2)) : 0;
  return {
    ticker,
    current_price: Number(latest.close.toFixed(2)),
    previous_close: Number(prev.close.toFixed(2)),
    change,
    change_percent: changePercent,
    currency: "USD",
    ohlc,
    source: "synthetic"
  };
}
async function startServer() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  const serveManifest = (req, res) => {
    const manifest = loadManifest();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=10");
    return res.json(manifest);
  };
  app.get("/manifest.json", serveManifest);
  app.get("/api/manifest.json", serveManifest);
  app.get("/api/manifest", serveManifest);
  app.post("/api/manifest/publish", async (req, res) => {
    try {
      const { trader_first_name, trader_last_name, trades } = req.body;
      const current = loadManifest();
      const updated = {
        trader_first_name: trader_first_name ?? current.trader_first_name ?? "Trader",
        trader_last_name: trader_last_name ?? current.trader_last_name ?? "User",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        trades: trades ?? current.trades
      };
      saveManifest(updated);
      return res.json({ success: true, manifest: updated, message: "Manifest published successfully to static URL" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/trades", async (req, res) => {
    try {
      const manifest = loadManifest();
      return res.json({
        trader_first_name: manifest.trader_first_name,
        trader_last_name: manifest.trader_last_name,
        timestamp: manifest.timestamp,
        trades: manifest.trades
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/trades", async (req, res) => {
    try {
      const { ticker, start_date, start_price, end_date, target_price, doi, initiation_status_metric, pct_diff_current_vs_target } = req.body;
      if (!ticker || !start_date || start_price === void 0 || !end_date || target_price === void 0 || !doi) {
        return res.status(400).json({
          error: "Missing required trade properties: ticker, start_date, start_price, end_date, target_price, doi"
        });
      }
      const manifest = loadManifest();
      let pctDiff = pct_diff_current_vs_target;
      if (pctDiff === void 0 || pctDiff === null) {
        try {
          const market = await fetchYahooOHLC(ticker, start_date);
          pctDiff = Number(((market.current_price - Number(target_price)) / Number(target_price) * 100).toFixed(2));
        } catch {
          pctDiff = Number(((Number(start_price) - Number(target_price)) / Number(target_price) * 100).toFixed(2));
        }
      }
      const newTrade = {
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
      manifest.timestamp = (/* @__PURE__ */ new Date()).toISOString();
      saveManifest(manifest);
      return res.json({ success: true, trade: newTrade, manifest });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.delete("/api/trades/:index", (req, res) => {
    try {
      const index = parseInt(req.params.index, 10);
      const manifest = loadManifest();
      if (isNaN(index) || index < 0 || index >= manifest.trades.length) {
        return res.status(404).json({ error: "Trade index not found" });
      }
      manifest.trades.splice(index, 1);
      manifest.timestamp = (/* @__PURE__ */ new Date()).toISOString();
      saveManifest(manifest);
      return res.json({ success: true, manifest });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/trader-profile", (req, res) => {
    try {
      const { trader_first_name, trader_last_name } = req.body;
      const manifest = loadManifest();
      if (trader_first_name) manifest.trader_first_name = String(trader_first_name).trim();
      if (trader_last_name) manifest.trader_last_name = String(trader_last_name).trim();
      manifest.timestamp = (/* @__PURE__ */ new Date()).toISOString();
      saveManifest(manifest);
      return res.json({ success: true, manifest });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/ohlc", async (req, res) => {
    try {
      const ticker = String(req.query.ticker || "AAPL").toUpperCase();
      const startDate = String(req.query.startDate || "2026-01-01");
      const endDate = req.query.endDate ? String(req.query.endDate) : void 0;
      const data = await fetchYahooOHLC(ticker, startDate, endDate);
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/quote/:ticker", async (req, res) => {
    try {
      const ticker = req.params.ticker.toUpperCase();
      const data = await fetchYahooOHLC(ticker, new Date(Date.now() - 7 * 864e5).toISOString().split("T")[0]);
      return res.json({
        ticker,
        current_price: data.current_price,
        previous_close: data.previous_close,
        change: data.change,
        change_percent: data.change_percent,
        currency: data.currency
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist/index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[TradeManifest] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[TradeManifest] Static manifest available at http://0.0.0.0:${PORT}/manifest.json`);
  });
}
startServer();
