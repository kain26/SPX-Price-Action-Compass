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
      fetched = await fetchYahooFinanceSPXGeneric("1d", "3y");
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
  try {
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

    const candles = caches[timeframe] || [];

    // Filter up to T-1 day by default (exclude today's New York date) if market is open or recently closed.
    // Once the market has been closed for more than 15 minutes (after 16:15 NY time) or on weekends, we allow showing today's (T-0) data.
    const nyTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const nowNY = new Date(nyTimeStr);
    const todayNYFormatted = `${nowNY.getFullYear()}-${String(nowNY.getMonth() + 1).padStart(2, "0")}-${String(nowNY.getDate()).padStart(2, "0")}`;

    const dayOfWeekNY = nowNY.getDay(); // 0 is Sunday, 6 is Saturday
    const hoursNY = nowNY.getHours();
    const minutesNY = nowNY.getMinutes();

    const isWeekend = dayOfWeekNY === 0 || dayOfWeekNY === 6;
    const isPastMarketClosePlus15 = hoursNY > 16 || (hoursNY === 16 && minutesNY >= 15);
    const allowToday = isWeekend || isPastMarketClosePlus15;

    let finalCandles = candles;
    if (!allowToday) {
      const upToTMinus1Candles = candles.filter(c => {
        if (!c || typeof c.time !== "number") return false;
        const candleNYStr = new Date(c.time).toLocaleString("en-US", { timeZone: "America/New_York" });
        const candleNY = new Date(candleNYStr);
        const candleNYFormatted = `${candleNY.getFullYear()}-${String(candleNY.getMonth() + 1).padStart(2, "0")}-${String(candleNY.getDate()).padStart(2, "0")}`;
        return candleNYFormatted < todayNYFormatted;
      });
      finalCandles = upToTMinus1Candles.length > 0 ? upToTMinus1Candles : candles;
    }
    let filtered: Candle[] = [];

    // If we are looking for a specific day's 5m intraday chart
    if (timeframe === "5m" && dayParam) {
      filtered = (caches["5m"] || []).filter(c => {
        if (!c || typeof c.time !== "number") return false;
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

    // Find dailyPreviousClose from caches["1d"] to provide exact 100% correct daily price change ratio
    let dailyPreviousClose = 0;
    if (filtered.length > 0) {
      const latestCandle = filtered[filtered.length - 1];
      try {
        const latestNYStr = new Date(latestCandle.time).toLocaleString("en-US", { timeZone: "America/New_York" });
        const latestNY = new Date(latestNYStr);
        const latestDateFormatted = `${latestNY.getFullYear()}-${String(latestNY.getMonth() + 1).padStart(2, "0")}-${String(latestNY.getDate()).padStart(2, "0")}`;

        const dailyCandles = caches["1d"] || [];
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
      lastUpdated: new Date(lastSyncTimes[timeframe] || Date.now()).toISOString(),
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
    // Trigger sync in the background so that the client request doesn't time out
    syncAllTimeframes()
      .then(() => console.log("[Sync] Manual sync complete in background."))
      .catch(err => console.error("[Sync] Manual sync background error:", err));

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
