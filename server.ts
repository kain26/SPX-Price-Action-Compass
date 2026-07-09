import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

import { generateSPX1YearHistory } from "./src/utils/spxGenerator.ts";
import { fetchYahooFinanceSPXGeneric, aggregate1HTo4H, mergeCandles } from "./src/utils/yahooFinance.ts";
import { detectTrend, detectSupportResistanceZones, detectPatterns, findSwingPoints } from "./src/utils/patternDetector.ts";
import { Candle } from "./src/types.ts";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DATA_DIR = path.join(process.cwd(), "data");

const TIMEFRAMES = ["1m", "5m", "15m", "4h", "1d"] as const;
type Timeframe = typeof TIMEFRAMES[number];

const SYMBOLS = ["spx", "es", "qqq", "spy"] as const;
type SymbolType = typeof SYMBOLS[number];

// Multi-symbol multi-timeframe caches
let caches: Record<SymbolType, Record<Timeframe, Candle[]>> = {
  spx: { "1m": [], "5m": [], "15m": [], "4h": [], "1d": [] },
  es: { "1m": [], "5m": [], "15m": [], "4h": [], "1d": [] },
  qqq: { "1m": [], "5m": [], "15m": [], "4h": [], "1d": [] },
  spy: { "1m": [], "5m": [], "15m": [], "4h": [], "1d": [] },
};

let lastSyncTimes: Record<SymbolType, Record<Timeframe, number>> = {
  spx: { "1m": 0, "5m": 0, "15m": 0, "4h": 0, "1d": 0 },
  es: { "1m": 0, "5m": 0, "15m": 0, "4h": 0, "1d": 0 },
  qqq: { "1m": 0, "5m": 0, "15m": 0, "4h": 0, "1d": 0 },
  spy: { "1m": 0, "5m": 0, "15m": 0, "4h": 0, "1d": 0 },
};

// Helper: Determine if the US market/futures are currently active in New York Time
function isSymbolActive(symbol: SymbolType): boolean {
  try {
    const nyTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const nyDate = new Date(nyTimeStr);
    const day = nyDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = nyDate.getHours();
    const minute = nyDate.getMinutes();

    if (day === 0 || day === 6) {
      // Weekends: ES opens Sunday at 18:00 NY time
      if (symbol === "es" && day === 0 && hour >= 18) {
        return true;
      }
      return false;
    }

    if (symbol === "es") {
      // ES Futures: Continuous from Sunday 18:00 (6 PM) to Friday 17:00 (5 PM) NY time
      if (day === 5) { // Friday
        return hour < 17;
      }
      return true; // Monday to Thursday
    } else if (symbol === "qqq" || symbol === "spy") {
      // QQQ, SPY: Pre-market + Regular + Post-market (4:00 AM to 8:00 PM NY time)
      return hour >= 4 && hour < 20;
    } else {
      // SPX: Cash Index (Regular hours only: 9:30 AM to 4:00 PM NY time)
      const isRegularHours = (hour > 9 || (hour === 9 && minute >= 30)) && hour < 16;
      return isRegularHours;
    }
  } catch (err) {
    console.error("Error checking active status:", err);
    return true; // Fallback to active
  }
}

// Helper: Get adaptive cache TTL (Time To Live) in milliseconds based on symbol activity and timeframe
function getSymbolTimeframeTTL(symbol: SymbolType, tf: Timeframe): number {
  const isActive = isSymbolActive(symbol);
  
  if (isActive) {
    if (tf === "1m" || tf === "5m" || tf === "15m") {
      return 2 * 60 * 1000; // 2 minutes for highly-active intraday trading
    }
    return 30 * 60 * 1000; // 30 minutes for longer term charts (4h, 1d) during active hours
  } else {
    // Off-market hours: 1 hour cache is plenty to keep server resources calm while capturing late reporting
    return 60 * 60 * 1000;
  }
}

