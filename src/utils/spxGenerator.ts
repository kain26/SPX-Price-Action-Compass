import { Candle } from "../types.js";

/**
 * Generates 1 year of highly realistic SPX 5-minute candles.
 * A trading day has 6.5 hours (9:30 AM to 4:00 PM EST).
 * 6.5 hours = 390 minutes = 78 candles (5-min intervals) per day.
 * 1 year = ~252 trading days = ~19,650 candles.
 */
export function generateSPX1YearHistory(): Candle[] {
  const candles: Candle[] = [];
  
  // Start date: 1 year before now (approx 252 trading days)
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  
  // Trading days calculation
  const tradingDays: Date[] = [];
  let currentDay = new Date(oneYearAgo);
  
  while (currentDay <= now) {
    const dayOfWeek = currentDay.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
      tradingDays.push(new Date(currentDay));
    }
    currentDay.setDate(currentDay.getDate() + 1);
  }

  // Cap trading days at 252 for performance and safety
  const daysToGenerate = tradingDays.slice(-252);
  
  let lastClose = 5350.0; // Starting price of SPX around mid-2025
  let trendState: "up" | "down" | "range" = "up";
  let trendDuration = 0;

  for (let d = 0; d < daysToGenerate.length; d++) {
    const dayDate = daysToGenerate[d];
    
    // Change overall trend state every 5-10 days
    if (trendDuration <= 0) {
      const rand = Math.random();
      if (rand < 0.4) trendState = "up";
      else if (rand < 0.7) trendState = "down";
      else trendState = "range";
      trendDuration = Math.floor(Math.random() * 8) + 5;
    }
    trendDuration--;

    // Overnight gap
    let gapPercent = (Math.random() - 0.48) * 0.003; // Slight positive drift
    if (trendState === "up") gapPercent += 0.0005;
    if (trendState === "down") gapPercent -= 0.0005;

    let dayOpen = lastClose * (1 + gapPercent);

    // Intraday pattern for the day
    // 0: Morning trend, afternoon range
    // 1: Morning range, afternoon breakout
    // 2: Strong trend day (bullish/bearish)
    // 3: Double top or double bottom day (reversal)
    const dayPatternType = Math.floor(Math.random() * 4);
    
    // Let's establish a set of support & resistance targets for the day if it's a range day
    const dayLowTarget = dayOpen * (1 - (Math.random() * 0.005 + 0.002));
    const dayHighTarget = dayOpen * (1 + (Math.random() * 0.005 + 0.002));

    let currentPrice = dayOpen;

    // Generate 78 bars for the day (9:30 AM to 4:00 PM EST, i.e., 14:30 to 21:00 UTC approximately)
    // We'll set timestamps starting at 9:30 AM EST for each trading day.
    const startHour = 9;
    const startMinute = 30;

    for (let bar = 0; bar < 78; bar++) {
      const barTime = new Date(dayDate);
      barTime.setHours(startHour, startMinute + bar * 5, 0, 0);

      // Intraday price logic
      let drift = 0;
      let volatility = 0.0008; // 0.08% standard volatility per 5m bar

      if (dayPatternType === 2) { // Strong Trend Day
        drift = trendState === "up" ? 0.0002 : -0.0002;
        volatility = 0.0006;
      } else if (dayPatternType === 3) { // Double Top/Bottom potential
        const phase = bar / 78;
        if (phase < 0.3) {
          drift = trendState === "up" ? 0.0003 : -0.0003; // Rally
        } else if (phase < 0.5) {
          drift = trendState === "up" ? -0.0004 : 0.0004; // Retracement
        } else if (phase < 0.8) {
          drift = trendState === "up" ? 0.00035 : -0.00035; // Rally back to double top/bottom
        } else {
          drift = trendState === "up" ? -0.0005 : 0.0005; // Reversal drop
        }
      } else { // Range or standard days
        // Pull back towards the targets if we exceed them
        if (currentPrice > dayHighTarget) drift -= 0.0004;
        if (currentPrice < dayLowTarget) drift += 0.0004;
      }

      // Add random component
      const changePercent = drift + (Math.random() - 0.5) * volatility;
      const barOpen = currentPrice;
      const barClose = currentPrice * (1 + changePercent);
      
      // Calculate realistic high/low
      const maxOC = Math.max(barOpen, barClose);
      const minOC = Math.min(barOpen, barClose);
      
      // Introduce shadows. Occasionally introduce high-shadow Pin Bars or Doji!
      let barHigh = maxOC + Math.random() * (volatility * 0.4) * barOpen;
      let barLow = minOC - Math.random() * (volatility * 0.4) * barOpen;

      const barRand = Math.random();
      if (barRand < 0.03) { // 3% chance of Hammer (Bullish Pin Bar)
        barLow = minOC - Math.random() * (volatility * 2.5) * barOpen;
        barHigh = maxOC + Math.random() * (volatility * 0.2) * barOpen;
      } else if (barRand < 0.06) { // 3% chance of Shooting Star (Bearish Pin Bar)
        barHigh = maxOC + Math.random() * (volatility * 2.5) * barOpen;
        barLow = minOC - Math.random() * (volatility * 0.2) * barOpen;
      } else if (barRand < 0.09) { // 3% chance of Doji
        // Close is extremely close to Open
        const dojiClose = barOpen + (Math.random() - 0.5) * (volatility * 0.1) * barOpen;
        barHigh = Math.max(barOpen, dojiClose) + Math.random() * (volatility * 0.8) * barOpen;
        barLow = Math.min(barOpen, dojiClose) - Math.random() * (volatility * 0.8) * barOpen;
        candles.push({
          time: barTime.getTime(),
          open: Number(barOpen.toFixed(2)),
          high: Number(barHigh.toFixed(2)),
          low: Number(barLow.toFixed(2)),
          close: Number(dojiClose.toFixed(2)),
          volume: Math.floor(Math.random() * 150000) + 50000,
          isReal: false
        });
        currentPrice = dojiClose;
        continue;
      }

      candles.push({
        time: barTime.getTime(),
        open: Number(barOpen.toFixed(2)),
        high: Number(barHigh.toFixed(2)),
        low: Number(barLow.toFixed(2)),
        close: Number(barClose.toFixed(2)),
        volume: Math.floor(Math.random() * 200000) + 100000,
        isReal: false
      });

      currentPrice = barClose;
    }
    
    lastClose = currentPrice;
  }

  return candles;
}
