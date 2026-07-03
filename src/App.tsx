import React, { useState, useEffect } from "react";
import PatternList from "./components/PatternList.tsx";
import PriceActionChart from "./components/PriceActionChart.tsx";
import ChallengeMode from "./components/ChallengeMode.tsx";
import { Candle, DetectedPattern, SupportResistanceZone, MarketTrend, SPXDataResponse } from "./types.js";
import { SlidersHorizontal, BookOpen, GraduationCap, Flame, RefreshCw, BarChart3, HelpCircle, Layers, Eye, EyeOff, ChevronDown, Check } from "lucide-react";

const PATTERN_CATEGORIES = [
  { val: "ALL", label: "全部形态" },
  { val: "PIN_BAR", label: "针形 K线 (Pin Bar / Hammer)" },
  { val: "ENGULFING", label: "吞没 K线 (Engulfing)" },
  { val: "STAR", label: "星体反转 (Morning/Evening Star)" },
  { val: "DOJI", label: "十字星 (Doji)" },
  { val: "DOUBLE", label: "双顶双底 (Double Top/Bottom)" },
  { val: "HEAD_SHOULDERS", label: "头肩结构 (Head & Shoulders)" },
  { val: "TRIANGLE", label: "收敛整理 (Triangles)" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"review" | "challenge">("review");
  const [timeframe, setTimeframe] = useState<"1m" | "5m" | "15m" | "4h" | "1d">("1d"); // Default to "1d" (日K)
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

  // Pattern Filter Selection Dropdown state
  const [patternFilters, setPatternFilters] = useState<string[]>(["ENGULFING", "PIN_BAR"]);
  const [showPatternDropdown, setShowPatternDropdown] = useState<boolean>(false);

  // Visibility toggles
  const [showPatterns, setShowPatterns] = useState<boolean>(true);
  const [showZones, setShowZones] = useState<boolean>(true);
  const [showTrends, setShowTrends] = useState<boolean>(true);
  const [showVolume, setShowVolume] = useState<boolean>(true);

  // Helper to toggle pattern filters (supports multi-selection)
  const handleTogglePatternFilter = (val: string) => {
    setShowPatterns(true); // Always enable pattern markings when filtering
    if (val === "ALL") {
      setPatternFilters(["ALL"]);
    } else {
      setPatternFilters(prev => {
        const withoutAll = prev.filter(x => x !== "ALL");
        if (withoutAll.includes(val)) {
          const updated = withoutAll.filter(x => x !== val);
          return updated.length === 0 ? ["ALL"] : updated;
        } else {
          return [...withoutAll, val];
        }
      });
    }
  };

  // Helper to get formatted display label for the selected patterns
  const getDropdownButtonLabel = () => {
    if (patternFilters.includes("ALL")) return "全部形态";
    if (patternFilters.length === 0) return "无选择";
    const selectedLabels = PATTERN_CATEGORIES
      .filter(c => patternFilters.includes(c.val) && c.val !== "ALL")
      .map(c => c.label.split(" ")[0]); // E.g., "针形", "吞没"
    return selectedLabels.join(" + ");
  };

  // Filter detected patterns based on user's active dropdown choice
  const filteredPatterns = patterns.filter(p => {
    if (patternFilters.includes("ALL")) return true;
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

  // Fetch SPX data from full-stack backend
  const fetchData = async (tfStr = timeframe) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/spx-data?timeframe=${tfStr}`);
      if (!res.ok) throw new Error("Failed to load SPX historical data");
      
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrilldownDay = async (dayStr: string) => {
    setDrilldownLoading(true);
    try {
      const res = await fetch(`/api/spx-data?timeframe=5m&day=${dayStr}`);
      if (!res.ok) throw new Error("Failed to load intraday drilldown data");
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
      if (!res.ok) throw new Error("Failed to sync database");
      
      const payload = await res.json();
      setLastUpdated(payload.lastUpdated);
      // Re-fetch current visible timeline
      await fetchData();
    } catch (err) {
      console.error(err);
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
    <div className="min-h-screen bg-[#0a0b0e] text-slate-300 flex flex-col font-sans">
      
      {/* 1. Global Navigation Header */}
      <header className="bg-[#0d0e12] border-b border-slate-800 sticky top-0 z-50 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* App Branding */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-bold text-sm text-slate-100 tracking-tight">
              SPX Price Action Compass
            </span>
          </div>

          {/* Mode Tabs Switch */}
          <div className="flex items-center bg-[#0a0b0e] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab("review")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "review"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/15"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              价格行为复盘 (Study Mode)
            </button>
            <button
              onClick={() => {
                setActiveTab("challenge");
                setSelectedPattern(null);
                setFocusIndex(null);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "challenge"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/15"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              实战模拟对抗 (Challenge)
            </button>
          </div>

          {/* Live Price Display */}
          {latestCandle && (
            <div className="hidden lg:flex items-center gap-3 bg-[#0a0b0e]/80 border border-slate-800/60 px-3 py-1 rounded-xl">
              <div className="text-right">
                <div className="text-base font-mono text-[#00f2ad] font-bold leading-none">
                  {latestCandle.close.toFixed(2)}
                </div>
                <div className={`text-[9px] font-bold font-mono mt-0.5 ${priceChange >= 0 ? "text-[#00f2ad]" : "text-[#ff4b5c]"}`}>
                  {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)} ({priceChangePct >= 0 ? "+" : ""}{priceChangePct.toFixed(2)}%)
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Content Dashboard Stage */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
        
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
                
                {/* Column 1: Interactive SVG Candlestick Chart Stage (Left/Middle for user habit) */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                  
                  {/* Chart Utility Toolbar - Clean, flat, borderless bar with NO nested cards */}
                  <div className="flex flex-wrap items-center justify-between gap-4 py-1.5 px-1">
                    {/* Timeframe picker - sleek flat group */}
                    <div className="flex items-center gap-1 bg-neutral-900/60 p-1 rounded-xl border border-[#1e222d]">
                      {[
                        { label: "1 min K", val: "1m" },
                        { label: "5 min K", val: "5m" },
                        { label: "15 min K", val: "15m" },
                        { label: "4h K", val: "4h" },
                        { label: "日 K", val: "1d" },
                      ].map(t => (
                        <button
                          key={t.val}
                          onClick={() => {
                            setTimeframe(t.val as any);
                            setDrilldownDay(null); // Reset drilldown when switching timeframe
                          }}
                          className={`px-3 py-1 rounded-lg text-[10px] font-semibold font-sans transition-all cursor-pointer ${
                            timeframe === t.val
                              ? "bg-[#1e222d] text-[#00c805] shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Visibility Switches - sleek flat buttons */}
                    <div className="flex items-center gap-2">
                      {/* Auto-detected Patterns Dropdown Menu */}
                      <div className="relative">
                        <button
                          onClick={() => setShowPatternDropdown(!showPatternDropdown)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${
                            showPatterns
                              ? "bg-[#00c805]/10 border-[#00c805]/20 text-[#00c805]"
                              : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#1e222d]/30"
                          }`}
                          title="选择并学习不同的价格行为形态"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>形态: {getDropdownButtonLabel()}</span>
                          <ChevronDown className="w-3 h-3 ml-0.5 text-slate-400" />
                        </button>

                        {showPatternDropdown && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setShowPatternDropdown(false)}
                            />
                            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0c0d10] border border-[#1e222d] p-1.5 shadow-2xl z-50 animate-fade-in">
                              <div className="px-2.5 py-1.5 text-[9px] font-mono text-slate-500 uppercase tracking-wider border-b border-[#1e222d]/50 mb-1">
                                选择要研究的形态 (支持多选)
                              </div>
                              <button
                                onClick={() => {
                                  setShowPatterns(!showPatterns);
                                  setShowPatternDropdown(false);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors flex items-center justify-between hover:bg-[#1e222d]/60 text-slate-300"
                              >
                                <span>显示所有形态图示</span>
                                <span className="text-[8px] font-mono opacity-60">{showPatterns ? "已开启" : "已关闭"}</span>
                              </button>
                              <div className="h-[1px] bg-[#1e222d]/50 my-1" />
                              {PATTERN_CATEGORIES.map(cat => {
                                const isSelected = cat.val === "ALL" 
                                  ? patternFilters.includes("ALL")
                                  : patternFilters.includes(cat.val);
                                return (
                                  <button
                                    key={cat.val}
                                    onClick={() => handleTogglePatternFilter(cat.val)}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors flex items-center justify-between ${
                                      isSelected
                                        ? "bg-[#00c805]/10 text-[#00c805] font-bold"
                                        : "text-slate-400 hover:bg-[#1e222d]/40 hover:text-slate-200"
                                    }`}
                                  >
                                    <span>{cat.label}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-[#00c805]" />}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Support & Resistance Bands */}
                      <button
                        onClick={() => setShowZones(!showZones)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${
                          showZones
                            ? "bg-[#00c805]/10 border-[#00c805]/20 text-[#00c805]"
                            : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#1e222d]/30"
                        }`}
                        title="显示/隐藏压力支撑带"
                      >
                        {showZones ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        支撑/阻力
                      </button>

                      {/* Trend Pivots */}
                      <button
                        onClick={() => setShowTrends(!showTrends)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${
                          showTrends
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                            : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#1e222d]/30"
                        }`}
                        title="显示/隐藏趋势标定"
                      >
                        {showTrends ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        HH / LL
                      </button>

                      {/* Volume toggler */}
                      <button
                        onClick={() => setShowVolume(!showVolume)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${
                          showVolume
                            ? "bg-slate-800/40 border-[#1e222d] text-slate-300"
                            : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#1e222d]/30"
                        }`}
                        title="显示/隐藏成交量"
                      >
                        {showVolume ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        成交量
                      </button>
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
                  />

                  {timeframe === "1d" && (
                    <div className="mt-2 text-center text-xs text-slate-500 font-sans italic">
                      💡 提示：在上方 **日 K** 视图下，点击任何一根 K 线即可在下方加载并查看那一天的 **5分钟日内精细分时走势图**
                    </div>
                  )}

                  {/* 5-minute Intraday Drilldown Section */}
                  {timeframe === "1d" && drilldownDay && (
                    <div className="bg-[#0c0d10] border border-[#1e222d] rounded-2xl p-6 shadow-2xl mt-4 animate-fade-in flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-[#1e222d] pb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 bg-blue-600/20 text-blue-400 text-[10px] font-mono font-bold rounded-lg border border-blue-500/20 uppercase">
                            日内分时 (5m)
                          </span>
                          <h3 className="text-sm font-bold text-white font-sans">
                            SPX 5分钟走势 analysis - <span className="text-blue-400 font-mono">{drilldownDay}</span>
                          </h3>
                        </div>
                        <button
                          onClick={() => setDrilldownDay(null)}
                          className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-900 border border-[#1e222d] text-slate-300 rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          收起日内图 (Close)
                        </button>
                      </div>

                      {drilldownLoading ? (
                        <div className="h-[250px] flex flex-col items-center justify-center">
                          <div className="w-8 h-8 border-t-2 border-blue-500 border-r-2 border-transparent rounded-full animate-spin mb-3"></div>
                          <p className="text-xs text-slate-400 font-mono">正在抓取并组装该交易日5分钟精细 K 线...</p>
                        </div>
                      ) : drilldownCandles.length === 0 ? (
                        <div className="h-[120px] flex items-center justify-center text-xs text-slate-500 font-sans border border-dashed border-[#1e222d] rounded-xl">
                          ⚠️ 未找到该交易日的日内5分钟数据（请点击近2个月内的有效美股交易日 K 线）
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {/* Intraday summary statistics card */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#000000] p-4 rounded-xl border border-[#1e222d]">
                            <div>
                              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">日内开盘</div>
                              <div className="text-xs font-bold text-slate-200 font-mono">${drilldownCandles[0]?.open.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">日内收盘</div>
                              <div className="text-xs font-bold text-slate-200 font-mono">${drilldownCandles[drilldownCandles.length - 1]?.close.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">日内最高</div>
                              <div className="text-xs font-bold text-[#00c805] font-mono">${Math.max(...drilldownCandles.map(c => c.high)).toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">日内最低</div>
                              <div className="text-xs font-bold text-[#ff3b30] font-mono">${Math.min(...drilldownCandles.map(c => c.low)).toFixed(2)}</div>
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
                    zones={zones}
                    trend={trend}
                    selectedPattern={selectedPattern}
                    onSelectPattern={handleSelectPattern}
                    onTriggerSync={handleTriggerSync}
                    syncing={syncing}
                    lastUpdated={lastUpdated}
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
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* 3. Global Sleek Status Bar Footer */}
      <footer className="h-10 bg-[#0d0e12] border-t border-slate-800 flex items-center justify-between px-6 text-[11px] text-slate-400 mt-auto font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center">
            <span className="w-1.5 h-1.5 bg-[#00f2ad] rounded-full mr-2 animate-pulse"></span> 
            DATA ENGINE: ONLINE
          </span>
          <span className="text-slate-700">|</span>
          <span>Last Fetch: <span className="text-slate-200">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "Pending"}</span></span>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex gap-4">
            <span className="text-slate-500 uppercase font-bold tracking-tighter text-[10px]">
              Patterns: <span className="text-slate-200">{patterns.length}</span>
            </span>
            <span className="text-slate-500 uppercase font-bold tracking-tighter text-[10px]">
              Trend: <span className="text-slate-200">{trend.direction}</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="bg-slate-800/80 px-2 py-0.5 rounded text-slate-400 text-[10px]">Al Brooks Style</span>
            <span className="bg-slate-800/80 px-2 py-0.5 rounded text-slate-400 text-[10px]">Bob Volman Style</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
