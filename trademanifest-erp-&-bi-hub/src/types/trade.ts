export interface TradeItem {
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

export interface TradingManifest {
  trader_first_name: string;
  trader_last_name: string;
  timestamp: string;
  trades: TradeItem[];
}

export interface OHLCPoint {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataResponse {
  ticker: string;
  current_price: number;
  previous_close: number;
  change: number;
  change_percent: number;
  currency: string;
  ohlc: OHLCPoint[];
  source: 'yahoo' | 'synthetic';
}

export interface CalculatedTradeMetrics {
  currentPrice: number;
  previousClose: number;
  dailyChange: number;
  dailyChangePercent: number;
  percentReturn: number; // % up or down from purchase / start price
  percentComplete: number; // % complete towards target price
  targetDeviation: number; // pct_diff_current_vs_target
  isTargetHit: boolean;
  isProfit: boolean;
  daysActive: number;
  daysRemaining: number;
  ohlc: OHLCPoint[];
  marketLoaded: boolean;
}
