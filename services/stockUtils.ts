import { StockData, MarketStatus } from '../types';

// 基礎清單，股價將由 API 更新
export const INITIAL_STOCKS: StockData[] = [
  {
    id: '2330',
    symbol: '2330',
    name: '台積電',
    price: 1080, // Placeholder
    change: 0,
    changePercent: 0,
    open: 1080,
    high: 1080,
    low: 1080,
    volume: 0,
    eps: 42.5,
    industry: '半導體',
    history: [], 
    obv: 0,
    ma5: 0,
    ma10: 0,
    ma20: 0
  },
  {
    id: '2317',
    symbol: '2317',
    name: '鴻海',
    price: 210,
    change: 0,
    changePercent: 0,
    open: 210,
    high: 210,
    low: 210,
    volume: 0,
    eps: 11.5,
    industry: '電子代工',
    history: [],
    obv: 0,
    ma5: 0,
    ma10: 0,
    ma20: 0
  },
  {
    id: '2454',
    symbol: '2454',
    name: '聯發科',
    price: 1260,
    change: 0,
    changePercent: 0,
    open: 1260,
    high: 1260,
    low: 1260,
    volume: 0,
    eps: 55.2,
    industry: 'IC設計',
    history: [],
    obv: 0,
    ma5: 0,
    ma10: 0,
    ma20: 0
  },
  {
    id: '2603',
    symbol: '2603',
    name: '長榮',
    price: 215,
    change: 0,
    changePercent: 0,
    open: 215,
    high: 215,
    low: 215,
    volume: 0,
    eps: 22.5,
    industry: '航運',
    history: [],
    obv: 0,
    ma5: 0,
    ma10: 0,
    ma20: 0
  }
];

// Helper to calculate SMA
const calculateSMA = (data: number[], period: number): number => {
  if (data.length < period) return 0;
  const slice = data.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Number((sum / period).toFixed(2));
};

// Determine market status using Taiwan Time (UTC+8)
export const getMarketStatus = (): MarketStatus => {
  const now = new Date();
  
  // Convert to Taiwan Time
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const twTime = new Date(utc + (3600000 * 8));
  
  const twDay = twTime.getDay();
  const twHour = twTime.getHours();
  const twMinute = twTime.getMinutes();

  // Weekend check
  if (twDay === 0 || twDay === 6) return MarketStatus.CLOSED;
  
  const timeVal = twHour * 60 + twMinute;
  const openTime = 9 * 60; // 09:00
  const closeTime = 13 * 60 + 30; // 13:30

  if (timeVal >= openTime && timeVal <= closeTime) return MarketStatus.OPEN;
  if (timeVal < openTime) return MarketStatus.PRE_MARKET;
  return MarketStatus.CLOSED;
};

// Generate fake history based on current price for chart visualization
export const generateHistory = (currentPrice: number): number[] => {
  const history = [];
  let price = currentPrice;
  for (let i = 0; i < 30; i++) {
    history.unshift(price);
    // Random walk backwards
    price = price + (Math.random() - 0.5) * (price * 0.02);
  }
  return history;
};

// Update stock object with real data
export const updateStockWithRealData = (existingStock: StockData, realData: Partial<StockData>): StockData => {
  const newPrice = realData.price || existingStock.price;
  
  // If we don't have history or price changed significantly, regenerate or append
  let newHistory = existingStock.history;
  if (newHistory.length === 0) {
      newHistory = generateHistory(newPrice);
  } else {
      // Append new price, keep length at 30
      newHistory = [...newHistory.slice(1), newPrice];
  }

  return {
    ...existingStock,
    price: newPrice,
    change: realData.change !== undefined ? realData.change : existingStock.change,
    changePercent: realData.changePercent !== undefined ? realData.changePercent : existingStock.changePercent,
    volume: realData.volume || existingStock.volume,
    history: newHistory,
    ma5: calculateSMA(newHistory, 5),
    ma10: calculateSMA(newHistory, 10),
    ma20: calculateSMA(newHistory, 20),
    obv: existingStock.obv + (realData.volume || 0) // Accumulate roughly
  };
};