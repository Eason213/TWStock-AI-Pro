import React, { useState, useEffect, useRef } from 'react';
import { Search, TrendingUp, Wallet, PieChart, Settings, X, RefreshCw } from 'lucide-react';
import { StockData, MarketStatus, AppMode, Portfolio, PortfolioItem } from './types';
import { INITIAL_STOCKS, getMarketStatus, updateStockWithRealData } from './services/stockUtils';
import { getRealTimeStockQuotes, searchStockSymbol } from './services/geminiService';
import StockDetail from './components/StockDetail';

const App: React.FC = () => {
  // stocks acts as the "Watchlist"
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
  const [tempCapitalInput, setTempCapitalInput] = useState("5000000");
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
      // Refresh both watchlist and currently selected stock
      const symbolsToFetch = new Set<string>(stocks.map(s => s.symbol));
      if (selectedStock) {
        symbolsToFetch.add(selectedStock.symbol);
      }

      const symbols = Array.from(symbolsToFetch);
      if (symbols.length === 0) {
        setIsUpdating(false);
        return;
      }

      const realDataList = await getRealTimeStockQuotes(symbols);
      
      // Update Watchlist
      setStocks(prevStocks => {
        return prevStocks.map(stock => {
          const data = realDataList.find(r => r.symbol === stock.symbol);
          if (data) {
            return updateStockWithRealData(stock, data);
          }
          return stock;
        });
      });

      // Update Selected Stock (if open)
      if (selectedStock) {
         const data = realDataList.find(r => r.symbol === selectedStock.symbol);
         if (data) {
            setSelectedStock(prev => prev ? updateStockWithRealData(prev, data) : null);
         }
      }

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

    // Check if already in watchlist
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
         // Create new stock object for viewing (NOT added to watchlist yet)
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
         
         // Fetch data immediately for this new stock
         const quotes = await getRealTimeStockQuotes([result.symbol]);
         if (quotes.length > 0) {
            const updatedStock = updateStockWithRealData(newStock, quotes[0]);
            setSelectedStock(updatedStock);
         } else {
            setSelectedStock(newStock);
         }

      setSearchQuery("");
      setIsSearchOpen(false);
    } else {
      alert("找不到該股票，請確認名稱或代號。");
    }
  };

  const toggleWatchlist = (stock: StockData) => {
    setStocks(prev => {
      const exists = prev.find(s => s.symbol === stock.symbol);
      if (exists) {
        return prev.filter(s => s.symbol !== stock.symbol);
      } else {
        return [stock, ...prev];
      }
    });
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

  // Portfolio Calculations (Based on Shares)
  const calculateTotalAssets = () => {
    let stockValue = 0;
    Object.values(portfolio.holdings).forEach((item: PortfolioItem) => {
      const currentStock = stocks.find(s => s.symbol === item.symbol) || selectedStock;
      // Note: If stock is not in watchlist or selectedStock, value might be stale, 
      // but in this app architecture we assume we have the price if we own it 
      // (or we use average cost as fallback if price unavailable to avoid 0)
      const price = (currentStock && currentStock.symbol === item.symbol) ? currentStock.price : item.averageCost;
      stockValue += price * item.quantity; // No multiplier
    });
    return portfolio.cash + stockValue;
  };

  const calculateTotalPL = () => {
    const totalAssets = calculateTotalAssets();
    return totalAssets - initialCapital;
  };

  const handleResetPortfolio = () => {
    const newCap = parseInt(tempCapitalInput);
    if (isNaN(newCap) || newCap < 0 || newCap > 10000000) {
      alert("請輸入 0 ~ 10,000,000 之間的金額");
      return;
    }
    setInitialCapital(newCap);
    setPortfolio({
      cash: newCap,
      holdings: {},
      history: []
    });
    setShowCapitalModal(false);
  };

  const handleTrade = (type: 'BUY' | 'SELL', stock: StockData, quantity: number) => {
    const totalAmount = stock.price * quantity; // No multiplier

    setPortfolio(prev => {
      const newPortfolio = { ...prev };
      
      if (type === 'BUY') {
        if (prev.cash < totalAmount) return prev; 
        
        newPortfolio.cash -= totalAmount;
        const currentHolding = newPortfolio.holdings[stock.symbol];
        
        if (currentHolding) {
          const totalCost = (currentHolding.averageCost * currentHolding.quantity) + totalAmount;
          const newQuantity = currentHolding.quantity + quantity;
          newPortfolio.holdings[stock.symbol] = {
            ...currentHolding,
            quantity: newQuantity,
            averageCost: (totalCost / newQuantity)
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
                      onClick={() => {
                        setTempCapitalInput(initialCapital.toString());
                        setShowCapitalModal(true);
                      }}
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
               <p>自選清單是空的</p>
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
               // Get current market price if available, else use average cost
               const stock = stocks.find(s => s.symbol === item.symbol);
               const currentPrice = stock ? stock.price : item.averageCost;
               const marketValue = currentPrice * item.quantity;
               const costValue = item.averageCost * item.quantity;
               const pl = marketValue - costValue;
               const plPercent = ((currentPrice - item.averageCost) / item.averageCost) * 100;
               const isProfitable = pl >= 0;

               return (
                <div 
                  key={item.symbol}
                  onClick={() => {
                     if(stock) handleStockClick(stock);
                     // If stock not in watchlist, we need to try finding it or show alert? 
                     // Ideally we should be able to open detail for any held stock.
                     // For now if it's not in stocks list, we might miss data, 
                     // but handleSearch logic allows viewing arbitrary stocks.
                     // We'll just show what we have in portfolio.
                  }}
                  className="relative overflow-hidden group p-5 rounded-[2rem] glass-panel transition-all duration-300 active:scale-95 cursor-pointer border border-white/5 hover:border-white/10"
                >
                  <div className="relative flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight">{item.symbol} <span className="text-base font-normal text-gray-400">{item.name}</span></h3>
                      <div className="flex gap-4 mt-1 text-sm text-ios-gray">
                         <span>庫存 {item.quantity} 股</span>
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
            
            <div className="mb-6">
                <label className="text-xs text-ios-gray mb-2 block uppercase tracking-wider">輸入金額 (TWD)</label>
                <input 
                  type="number" 
                  value={tempCapitalInput}
                  onChange={(e) => setTempCapitalInput(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-xl font-bold text-white focus:outline-none focus:border-indigo-500"
                  placeholder="5000000"
                  min="0"
                  max="10000000"
                />
                <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
                    {[100, 300, 500, 1000].map(val => (
                        <button 
                           key={val}
                           onClick={() => setTempCapitalInput((val * 10000).toString())}
                           className="whitespace-nowrap px-3 py-1 bg-white/5 rounded-lg text-sm text-gray-400 hover:bg-white/10 hover:text-white"
                        >
                            {val}萬
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowCapitalModal(false)}
                className="flex-1 py-3 bg-gray-700/50 hover:bg-gray-700 rounded-xl font-bold transition"
              >
                取消
              </button>
              <button
                onClick={handleResetPortfolio}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition"
              >
                確認重置
              </button>
            </div>
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
          isWatchlisted={stocks.some(s => s.symbol === selectedStock.symbol)}
          onToggleWatchlist={() => toggleWatchlist(selectedStock)}
        />
      )}
    </div>
  );
};

export default App;