import { Candle } from "../types.js";

/**
 * Fetches the latest SPX candles from Yahoo Finance for any generic interval and range.
 */
export async function fetchYahooFinanceSPXGeneric(interval: "1m" | "5m" | "15m" | "1h" | "1d", range: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=${interval}&range=${range}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance responded with status: ${response.status} for ${interval}`);
    }

    const json = await response.json() as any;
    const result = json?.chart?.result?.[0];
    
    if (!result) {
      throw new Error(`Invalid response format from Yahoo Finance for ${interval}`);
    }

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    
    if (!quote || timestamps.length === 0) {
      return [];
    }

    const { open, high, low, close, volume } = quote;
    const candles: Candle[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const timeMs = timestamps[i] * 1000;
      const o = open[i];
      const h = high[i];
      const l = low[i];
      const c = close[i];
      const v = volume[i] || 0;

      if (o !== null && o !== undefined && 
          h !== null && h !== undefined && 
          l !== null && l !== undefined && 
          c !== null && c !== undefined) {
        candles.push({
          time: timeMs,
          open: Number(o.toFixed(2)),
          high: Number(h.toFixed(2)),
          low: Number(l.toFixed(2)),
          close: Number(c.toFixed(2)),
          volume: Math.round(v),
          isReal: true
        });
      }
    }

    return candles;
  } catch (error) {
    console.error(`Error fetching ${interval} from Yahoo Finance:`, error);
    return [];
  }
}

/**
 * Aggregates 1-hour candles into 4-hour candles.
 */
export function aggregate1HTo4H(hourlyCandles: Candle[]): Candle[] {
  const sorted = [...hourlyCandles].sort((a, b) => a.time - b.time);
  const result: Candle[] = [];
  
  for (let i = 0; i < sorted.length; i += 4) {
    const chunk = sorted.slice(i, i + 4);
    if (chunk.length === 0) continue;
    
    const time = chunk[0].time;
    const open = chunk[0].open;
    const close = chunk[chunk.length - 1].close;
    const high = Math.max(...chunk.map(c => c.high));
    const low = Math.min(...chunk.map(c => c.low));
    const volume = chunk.reduce((sum, c) => sum + c.volume, 0);
    
    result.push({
      time,
      open,
      high,
      low,
      close,
      volume,
      isReal: true
    });
  }
  
  return result;
}

/**
 * Fetches the latest SPX 5-minute candles from Yahoo Finance.
 * Yahoo Finance supports a max range of 60d for 5-minute intervals.
 */
export async function fetchYahooFinanceSPX(range: "5d" | "30d" | "60d" = "60d"): Promise<Candle[]> {
  return fetchYahooFinanceSPXGeneric("5m", range);
}

/**
 * Merges existing candles with newly fetched candles.
 * Prioritizes newly fetched real candles and overwrites any synthetic ones.
 */
export function mergeCandles(existing: Candle[], fetched: Candle[]): Candle[] {
  const candleMap = new Map<number, Candle>();

  // Add existing
  for (const candle of existing) {
    candleMap.set(candle.time, candle);
  }

  // Add/overwrite fetched real candles
  for (const candle of fetched) {
    candleMap.set(candle.time, candle);
  }

  // Sort chronologically
  const merged = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
  
  return merged;
}