const VERSION_FILE = path.join(DATA_DIR, ".cache_version");
const CURRENT_VERSION = "v2_prepost";

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let shouldReset = true;
  if (fs.existsSync(VERSION_FILE)) {
    const v = fs.readFileSync(VERSION_FILE, "utf-8").trim();
    if (v === CURRENT_VERSION) {
      shouldReset = false;
    }
  }

  if (shouldReset) {
    console.log("[Cache Reset] New cache version detected. Clearing old JSON caches to force fresh download with pre/post-market data...");
    for (const sym of SYMBOLS) {
      for (const tf of TIMEFRAMES) {
        const filePath = path.join(DATA_DIR, `${sym}_${tf}.json`);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.error(`Error deleting old cache file ${filePath}:`, err);
          }
        }
      }
    }
    fs.writeFileSync(VERSION_FILE, CURRENT_VERSION, "utf-8");
  }

  for (const sym of SYMBOLS) {
    for (const tf of TIMEFRAMES) {
      const filePath = path.join(DATA_DIR, `${sym}_${tf}.json`);
      if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf-8").trim() !== "") {
        try {
          caches[sym][tf] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          lastSyncTimes[sym][tf] = Date.now() - 5 * 60 * 1000; // Assume fresh on load
          console.log(`Loaded ${caches[sym][tf].length} candles for symbol ${sym} timeframe ${tf} from cache.`);
        } catch (e) {
          console.error(`Error loading cache for ${sym} ${tf}, will fetch fresh...`, e);
        }
      }
    }
  }
}

// Sync single symbol & timeframe from Yahoo Finance
async function syncTimeframe(sym: SymbolType, tf: Timeframe) {
  console.log(`[Sync] Fetching symbol ${sym} timeframe ${tf} from Yahoo Finance...`);
  // Mark as synced immediately to prevent overlapping concurrent fetches
  lastSyncTimes[sym][tf] = Date.now();
  try {
    let fetched: Candle[] = [];
    if (tf === "1m") {
      fetched = await fetchYahooFinanceSPXGeneric("1m", "7d", sym);
    } else if (tf === "5m") {
      fetched = await fetchYahooFinanceSPXGeneric("5m", "60d", sym);
    } else if (tf === "15m") {
      fetched = await fetchYahooFinanceSPXGeneric("15m", "60d", sym);
    } else if (tf === "4h") {
      // Fetch 1h and aggregate to 4h
      const hourly = await fetchYahooFinanceSPXGeneric("1h", "360d", sym);
      if (hourly.length > 0) {
        fetched = aggregate1HTo4H(hourly);
      }
    } else if (tf === "1d") {
      fetched = await fetchYahooFinanceSPXGeneric("1d", "3y", sym);
    }

    if (fetched.length > 0) {
      caches[sym][tf] = mergeCandles(caches[sym][tf], fetched);
      const filePath = path.join(DATA_DIR, `${sym}_${tf}.json`);
      fs.writeFileSync(filePath, JSON.stringify(caches[sym][tf], null, 2), "utf-8");
      console.log(`[Sync] ${sym} ${tf} sync complete. Total ${caches[sym][tf].length} candles saved.`);
    } else {
      console.log(`[Sync] Yahoo Finance returned 0 candles for ${sym} ${tf}.`);
    }
  } catch (err) {
    console.error(`[Sync] Failed to sync ${sym} ${tf}:`, err);
  }
}

// Sync all symbols and timeframes sequentially
async function syncAllTimeframes() {
  console.log("[Sync] Syncing all symbols and multi-timeframe caches...");
  for (const sym of SYMBOLS) {
    for (const tf of TIMEFRAMES) {
      await syncTimeframe(sym, tf);
    }
  }
}

// Ensure database files are loaded
ensureDataFiles();

