import { TradeItem, MarketDataResponse, CalculatedTradeMetrics } from '../types/trade';

export function calculateTradeMetrics(trade: TradeItem, market?: MarketDataResponse): CalculatedTradeMetrics {
  const currentPrice = market ? market.current_price : trade.start_price;
  const previousClose = market ? market.previous_close : trade.start_price;
  const dailyChange = market ? market.change : 0;
  const dailyChangePercent = market ? market.change_percent : 0;

  // 1. Percent up or down related to its purchase / start price
  // ((Current - Start) / Start) * 100
  const percentReturn = trade.start_price > 0
    ? ((currentPrice - trade.start_price) / trade.start_price) * 100
    : 0;

  // 2. Percentage complete indicating how far along the trade is relative to its target price
  let percentComplete = 0;
  if (trade.target_price > trade.start_price) {
    // Long trade: progress from start_price towards target_price
    const totalDistance = trade.target_price - trade.start_price;
    const currentProgress = currentPrice - trade.start_price;
    percentComplete = (currentProgress / totalDistance) * 100;
  } else if (trade.target_price < trade.start_price) {
    // Short trade: progress downward from start_price towards target_price
    const totalDistance = trade.start_price - trade.target_price;
    const currentProgress = trade.start_price - currentPrice;
    percentComplete = (currentProgress / totalDistance) * 100;
  } else {
    percentComplete = 100;
  }

  // 3. Percentage deviation from target price (schema: pct_diff_current_vs_target)
  const targetDeviation = trade.target_price > 0
    ? ((currentPrice - trade.target_price) / trade.target_price) * 100
    : 0;

  const isTargetHit = trade.target_price >= trade.start_price
    ? currentPrice >= trade.target_price
    : currentPrice <= trade.target_price;

  // Date differences
  const now = new Date();
  const startDate = new Date(trade.start_date);
  const endDate = new Date(trade.end_date);

  const daysActive = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    currentPrice: Number(currentPrice.toFixed(2)),
    previousClose: Number(previousClose.toFixed(2)),
    dailyChange: Number(dailyChange.toFixed(2)),
    dailyChangePercent: Number(dailyChangePercent.toFixed(2)),
    percentReturn: Number(percentReturn.toFixed(2)),
    percentComplete: Number(percentComplete.toFixed(2)),
    targetDeviation: Number(targetDeviation.toFixed(2)),
    isTargetHit,
    isProfit: percentReturn >= 0,
    daysActive,
    daysRemaining,
    ohlc: market?.ohlc || [],
    marketLoaded: !!market
  };
}

export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
}

export function formatPercent(val: number, includeSign: boolean = true): string {
  const prefix = includeSign && val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(2)}%`;
}

export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}
