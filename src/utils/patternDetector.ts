import { Candle, DetectedPattern, PatternType, SupportResistanceZone, MarketTrend, TrendLabel } from "../types.js";

/**
 * Calculates average range of candles for normalizing thresholds
 */
function getAverageRange(candles: Candle[], period = 14): number[] {
  const avgs: number[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    const r = candles[i].high - candles[i].low;
    if (i < period) {
      sum += r;
      avgs.push(sum / (i + 1));
    } else {
      sum = sum - (candles[i - period].high - candles[i - period].low) + r;
      avgs.push(sum / period);
    }
  }
  return avgs;
}

/**
 * Finds local swing points
 */
export function findSwingPoints(
  candles: Candle[],
  leftStrength = 5,
  rightStrength = 5
): { highs: { index: number; price: number }[]; lows: { index: number; price: number }[] } {
  const highs: { index: number; price: number }[] = [];
  const lows: { index: number; price: number }[] = [];

  for (let i = leftStrength; i < candles.length - rightStrength; i++) {
    const currentHigh = candles[i].high;
    const currentLow = candles[i].low;
    let isHigh = true;
    let isLow = true;

    // Check left side
    for (let j = 1; j <= leftStrength; j++) {
      if (candles[i - j].high >= currentHigh) isHigh = false;
      if (candles[i - j].low <= currentLow) isLow = false;
    }

    // Check right side
    for (let j = 1; j <= rightStrength; j++) {
      if (candles[i + j].high > currentHigh) isHigh = false;
      if (candles[i + j].low < currentLow) isLow = false;
    }

    if (isHigh) {
      highs.push({ index: i, price: currentHigh });
    }
    if (isLow) {
      lows.push({ index: i, price: currentLow });
    }
  }

  return { highs, lows };
}

/**
 * Detects Market Trend (HH, HL, LH, LL) and strength
 */
export function detectTrend(candles: Candle[]): MarketTrend {
  if (candles.length < 10) {
    return { direction: "SIDEWAYS", strength: 50, labels: [] };
  }

  // Get swing points with small lookback for short-term trend labels
  const { highs, lows } = findSwingPoints(candles, 4, 4);
  const labels: TrendLabel[] = [];

  // Determine HH, LH
  for (let i = 1; i < highs.length; i++) {
    const prev = highs[i - 1];
    const curr = highs[i];
    if (curr.price > prev.price) {
      labels.push({ index: curr.index, label: "HH", price: curr.price });
    } else {
      labels.push({ index: curr.index, label: "LH", price: curr.price });
    }
  }

  // Determine HL, LL
  for (let i = 1; i < lows.length; i++) {
    const prev = lows[i - 1];
    const curr = lows[i];
    if (curr.price > prev.price) {
      labels.push({ index: curr.index, label: "HL", price: curr.price });
    } else {
      labels.push({ index: curr.index, label: "LL", price: curr.price });
    }
  }

  // Calculate overall trend using EMA/EMA crossovers or recent candle slope
  let upCount = 0;
  let downCount = 0;
  const period = Math.min(20, candles.length);
  for (let i = candles.length - period; i < candles.length; i++) {
    if (i <= 0) continue;
    if (candles[i].close > candles[i - 1].close) upCount++;
    else downCount++;
  }

  // Look at long-term slope
  const firstClose = candles[candles.length - Math.min(50, candles.length)].close;
  const lastClose = candles[candles.length - 1].close;
  const percentDiff = (lastClose - firstClose) / firstClose;

  let direction: "UP" | "DOWN" | "SIDEWAYS" = "SIDEWAYS";
  let strength = 50;

  if (percentDiff > 0.003) {
    direction = "UP";
    strength = Math.min(100, Math.round(50 + percentDiff * 10000));
  } else if (percentDiff < -0.003) {
    direction = "DOWN";
    strength = Math.min(100, Math.round(50 + Math.abs(percentDiff) * 10000));
  } else {
    direction = "SIDEWAYS";
    strength = Math.round(30 + Math.abs(upCount - downCount) * 4);
  }

  // Sort labels by index
  labels.sort((a, b) => a.index - b.index);

  return { direction, strength, labels };
}

