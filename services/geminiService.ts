import { GoogleGenAI, Type } from "@google/genai";
import { StockData, AIAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// 模型設定
const MODEL_ID = "gemini-2.5-flash";

// 1. AI 個股分析 (維持原有功能，但強化提示詞)
export const analyzeStockWithAI = async (stock: StockData): Promise<AIAnalysisResult> => {
  const prompt = `
    你是一位專業的台灣股市分析師。請根據以下台股個股數據，結合 Google Search 搜尋最新的新聞與產業動態，提供投資建議。
    請使用繁體中文回答，並使用專業術語（如：K線、均線、成交量、EPS、本益比、OBV能量潮等）。
    
    股票代號：${stock.symbol}
    股票名稱：${stock.name}
    產業類別：${stock.industry}
    目前股價：${stock.price} TWD
    漲跌：${stock.change} (${stock.changePercent}%)
    成交量（張）：${stock.volume}
    EPS：${stock.eps}
    
    技術指標參考：
    - 5日均線 (MA5)：${stock.ma5}
    - 10日均線 (MA10)：${stock.ma10}
    - 20日均線 (MA20)：${stock.ma20}
    
    分析規則：
    1. 比較目前股價與均線的關係。
    2. 搜尋該公司近期的即時新聞或財報發布（使用 googleSearch）。
    3. 給出明確建議：買進 (BUY)、賣出 (SELL) 或 持有 (HOLD)。
    4. 語氣專業、簡潔、有信心。
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], // 啟用搜尋以獲取最新新聞
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendation: { type: Type.STRING, enum: ["BUY", "SELL", "HOLD"], description: "BUY, SELL 或 HOLD" },
            confidence: { type: Type.NUMBER, description: "信心指數 0-100" },
            summary: { type: Type.STRING, description: "整體分析摘要 (繁體中文)" },
            technicalAnalysis: { type: Type.STRING, description: "技術面分析 (繁體中文)" },
            fundamentalAnalysis: { type: Type.STRING, description: "基本面分析 (繁體中文)" }
          },
          required: ["recommendation", "confidence", "summary", "technicalAnalysis", "fundamentalAnalysis"]
        }
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) throw new Error("No response from AI");
    return JSON.parse(jsonStr) as AIAnalysisResult;

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    return {
      recommendation: "HOLD",
      confidence: 0,
      summary: "AI 服務繁忙，無法取得即時分析。",
      technicalAnalysis: "無數據",
      fundamentalAnalysis: "無數據"
    };
  }
};

// 2. 獲取即時股價 (批次)
export const getRealTimeStockQuotes = async (symbols: string[]): Promise<Partial<StockData>[]> => {
  if (symbols.length === 0) return [];

  const symbolsString = symbols.map(s => `${s} TW`).join(", ");
  const prompt = `
    請使用 Google Search 查詢 Google Finance 上的最新即時股價資訊。
    目標股票：${symbolsString}。
    
    如果現在是台灣股市收盤時間 (13:30 後或假日)，請回傳最後的收盤價。
    請確保數據準確。
    
    請回傳一個 JSON Array，包含每個股票的：
    - symbol (股票代號，例如 "2330")
    - price (目前股價，Number)
    - change (漲跌金額，Number)
    - changePercent (漲跌幅度百分比，Number)
    - volume (成交量，若無法取得請回傳 0，Number)
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              symbol: { type: Type.STRING },
              price: { type: Type.NUMBER },
              change: { type: Type.NUMBER },
              changePercent: { type: Type.NUMBER },
              volume: { type: Type.NUMBER }
            },
            required: ["symbol", "price", "change", "changePercent"]
          }
        }
      }
    });

    const jsonStr = response.text;
    return JSON.parse(jsonStr) as Partial<StockData>[];
  } catch (error) {
    console.error("Fetch Realtime Quote Failed:", error);
    return [];
  }
};

// 3. 搜尋新股票
export const searchStockSymbol = async (query: string): Promise<{symbol: string, name: string} | null> => {
  const prompt = `
    使用者想要搜尋台灣股票："${query}"。
    請使用 Google Search 確認這是否為一支有效的台股。
    如果是，請回傳其股票代號 (symbol) 與繁體中文名稱 (name)。
    如果不是或找不到，請回傳 null。
    回傳格式為 JSON Object。
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING },
            name: { type: Type.STRING }
          }
        }
      }
    });
    
    const text = response.text;
    if(!text) return null;
    const result = JSON.parse(text);
    if (!result.symbol) return null;
    return result;

  } catch (error) {
    console.error("Search Stock Failed:", error);
    return null;
  }
};