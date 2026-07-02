import fs from "fs";
import path from "path";
import { fetchYahooFinanceSPX, mergeCandles } from "../src/utils/yahooFinance.ts";
import { Candle } from "../src/types.ts";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "spx_5m_data.json");

async function run() {
  console.log("Running standalone SPX 5m data pull script...");
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    let cachedCandles: Candle[] = [];
    if (fs.existsSync(DATA_FILE) && fs.readFileSync(DATA_FILE, "utf-8").trim() !== "") {
      try {
        cachedCandles = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
        console.log(`Loaded existing ${cachedCandles.length} candles.`);
      } catch (e) {
        console.error("Error reading existing data file:", e);
      }
    }

    console.log("Fetching last 60 days of real SPX 5m data from Yahoo Finance...");
    const fetched = await fetchYahooFinanceSPX("60d");
    
    if (fetched.length > 0) {
      const combined = mergeCandles(cachedCandles, fetched);
      fs.writeFileSync(DATA_FILE, JSON.stringify(combined, null, 2), "utf-8");
      console.log(`Successfully pulled and merged. Saved to ${DATA_FILE}. Total database size: ${combined.length} candles.`);
    } else {
      console.log("No data returned from Yahoo Finance.");
    }
  } catch (err) {
    console.error("Failed to run sync script:", err);
    process.exit(1);
  }
}

run();
