export interface Candle {
  time: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isReal?: boolean;
}

export enum PatternType {
  PIN_BAR_BULLISH = "PIN_BAR_BULLISH",
  PIN_BAR_BEARISH = "PIN_BAR_BEARISH",
  ENGULFING_BULLISH = "ENGULFING_BULLISH",
  ENGULFING_BEARISH = "ENGULFING_BEARISH",
  MORNING_STAR = "MORNING_STAR",
  EVENING_STAR = "EVENING_STAR",
  DOJI = "DOJI",
  INSIDE_BAR = "INSIDE_BAR",
  DOUBLE_TOP = "DOUBLE_TOP",
  DOUBLE_BOTTOM = "DOUBLE_BOTTOM",
  HEAD_AND_SHOULDERS = "HEAD_AND_SHOULDERS",
  INVERSE_HEAD_AND_SHOULDERS = "INVERSE_HEAD_AND_SHOULDERS",
  FLAG_BULLISH = "FLAG_BULLISH",
  FLAG_BEARISH = "FLAG_BEARISH",
  TRIANGLE_ASCENDING = "TRIANGLE_ASCENDING",
  TRIANGLE_DESCENDING = "TRIANGLE_DESCENDING",
  TRIANGLE_SYMMETRICAL = "TRIANGLE_SYMMETRICAL"
}

export interface DetectedPattern {
  id: string;
  type: PatternType;
  name: string;
  candleIndices: number[]; // indices of candles involved
  price: number; // primary trigger price (e.g. support level, breakout level, or peak)
  description: string;
  confidence: number; // 0 to 1
  label: string; // e.g. "Bullish Pin Bar", "Double Top"
}

export interface SupportResistanceZone {
  id: string;
  price: number;
  type: "support" | "resistance" | "flip";
  strength: number; // how many times it was touched
  touches: { index: number; price: number; type: "high" | "low" }[]; // candles touching this level
  minPrice: number; // band lower boundary
  maxPrice: number; // band upper boundary
}

export interface TrendLabel {
  index: number;
  label: "HH" | "HL" | "LH" | "LL";
  price: number;
}

export interface MarketTrend {
  direction: "UP" | "DOWN" | "SIDEWAYS";
  strength: number; // 0 to 100 (e.g., ADX-like index or slope metric)
  labels: TrendLabel[];
}

export interface SPXDataResponse {
  candles: Candle[];
  patterns: DetectedPattern[];
  zones: SupportResistanceZone[];
  trend: MarketTrend;
  lastUpdated: string;
}
