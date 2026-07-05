import React, { useState, useEffect } from "react";
// @ts-ignore
import paLogo from "./pa-logo.png";
import PatternList from "./components/PatternList.tsx";
import PriceActionChart from "./components/PriceActionChart.tsx";
import ChallengeMode from "./components/ChallengeMode.tsx";
import { Candle, DetectedPattern, SupportResistanceZone, MarketTrend, SPXDataResponse } from "./types.js";
import { SlidersHorizontal, BookOpen, GraduationCap, Flame, RefreshCw, BarChart3, HelpCircle, Layers, Eye, EyeOff, ChevronDown, Check, Filter, Sparkles, TrendingUp, ChevronRight, Clock, Grid, Triangle, ArrowUpDown } from "lucide-react";
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
  const [timeframe, setTimeframe] = useState<"1m" | "5m" | "15m" | "4h" | "1d">("5m"); // Default to "5m" (5min K)
  const [candles, setCandles] = useState<Candle[]>([]);
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [zones, setZones] = useState<SupportResistanceZone[]>([]);
  const [trend, setTrend] = useState<MarketTrend>({ direction: "SIDEWAYS", strength: 50, labels: [] });
  const [lastUpdated, setLastUpdated] = useState<string>("");

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

  // Fetch SPX data from full-stack backend with automatic retry on failure
  const fetchData = async (tfStr = timeframe, retries = 3, delayMs = 1500) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/spx-data?timeframe=${tfStr}`);
      if (!res.ok) throw new Error(`Failed to load SPX historical data (Status: ${res.status})`);
      
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
      console.error("[fetchData Error]:", err);
      if (retries > 0) {
        console.log(`Retrying fetchData in ${delayMs}ms... (${retries} attempts left)`);
        setTimeout(() => {
          fetchData(tfStr, retries - 1, delayMs);
        }, delayMs);
      } else {
        setLoading(false);
      }
    }
  };

  const fetchDrilldownDay = async (dayStr: string) => {
    setDrilldownLoading(true);
    try {
      const res = await fetch(`/api/spx-data?timeframe=5m&day=${dayStr}`);
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
    fetchDrilldownDay(dayStr);
  };

  useEffect(() => {
    fetchData();
  }, [timeframe]);

  // Handle active manual sync pull to Yahoo Finance
  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/spx-sync", { method: "POST" });
      if (!res.ok) throw new Error(`Failed to sync database (Status: ${res.status})`);
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response during sync.");
      }
      
      const payload = await res.json();
      setLastUpdated(payload.lastUpdated);
      // Re-fetch current visible timeline
      await fetchData();
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
  const priceChange = latestCandle && candles.length > 1
    ? latestCandle.close - candles[candles.length - 2].close
    : 0;
  const priceChangePct = latestCandle && candles.length > 1 && candles[candles.length - 2].close > 0
    ? (priceChange / candles[candles.length - 2].close) * 100
    : 0;

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col font-sans">
      
      {/* 1. Global Navigation Header */}
      <header className="bg-black/90 backdrop-blur-md border-b border-neutral-800 sticky top-0 z-50 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* App Branding */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              {/* Premium Custom Image Logo with Dark Mode Compatibility */}
              <div className="relative w-9 h-9 flex items-center justify-center bg-white border border-neutral-800 rounded-md shadow-[0_1px_3px_rgba(0,0,0,0.4)] overflow-hidden group hover:scale-105 transition-all duration-300">
                <img 
                  src={paLogo} 
                  alt="Price Action Compass Logo" 
                  className="w-7 h-7 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="font-bold text-sm text-white tracking-widest font-mono uppercase">
                SPX Price Action Compass
              </span>
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
            <div className="hidden lg:flex flex-col items-end gap-0.5 px-3 py-1 rounded-lg border border-neutral-800 bg-[#0d0d11]">
              <div className="text-[10px] font-mono text-slate-400 font-bold">
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
              <div className={`text-sm font-mono font-extrabold leading-none ${priceChange >= 0 ? (isChineseStyle ? "text-[#ff3b30]" : "text-[#00c805]") : (isChineseStyle ? "text-[#00c805]" : "text-[#ff3b30]")}`}>
                {latestCandle.close.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Content Dashboard Stage */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-2 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-6 flex flex-col gap-6">
        
        {loading && candles.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-t-2 border-blue-500 border-r-2 border-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-xs text-slate-400 font-mono">正在加载 SPX 历史行情数据...</p>
          </div>
        ) : (
          <>
            {activeTab === "review" ? (
              /* TAB 1: INTERACTIVE PRICE ACTION REVIEW */
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                
                {/* Column 1: Interactive SVG Candlestick Chart Stage */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                  
                  {/* Chart Utility Toolbar - Clean, flat, borderless bar with NO nested cards */}
                  <div className="flex flex-wrap items-center justify-between gap-2 py-1 px-1 w-full relative">
                    
                    {/* Timeframe picker - sleek collapsed select button */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="relative shrink-0">
                        <button
                          onClick={() => setShowTimeframeDropdown(!showTimeframeDropdown)}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#0d0d11] hover:bg-[#1a1a24] text-white border border-neutral-800 rounded-md text-[10px] sm:text-xs font-bold tracking-wide transition-all cursor-pointer min-h-[32px] shrink-0"
                          title="选择 K 线时间周期 (1m, 5m, 15m, 4h, 1D)"
                        >
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono">{timeframe.toUpperCase() === "1D" ? "1D" : timeframe}</span>
                          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                        </button>
                        
                        {showTimeframeDropdown && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setShowTimeframeDropdown(false)}
                            />
                            <div className="absolute left-0 mt-1 rounded-md bg-[#0d0d11] border border-neutral-700 p-1 shadow-2xl z-50 animate-fade-in w-full sm:w-36">
                              {[
                                { label: "1 min K (1m)", val: "1m" },
                                { label: "5 min K (5m)", val: "5m" },
                                { label: "15 min K (15m)", val: "15m" },
                                { label: "4h K (4h)", val: "4h" },
                                { label: "日 K (1d)", val: "1d" },
                              ].map(t => (
                                <button
                                  key={t.val}
                                  onClick={() => {
                                    setTimeframe(t.val as any);
                                    setDrilldownDay(null);
                                    setShowTimeframeDropdown(false);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded text-[10px] font-bold transition-colors flex items-center justify-between min-h-[28px] ${
                                    timeframe === t.val
                                      ? "bg-white text-black font-black"
                                      : "text-slate-400 hover:bg-neutral-900 hover:text-white"
                                  }`}
                                >
                                  <span>{t.label}</span>
                                  {timeframe === t.val && <Check className="w-3 h-3 text-black" />}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Sleek Apple-style K-line color mode switch */}
                      <button
                        onClick={() => setIsChineseStyle(!isChineseStyle)}
                        className="group flex items-center justify-center gap-2 h-8 px-2.5 bg-[#0d0d11] hover:bg-[#13131c] border border-neutral-800 hover:border-neutral-700 rounded-full transition-all cursor-pointer select-none shrink-0"
                        title={isChineseStyle ? "当前：红涨绿跌 (点击切换为国际标准)" : "当前：绿涨红跌 (点击切换为国内习惯)"}
                      >
                        <span className="flex items-center gap-1">
                          <span 
                            className={`w-1.5 h-4.5 rounded-full transition-all duration-300 ${
                              isChineseStyle ? "bg-[#ff3b30] shadow-[0_0_6px_rgba(255,59,48,0.4)]" : "bg-[#00c805] shadow-[0_0_6px_rgba(0,200,5,0.4)]"
                            }`} 
                          />
                          <span 
                            className={`w-1.5 h-4.5 rounded-full transition-all duration-300 ${
                              isChineseStyle ? "bg-[#00c805] shadow-[0_0_6px_rgba(0,200,5,0.4)]" : "bg-[#ff3b30] shadow-[0_0_6px_rgba(255,59,48,0.4)]"
                            }`} 
                          />
                        </span>
                      </button>
                    </div>

                    {/* Functional Toolbar - sleek row of square/iconic controls with active highlights */}
                    <div className="flex items-center gap-1.5 py-0.5 shrink-0 ml-auto">
                      
                      {/* S/R Toggle */}
                      <button
                        onClick={() => setShowZones(!showZones)}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] font-bold transition-all cursor-pointer min-h-[32px] shrink-0 ${
                          showZones
                            ? "bg-white border-white text-black font-black"
                            : "bg-[#0d0d11] border-neutral-800 text-slate-400 hover:text-white hover:border-neutral-600 hover:bg-neutral-900"
                        }`}
                        title="显示/隐藏 支撑与阻力关键水位共识"
                      >
                        <Grid className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">支撑/阻力</span>
                      </button>

                      {/* Patterns Toggle */}
                      <button
                        onClick={() => setShowPatterns(!showPatterns)}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] font-bold transition-all cursor-pointer min-h-[32px] shrink-0 ${
                          showPatterns
                            ? "bg-white border-white text-black font-black"
                            : "bg-[#0d0d11] border-neutral-800 text-slate-400 hover:text-white hover:border-neutral-600 hover:bg-neutral-900"
                        }`}
                        title="显示/隐藏 图表自动识别价格行为形态"
                      >
                        <Triangle className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">图上形态</span>
                      </button>

                      {/* Trends (HH/LL) Toggle */}
                      <button
                        onClick={() => setShowTrends(!showTrends)}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] font-bold transition-all cursor-pointer min-h-[32px] shrink-0 ${
                          showTrends
                            ? "bg-white border-white text-black font-black"
                            : "bg-[#0d0d11] border-neutral-800 text-slate-400 hover:text-white hover:border-neutral-600 hover:bg-neutral-900"
                        }`}
                        title="显示/隐藏 趋势高低波段标定 (HH / LL / LH / HL)"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">HH/LL</span>
                      </button>

                      {/* Volume Toggle */}
                      <button
                        onClick={() => setShowVolume(!showVolume)}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] font-bold transition-all cursor-pointer min-h-[32px] shrink-0 ${
                          showVolume
                            ? "bg-white border-white text-black font-black"
                            : "bg-[#0d0d11] border-neutral-800 text-slate-400 hover:text-white hover:border-neutral-600 hover:bg-neutral-900"
                        }`}
                        title="显示/隐藏 底部成交量分布图"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">成交量</span>
                      </button>

                      {/* Pattern Filter Button */}
                      <div className="relative shrink-0">
                        <button
                          onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                          className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] font-bold transition-all cursor-pointer min-h-[32px] shrink-0 ${
                            showFilterDropdown
                              ? "bg-white border-white text-black font-black"
                              : "bg-[#0d0d11] border-neutral-800 text-slate-400 hover:text-white hover:border-neutral-600 hover:bg-neutral-900"
                          }`}
                          title="筛选要显示的特定 K 线价格形态"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span className="hidden xs:inline">筛选</span>
                        </button>

                        {showFilterDropdown && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setShowFilterDropdown(false)}
                            />
                            <div className="absolute right-0 mt-1 rounded-md bg-[#0d0d11] border border-neutral-700 p-1.5 shadow-2xl z-50 animate-fade-in w-48 sm:w-56 max-h-[300px] overflow-y-auto">
                              <div className="px-2 py-1 text-[9px] font-mono text-slate-500 uppercase tracking-wider border-b border-neutral-800 mb-1 text-left">
                                选择形态 (多选)
                              </div>
                              {PATTERN_CATEGORIES.map(cat => {
                                const isSelected = cat.val === "ALL" 
                                  ? patternFilters.includes("ALL")
                                  : patternFilters.includes(cat.val);
                                const count = getCategoryCount(cat.val);
                                return (
                                  <button
                                    key={cat.val}
                                    onClick={() => handleTogglePatternFilter(cat.val)}
                                    className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-bold transition-colors flex items-center justify-between min-h-[28px] ${
                                      isSelected
                                        ? "bg-white text-black font-black"
                                        : "text-slate-400 hover:bg-neutral-900 hover:text-white"
                                    }`}
                                  >
                                    <span>{cat.label} ({count})</span>
                                    {isSelected && <Check className="w-3 h-3 text-black" />}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* Main Price Action SVG Chart */}
                  <PriceActionChart
                    candles={candles}
                    patterns={filteredPatterns}
                    zones={zones}
                    trend={trend}
                    selectedPattern={selectedPattern}
                    onSelectPattern={handleSelectPattern}
                    showPatterns={showPatterns}
                    showZones={showZones}
                    showTrends={showTrends}
                    showVolume={showVolume}
                    focusIndex={focusIndex}
                    onCandleClick={handleCandleClick}
                    timeframe={timeframe}
                    isChineseStyle={isChineseStyle}
                  />

                  {/* Calculate active focus pattern */}
                  {(() => {
                    // Highest confidence pattern from filtered list as fallback, or selectedPattern
                    const activeFocus = selectedPattern || 
                      (filteredPatterns.length > 0 
                        ? [...filteredPatterns].sort((a, b) => b.confidence - a.confidence)[0] 
                        : null);
                        
                    if (!activeFocus) return null;

                    const displayLabel = (() => {
                      switch (activeFocus.type) {
                        case "PIN_BAR_BULLISH": return "看涨 Pin Bar (锤子线)";
                        case "PIN_BAR_BEARISH": return "看跌 Pin Bar (流星线)";
                        case "ENGULFING_BULLISH": return "看涨吞没 (Bullish Engulfing)";
                        case "ENGULFING_BEARISH": return "看跌吞没 (Bearish Engulfing)";
                        case "MORNING_STAR": return "启明星反转 (Morning Star)";
                        case "EVENING_STAR": return "黄昏星反转 (Evening Star)";
                        case "DOJI": return "十字星 (Doji)";
                        case "INSIDE_BAR": return "内含线 (Inside Bar)";
                        case "DOUBLE_TOP": return "双顶结构 (Double Top)";
                        case "DOUBLE_BOTTOM": return "双底结构 (Double Bottom)";
                        case "HEAD_AND_SHOULDERS": return "头肩顶 (Head & Shoulders)";
                        case "INVERSE_HEAD_AND_SHOULDERS": return "逆头肩底 (Inverse H&S)";
                        case "FLAG_BULLISH": return "看涨旗形 (Bullish Flag)";
                        case "FLAG_BEARISH": return "看跌旗形 (Bearish Flag)";
                        case "TRIANGLE_ASCENDING": return "上升三角形 (Ascending Triangle)";
                        case "TRIANGLE_DESCENDING": return "下降三角形 (Descending Triangle)";
                        case "TRIANGLE_SYMMETRICAL": return "对称三角形 (Symmetrical Triangle)";
                        default: return activeFocus.name.split(" (")[0];
                      }
                    })();

                    return (
                      <>
                        <div className="mt-3">
                          <button
                            onClick={() => setShowDiagnosticModal(true)}
                            className="w-full flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl cursor-pointer transition-all animate-fade-in group text-left gap-2 shadow-lg"
                          >
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-300">
                                <span className="flex h-2 w-2 rounded-full bg-[#00c805] animate-pulse" />
                                形态识别: <span className="text-white font-black">{displayLabel}</span>
                              </span>
                              <span className="text-neutral-800 hidden sm:inline">|</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                置信度: <span className="text-yellow-500 font-bold">{Math.round(activeFocus.confidence * 100)}%</span>
                              </span>
                              <span className="text-neutral-800 hidden sm:inline">|</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                参考价: <span className="text-white font-bold">${activeFocus.price}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-indigo-400 group-hover:text-indigo-300 transition-colors font-mono font-bold">
                              <span>查看形态详解</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        </div>

                        {showDiagnosticModal && (
                          <DiagnosticModal
                            pattern={activeFocus}
                            onClose={() => setShowDiagnosticModal(false)}
                            candles={candles}
                            isChineseStyle={isChineseStyle}
                          />
                        )}
                      </>
                    );
                  })()}

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
                            SPX 5分钟走势分析 - <span className="text-white font-mono font-bold">{drilldownDay}</span>
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
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Column 2: Patterns Sidebar & Trend Diagnostics (Right Sidebar matching trading conventions) */}
                <div className="lg:col-span-1 h-full">
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
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* 3. Global Sleek Status Bar Footer */}
      <footer className="hidden sm:block py-3 bg-black border-t border-neutral-950 text-center text-[9px] text-slate-600 mt-auto font-mono px-4 select-none">
        <div>© 2026 SPX Price Action Compass · 数据延迟 (t-1) · 非投资建议 学习用途</div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#07070a]/95 backdrop-blur-xl border-t border-neutral-900 z-50 px-8 pb-safe">
        <div className="flex items-center justify-around h-14">
          <button
            onClick={() => {
              setActiveTab("challenge");
              setSelectedPattern(null);
              setFocusIndex(null);
            }}
            className={`flex flex-col items-center justify-center gap-1.5 py-1 px-4 transition-all duration-200 cursor-pointer ${
              activeTab === "challenge"
                ? "text-white font-bold"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <GraduationCap className={`w-4.5 h-4.5 transition-transform duration-200 ${activeTab === "challenge" ? "text-white scale-110" : "text-neutral-500"}`} />
            <span className="text-[10px] tracking-widest font-medium">实战</span>
          </button>

          <button
            onClick={() => setActiveTab("review")}
            className={`flex flex-col items-center justify-center gap-1.5 py-1 px-4 transition-all duration-200 cursor-pointer ${
              activeTab === "review"
                ? "text-white font-bold"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <BarChart3 className={`w-4 h-4 transition-transform duration-200 ${activeTab === "review" ? "text-white scale-110" : "text-neutral-500"}`} />
            <span className="text-[10px] tracking-widest font-medium">学习</span>
          </button>
        </div>
      </div>
    </div>
  );
}
