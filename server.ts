import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

import { generateSPX1YearHistory } from "./src/utils/spxGenerator.ts";
import { fetchYahooFinanceSPXGeneric, aggregate1HTo4H, mergeCandles } from "./src/utils/yahooFinance.ts";
import { detectTrend, detectSupportResistanceZones, detectPatterns, findSwingPoints } from "./src/utils/patternDetector.ts";
import { Candle } from "./src/types.ts";

dotenv.config();

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), "data");

const TIMEFRAMES = ["1m", "5m", "15m", "4h", "1d"] as const;
type Timeframe = typeof TIMEFRAMES[number];

const timeframeFiles: Record<Timeframe, string> = {
  "1m": path.join(DATA_DIR, "spx_1m.json"),
  "5m": path.join(DATA_DIR, "spx_5m.json"),
  "15m": path.join(DATA_DIR, "spx_15m.json"),
  "4h": path.join(DATA_DIR, "spx_4h.json"),
  "1d": path.join(DATA_DIR, "spx_1d.json"),
};

let caches: Record<Timeframe, Candle[]> = {
  "1m": [],
  "5m": [],
  "15m": [],
  "4h": [],
  "1d": [],
};

let lastSyncTimes: Record<Timeframe, number> = {
  "1m": 0,
  "5m": 0,
  "15m": 0,
  "4h": 0,
  "1d": 0,
};

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  for (const tf of TIMEFRAMES) {
    const filePath = timeframeFiles[tf];
    if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf-8").trim() !== "") {
      try {
        caches[tf] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        lastSyncTimes[tf] = Date.now() - 5 * 60 * 1000; // Assume fresh on load
        console.log(`Loaded ${caches[tf].length} candles for timeframe: ${tf} from cache.`);
      } catch (e) {
        console.error(`Error loading cache for ${tf}, will fetch fresh...`, e);
      }
    }
  }
}

// Sync single timeframe from Yahoo Finance
async function syncTimeframe(tf: Timeframe) {
  console.log(`[Sync] Fetching timeframe ${tf} from Yahoo Finance...`);
  try {
    let fetched: Candle[] = [];
    if (tf === "1m") {
      fetched = await fetchYahooFinanceSPXGeneric("1m", "7d");
    } else if (tf === "5m") {
      fetched = await fetchYahooFinanceSPXGeneric("5m", "60d");
    } else if (tf === "15m") {
      fetched = await fetchYahooFinanceSPXGeneric("15m", "60d");
    } else if (tf === "4h") {
      // Fetch 1h and aggregate to 4h
      const hourly = await fetchYahooFinanceSPXGeneric("1h", "360d");
      if (hourly.length > 0) {
        fetched = aggregate1HTo4H(hourly);
      }
    } else if (tf === "1d") {
      fetched = await fetchYahooFinanceSPXGeneric("1d", "2y");
    }

    if (fetched.length > 0) {
      caches[tf] = mergeCandles(caches[tf], fetched);
      fs.writeFileSync(timeframeFiles[tf], JSON.stringify(caches[tf], null, 2), "utf-8");
      lastSyncTimes[tf] = Date.now();
      console.log(`[Sync] ${tf} sync complete. Total ${caches[tf].length} candles saved.`);
    } else {
      console.log(`[Sync] Yahoo Finance returned 0 candles for ${tf}.`);
    }
  } catch (err) {
    console.error(`[Sync] Failed to sync ${tf}:`, err);
  }
}

// Sync all timeframes sequentially
async function syncAllTimeframes() {
  console.log("[Sync] Syncing all multi-timeframe caches...");
  for (const tf of TIMEFRAMES) {
    await syncTimeframe(tf);
  }
}

// Ensure database files are loaded
ensureDataFiles();

// Sync any missing caches on startup and run full background update
async function initSync() {
  for (const tf of TIMEFRAMES) {
    if (caches[tf].length === 0) {
      await syncTimeframe(tf);
    }
  }
  // Run background full sync
  syncAllTimeframes().catch(err => console.error("Initial sync error:", err));
}
initSync();