// Sync any missing caches on startup and run full background update
async function initSync() {
  for (const sym of SYMBOLS) {
    for (const tf of TIMEFRAMES) {
      if (caches[sym][tf].length === 0) {
        await syncTimeframe(sym, tf);
      }
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
  try {
    const timeframe = (req.query.timeframe as Timeframe) || "5m";
    const dayParam = req.query.day as string; // YYYY-MM-DD
    const symbolParam = (req.query.symbol as string || "spx").toLowerCase();
    const symbol = SYMBOLS.includes(symbolParam as SymbolType) ? (symbolParam as SymbolType) : "spx";
    
    if (!TIMEFRAMES.includes(timeframe)) {
      return res.status(400).json({ error: "Invalid timeframe parameter" });
    }

    // Smart Option 3 Auto Sync Strategy:
    // Await the sync inline during active trading hours (or if the cache is empty) to guarantee fresh pre/post/night data.
    // Otherwise, fetch in the background to avoid any blocking during off-market hours.
    const now = Date.now();
    const ttl = getSymbolTimeframeTTL(symbol, timeframe);
    const timeSinceLastSync = now - lastSyncTimes[symbol][timeframe];
    const isCacheEmpty = !caches[symbol][timeframe] || caches[symbol][timeframe].length === 0;

    if (isCacheEmpty || timeSinceLastSync > ttl) {
      const isActive = isSymbolActive(symbol) || isCacheEmpty;
      if (isActive) {
        console.log(`[API] Cache stale (${timeSinceLastSync / 1000}s) for ${symbol} ${timeframe} during ACTIVE hours. Syncing inline...`);
        await syncTimeframe(symbol, timeframe);
      } else {
        console.log(`[API] Cache stale (${timeSinceLastSync / 1000}s) for ${symbol} ${timeframe} during OFF hours. Syncing in background...`);
        syncTimeframe(symbol, timeframe).catch(err => console.error("Off-hours background sync error:", err));
      }
    }

    const candles = caches[symbol][timeframe] || [];

    // Filter up to T-1 day by default (exclude today's New York date) if market is open or recently closed.
    // Once the market has been closed for more than 15 minutes (after 16:15 NY time) or on weekends, we allow showing today's (T-0) data.
    let finalCandles = candles;
    let filtered: Candle[] = [];

    // If we are looking for a specific day's 5m intraday chart
    if (timeframe === "5m" && dayParam) {
      filtered = (caches[symbol]["5m"] || []).filter(c => {
        if (!c || typeof c.time !== "number") return false;
        const candleNYStr = new Date(c.time).toLocaleString("en-US", { timeZone: "America/New_York" });
        const candleNY = new Date(candleNYStr);
        
        const yyyy = candleNY.getFullYear();
        const mm = String(candleNY.getMonth() + 1).padStart(2, "0");
        const dd = String(candleNY.getDate()).padStart(2, "0");
        const candleNYFormatted = `${yyyy}-${mm}-${dd}`;
        
        if (candleNYFormatted === dayParam) {
          return true;
        }
        
        // Smart inclusion of the previous calendar day's night session (starts at 18:00 NY time) for ES futures
        if (symbol === "es") {
          const targetDate = new Date(dayParam + "T12:00:00");
          targetDate.setDate(targetDate.getDate() - 1);
          const prevY = targetDate.getFullYear();
          const prevM = String(targetDate.getMonth() + 1).padStart(2, "0");
          const prevD = String(targetDate.getDate()).padStart(2, "0");
          const prevDayFormatted = `${prevY}-${prevM}-${prevD}`;
          
          if (candleNYFormatted === prevDayFormatted) {
            const hh = candleNY.getHours();
            return hh >= 18;
          }
        }
        
        return false;
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
        filtered = finalCandles.slice(-1200); // Full 3 years history
      }
    }

    // Run server-side patterns and indicators
    const trend = detectTrend(filtered);
    const patterns = detectPatterns(filtered);

    // S&R zones are calculated from a timeframe-appropriate historical window with adaptive swing parameters and tolerances.
    let zonesCandlesCount = 150;
    let swingStrength = 5;
    let tolerancePercent = 0.0015;

    if (timeframe === "1d") {
      zonesCandlesCount = 750; // Over 3 years of daily peaks/troughs
      swingStrength = 6;
      tolerancePercent = 0.005; // 0.5% clustering for daily
    } else if (timeframe === "4h") {
      zonesCandlesCount = 300; // Rich window of 300 bars
      swingStrength = 5;
      tolerancePercent = 0.004; // 0.4% clustering for 4h
    } else if (timeframe === "15m") {
      zonesCandlesCount = 200;
      swingStrength = 5;
      tolerancePercent = 0.002; // 0.2% clustering
    } else if (timeframe === "5m") {
      zonesCandlesCount = 150; // Double original density
      swingStrength = 4;
      tolerancePercent = 0.0015; // 0.15%
    } else if (timeframe === "1m") {
      zonesCandlesCount = 390;
      swingStrength = 5;
      tolerancePercent = 0.001; // 0.1% for high resolution 1m
    }

    const zonesBaseCandles = finalCandles.slice(-zonesCandlesCount);
    const finalZonesCandles = zonesBaseCandles.length > 0 ? zonesBaseCandles : filtered;
    const { highs: zoneHighs, lows: zoneLows } = findSwingPoints(finalZonesCandles, swingStrength, swingStrength);
    const zones = detectSupportResistanceZones(finalZonesCandles, zoneHighs, zoneLows, tolerancePercent);

    // Find dailyPreviousClose from caches[symbol]["1d"] to provide exact 100% correct daily price change ratio
    let dailyPreviousClose = 0;
    if (filtered.length > 0) {
      const latestCandle = filtered[filtered.length - 1];
      try {
        const latestNYStr = new Date(latestCandle.time).toLocaleString("en-US", { timeZone: "America/New_York" });
        const latestNY = new Date(latestNYStr);
        const latestDateFormatted = `${latestNY.getFullYear()}-${String(latestNY.getMonth() + 1).padStart(2, "0")}-${String(latestNY.getDate()).padStart(2, "0")}`;

        const dailyCandles = caches[symbol]["1d"] || [];
        for (let i = dailyCandles.length - 1; i >= 0; i--) {
          const d = dailyCandles[i];
          const dNYStr = new Date(d.time).toLocaleString("en-US", { timeZone: "America/New_York" });
          const dNY = new Date(dNYStr);
          const dDateFormatted = `${dNY.getFullYear()}-${String(dNY.getMonth() + 1).padStart(2, "0")}-${String(dNY.getDate()).padStart(2, "0")}`;

          if (dDateFormatted < latestDateFormatted) {
            dailyPreviousClose = d.close;
            break;
          }
        }
      } catch (e) {
        console.error("Error finding daily previous close on server:", e);
      }
    }

    res.json({
      candles: filtered,
      patterns,
      zones,
      trend,
      lastUpdated: new Date(lastSyncTimes[symbol][timeframe] || Date.now()).toISOString(),
      dailyPreviousClose: dailyPreviousClose || undefined,
    });
  } catch (error: any) {
    console.error("[API Error] in /api/spx-data:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// 2. API Endpoint: Manually trigger database sync
app.post("/api/spx-sync", async (req, res) => {
  try {
    const symbolParam = (req.query.symbol as string || "spx").toLowerCase();
    const symbol = SYMBOLS.includes(symbolParam as SymbolType) ? (symbolParam as SymbolType) : "spx";

    // Trigger sync in the background so that the client request doesn't time out
    for (const tf of TIMEFRAMES) {
      syncTimeframe(symbol, tf).catch(err => console.error(`[Sync] Manual sync background error for ${symbol} ${tf}:`, err));
    }

    res.json({ success: true, lastUpdated: new Date().toISOString() });
  } catch (error: any) {
    console.error("[API Error] in /api/spx-sync:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
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