/**
 * Clusters swing points into Support and Resistance zones
 */
export function detectSupportResistanceZones(
  candles: Candle[],
  highs: { index: number; price: number }[],
  lows: { index: number; price: number }[]
): SupportResistanceZone[] {
  if (candles.length === 0) return [];

  const points = [
    ...highs.map(h => ({ ...h, type: "high" as const })),
    ...lows.map(l => ({ ...l, type: "low" as const })),
  ];

  if (points.length === 0) return [];

  // Group prices that are very close (within 0.12% of each other)
  const sortedPoints = [...points].sort((a, b) => a.price - b.price);
  const clusters: typeof points[] = [];
  let currentCluster: typeof points = [];

  const tolerancePercent = 0.0015; // 0.15% threshold for SPX (~7-8 points)

  for (let i = 0; i < sortedPoints.length; i++) {
    const pt = sortedPoints[i];
    if (currentCluster.length === 0) {
      currentCluster.push(pt);
    } else {
      const avgPrice = currentCluster.reduce((sum, p) => sum + p.price, 0) / currentCluster.length;
      if (Math.abs(pt.price - avgPrice) / avgPrice <= tolerancePercent) {
        currentCluster.push(pt);
      } else {
        clusters.push(currentCluster);
        currentCluster = [pt];
      }
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // Map clusters to structured Zones
  return clusters
    .map((cluster, i) => {
      const prices = cluster.map(p => p.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

      const highTouches = cluster.filter(p => p.type === "high").length;
      const lowTouches = cluster.filter(p => p.type === "low").length;

      let type: "support" | "resistance" | "flip" = "flip";
      if (highTouches > 0 && lowTouches === 0) {
        type = "resistance";
      } else if (lowTouches > 0 && highTouches === 0) {
        type = "support";
      } else {
        type = "flip"; // acted as both support and resistance!
      }

      return {
        id: `zone-${i}-${Math.round(avgPrice)}`,
        price: Number(avgPrice.toFixed(2)),
        type,
        strength: cluster.length,
        touches: cluster.map(p => ({
          index: p.index,
          price: Number(p.price.toFixed(2)),
          type: p.type,
        })),
        minPrice: Number((minPrice * 0.9995).toFixed(2)), // add slight padding for visual zones
        maxPrice: Number((maxPrice * 1.0005).toFixed(2)),
      };
    })
    .filter(zone => zone.strength >= 2) // only key zones touched at least twice
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 8); // Keep the top 8 strongest zones to keep the chart clean
}

/**
 * Runs pattern detection over candles list
 */
export function detectPatterns(candles: Candle[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const avgRanges = getAverageRange(candles);

  const { highs, lows } = findSwingPoints(candles, 6, 6);

  // Helper to push patterns safely
  const addPattern = (
    type: PatternType,
    name: string,
    indices: number[],
    price: number,
    description: string,
    confidence: number
  ) => {
    // Avoid duplicates for overlapping/same patterns
    const id = `${type}-${indices[0]}-${indices[indices.length - 1]}`;
    patterns.push({
      id,
      type,
      name,
      candleIndices: indices,
      price: Number(price.toFixed(2)),
      description,
      confidence,
      label: name,
    });
  };

  // 1. Candlestick Reversals & Continuations
  for (let i = 2; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const prev2 = candles[i - 2];

    const range = c.high - c.low;
    if (range <= 0) continue;

    const body = Math.abs(c.close - c.open);
    const upperShadow = c.high - Math.max(c.open, c.close);
    const lowerShadow = Math.min(c.open, c.close) - c.low;
    const bodyRatio = body / range;
    const avgRange = avgRanges[i];

    // DOJI
    if (bodyRatio < 0.08 && range > avgRange * 0.2) {
      addPattern(
        PatternType.DOJI,
        "Doji (十字星)",
        [i],
        c.close,
        "开盘价与收盘价极近，表明买卖双方陷入僵局，潜在的反转信号。",
        0.6
      );
      continue;
    }

    // PIN BAR (Hammer / Shooting Star)
    if (range > avgRange * 0.4) {
      // Bullish Pin Bar / Hammer
      if (lowerShadow > range * 0.6 && upperShadow < range * 0.15 && bodyRatio < 0.3) {
        const conf = Math.min(1, lowerShadow / range);
        addPattern(
          PatternType.PIN_BAR_BULLISH,
          "Bullish Pin Bar (锤子线)",
          [i],
          c.low,
          "长下影线和小实体。代表多头在低位强势收回失地，是强烈的看涨反转信号。",
          conf
        );
        continue;
      }
      // Bearish Pin Bar / Shooting Star
      if (upperShadow > range * 0.6 && lowerShadow < range * 0.15 && bodyRatio < 0.3) {
        const conf = Math.min(1, upperShadow / range);
        addPattern(
          PatternType.PIN_BAR_BEARISH,
          "Bearish Pin Bar (射击之星)",
          [i],
          c.high,
          "长上影线和小实体。代表空头在高位强势反击，是强烈的看跌反转信号。",
          conf
        );
        continue;
      }
    }

    // INSIDE BAR (Continuation / Range contraction)
    if (c.high < prev.high && c.low > prev.low) {
      addPattern(
        PatternType.INSIDE_BAR,
        "Inside Bar (内含线)",
        [i - 1, i],
        c.high,
        "当前K线完全被前一根K线吞没，代表市场进入休整和筹码盘整，通常是强烈的突破先兆。",
        0.75
      );
      continue;
    }

    // ENGULFING (吞没)
    const prevBody = Math.abs(prev.close - prev.open);
    if (body > prevBody && range > avgRange * 0.3) {
      // Bullish Engulfing
      if (prev.close < prev.open && c.close > c.open && c.open <= prev.close && c.close >= prev.open) {
        addPattern(
          PatternType.ENGULFING_BULLISH,
          "Bullish Engulfing (看涨吞没)",
          [i - 1, i],
          c.low,
          "实体一阳吞一阴，多头完全占据主导，代表趋势极可能向上反转。",
          0.85
        );
        continue;
      }
      // Bearish Engulfing
      if (prev.close > prev.open && c.close < c.open && c.open >= prev.close && c.close <= prev.open) {
        addPattern(
          PatternType.ENGULFING_BEARISH,
          "Bearish Engulfing (看跌吞没)",
          [i - 1, i],
          c.high,
          "实体一阴吞一阳，空头力量倾泻而出，代表趋势极可能向下反转。",
          0.85
        );
        continue;
      }
    }

    // MORNING STAR & EVENING STAR (3-Candle)
    const prev2Body = Math.abs(prev2.close - prev2.open);
    if (prev2Body > avgRange * 0.5) {
      // Morning Star
      if (
        prev2.close < prev2.open && // Bearish
        prev.close < Math.max(prev2.open, prev2.close) && // Small gap/low
        Math.abs(prev.close - prev.open) < avgRange * 0.3 && // Tiny body (Star)
        c.close > c.open && // Bullish
        c.close > (prev2.open + prev2.close) / 2 // Closes more than half of first candle
      ) {
        addPattern(
          PatternType.MORNING_STAR,
          "Morning Star (晨星)",
          [i - 2, i - 1, i],
          c.low,
          "三根K线组合：大阴线、小十字星、大阳线。是极度经典的底部反转形态。",
          0.9
        );
        continue;
      }
      // Evening Star
      if (
        prev2.close > prev2.open && // Bullish
        prev.close > Math.min(prev2.open, prev2.close) && // Small gap/high
        Math.abs(prev.close - prev.open) < avgRange * 0.3 && // Tiny body (Star)
        c.close < c.open && // Bearish
        c.close < (prev2.open + prev2.close) / 2 // Closes more than half of first candle
      ) {
        addPattern(
          PatternType.EVENING_STAR,
          "Evening Star (暮星)",
          [i - 2, i - 1, i],
          c.high,
          "三根K线组合：大阳线、小十字星、大阴线。是极为经典的顶部反转形态。",
          0.9
        );
        continue;
      }
    }
  }

  // 2. Chart Pattern Recognition from Swing Points
  // Double Tops and Bottoms
  for (let k = 2; k < highs.length; k++) {
    const h1 = highs[k - 2];
    const h2 = highs[k - 1];
    const h3 = highs[k];

    // Look for Double Top (H1 & H3 are highs, H2 is somewhere in between but we just need two peaks)
    // Actually, let's look at consecutive swing highs h1, h2
    const priceDiff = Math.abs(highs[k].price - highs[k - 1].price) / highs[k - 1].price;
    const distance = highs[k].index - highs[k - 1].index;

    if (priceDiff < 0.0012 && distance >= 8 && distance < 40) {
      // Find the valley between them
      let valleyIndex = -1;
      let valleyPrice = Infinity;
      for (let j = highs[k - 1].index; j < highs[k].index; j++) {
        if (candles[j].low < valleyPrice) {
          valleyPrice = candles[j].low;
          valleyIndex = j;
        }
      }

      const indices: number[] = [];
      for (let j = highs[k - 1].index; j <= highs[k].index; j++) indices.push(j);

      addPattern(
        PatternType.DOUBLE_TOP,
        "Double Top (双顶 M顶)",
        indices,
        highs[k].price,
        `价格在 ${highs[k-1].price.toFixed(1)} 附近两次遇阻回落，中间低点位于 ${valleyPrice.toFixed(1)}。破此颈线确立反转。`,
        0.8
      );
    }
  }

  for (let k = 2; k < lows.length; k++) {
    const priceDiff = Math.abs(lows[k].price - lows[k - 1].price) / lows[k - 1].price;
    const distance = lows[k].index - lows[k - 1].index;

    if (priceDiff < 0.0012 && distance >= 8 && distance < 40) {
      // Find the peak between them
      let peakIndex = -1;
      let peakPrice = -Infinity;
      for (let j = lows[k - 1].index; j < lows[k].index; j++) {
        if (candles[j].high > peakPrice) {
          peakPrice = candles[j].high;
          peakIndex = j;
        }
      }

      const indices: number[] = [];
      for (let j = lows[k - 1].index; j <= lows[k].index; j++) indices.push(j);

      addPattern(
        PatternType.DOUBLE_BOTTOM,
        "Double Bottom (双底 W底)",
        indices,
        lows[k].price,
        `价格在 ${lows[k-1].price.toFixed(1)} 附近获得双重支撑反弹，阻力位在 ${peakPrice.toFixed(1)}。突破此颈线确立涨势。`,
        0.8
      );
    }
  }

  // Head and Shoulders (H&S)
  for (let k = 2; k < highs.length; k++) {
    const leftS = highs[k - 2];
    const head = highs[k - 1];
    const rightS = highs[k];

    if (
      head.price > leftS.price &&
      head.price > rightS.price &&
      Math.abs(leftS.price - rightS.price) / leftS.price < 0.002 && // Shoulders roughly same price
      head.index - leftS.index >= 6 &&
      rightS.index - head.index >= 6
    ) {
      const indices: number[] = [];
      for (let j = leftS.index; j <= rightS.index; j++) indices.push(j);

      addPattern(
        PatternType.HEAD_AND_SHOULDERS,
        "Head and Shoulders (头肩顶)",
        indices,
        head.price,
        "由左肩、头部、右肩组成。中间峰顶最高，两边峰顶相近。是极其强烈的见顶反转形态。",
        0.85
      );
    }
  }

  // Inverse Head and Shoulders
  for (let k = 2; k < lows.length; k++) {
    const leftS = lows[k - 2];
    const head = lows[k - 1];
    const rightS = lows[k];

    if (
      head.price < leftS.price &&
      head.price < rightS.price &&
      Math.abs(leftS.price - rightS.price) / leftS.price < 0.002 &&
      head.index - leftS.index >= 6 &&
      rightS.index - head.index >= 6
    ) {
      const indices: number[] = [];
      for (let j = leftS.index; j <= rightS.index; j++) indices.push(j);

      addPattern(
        PatternType.INVERSE_HEAD_AND_SHOULDERS,
        "Inverse Head & Shoulders (头肩底)",
        indices,
        head.price,
        "经典底部反转形态。由左肩、深幅探底的头部、及右肩构成。突破颈线为高胜率买入点。",
        0.85
      );
    }
  }

  // Flag/Pennant Pattern and Triangles (Symmetrical, Descending, Ascending)
  // Let's identify Triangles if the last few swing highs are descending and last few swing lows are ascending
  if (highs.length >= 3 && lows.length >= 3) {
    const lastHighs = highs.slice(-3);
    const lastLows = lows.slice(-3);

    const highSlope = (lastHighs[2].price - lastHighs[0].price) / (lastHighs[2].index - lastHighs[0].index);
    const lowSlope = (lastLows[2].price - lastLows[0].price) / (lastLows[2].index - lastLows[0].index);

    if (highSlope < -0.01 && lowSlope > 0.01) {
      const startIdx = Math.min(lastHighs[0].index, lastLows[0].index);
      const endIdx = Math.max(lastHighs[2].index, lastLows[2].index);
      const indices: number[] = [];
      for (let j = startIdx; j <= endIdx; j++) indices.push(j);

      addPattern(
        PatternType.TRIANGLE_SYMMETRICAL,
        "Symmetrical Triangle (对称三角形)",
        indices,
        (lastHighs[2].price + lastLows[2].price) / 2,
        "高点不断降低，低点不断提高。价格波动收敛进三角形，标志多空均衡积蓄能量，即将发生剧烈突破。",
        0.7
      );
    } else if (Math.abs(highSlope) < 0.015 && lowSlope > 0.02) {
      const startIdx = Math.min(lastHighs[0].index, lastLows[0].index);
      const endIdx = Math.max(lastHighs[2].index, lastLows[2].index);
      const indices: number[] = [];
      for (let j = startIdx; j <= endIdx; j++) indices.push(j);

      addPattern(
        PatternType.TRIANGLE_ASCENDING,
        "Ascending Triangle (上升三角形)",
        indices,
        lastHighs[2].price,
        "上方有明确水平阻力线，下方低点不断抬升。代表买盘步步进逼，是经典的看涨突破形态。",
        0.75
      );
    } else if (highSlope < -0.02 && Math.abs(lowSlope) < 0.015) {
      const startIdx = Math.min(lastHighs[0].index, lastLows[0].index);
      const endIdx = Math.max(lastHighs[2].index, lastLows[2].index);
      const indices: number[] = [];
      for (let j = startIdx; j <= endIdx; j++) indices.push(j);

      addPattern(
        PatternType.TRIANGLE_DESCENDING,
        "Descending Triangle (下降三角形)",
        indices,
        lastLows[2].price,
        "下方有水平支撑线，上方高点不断降低。代表卖盘压制力量变强，是经典的看跌突破形态。",
        0.75
      );
    }
  }

  // Sort patterns so that largest range/most confidence patterns are highlighted first
  return patterns.sort((a, b) => b.confidence - a.confidence);
}