// Daily Scheduler: 16:18 New York Time after stock market close
let lastDailySyncDateStr = "";
function startDailySyncScheduler() {
  console.log("Starting daily 16:18 EST/EDT multi-timeframe auto-sync scheduler...");
  setInterval(async () => {
    try {
      const nyTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
      const nyDate = new Date(nyTimeStr);
      
      const hours = nyDate.getHours();
      const minutes = nyDate.getMinutes();
      const dateStr = `${nyDate.getFullYear()}-${String(nyDate.getMonth() + 1).padStart(2, "0")}-${String(nyDate.getDate()).padStart(2, "0")}`;
      
      if (hours === 16 && minutes === 18 && lastDailySyncDateStr !== dateStr) {
        console.log(`[Scheduler] It is 16:18 New York time. Triggering automatic daily multi-timeframe pull...`);
        lastDailySyncDateStr = dateStr;
        await syncAllTimeframes();
        console.log(`[Scheduler] Automatic daily multi-timeframe pull completed for ${dateStr}.`);
      }
    } catch (err) {
      console.error("[Scheduler] Error in daily sync scheduler:", err);
    }
  }, 30 * 1000); // Check every 30 seconds
}
startDailySyncScheduler();

app.use(express.json({ limit: "10mb" }));

// 1. API Endpoint: Fetch candles + auto-recognized patterns and zones
app.get("/api/spx-data", async (req, res) => {
  const timeframe = (req.query.timeframe as Timeframe) || "5m";
  const dayParam = req.query.day as string; // YYYY-MM-DD
  
  if (!TIMEFRAMES.includes(timeframe)) {
    return res.status(400).json({ error: "Invalid timeframe parameter" });
  }

  // Auto sync if stale (older than 15 minutes)
  const now = Date.now();
  if (now - lastSyncTimes[timeframe] > 15 * 60 * 1000) {
    console.log(`[API] Cache stale for ${timeframe}. Triggering background sync...`);
    syncTimeframe(timeframe).catch(err => console.error("Stale sync error:", err));
  }

  const candles = caches[timeframe];

  // Filter up to T-1 day by default (exclude today's New York date)
  const nyTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const nowNY = new Date(nyTimeStr);
  const todayNYFormatted = `${nowNY.getFullYear()}-${String(nowNY.getMonth() + 1).padStart(2, "0")}-${String(nowNY.getDate()).padStart(2, "0")}`;

  const upToTMinus1Candles = candles.filter(c => {
    const candleNYStr = new Date(c.time).toLocaleString("en-US", { timeZone: "America/New_York" });
    const candleNY = new Date(candleNYStr);
    const candleNYFormatted = `${candleNY.getFullYear()}-${String(candleNY.getMonth() + 1).padStart(2, "0")}-${String(candleNY.getDate()).padStart(2, "0")}`;
    return candleNYFormatted < todayNYFormatted;
  });

  const finalCandles = upToTMinus1Candles.length > 0 ? upToTMinus1Candles : candles;
  let filtered: Candle[] = [];

  // If we are looking for a specific day's 5m intraday chart
  if (timeframe === "5m" && dayParam) {
    filtered = caches["5m"].filter(c => {
      const candleNYStr = new Date(c.time).toLocaleString("en-US", { timeZone: "America/New_York" });
      const candleNY = new Date(candleNYStr);
      const candleNYFormatted = `${candleNY.getFullYear()}-${String(candleNY.getMonth() + 1).padStart(2, "0")}-${String(candleNY.getDate()).padStart(2, "0")}`;
      return candleNYFormatted === dayParam;
    });

    // If no data found for that specific day, fallback to latest 5m candles
    if (filtered.length === 0) {
      filtered = finalCandles.slice(-390); // default to 1 day (~390 candles of 5m)
    }
  } else {
    // Standard timeframe slicing
    if (timeframe === "1m") {
      filtered = finalCandles.slice(-1500); // 4 days of 1-minute
    } else if (timeframe === "5m") {
      filtered = finalCandles.slice(-1500); // 19 days of 5-minute
    } else if (timeframe === "15m") {
      filtered = finalCandles.slice(-1500); // 57 days of 15-minute
    } else if (timeframe === "4h") {
      filtered = finalCandles.slice(-1000); // Plenty of 4h candles
    } else if (timeframe === "1d") {
      filtered = finalCandles.slice(-1000); // Full 2 years history
    }
  }

  // Run server-side patterns and indicators
  const trend = detectTrend(filtered);
  const patterns = detectPatterns(filtered);

  // S&R zones should ALWAYS be calculated from the past 21 trading days
  let zonesCandlesCount = 1638;
  if (timeframe === "1d") {
    zonesCandlesCount = 21;
  } else if (timeframe === "4h") {
    zonesCandlesCount = 42;
  } else if (timeframe === "15m") {
    zonesCandlesCount = 546;
  } else if (timeframe === "5m") {
    zonesCandlesCount = 1638;
  } else if (timeframe === "1m") {
    zonesCandlesCount = 3000;
  }

  const zonesBaseCandles = finalCandles.slice(-zonesCandlesCount);
  const finalZonesCandles = zonesBaseCandles.length > 0 ? zonesBaseCandles : filtered;
  const { highs: zoneHighs, lows: zoneLows } = findSwingPoints(finalZonesCandles, 6, 6);
  const zones = detectSupportResistanceZones(finalZonesCandles, zoneHighs, zoneLows);

  res.json({
    candles: filtered,
    patterns,
    zones,
    trend,
    lastUpdated: new Date(lastSyncTimes[timeframe] || Date.now()).toISOString(),
  });
});

