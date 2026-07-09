import React, { useState, useEffect } from "react";
// @ts-ignore
import paLogo from "./pa-logo.png";
import PatternList from "./components/PatternList.tsx";
import PriceActionChart from "./components/PriceActionChart.tsx";
import ChallengeMode from "./components/ChallengeMode.tsx";
import { Candle, DetectedPattern, SupportResistanceZone, MarketTrend, SPXDataResponse } from "./types.js";
import { SlidersHorizontal, BookOpen, GraduationCap, Flame, RefreshCw, BarChart3, HelpCircle, Layers, Eye, EyeOff, ChevronDown, Check, Filter, Sparkles, TrendingUp, ChevronRight, Clock, Grid, Triangle, ArrowUpDown, Github } from "lucide-react";
import DiagnosticModal from "./components/DiagnosticModal.tsx";

const PATTERN_CATEGORIES = [
  { val: "ALL", label: "全部形态" },
  { val: "NONE", label: "无 (不显示形态)" },
  { val: "PIN_BAR", label: "针形 K线 (Pin Bar)" },
  { val: "ENGULFING", label: "吞没 K线 (Engulfing)" },
  { val: "STAR", label: "星体反转 (Star)" },
  { val: "DOJI", label: "十字星 (Doji)" },
  { val: "DOUBLE", label: "双顶双底 (Double)" },
  { val: "HEAD_SHOULDERS", label: "头肩结构 (H&S)" },
  { val: "TRIANGLE", label: "收敛整理 (Triangle)" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"review" | "challenge">("review");
  const [symbol, setSymbol] = useState<"spx" | "es" | "qqq" | "spy">("spx");
  const [timeframe, setTimeframe] = useState<"1m" | "5m" | "15m" | "4h" | "1d">("5m"); // Default to "5m" (5min K)
  const [candles, setCandles] = useState<Candle[]>([]);
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [zones, setZones] = useState<SupportResistanceZone[]>([]);
  const [trend, setTrend] = useState<MarketTrend>({ direction: "SIDEWAYS", strength: 50, labels: [] });
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [apiPreviousClose, setApiPreviousClose] = useState<number | null>(null);

  const [selectedPattern, setSelectedPattern] = useState<DetectedPattern | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const [syncing, setSyncing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Intraday drilldown states
  const [drilldownDay, setDrilldownDay] = useState<string | null>(null);
  const [drilldownCandles, setDrilldownCandles] = useState<Candle[]>([]);
  const [drilldownPatterns, setDrilldownPatterns] = useState<DetectedPattern[]>([]);
  const [drilldownZones, setDrilldownZones] = useState<SupportResistanceZone[]>([]);
  const [drilldownTrend, setDrilldownTrend] = useState<MarketTrend>({ direction: "SIDEWAYS", strength: 50, labels: [] });
  const [drilldownLoading, setDrilldownLoading] = useState<boolean>(false);
  const [isChineseStyle, setIsChineseStyle] = useState<boolean>(false);

  // Pattern Filter Selection state
  const [patternFilters, setPatternFilters] = useState<string[]>(["ENGULFING", "PIN_BAR"]);

  // Visibility toggles
  const [showPatterns, setShowPatterns] = useState<boolean>(true);
  const [showZones, setShowZones] = useState<boolean>(true);
  const [showTrends, setShowTrends] = useState<boolean>(true);
  const [showVolume, setShowVolume] = useState<boolean>(true);

  // Dropdown states & helpers
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);
  const [showTimeframeDropdown, setShowTimeframeDropdown] = useState<boolean>(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState<boolean>(false);

  // Challenge mode quiz score state shared globally
  const [quizScore, setQuizScore] = useState<{ wins: number; total: number }>({ wins: 0, total: 0 });

  const getCategoryCount = (val: string) => {
    if (val === "ALL") return patterns.length;
    if (val === "NONE") return 0;
    return patterns.filter(p => {
      if (val === "PIN_BAR") return p.type.includes("PIN_BAR");
      if (val === "ENGULFING") return p.type.includes("ENGULFING");
      if (val === "STAR") return p.type.includes("STAR");
      if (val === "DOJI") return p.type === "DOJI";
      if (val === "DOUBLE") return p.type.includes("DOUBLE");
      if (val === "HEAD_SHOULDERS") return p.type.includes("HEAD_AND_SHOULDERS") || p.type.includes("INVERSE_HEAD_AND_SHOULDERS");
      if (val === "TRIANGLE") return p.type.includes("TRIANGLE");
      return false;
    }).length;
  };

  const getDropdownButtonLabel = () => {
    if (patternFilters.includes("ALL")) return "全部形态";
    if (patternFilters.includes("NONE")) return "无 (未选形态)";
    if (patternFilters.length === 0) return "无选择";
    const selectedLabels = PATTERN_CATEGORIES
      .filter(c => patternFilters.includes(c.val) && c.val !== "ALL" && c.val !== "NONE")
      .map(c => c.label.split(" ")[0]); // E.g., "针形", "吞没"
    return selectedLabels.join(" + ");
  };

  const handleTogglePatternFilter = (val: string) => {
    setShowPatterns(true); // Always enable pattern markings when filtering
    if (val === "ALL") {
      setPatternFilters(["ALL"]);
    } else if (val === "NONE") {
      setPatternFilters(["NONE"]);
    } else {
      setPatternFilters(prev => {
        const withoutAllOrNone = prev.filter(x => x !== "ALL" && x !== "NONE");
        if (withoutAllOrNone.includes(val)) {
          const updated = withoutAllOrNone.filter(x => x !== val);
          return updated.length === 0 ? ["ALL"] : updated;
        } else {
          return [...withoutAllOrNone, val];
        }
      });
    }
  };

  // Filter detected patterns based on user's active dropdown choice
  const filteredPatterns = patterns.filter(p => {
    if (patternFilters.includes("ALL")) return true;
    if (patternFilters.includes("NONE")) return false;
    if (patternFilters.length === 0) return false;
    return patternFilters.some(filter => {
      if (filter === "PIN_BAR") return p.type.includes("PIN_BAR");
      if (filter === "ENGULFING") return p.type.includes("ENGULFING");
      if (filter === "STAR") return p.type.includes("STAR");
      if (filter === "DOJI") return p.type === "DOJI";
      if (filter === "DOUBLE") return p.type.includes("DOUBLE");
      if (filter === "HEAD_SHOULDERS") return p.type.includes("HEAD_AND_SHOULDERS") || p.type.includes("INVERSE_HEAD_AND_SHOULDERS");
      if (filter === "TRIANGLE") return p.type.includes("TRIANGLE");
      return false;
    });
  });

  // Fetch SPX/ES data from full-stack backend with automatic retry on failure
  const fetchData = async (tfStr = timeframe, symStr = symbol, retries = 3, delayMs = 1500) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/spx-data?timeframe=${tfStr}&symbol=${symStr}`);
      if (!res.ok) throw new Error(`Failed to load historical data (Status: ${res.status})`);
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response. The dev server may still be booting.");
      }
      
      const payload: SPXDataResponse = await res.json();
      setCandles(payload.candles);
      setPatterns(payload.patterns);
      setZones(payload.zones);
      setTrend(payload.trend);
      setLastUpdated(payload.lastUpdated);
      setApiPreviousClose(payload.dailyPreviousClose || null);
      
      // Find the latest (most recent) Engulfing pattern and select it by default to ensure the viewport centers on the T-1 day range
      const defaultEngulfing = [...payload.patterns].reverse().find(p => p.type.includes("ENGULFING"));
      if (defaultEngulfing) {
        setSelectedPattern(defaultEngulfing);
        if (defaultEngulfing.candleIndices.length > 0) {
          const sortedIdxs = [...defaultEngulfing.candleIndices].sort((a, b) => a - b);
          const mid = sortedIdxs[Math.floor(sortedIdxs.length / 2)];
          setFocusIndex(mid);
        } else {
          setFocusIndex(null);
        }
      } else {
        setSelectedPattern(null);
        setFocusIndex(null);
      }
      setLoading(false);
    } catch (err) {
      if (retries > 0) {
        console.warn(`[fetchData Warning] Failed to fetch, retrying in ${delayMs}ms... (${retries} attempts left). Error:`, err);
        setTimeout(() => {
          fetchData(tfStr, symStr, retries - 1, delayMs);
        }, delayMs);
      } else {
        console.error("[fetchData Error] All fetch retries failed:", err);
        setLoading(false);
      }
    }
  };

  const fetchDrilldownDay = async (dayStr: string, symStr = symbol) => {
    setDrilldownLoading(true);
    try {
      const res = await fetch(`/api/spx-data?timeframe=5m&day=${dayStr}&symbol=${symStr}`);
      if (!res.ok) throw new Error(`Failed to load intraday drilldown data (Status: ${res.status})`);
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response for drilldown. The dev server may still be booting.");
      }
      
      const payload: SPXDataResponse = await res.json();
      setDrilldownCandles(payload.candles);
      setDrilldownPatterns(payload.patterns);
      setDrilldownZones(payload.zones);
      setDrilldownTrend(payload.trend);
    } catch (err) {
      console.error("Error fetching drilldown data:", err);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const handleCandleClick = (candle: Candle) => {
    if (timeframe !== "1d") return; // Only drill down when in daily (1d) view
    
    // Convert candle time to NY Date
    const dateNYStr = new Date(candle.time).toLocaleString("en-US", { timeZone: "America/New_York" });
    const dateNY = new Date(dateNYStr);
    const yyyy = dateNY.getFullYear();
    const mm = String(dateNY.getMonth() + 1).padStart(2, "0");
    const dd = String(dateNY.getDate()).padStart(2, "0");
    const dayStr = `${yyyy}-${mm}-${dd}`;
    
    setDrilldownDay(dayStr);
    fetchDrilldownDay(dayStr, symbol);
  };

  useEffect(() => {
    fetchData(timeframe, symbol);
  }, [timeframe, symbol]);

  // Handle active manual sync pull to Yahoo Finance
  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/spx-sync?symbol=${symbol}`, { method: "POST" });
      if (!res.ok) throw new Error(`Failed to sync database (Status: ${res.status})`);
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response during sync.");
      }
      
      const payload = await res.json();
      setLastUpdated(payload.lastUpdated);
      // Re-fetch current visible timeline
      await fetchData(timeframe, symbol);
    } catch (err) {
      console.error("[handleTriggerSync Error]:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Center chart and coach on selected pattern
  const handleSelectPattern = (pattern: DetectedPattern | null) => {
    setSelectedPattern(pattern);
    if (pattern && pattern.candleIndices.length > 0) {
      // Find middle index of pattern to focus
      const sortedIdxs = [...pattern.candleIndices].sort((a, b) => a - b);
      const mid = sortedIdxs[Math.floor(sortedIdxs.length / 2)];
      setFocusIndex(mid);
    } else {
      setFocusIndex(null);
    }
  };

  const latestCandle = candles[candles.length - 1];

  // Helper to find the previous day's close price to accurately reflect today's cumulative daily percent change
  const getPreviousDayClosePrice = (): number => {
    if (!latestCandle || candles.length < 2) return 0;
    try {
      const latestNYStr = new Date(latestCandle.time).toLocaleString("en-US", { timeZone: "America/New_York" });
      const latestNY = new Date(latestNYStr);
      const latestDateFormatted = `${latestNY.getFullYear()}-${String(latestNY.getMonth() + 1).padStart(2, "0")}-${String(latestNY.getDate()).padStart(2, "0")}`;

      // Search backwards for the last candle with a different (earlier) NY date
      for (let i = candles.length - 2; i >= 0; i--) {
        const c = candles[i];
        const cNYStr = new Date(c.time).toLocaleString("en-US", { timeZone: "America/New_York" });
        const cNY = new Date(cNYStr);
        const cDateFormatted = `${cNY.getFullYear()}-${String(cNY.getMonth() + 1).padStart(2, "0")}-${String(cNY.getDate()).padStart(2, "0")}`;

        if (cDateFormatted < latestDateFormatted) {
          return c.close;
        }
      }
    } catch (e) {
      console.error("Error calculating previous day close", e);
    }
    // Fallback to previous candle close if no earlier day candle is found
    return candles[candles.length - 2].close;
  };

  const previousDayClose = apiPreviousClose || getPreviousDayClosePrice();

  const priceChange = latestCandle && previousDayClose > 0
    ? latestCandle.close - previousDayClose
    : latestCandle && candles.length > 1
      ? latestCandle.close - candles[candles.length - 2].close
      : 0;

  const priceChangePct = latestCandle && previousDayClose > 0
    ? (priceChange / previousDayClose) * 100
    : latestCandle && candles.length > 1 && candles[candles.length - 2].close > 0
      ? ((latestCandle.close - candles[candles.length - 2].close) / candles[candles.length - 2].close) * 100
      : 0;

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col font-sans">
      
      {/* 1. Global Navigation Header */}
      <header className="bg-black/90 backdrop-blur-md border-b border-neutral-800 sticky top-0 z-50 px-3 py-2 sm:px-6 sm:py-3">
        <div className="max-w-[1800px] mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* App Branding */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Premium Custom Image Logo with Dark Mode Compatibility */}
              <div className="relative w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center bg-white border border-neutral-800 rounded-md shadow-[0_1px_3px_rgba(0,0,0,0.4)] overflow-hidden group hover:scale-105 transition-all duration-300">
                <img 
                  src={paLogo} 
                  alt="Price Action Compass Logo" 
                  className="w-5.5 h-5.5 sm:w-7 sm:h-7 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="font-black text-[12px] sm:text-base tracking-widest font-space uppercase bg-gradient-to-b from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent drop-shadow-sm select-none">
                {symbol.toUpperCase()} Price Action Compass
              </span>
            </div>

            {/* Premium Ticker Switcher */}
            <div className="flex items-center bg-[#0e0e12] p-1 rounded-md border border-neutral-800 text-[10px] font-mono font-black select-none h-auto shrink-0 gap-1 flex-wrap">
              <button
                onClick={() => setSymbol("spx")}
                className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold transition-all duration-150 cursor-pointer min-h-[20px] ${
                  symbol === "spx"
                    ? "bg-white text-black font-black border border-white shadow-[0_1px_4px_rgba(255,255,255,0.1)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                SPX 指数
              </button>
              <button
                onClick={() => setSymbol("es")}
                className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold transition-all duration-150 cursor-pointer min-h-[20px] ${
                  symbol === "es"
                    ? "bg-white text-black font-black border border-white shadow-[0_1px_4px_rgba(255,255,255,0.1)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                ES 期货
              </button>
              <button
                onClick={() => setSymbol("qqq")}
                className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold transition-all duration-150 cursor-pointer min-h-[20px] ${
                  symbol === "qqq"
                    ? "bg-white text-black font-black border border-white shadow-[0_1px_4px_rgba(255,255,255,0.1)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                QQQ 纳指
              </button>
              <button
                onClick={() => setSymbol("spy")}
                className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold transition-all duration-150 cursor-pointer min-h-[20px] ${
                  symbol === "spy"
                    ? "bg-white text-black font-black border border-white shadow-[0_1px_4px_rgba(255,255,255,0.1)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                SPY 标普
              </button>
            </div>
          </div>

          {/* Mode Tabs Switch (Desktop) */}
          <div className="hidden sm:flex items-center bg-[#0d0d11] p-1 rounded-lg border border-neutral-800 w-full sm:w-auto justify-center">
            <button
              onClick={() => {
                setActiveTab("challenge");
                setSelectedPattern(null);
                setFocusIndex(null);
              }}
              className={`px-4 py-1.5 rounded-md text-xs font-bold tracking-widest transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer min-h-0 flex-initial ${
                activeTab === "challenge"
                  ? "bg-white text-black font-black border border-white shadow-[0_2px_8px_rgba(255,255,255,0.15)]"
                  : "bg-transparent text-slate-400 hover:text-white border border-transparent hover:border-neutral-700"
              }`}
            >
              <GraduationCap className={`w-3.5 h-3.5 ${activeTab === "challenge" ? "text-black" : "text-slate-400"}`} />
              实战模拟
            </button>
            <button
              onClick={() => setActiveTab("review")}
              className={`px-4 py-1.5 rounded-md text-xs font-bold tracking-widest transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer min-h-0 flex-initial ${
                activeTab === "review"
                  ? "bg-white text-black font-black border border-white shadow-[0_2px_8px_rgba(255,255,255,0.15)]"
                  : "bg-transparent text-slate-400 hover:text-white border border-transparent hover:border-neutral-700"
              }`}
            >
              <BarChart3 className={`w-3.5 h-3.5 ${activeTab === "review" ? "text-black" : "text-slate-400"}`} />
              行为学习
            </button>
          </div>

          {/* Live Price Display */}
          {latestCandle && (
            <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900/30 backdrop-blur-sm shadow-inner transition-all hover:border-neutral-700">
              {/* Left Column: Ticker & Live Status / NY Time */}
              <div className="flex flex-col items-start gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${priceChange >= 0 ? (isChineseStyle ? "bg-[#ff3b30]" : "bg-[#00c805]") : (isChineseStyle ? "bg-[#00c805]" : "bg-[#ff3b30]")}`}></span>
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${priceChange >= 0 ? (isChineseStyle ? "bg-[#ff3b30]" : "bg-[#00c805]") : (isChineseStyle ? "bg-[#00c805]" : "bg-[#ff3b30]")}`}></span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-neutral-200 uppercase tracking-widest">
                    {symbol.toUpperCase()} LATEST
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-neutral-400 font-bold">
                  <Clock className="w-2.5 h-2.5 text-neutral-400" />
                  {(() => {
                    try {
                      const dateNYStr = new Date(latestCandle.time).toLocaleString("en-US", { timeZone: "America/New_York" });
                      const dateNY = new Date(dateNYStr);
                      const yyyy = dateNY.getFullYear();
                      const mm = String(dateNY.getMonth() + 1).padStart(2, "0");
                      const dd = String(dateNY.getDate()).padStart(2, "0");
                      const hh = String(dateNY.getHours()).padStart(2, "0");
                      const min = String(dateNY.getMinutes()).padStart(2, "0");
                      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
                    } catch (e) {
                      return "";
                    }
                  })()}
                </div>
              </div>

              {/* Vertical divider */}
              <div className="h-6 w-[1px] bg-neutral-800" />

              {/* Right Column: Price and % Change */}
              <div className="flex items-baseline gap-1.5">
                <span className={`text-base font-mono font-black tracking-tight ${priceChange >= 0 ? (isChineseStyle ? "text-[#ff3b30]" : "text-[#00c805]") : (isChineseStyle ? "text-[#00c805]" : "text-[#ff3b30]")}`}>
                  ${latestCandle.close.toFixed(2)}
                </span>
                
                <span className={`text-[11px] font-mono font-extrabold ${priceChange >= 0 ? (isChineseStyle ? "text-[#ff3b30]" : "text-[#00c805]") : (isChineseStyle ? "text-[#00c805]" : "text-[#ff3b30]")}`}>
                  {priceChange >= 0 ? "+" : ""}{priceChangePct.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Content Dashboard Stage */}
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 sm:pb-6 flex flex-col gap-5">
        
        {loading && candles.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-t-2 border-blue-500 border-r-2 border-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-xs text-slate-400 font-mono">正在加载 SPX 历史行情数据...</p>
          </div>
        ) : (
          <>
            {activeTab === "review" ? (
              /* TAB 1: INTERACTIVE PRICE ACTION REVIEW */
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch flex-1">
                
                {/* Column 1: Interactive SVG Candlestick Chart Stage */}
                <div className="lg:col-span-3 flex flex-col gap-4 h-full">

                  {/* Main Price Action SVG Chart */}
                  <PriceActionChart
                    candles={candles}
                    patterns={filteredPatterns}
                    zones={zones}
                    trend={trend}
                    selectedPattern={selectedPattern}
                    onSelectPattern={handleSelectPattern}
                    showPatterns={showPatterns}
                    setShowPatterns={setShowPatterns}
                    showZones={showZones}
                    setShowZones={setShowZones}
                    showTrends={showTrends}
                    setShowTrends={setShowTrends}
                    showVolume={showVolume}
                    setShowVolume={setShowVolume}
                    focusIndex={focusIndex}
                    onCandleClick={handleCandleClick}
                    timeframe={timeframe}
                    setTimeframe={(tf) => {
                      setTimeframe(tf);
                      setDrilldownDay(null);
                    }}
                    isChineseStyle={isChineseStyle}
                    setIsChineseStyle={setIsChineseStyle}
                    patternFilters={patternFilters}
                    onTogglePatternFilter={handleTogglePatternFilter}
                    getCategoryCount={getCategoryCount}
                    symbol={symbol}
                  />

                  {timeframe === "1d" && (
                    <div className="mt-2 text-center text-xs text-slate-500 font-sans italic">
                      💡 提示：在上方 **日 K** 视图下，点击任何一根 K 线即可在下方加载并查看那一天的 **5分钟日内精细分时走势图**
                    </div>
                  )}

                  {/* 5-minute Intraday Drilldown Section */}
                  {timeframe === "1d" && drilldownDay && (
                    <div className="bg-black border border-neutral-800 rounded-none p-6 shadow-2xl mt-4 animate-fade-in flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 bg-white text-black text-[10px] font-mono font-bold rounded-none border border-white uppercase">
                            日内分时 (5m)
                          </span>
                          <h3 className="text-sm font-bold text-slate-100 font-sans">
                            {symbol.toUpperCase()} 5分钟走势分析 - <span className="text-white font-mono font-bold">{drilldownDay}</span>
                          </h3>
                        </div>
                        <button
                          onClick={() => setDrilldownDay(null)}
                          className="px-3 py-1.5 bg-black hover:bg-neutral-900 active:scale-[0.98] border border-neutral-700 text-slate-200 rounded-none text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          收起日内图 (Close)
                        </button>
                      </div>

                      {drilldownLoading ? (
                        <div className="h-[250px] flex flex-col items-center justify-center">
                          <div className="w-8 h-8 border-t-2 border-white border-r-2 border-transparent rounded-full animate-spin mb-3"></div>
                          <p className="text-xs text-slate-400 font-mono">正在抓取并组装该交易日5分钟精细 K 线...</p>
                        </div>
                      ) : drilldownCandles.length === 0 ? (
                        <div className="h-[120px] flex items-center justify-center text-xs text-slate-500 font-sans border border-dashed border-neutral-800 rounded-none">
                          ⚠️ 未找到该交易日的日内5分钟数据（请点击近2个月内的有效美股交易日 K 线）
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {/* Intraday summary statistics card */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-black p-4 rounded-none border border-neutral-800">
                            <div>
                              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">日内开盘</div>
                              <div className="text-xs font-bold text-slate-200 font-mono">
                                {drilldownCandles[0]?.open !== undefined ? `$${drilldownCandles[0].open.toFixed(2)}` : "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">日内收盘</div>
                              <div className="text-xs font-bold text-slate-200 font-mono">
                                {drilldownCandles[drilldownCandles.length - 1]?.close !== undefined ? `$${drilldownCandles[drilldownCandles.length - 1].close.toFixed(2)}` : "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">日内最高</div>
                              <div className={`text-xs font-bold font-mono ${isChineseStyle ? "text-[#ff3b30]" : "text-[#00c805]"}`}>
                                {(() => {
                                  const highs = drilldownCandles.map(c => c?.high).filter(h => h !== undefined && !isNaN(h));
                                  return highs.length > 0 ? `$${Math.max(...highs).toFixed(2)}` : "—";
                                })()}
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">日内最低</div>
                              <div className={`text-xs font-bold font-mono ${isChineseStyle ? "text-[#00c805]" : "text-[#ff3b30]"}`}>
                                {(() => {
                                  const lows = drilldownCandles.map(c => c?.low).filter(l => l !== undefined && !isNaN(l));
                                  return lows.length > 0 ? `$${Math.min(...lows).toFixed(2)}` : "—";
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* 5-minute Intraday sub-chart */}
                          <PriceActionChart
                            candles={drilldownCandles}
                            patterns={drilldownPatterns}
                            zones={drilldownZones}
                            trend={drilldownTrend}
                            selectedPattern={null}
                            onSelectPattern={() => {}}
                            showPatterns={showPatterns}
                            showZones={showZones}
                            showTrends={showTrends}
                            showVolume={showVolume}
                            timeframe="5m"
                            isChineseStyle={isChineseStyle}
                            symbol={symbol}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Column 2: Patterns Sidebar & Trend Diagnostics (Right Sidebar matching trading conventions) */}
                <div className="lg:col-span-1 flex flex-col h-full">
                  <PatternList
                    patterns={filteredPatterns}
                    allPatterns={patterns}
                    patternFilters={patternFilters}
                    setPatternFilters={setPatternFilters}
                    showPatterns={showPatterns}
                    setShowPatterns={setShowPatterns}
                    zones={zones}
                    trend={trend}
                    selectedPattern={selectedPattern}
                    onSelectPattern={handleSelectPattern}
                    onTriggerSync={handleTriggerSync}
                    syncing={syncing}
                    lastUpdated={lastUpdated}
                    timeframe={timeframe}
                    candles={candles}
                    isChineseStyle={isChineseStyle}
                    quizScore={quizScore}
                    setQuizScore={setQuizScore}
                    setActiveTab={setActiveTab}
                  />
                </div>
              </div>
            ) : (
              /* TAB 2: INTERACTIVE BLIND CHALLENGE */
              <div className="animate-fade-in">
                <ChallengeMode
                  candles={candles}
                  patterns={patterns}
                  zones={zones}
                  trend={trend}
                  isChineseStyle={isChineseStyle}
                  quizScore={quizScore}
                  setQuizScore={setQuizScore}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* 3. Global Sleek Status Bar Footer */}
      <footer className="py-4 bg-[#050507] border-t border-neutral-900 text-[10px] text-neutral-200 mt-auto font-mono px-4 sm:px-6 select-none pb-16 sm:pb-3">
        <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
          <div className="text-center sm:text-left tracking-wider bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent font-bold">
            © 2026 {symbol.toUpperCase()} Price Action Compass · 数据延迟 (t-1) · 非投资建议 学习用途
          </div>
          <a
            href="https://github.com/kain26/SPX-Price-Action-Compass"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-white hover:text-white border border-neutral-800 hover:border-neutral-600 bg-neutral-900/60 backdrop-blur-sm px-2.5 py-1 rounded transition-all duration-300 hover:shadow-[0_0_12px_rgba(255,255,255,0.06)] cursor-pointer"
            title="View on GitHub"
          >
            <Github className="w-3.5 h-3.5 text-white" />
            <span className="font-bold tracking-widest uppercase text-[9px] bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">GitHub Repo</span>
          </a>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#07070a]/95 backdrop-blur-xl border-t border-neutral-900 z-50 px-6 pb-safe">
        <div className="flex items-center justify-around h-11 sm:h-14">
          <button
            onClick={() => {
              setActiveTab("challenge");
              setSelectedPattern(null);
              setFocusIndex(null);
            }}
            className={`flex flex-col items-center justify-center gap-0.5 sm:gap-1.5 py-1 px-3 transition-all duration-200 cursor-pointer ${
              activeTab === "challenge"
                ? "text-white font-bold"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <GraduationCap className={`w-4 h-4 transition-transform duration-200 ${activeTab === "challenge" ? "text-white scale-110" : "text-neutral-500"}`} />
            <span className="text-[9px] sm:text-[10px] tracking-wider sm:tracking-widest font-medium">实战</span>
          </button>

          <button
            onClick={() => setActiveTab("review")}
            className={`flex flex-col items-center justify-center gap-0.5 sm:gap-1.5 py-1 px-3 transition-all duration-200 cursor-pointer ${
              activeTab === "review"
                ? "text-white font-bold"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <BarChart3 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${activeTab === "review" ? "text-white scale-110" : "text-neutral-500"}`} />
            <span className="text-[9px] sm:text-[10px] tracking-wider sm:tracking-widest font-medium">学习</span>
          </button>
        </div>
      </div>
    </div>
  );
}
