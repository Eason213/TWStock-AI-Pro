import { GoogleGenAI } from "@google/genai";
import { StockData, AIAnalysisResult } from "../types";

// Lazy initialization helper to prevent top-level crashes if process.env is not ready
const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
};

// 模型設定
const MODEL_ID = "gemini-2.5-flash";

// Helper to clean and parse JSON from model output
const parseJSON = <T>(text: string | undefined): T | null => {
  if (!text) return null;
  try {
    // Remove markdown code blocks if present (```json ... ```)
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText) as T;
  } catch (error) {
    console.error("JSON Parse Failed:", error);
    console.debug("Raw Text:", text);
    return null;
  }
};

// 1. AI 個股分析 (強化建議與信心度)
export const analyzeStockWithAI = async (stock: StockData): Promise<AIAnalysisResult> => {
  const ai = getAIClient();
  const prompt = `
    你是一位狼性十足的台灣股市當沖與波段操盤手。請根據目前最新的股價數據與即時新聞，判斷現在是否為好的買賣點。
    
    【目標個股】
    代號：${stock.symbol}
    名稱：${stock.name}
    目前股價：${stock.price}
    漲跌幅：${stock.changePercent}%
    成交量：${stock.volume} 股
    均線參考：MA5=${stock.ma5}, MA10=${stock.ma10}, MA20=${stock.ma20}
    
    【任務執行】
    1. 使用 googleSearch 搜尋 "TPE:${stock.symbol} ${stock.name} 即時新聞" 與 "法人動向"。
    2. 結合技術面（股價是否站上均線、乖離率）與消息面進行分析。
    3. 給出極度明確的建議：
       - 若趨勢向上且有量，建議 BUY。
       - 若趨勢破線或利空，建議 SELL。
       - 若方向不明，建議 HOLD。
    4. 設定信心度 (0-100%)：若訊號強烈（如突破均線+爆量），信心度應高於 80%。

    【輸出格式】
    請直接回傳純 JSON 字串，不要 Markdown：
    {
      "recommendation": "BUY" | "SELL" | "HOLD",
      "confidence": number,
      "summary": "一句話講完結論 (例如：股價站上五日線且法人買超，強勢看多)",
      "technicalAnalysis": "針對均線與量能的技術分析 (繁體中文)",
      "fundamentalAnalysis": "針對新聞與產業面的基本分析 (繁體中文)"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const result = parseJSON<AIAnalysisResult>(response.text);
    if (!result) throw new Error("Failed to parse analysis result");
    
    return result;

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    return {
      recommendation: "HOLD",
      confidence: 50,
      summary: "AI 連線不穩，暫時建議觀望。",
      technicalAnalysis: "無法取得即時運算數據。",
      fundamentalAnalysis: "無法取得即時搜尋結果。"
    };
  }
};

// 2. 獲取即時股價 (修正搜尋邏輯)
export const getRealTimeStockQuotes = async (symbols: string[]): Promise<Partial<StockData>[]> => {
  if (symbols.length === 0) return [];
  const ai = getAIClient();

  // 強制加上 "TPE:" 前綴，確保 Google Finance 抓到的是台灣證交所數據
  const symbolsString = symbols.map(s => `TPE:${s}`).join(", ");
  
  const prompt = `
    請利用 Google Search 查詢 Google Finance，回傳以下台灣股票的「最新即時成交價」。
    股票列表：${symbolsString}
    
    重要規則：
    1. 必須搜尋 "Google Finance TPE:${symbols[0]}" 等關鍵字。
    2. 務必抓取 "TWD" 計價的數值。
    3. 若目前是收盤時間，回傳當日收盤價 (Close Price)。
    4. 若目前是開盤時間，回傳即時成交價 (Current Price)。
    5. "change" 為漲跌金額，"changePercent" 為漲跌幅(%)。
    
    【輸出格式】
    直接回傳純 JSON Array 字串：
    [
      {
        "symbol": "原始代號(去除TPE:前綴，例如 2330)",
        "price": number,
        "change": number,
        "changePercent": number,
        "volume": number
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const result = parseJSON<Partial<StockData>[]>(response.text);
    return result || [];
  } catch (error) {
    console.error("Fetch Realtime Quote Failed:", error);
    return [];
  }
};

// 3. 搜尋新股票
export const searchStockSymbol = async (query: string): Promise<{symbol: string, name: string} | null> => {
  const ai = getAIClient();
  const prompt = `
    使用者搜尋台灣股票："${query}"。
    請搜尋確認這是否為有效的上市櫃台股。
    
    回傳純 JSON Object：
    { "symbol": "代號", "name": "繁體中文名稱" }
    若找不到則回傳 null (JSON null)。
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    
    const result = parseJSON<{symbol: string, name: string}>(response.text);
    if (!result || !result.symbol) return null;
    return result;

  } catch (error) {
    console.error("Search Stock Failed:", error);
    return null;
  }
};
