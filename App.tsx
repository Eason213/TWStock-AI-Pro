import React, { useState, useEffect, useRef } from 'react';
import { Search, TrendingUp, Wallet, PieChart, Settings, Plus, X, RefreshCw } from 'lucide-react';
import { StockData, MarketStatus, AppMode, Portfolio, PortfolioItem } from './types';
import { INITIAL_STOCKS, getMarketStatus, updateStockWithRealData } from './services/stockUtils';
import { getRealTimeStockQuotes, searchStockSymbol } from './services/geminiService';
import StockDetail from './components/StockDetail';

const App: React.FC = () => {
  const [stocks, setStocks] = useState<StockData[]>(INITIAL_STOCKS);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(MarketStatus.CLOSED);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  // App Mode State
  const [appMode, setAppMode] = useState<AppMode>('MARKET');

  // Portfolio State
  const [initialCapital, setInitialCapital] = useState(5000000);
  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [portfolio, setPortfolio] = useState<Portfolio>({
    cash: initialCapital,
    holdings: {},
    history: []
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch Real Data Helper
  const refreshPrices = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const symbols = stocks.map(s => s.symbol);
      const realDataList = await getRealTimeStockQuotes(symbols);
      
      setStocks(prevStocks => {
        return prevStocks.map(stock => {
          const data = realDataList.find(r => r.symbol === stock.symbol);
          if (data) {
            return updateStockWithRealData(stock, data);
          }
          return stock;
        });
      });
      setLastUpdate(new Date());
    } catch (e) {
      console.error("Failed to refresh prices", e);
    } finally {
      setIsUpdating(false);
    }
  };

  // Initialize and Interval
  useEffect(() => {
    const status = getMarketStatus();
    setMarketStatus(status);
    
    // Initial fetch
    refreshPrices();

    // Auto-refresh interval (5 seconds)
    // 注意：實際生產環境應考慮 API 成本，這裡為了滿足需求設定為 5 秒
    intervalRef.current = setInterval(() => {
       const currentStatus = getMarketStatus();
       setMarketStatus(currentStatus);
       if (currentStatus === MarketStatus.OPEN) {
         refreshPrices();
       }
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // Run once on mount to set up interval

  // Handle Search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Check if already in list
    const existing = stocks.find(s => s.symbol === searchQuery || s.name.includes(searchQuery));
    if (existing) {
      setSelectedStock(existing);
      setSearchQuery("");
      setIsSearchOpen(false);
      return;
    }

    // AI Search
    setIsSearching(true);
    const result = await searchStockSymbol(searchQuery);
    setIsSearching(false);

    if (result) {
      // Check again if we have it by symbol now
      const duplicate = stocks.find(s => s.symbol === result.symbol);
      if (duplicate) {
         setSelectedStock(duplicate);
      } else {
         // Create new stock entry
         const newStock: StockData = {
           id: result.symbol,
           symbol: result.symbol,
           name: result.name,
           price: 0, // Will be fetched
           change: 0,
           changePercent: 0,
           open: 0,
           high: 0,
           low: 0,
           volume: 0,
           eps: 0,
           industry: '其他',
           history: [],
           obv: 0,
           ma5: 0,
           ma10: 0,
           ma20: 0
         };
         
         // Add to list first
         setStocks(prev => [newStock, ...prev]);
         // Then fetch its data immediately
         const quotes = await getRealTimeStockQuotes([result.symbol]);
         if (quotes.length > 0) {
            const updatedStock = updateStockWithRealData(newStock, quotes[0]);
            setStocks(prev => prev.map(s => s.symbol === result.symbol ? updatedStock : s));
            setSelectedStock(updatedStock);
         } else {
            setSelectedStock(newStock);
         }
      }
      setSearchQuery("");
      setIsSearchOpen(false);
    } else {
      alert("找不到該股票，請確認名稱或代號。");
    }
  };

  const handleStockClick = (stock: StockData) => {
    setSelectedStock(stock);
  };

  const getStatusText = (status: MarketStatus) => {
    switch (status) {
      case MarketStatus.OPEN: return '開盤中';
      case MarketStatus.CLOSED: return '已收盤';
      case MarketStatus.PRE_MARKET: return '試撮中';
      default: return '';
    }
  };

  // Portfolio Calculations
  const calculateTotalAssets = () => {
    let stockValue = 0;
    Object.values(portfolio.holdings).forEach((item: PortfolioItem) => {
      const currentStock = stocks.find(s => s.symbol === item.symbol);
      if (currentStock) {
        stockValue += currentStock.price * item.quantity * 1000;
      }
    });
    return portfolio.cash + stockValue;
  };

  const calculateTotalPL = () => {
    const totalAssets = calculateTotalAssets();
    return totalAssets - initialCapital;
  };

  const handleResetPortfolio = (newCapital: number) => {
    setInitialCapital(newCapital);
    setPortfolio({
      cash: newCapital,
      holdings: {},
      history: []
    });
    setShowCapitalModal(false);
  };

  const handleTrade = (type: 'BUY' | 'SELL', stock: StockData, quantity: number) => {
    const pricePerSheet = stock.price * 1000;
    const totalAmount = pricePerSheet * quantity;

    setPortfolio(prev => {
      const newPortfolio = { ...prev };
      
      if (type === 'BUY') {
        if (prev.cash < totalAmount) return prev; 
        
        newPortfolio.cash -= totalAmount;
        const currentHolding = newPortfolio.holdings[stock.symbol];
        
        if (currentHolding) {
          const totalCost = (currentHolding.averageCost * currentHolding.quantity * 1000) + totalAmount;
          const newQuantity = currentHolding.quantity + quantity;
          newPortfolio.holdings[stock.symbol] = {
            ...currentHolding,
            quantity: newQuantity,
            averageCost: (totalCost / (newQuantity * 1000))
          };
        } else {
          newPortfolio.holdings[stock.symbol] = {
            symbol: stock.symbol,
            name: stock.name,
            quantity: quantity,
            averageCost: stock.price
          };
        }
      } else {
        if (!newPortfolio.holdings[stock.symbol] || newPortfolio.holdings[stock.symbol].quantity < quantity) return prev;
        
        newPortfolio.cash += totalAmount;
        newPortfolio.holdings[stock.symbol].quantity -= quantity;
        
        if (newPortfolio.holdings[stock.symbol].quantity === 0) {
          delete newPortfolio.holdings[stock.symbol];
        }
      }

      newPortfolio.history.push({
        id: Date.now().toString(),
        symbol: stock.symbol,
        type,
        price: stock.price,
        quantity,
        amount: totalAmount,
        timestamp: new Date()
      });

      return newPortfolio;
    });
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-ios-twRed selection:text-white pb-32">
      
      <div className={`fixed top-0 left-0 w-full h-96 blur-[120px] rounded-full pointer-events-none transition-colors duration-1000 ${appMode === 'MARKET' ? 'bg-indigo-900/20' : 'bg-orange-900/20'}`} />
      <div className="fixed bottom-0 right-0 w-full h-96 bg-purple-900/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5 transition-all pt-safe-top">
        <div className="px-6 pt-2 pb-4">
          
          {/* Top Bar with Search Toggle */}
          <div className="flex justify-between items-center mb-4 min-h-[44px]">
            {isSearchOpen ? (
              <form onSubmit={handleSearch} className="flex-1 flex gap-2 animate-fade-in">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="輸入代號或名稱 (如: 2330 或 台積電)"
                    className="w-full bg-gray-800/80 rounded-xl py-2 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                </div>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 rounded-xl font-bold text-sm disabled:opacity-50"
                  disabled={isSearching}
                >
                  {isSearching ? '搜尋中...' : '搜尋'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsSearchOpen(false)}
                  className="p-2 bg-gray-800 rounded-xl"
                >
                  <X size={20} />
                </button>
              </form>
            ) : (
              <>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {appMode === 'MARKET' ? '自選清單' : '模擬操盤'}
                  </h1>
                  <p className="text-ios-gray text-xs font-medium tracking-wide flex items-center gap-2 mt-1">
                     <span className={`inline-block w-2 h-2 rounded-full ${marketStatus === MarketStatus.OPEN ? 'bg-ios-twRed animate-pulse' : 'bg-ios-gray'}`}></span>
                     {getStatusText(marketStatus)} • {lastUpdate.toLocaleTimeString('zh-TW')}
                     {isUpdating && <RefreshCw size={10} className="animate-spin ml-1"/>}
                  </p>
                </div>
                <div className="flex gap-2">
                  {/* Search Trigger */}
                  <button 
                    onClick={() => setIsSearchOpen(true)}
                    className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition"
                  >
                    <Search size={20} />
                  </button>
                  
                  {/* Settings Trigger (Simulation Mode) */}
                  {appMode === 'SIMULATION' && (
                    <button 
                      onClick={() => setShowCapitalModal(true)}
                      className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition"
                    >
                      <Settings size={20} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
            
            {/* Mode Switcher */}
            <div className="w-full sm:w-64 mx-auto">
              <div className="segmented-control">
                <div 
                  className="segment-indicator" 
                  style={{ transform: appMode === 'MARKET' ? 'translateX(0%)' : 'translateX(100%)', backgroundColor: appMode === 'MARKET' ? '#6366f1' : '#f97316' }} 
                />
                <button 
                  className="segment-btn relative" 
                  onClick={() => setAppMode('MARKET')}
                >
                  即時行情
                </button>
                <button 
                  className="segment-btn relative" 
                  onClick={() => setAppMode('SIMULATION')}
                >
                  虛擬下單
                </button>
              </div>
            </div>

          {/* Portfolio Summary Card */}
          {appMode === 'SIMULATION' && (
            <div className="mt-4 glass-panel p-5 rounded-2xl animate-slide-up border border-orange-500/30 shadow-lg shadow-orange-900/10">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-ios-gray text-xs uppercase tracking-wider mb-1">總資產現值 (TWD)</div>
                  <div className="text-3xl font-bold tracking-tight text-white">
                    {Math.floor(calculateTotalAssets()).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-ios-gray text-xs uppercase tracking-wider mb-1">未實現損益</div>
                  <div className={`text-xl font-bold ${calculateTotalPL() >= 0 ? 'text-ios-twRed' : 'text-ios-twGreen'}`}>
                    {calculateTotalPL() > 0 ? '+' : ''}{Math.floor(calculateTotalPL()).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-orange-500" 
                  style={{ width: `${(portfolio.cash / Math.max(1, calculateTotalAssets())) * 100}%` }} 
                />
                <div className="h-full bg-indigo-500 flex-1" />
              </div>
              <div className="flex justify-between mt-2 text-xs font-medium text-ios-gray">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /> 現金 {Math.floor(portfolio.cash).toLocaleString()}</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500" /> 證券 {(Math.floor(calculateTotalAssets() - portfolio.cash)).toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main List */}
      <main className="px-4 pt-4 space-y-4 pb-20">
        {appMode === 'MARKET' ? (
          stocks.length === 0 ? (
             <div className="text-center py-20 text-ios-gray">
               <p>清單是空的</p>
               <button onClick={() => setIsSearchOpen(true)} className="mt-2 text-indigo-400 font-bold">立即搜尋加入</button>
             </div>
          ) : (
            stocks.map((stock) => {
              const isUp = stock.change >= 0;
              const bgGradient = isUp 
                ? 'from-ios-twRed/5 to-transparent' 
                : 'from-ios-twGreen/5 to-transparent';

              return (
                <div 
                  key={stock.id}
                  onClick={() => handleStockClick(stock)}
                  className="relative overflow-hidden group p-5 rounded-[2rem] glass-panel transition-all duration-300 active:scale-95 cursor-pointer border border-white/5 hover:border-white/10"
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${bgGradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  
                  <div className="relative flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 ${isUp ? 'text-ios-twRed' : 'text-ios-twGreen'}`}>
                        <TrendingUp size={24} className={isUp ? '' : 'rotate-180'} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold tracking-tight">{stock.symbol}</h3>
                        <p className="text-sm text-ios-gray font-medium">{stock.name}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold tracking-tight tabular-nums">
                        {stock.price > 0 ? stock.price.toFixed(1) : '--'}
                      </div>
                      <div className={`flex items-center justify-end gap-1 text-sm font-semibold ${isUp ? 'text-ios-twRed' : 'text-ios-twGreen'}`}>
                        <span>{stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}</span>
                        <span className="bg-white/10 px-1.5 py-0.5 rounded text-xs">
                          {stock.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : (
          // SIMULATION HOLDINGS
          Object.keys(portfolio.holdings).length === 0 ? (
            <div className="text-center py-20 text-ios-gray">
              <Wallet size={48} className="mx-auto mb-4 opacity-50" />
              <p>目前沒有庫存</p>
              <p className="text-sm">切換回「即時行情」搜尋並點擊個股進行下單</p>
            </div>
          ) : (
             Object.values(portfolio.holdings).map((item: PortfolioItem) => {
               const stock = stocks.find(s => s.symbol === item.symbol) || { price: item.averageCost };
               const currentPrice = stock.price || item.averageCost;
               const marketValue = currentPrice * item.quantity * 1000;
               const costValue = item.averageCost * item.quantity * 1000;
               const pl = marketValue - costValue;
               const plPercent = ((currentPrice - item.averageCost) / item.averageCost) * 100;
               const isProfitable = pl >= 0;

               return (
                <div 
                  key={item.symbol}
                  onClick={() => stock.id ? handleStockClick(stock as StockData) : null}
                  className="relative overflow-hidden group p-5 rounded-[2rem] glass-panel transition-all duration-300 active:scale-95 cursor-pointer border border-white/5 hover:border-white/10"
                >
                  <div className="relative flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight">{item.symbol} <span className="text-base font-normal text-gray-400">{item.name}</span></h3>
                      <div className="flex gap-4 mt-1 text-sm text-ios-gray">
                         <span>庫存 {item.quantity} 張</span>
                         <span>均價 {item.averageCost.toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xl font-bold tracking-tight ${isProfitable ? 'text-ios-twRed' : 'text-ios-twGreen'}`}>
                        {pl > 0 ? '+' : ''}{Math.floor(pl).toLocaleString()}
                      </div>
                      <div className={`text-sm font-medium ${isProfitable ? 'text-ios-twRed' : 'text-ios-twGreen'}`}>
                        {plPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
               );
             })
          )
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-6 left-6 right-6 h-16 glass-panel rounded-full flex justify-around items-center px-2 z-40 shadow-2xl shadow-black/50 mb-safe-bottom">
         <button onClick={() => setAppMode('MARKET')} className={`p-3 transition ${appMode === 'MARKET' ? 'text-white' : 'text-ios-gray'}`}><TrendingUp size={24} /></button>
         <button onClick={() => setIsSearchOpen(true)} className="p-3 text-ios-gray hover:text-white transition"><Search size={24} /></button>
         <button onClick={() => setAppMode('SIMULATION')} className={`p-3 transition ${appMode === 'SIMULATION' ? 'text-white' : 'text-ios-gray'}`}><PieChart size={24} /></button>
      </nav>

      {/* Capital Setting Modal */}
      {showCapitalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-modal w-full max-w-sm rounded-3xl p-6 animate-slide-up">
            <h3 className="text-xl font-bold mb-4">設定初始資金</h3>
            <p className="text-gray-400 text-sm mb-6">這將會重置您的模擬投資組合與所有交易紀錄。</p>
            
            <div className="space-y-3 mb-6">
              {[1000000, 3000000, 5000000, 10000000].map(amt => (
                <button
                  key={amt}
                  onClick={() => handleResetPortfolio(amt)}
                  className={`w-full py-3 rounded-xl font-medium border border-white/10 hover:bg-white/10 ${initialCapital === amt ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'text-gray-300'}`}
                >
                  ${(amt/10000).toLocaleString()} 萬
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setShowCapitalModal(false)}
              className="w-full py-3 bg-gray-700 rounded-xl font-bold"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      {selectedStock && (
        <StockDetail 
          stock={selectedStock} 
          onClose={() => setSelectedStock(null)}
          mode={appMode}
          portfolio={portfolio}
          onTrade={handleTrade}
        />
      )}
    </div>
  );
};

export default App;