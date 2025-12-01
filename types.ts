export interface StockData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number; // In shares (股)
  eps: number;
  industry: string;
  // Simulated historical data for technical analysis
  history: number[]; 
  obv: number;
  ma5: number;
  ma10: number;
  ma20: number;
}

export interface AIAnalysisResult {
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  summary: string;
  technicalAnalysis: string;
  fundamentalAnalysis: string;
}

export enum MarketStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  PRE_MARKET = 'PRE_MARKET'
}

export interface PortfolioItem {
  symbol: string;
  name: string;
  quantity: number; // In shares (股)
  averageCost: number; // Per share price
}

export interface Portfolio {
  cash: number;
  holdings: { [symbol: string]: PortfolioItem };
  history: TradeRecord[];
}

export interface TradeRecord {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  price: number;
  quantity: number; // In shares (股)
  amount: number;
  timestamp: Date;
}

export type AppMode = 'MARKET' | 'SIMULATION';