// 2. API Endpoint: Manually trigger database sync
app.post("/api/spx-sync", async (req, res) => {
  await syncAllTimeframes();
  res.json({ success: true, lastUpdated: new Date().toISOString() });
});

// 3. API Endpoint: Gemini Price Action Coach
app.post("/api/coach-analyze", async (req, res) => {
  const { candles, activePattern } = req.body as { candles: Candle[]; activePattern?: any };

  if (!candles || candles.length === 0) {
    return res.status(400).json({ error: "Candles data is required for analysis." });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || geminiApiKey === "MY_GEMINI_API_KEY") {
    return res.json({
      text: `### 🎓 Price Action Coach Analysis

⚠️ **Gemini API Key is not configured yet.**
To unlock real-time, professional AI price action coaching:
1. Open the **Settings > Secrets** panel in the AI Studio UI.
2. Provide a valid \`GEMINI_API_KEY\`.

---

#### 💡 Coach's Quick Tip:
Based on the **${candles.length} bars** of price action submitted, the market is presenting classic structure:
- **Last Price**: $${candles[candles.length - 1].close.toFixed(2)}
- **Pattern Selected**: ${activePattern ? `**${activePattern.name}**` : "None"}
- **Study Tip**: Look at the shadow lengths relative to the bodies. Notice how rejection of highs or lows near recent pivot levels leads to sudden directional changes. That is the essence of Price Action trading!`
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    // Simplify the payload so we don't blow up token count
    const simplifiedCandles = candles.slice(-100).map(c => ({
      time: new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      O: c.open,
      H: c.high,
      L: c.low,
      C: c.close
    }));

    const patternContext = activePattern 
      ? `The user is specifically focusing on a detected **${activePattern.name}** pattern around price $${activePattern.price}. Context: ${activePattern.description}.`
      : "The user is looking at a general slice of the 5-minute SPX chart.";

    const prompt = `You are an elite, world-class Price Action trading mentor (specializing in Bob Volman and Al Brooks style price action). 
Your task is to analyze the following sequence of 5-minute SPX (S&P 500) candles and provide an actionable, deep-dive price action lesson.

---
[CONTEXT]
${patternContext}

---
[CANDLE DATA (OHLC)]
${JSON.stringify(simplifiedCandles, null, 2)}

---
Your analysis MUST be structured, engaging, and highly educational ("Wow" effect). Write in elegant, authoritative markdown:
1. **Trend & Market Structure**: Identify whether we are in a strong trend (bullish/bearish) or a trading range (accumulation/distribution). Point out any Higher Highs/Lows or Lower Highs/Lows.
2. **Key Level Diagnostics**: Highlight where the immediate support and resistance boundaries are, and how price behaves as it approaches them.
3. **Pattern Break Down**: Analyze the specific pattern selected (or visible). Explain the psychology behind this pattern (e.g., trapped sellers/buyers, exhaustion, or breakout compression).
4. **Actionable Trading Strategy**: Give concrete guidelines for a price action trader on this chart:
   - **Trigger / Entry**: What precise price trigger should we wait for (e.g. breakout of a signal bar's high/low)?
   - **Stop Loss Placement**: Where is the pattern invalidated?
   - **Take Profit Targets**: Realistic next target levels based on recent swings.

Keep your tone professional, encouraging, and razor-focused on price action (No indicators, moving averages, or RSI. Rely 100% on pure candles, support/resistance, and volume). Give specific prices from the candle dataset to make the lesson extremely concrete!`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional, direct, and elite price action coach. You never recommend indicators or complex metrics, teaching pure candlestick structure, swing levels, and market psychology.",
        temperature: 0.7,
      }
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error("Gemini Coach Error:", err);
    res.status(500).json({ error: "Failed to query Gemini Coach: " + err.message });
  }
});

// Vite & Static file serving setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
