import React, { useEffect, useState } from 'react';
import { X, TrendingUp, TrendingDown, Activity, Cpu, Zap, BarChart3, BrainCircuit, Wallet } from 'lucide-react';
import { StockData, AIAnalysisResult, AppMode, Portfolio } from '../types';
import StockChart from './StockChart';
import { analyzeStockWithAI } from '../services/geminiService';

interface StockDetailProps {
  stock: StockData;
  onClose: () => void;
  mode: AppMode;
  portfolio?: Portfolio;
  onTrade?: (type: 'BUY' | 'SELL', stock: StockData, quantity: number) => void;
}

const StockDetail: React.FC<StockDetailProps> = ({ stock, onClose, mode, portfolio, onTrade }) => {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Trading State
  const [tradeTab, setTradeTab] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState<number>(1);

  const isUp = stock.change >= 0;
  const colorClass = isUp ? 'text-ios-twRed' : 'text-ios-twGreen';
  const chartColor = isUp ? '#FF453A' : '#30D158';

  // Portfolio derived data
  const holding = portfolio?.holdings[stock.symbol];
  const holdingQty = holding?.quantity || 0;
  const cash = portfolio?.cash || 0;
  const maxBuy = Math.floor(cash / (stock.price * 1000));

  useEffect(() => {
    let mounted = true;
    const fetchAnalysis = async () => {
      setLoading(true);
      const result = await analyzeStockWithAI(stock);
      if (mounted) {
        setAnalysis(result);
        setLoading(false);
      }
    };
    fetchAnalysis();
    return () => { mounted = false; };
  }, [stock.id]);

  const getRecommendationText = (rec: string) => {
    switch (rec) {
      case 'BUY': return '強力買進';
      case 'SELL': return '建議賣出';
      case 'HOLD': return '觀望持有';
      default: return rec;
    }
  };

  const handleExecuteTrade = () => {
    if (onTrade) {
      onTrade(tradeTab, stock, quantity);
      // Reset after trade
      if (tradeTab === 'SELL' && quantity >= holdingQty) {
          // If sold all, maybe close or reset
          setQuantity(1);
      }
      // Simple haptic feedback simulation
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Sheet */}
      <div className="relative w-full max-w-md h-[92vh] sm:h-[85vh] glass-modal rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col overflow-hidden animate-slide-up shadow-2xl shadow-black">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">{stock.symbol}</h2>
            <p className="text-ios-gray text-sm font-medium tracking-wide">{stock.name}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-8 pb-32">
          
          {/* Price Section */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <span className={`text-5xl font-bold tracking-tighter ${colorClass}`}>
                {stock.price.toFixed(1)}
              </span>
              <span className="text-sm text-ios-gray">TWD</span>
            </div>
            <div className={`flex items-center gap-2 text-lg font-medium ${colorClass}`}>
              {isUp ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              <span>{stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent}%)</span>
            </div>
          </div>

          {/* Chart */}
          <StockChart data={stock.history} color={chartColor} />

          {/* Mode Specific Interface */}
          {mode === 'SIMULATION' && (
             <div className="glass-panel p-5 rounded-3xl border border-orange-500/30 shadow-lg shadow-orange-900/10">
                <div className="flex items-center gap-2 mb-4 text-orange-400 font-bold">
                   <Wallet size={18} /> 
                   <span>模擬下單</span>
                </div>
                
                {/* Buy/Sell Tabs */}
                <div className="flex bg-black/40 p-1 rounded-xl mb-6">
                  <button 
                    onClick={() => setTradeTab('BUY')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tradeTab === 'BUY' ? 'bg-ios-twRed text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  >
                    買進
                  </button>
                  <button 
                    onClick={() => setTradeTab('SELL')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tradeTab === 'SELL' ? 'bg-ios-twGreen text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  >
                    賣出
                  </button>
                </div>

                {/* Info Row */}
                <div className="flex justify-between text-sm mb-4 px-2">
                   <span className="text-ios-gray">
                     {tradeTab === 'BUY' ? '可買股數' : '庫存股數'}
                   </span>
                   <span className="font-mono text-white">
                     {tradeTab === 'BUY' ? `${maxBuy} 張` : `${holdingQty} 張`}
                   </span>
                </div>

                {/* Quantity Input */}
                <div className="flex items-center justify-between bg-black/30 rounded-xl p-3 mb-4 border border-white/5">
                   <button 
                     onClick={() => setQuantity(Math.max(1, quantity - 1))}
                     className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full text-xl font-bold hover:bg-white/20"
                   >-</button>
                   <div className="text-center">
                      <div className="text-2xl font-bold">{quantity} <span className="text-sm font-normal text-ios-gray">張</span></div>
                   </div>
                   <button 
                     onClick={() => setQuantity(quantity + 1)}
                     className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full text-xl font-bold hover:bg-white/20"
                   >+</button>
                </div>

                {/* Summary */}
                <div className="flex justify-between items-center mb-4 px-2">
                   <span className="text-ios-gray text-sm">預估金額</span>
                   <span className="text-xl font-bold text-white font-mono">
                     {Math.floor(stock.price * 1000 * quantity).toLocaleString()} TWD
                   </span>
                </div>

                <button 
                   onClick={handleExecuteTrade}
                   disabled={(tradeTab === 'BUY' && maxBuy < quantity) || (tradeTab === 'SELL' && holdingQty < quantity)}
                   className={`w-full py-3.5 rounded-xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                     tradeTab === 'BUY' ? 'bg-ios-twRed hover:bg-red-500' : 'bg-ios-twGreen hover:bg-green-500'
                   }`}
                >
                   確認{tradeTab === 'BUY' ? '買進' : '賣出'}
                </button>
             </div>
          )}

          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
             <div className="glass-panel p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2 text-ios-gray text-xs uppercase tracking-wider">
                  <Activity size={12} /> 成交量
                </div>
                <div className="text-xl font-semibold">{stock.volume.toLocaleString()}</div>
             </div>
             <div className="glass-panel p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2 text-ios-gray text-xs uppercase tracking-wider">
                  <Zap size={12} /> EPS
                </div>
                <div className="text-xl font-semibold">{stock.eps}</div>
             </div>
             <div className="glass-panel p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2 text-ios-gray text-xs uppercase tracking-wider">
                  <BarChart3 size={12} /> 5日均線
                </div>
                <div className="text-xl font-semibold text-ios-blue">{stock.ma5}</div>
             </div>
             <div className="glass-panel p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2 text-ios-gray text-xs uppercase tracking-wider">
                  <Cpu size={12} /> 產業
                </div>
                <div className="text-xl font-semibold truncate">{stock.industry}</div>
             </div>
          </div>

          {/* AI Analysis Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-purple-900/20">
                <BrainCircuit size={20} className="text-white" />
              </div>
              <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-300">
                AI 智能分析
              </h3>
            </div>

            {loading ? (
              <div className="glass-panel p-6 rounded-3xl flex flex-col items-center justify-center space-y-4 min-h-[200px]">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-ios-gray animate-pulse">正在分析市場動向...</p>
              </div>
            ) : analysis ? (
              <div className="glass-panel p-6 rounded-3xl space-y-6 border border-indigo-500/20 shadow-lg shadow-indigo-900/10">
                
                {/* Recommendation Badge */}
                <div className="flex justify-between items-center">
                  <span className="text-ios-gray text-sm font-medium">投資建議</span>
                  <div className={`px-4 py-1.5 rounded-full text-sm font-bold border ${
                    analysis.recommendation === 'BUY' ? 'bg-ios-twRed/20 border-ios-twRed text-ios-twRed' :
                    analysis.recommendation === 'SELL' ? 'bg-ios-twGreen/20 border-ios-twGreen text-ios-twGreen' :
                    'bg-ios-gray/20 border-ios-gray text-ios-gray'
                  }`}>
                    {getRecommendationText(analysis.recommendation)} • 信心度 {analysis.confidence}%
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h4 className="text-indigo-300 text-xs uppercase font-bold tracking-widest mb-1">總結</h4>
                    <p className="text-sm leading-relaxed text-gray-200">{analysis.summary}</p>
                  </div>
                  
                  <div className="h-px bg-white/10 my-2" />
                  
                  <div>
                    <h4 className="text-indigo-300 text-xs uppercase font-bold tracking-widest mb-1">技術面</h4>
                    <p className="text-sm leading-relaxed text-gray-300">{analysis.technicalAnalysis}</p>
                  </div>

                  <div className="h-px bg-white/10 my-2" />

                  <div>
                    <h4 className="text-indigo-300 text-xs uppercase font-bold tracking-widest mb-1">基本面</h4>
                    <p className="text-sm leading-relaxed text-gray-300">{analysis.fundamentalAnalysis}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-red-400">無法取得分析數據</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockDetail;