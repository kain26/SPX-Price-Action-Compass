import React, { useState, useEffect } from "react";
import { Candle, DetectedPattern, PatternType } from "../types.js";
import { Award, Eye, Play, Sparkles, Check, X, HelpCircle, ArrowRight, Target, Filter, ChevronDown, ChevronUp, Layers, TrendingUp, TrendingDown, Coins } from "lucide-react";
import PriceActionChart from "./PriceActionChart.tsx";

interface ChallengeModeProps {
  candles: Candle[];
  patterns: DetectedPattern[];
  zones: any[];
  trend: any;
  isChineseStyle?: boolean;
  quizScore: { wins: number; total: number };
  setQuizScore: React.Dispatch<React.SetStateAction<{ wins: number; total: number }>>;
}

const CATEGORIES = [
  { id: "ALL", label: "全部实战样本" },
  { id: "PIN_BAR", label: "Pin Bar 系列" },
  { id: "ENGULFING", label: "吞没 K线系列" },
  { id: "DOUBLE", label: "双底/双顶系列" },
  { id: "HEAD_AND_SHOULDERS", label: "星体/头肩系列" }
];

export default function ChallengeMode({
  candles,
  patterns,
  zones,
  trend,
  isChineseStyle = false,
  quizScore,
  setQuizScore
}: ChallengeModeProps) {
  // Filter only high quality / recognizable patterns to test the user on
  // Ensure that there are at least 70 historical candles before the pattern so that the user always gets a clear 71-candle big-picture view
  const challengePatterns = patterns.filter(p => {
    const endIdx = Math.max(...p.candleIndices);
    const hasEnoughHistory = endIdx >= 70;
    return hasEnoughHistory && (
      p.type.includes("PIN_BAR") || 
      p.type.includes("ENGULFING") || 
      p.type.includes("DOUBLE") || 
      p.type.includes("HEAD_AND_SHOULDERS") ||
      p.type.includes("STAR")
    );
  });

  // Chronologically sort patterns (oldest to newest)
  const sortedPatterns = [...challengePatterns].sort((a, b) => {
    const aMax = Math.max(...a.candleIndices);
    const bMax = Math.max(...b.candleIndices);
    return aMax - bMax;
  });

  const [activePattern, setActivePattern] = useState<DetectedPattern | null>(null);
  const [cutoffIndex, setCutoffIndex] = useState<number>(-1);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [revealFuture, setRevealFuture] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showZones, setShowZones] = useState<boolean>(true);

  // Helper to format date string for a pattern
  const getPatternDateStr = (p: DetectedPattern) => {
    const lastIdx = Math.max(...p.candleIndices);
    const candle = candles[lastIdx];
    if (!candle) return "";
    const date = new Date(candle.time);
    return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  };

  // Set up a specific pattern challenge
  const selectPatternForChallenge = (pattern: DetectedPattern) => {
    setActivePattern(pattern);
    const patternEndIdx = Math.max(...pattern.candleIndices);
    setCutoffIndex(patternEndIdx);
    setSelectedOption(null);
    setIsAnswered(false);
    setRevealFuture(false);
  };

  // Set up a new challenge (can choose to pick newest or random)
  const setupNewChallenge = (preferNewest = false) => {
    if (challengePatterns.length === 0) return;

    let targetPattern = null;
    if (preferNewest && sortedPatterns.length >= 1) {
      // Prioritize t-1 (newest)
      targetPattern = sortedPatterns[sortedPatterns.length - 1];
    } else {
      // Pick a random pattern
      targetPattern = challengePatterns[Math.floor(Math.random() * challengePatterns.length)];
    }

    if (targetPattern) {
      selectPatternForChallenge(targetPattern);
    }
  };

  useEffect(() => {
    if (challengePatterns.length > 0 && !activePattern) {
      // Default to the newest t-1 pattern on first load!
      setupNewChallenge(true);
    }
  }, [challengePatterns]);

  if (challengePatterns.length === 0) {
    return (
      <div className="h-[480px] flex flex-col items-center justify-center bg-black border border-neutral-800 rounded-none text-slate-400 p-8 text-center font-mono">
        <HelpCircle className="w-10 h-10 text-slate-700 mb-3 animate-pulse" />
        <h4 className="font-bold text-slate-100 text-sm">暂无可供挑战的形态</h4>
        <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
          交互复盘需要当前数据源包含 Pin Bar, 吞没, 双底/双顶等反转型价格形态。
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 px-5 py-3 sm:py-2.5 bg-white hover:bg-neutral-200 text-black font-black text-xs cursor-pointer transition-all border border-white rounded-none min-h-[44px] sm:min-h-0"
        >
          刷新重试
        </button>
      </div>
    );
  }

  // Get visible candles up to cutoff (hide the subsequent bars if not revealed)
  const getChallengeCandles = () => {
    if (!activePattern) return [];
    
    const startIdx = Math.max(0, cutoffIndex - 70); // Show 70 bars before the trigger
    const endIdx = revealFuture 
      ? Math.min(candles.length, cutoffIndex + 25) // Reveal 25 bars in the future!
      : cutoffIndex + 1; // Cut off exactly on the signal bar
      
    return candles.slice(startIdx, endIdx);
  };

  const visibleChallengeCandles = getChallengeCandles();

  // Determine correct choice based on what ACTUALLY happened in subsequent price action
  const getCorrectAnswer = (): "LONG" | "SHORT" | "NONE" => {
    if (!activePattern) return "NONE";
    
    const signalIndex = cutoffIndex;
    const signalCandle = candles[signalIndex];
    if (!signalCandle) return "NONE";
    
    // Check subsequent candles to find where the price broke out or broke down first
    const futureCandles = candles.slice(signalIndex + 1, Math.min(candles.length, signalIndex + 20));
    if (futureCandles.length === 0) {
      // Fallback to pattern type classification if no future data exists
      const t = activePattern.type;
      if (t.includes("BULLISH") || t.includes("BOTTOM") || t.includes("MORNING")) {
        return "LONG";
      }
      if (t.includes("BEARISH") || t.includes("TOP") || t.includes("EVENING")) {
        return "SHORT";
      }
      return "NONE";
    }
    
    const highTrigger = signalCandle.high;
    const lowTrigger = signalCandle.low;
    const range = Math.max(0.1, highTrigger - lowTrigger);
    
    // We define a minimum breakout threshold (e.g., 10% of the signal candle's range or 0.2 points, whichever is larger)
    // This perfectly prevents minor wicks or noises from triggering incorrect directions
    const threshold = Math.max(0.2, range * 0.1);
    
    let firstLongIndex = -1;
    let firstShortIndex = -1;
    
    for (let i = 0; i < futureCandles.length; i++) {
      const c = futureCandles[i];
      if (firstLongIndex === -1 && c.high > highTrigger + threshold) {
        firstLongIndex = i;
      }
      if (firstShortIndex === -1 && c.low < lowTrigger - threshold) {
        firstShortIndex = i;
      }
    }
    
    // If only one was triggered, that's the clear winner!
    if (firstLongIndex !== -1 && firstShortIndex === -1) return "LONG";
    if (firstShortIndex !== -1 && firstLongIndex === -1) return "SHORT";
    
    // If both were triggered:
    if (firstLongIndex !== -1 && firstShortIndex !== -1) {
      // If one was triggered significantly earlier (at least 2 candles earlier), we take that one
      if (firstLongIndex < firstShortIndex - 1) return "LONG";
      if (firstShortIndex < firstLongIndex - 1) return "SHORT";
      
      // Otherwise, we compare the maximum excursions over the 20-candle window to see which was the real move
      const maxHigh = Math.max(...futureCandles.map(c => c.high));
      const minLow = Math.min(...futureCandles.map(c => c.low));
      const maxUpMove = maxHigh - highTrigger;
      const maxDownMove = lowTrigger - minLow;
      
      return maxUpMove >= maxDownMove ? "LONG" : "SHORT";
    }
    
    // If neither crossed the threshold, look at the net price change at the end of the future horizon
    const lastFutureCandle = futureCandles[futureCandles.length - 1];
    return lastFutureCandle.close >= signalCandle.close ? "LONG" : "SHORT";
  };

  const handleAnswerSubmit = (option: "LONG" | "SHORT" | "SKIP" | "NONE") => {
    if (isAnswered) return;
    
    setSelectedOption(option);
    setIsAnswered(true);
    setRevealFuture(true); // Auto-reveal future bars when answered!

    if (option !== "SKIP" && option !== "NONE") {
      const correctAns = getCorrectAnswer();
      const isCorrect = option === correctAns;

      setQuizScore(prev => ({
        wins: isCorrect ? prev.wins + 1 : prev.wins,
        total: prev.total + 1
      }));
    }
  };

  const correctAns = getCorrectAnswer();

  // Filter instances based on selected category
  const filteredInstances = sortedPatterns.filter(p => {
    if (selectedCategory === "ALL") return true;
    if (selectedCategory === "PIN_BAR") return p.type.includes("PIN_BAR");
    if (selectedCategory === "ENGULFING") return p.type.includes("ENGULFING");
    if (selectedCategory === "DOUBLE") return p.type.includes("DOUBLE");
    if (selectedCategory === "HEAD_AND_SHOULDERS") return p.type.includes("HEAD_AND_SHOULDERS") || p.type.includes("STAR");
    return false;
  });

  const winPercent = quizScore.total > 0 ? Math.round((quizScore.wins / quizScore.total) * 100) : 0;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (winPercent / 100) * circumference;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch select-none flex-1 animate-fade-in">
      
      {/* Column 1: Chart Canvas Area & Practice Selector (Left side) */}
      <div className="lg:col-span-2 flex flex-col gap-4 h-full">
        
        {/* Targeted Practice Selector Panel */}
        <div className="bg-black border border-neutral-800 rounded-none p-4 flex flex-col gap-3 text-left">
          {/* Row 1: Fast Mode Selection & Quick t-1/t-2 & Toggleable Advanced Picker */}
          <div className="flex flex-row items-center justify-between gap-2 overflow-x-auto no-scrollbar w-full whitespace-nowrap">
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    const rand = challengePatterns[Math.floor(Math.random() * challengePatterns.length)];
                    if (rand) selectPatternForChallenge(rand);
                  }}
                  className="px-2.5 py-1 bg-[#0d0d11] border border-neutral-800 hover:border-white hover:bg-neutral-900 text-white text-[10px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>随机</span>
                </button>
                {sortedPatterns.length >= 1 && (
                  <button
                    onClick={() => selectPatternForChallenge(sortedPatterns[sortedPatterns.length - 1])}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md border transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                      activePattern?.id === sortedPatterns[sortedPatterns.length - 1].id
                        ? "bg-white border-white text-black font-black"
                        : "bg-[#0d0d11] border-neutral-800 hover:border-neutral-500 text-slate-300"
                    }`}
                  >
                    <span>t-1</span>
                  </button>
                )}
                {sortedPatterns.length >= 2 && (
                  <button
                    onClick={() => selectPatternForChallenge(sortedPatterns[sortedPatterns.length - 2])}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md border transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                      activePattern?.id === sortedPatterns[sortedPatterns.length - 2].id
                        ? "bg-white border-white text-black font-black"
                        : "bg-[#0d0d11] border-neutral-800 hover:border-neutral-500 text-slate-300"
                    }`}
                  >
                    <span>t-2</span>
                  </button>
                )}
                <button
                  onClick={() => setShowDatePicker(prev => !prev)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md border transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                    showDatePicker
                      ? "bg-white border-white text-black font-black"
                      : "bg-[#0d0d11] border-neutral-800 hover:border-slate-500 text-slate-400"
                  }`}
                >
                  <span>自选</span>
                  {showDatePicker ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 ml-auto">
              <span className="text-[10px] text-slate-500 font-mono shrink-0">
                总形态: <span className="text-slate-300 font-bold">{challengePatterns.length}</span>
              </span>
            </div>
          </div>

          {/* Row 2: Category Filter & Specific Pattern Events - COLLAPSIBLE and HIDDEN by default */}
          {showDatePicker && (
            <div className="flex flex-col gap-2.5 pt-2 border-t border-neutral-800 animate-fade-in text-left">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  针对性筛选：
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {CATEGORIES.map(cat => {
                    const count = cat.id === "ALL" 
                      ? challengePatterns.length 
                      : challengePatterns.filter(p => {
                          if (cat.id === "PIN_BAR") return p.type.includes("PIN_BAR");
                          if (cat.id === "ENGULFING") return p.type.includes("ENGULFING");
                          if (cat.id === "DOUBLE") return p.type.includes("DOUBLE");
                          if (cat.id === "HEAD_AND_SHOULDERS") return p.type.includes("HEAD_AND_SHOULDERS") || p.type.includes("STAR");
                          return false;
                        }).length;

                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          // Auto-select the newest pattern of this category
                          const matched = sortedPatterns.filter(p => {
                            if (cat.id === "ALL") return true;
                            if (cat.id === "PIN_BAR") return p.type.includes("PIN_BAR");
                            if (cat.id === "ENGULFING") return p.type.includes("ENGULFING");
                            if (cat.id === "DOUBLE") return p.type.includes("DOUBLE");
                            if (cat.id === "HEAD_AND_SHOULDERS") return p.type.includes("HEAD_AND_SHOULDERS") || p.type.includes("STAR");
                            return false;
                          });
                          if (matched.length > 0) {
                            selectPatternForChallenge(matched[matched.length - 1]);
                          }
                        }}
                        className={`px-3 py-1.5 sm:py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer min-h-[32px] sm:min-h-0 ${
                          selectedCategory === cat.id
                            ? "bg-white border-white text-black font-black border"
                            : "bg-transparent border border-transparent hover:border-neutral-800 text-slate-400"
                        }`}
                      >
                        {cat.label} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Horizontal or compact box to click on specific pattern events - ALL NAMES HIDDEN FOR ZERO ANSWER LEAKAGE */}
              <div className="bg-[#0a0a0d] border border-neutral-800 rounded-none p-2">
                <span className="text-[9px] font-bold text-slate-500 block mb-1.5 uppercase tracking-wider font-mono">
                  自选历史未知信号点（防泄题盲测）：
                </span>
                {filteredInstances.length === 0 ? (
                  <div className="text-[10px] text-slate-500 py-1 font-mono">当前分类下暂无形态数据</div>
                ) : (
                  <div className="flex flex-wrap gap-1 max-h-[105px] overflow-y-auto pr-1">
                    {filteredInstances.map((p, index) => {
                      const isSelected = activePattern?.id === p.id;
                      const dateStr = getPatternDateStr(p);
                      let tTag = "";
                      if (p.id === sortedPatterns[sortedPatterns.length - 1].id) {
                        tTag = "t-1 最新";
                      } else if (sortedPatterns.length >= 2 && p.id === sortedPatterns[sortedPatterns.length - 2].id) {
                        tTag = "t-2 次新";
                      }

                      return (
                        <button
                          key={p.id}
                          onClick={() => selectPatternForChallenge(p)}
                          className={`px-3 py-1.5 sm:py-1 text-[10px] rounded-md border transition-all flex items-center gap-1.5 cursor-pointer min-h-[36px] sm:min-h-0 ${
                            isSelected
                              ? "bg-white border-white text-black font-black"
                              : "bg-black border-neutral-800 hover:border-white text-slate-300"
                          }`}
                        >
                          {tTag && (
                            <span className="bg-amber-500/15 text-amber-400 border border-amber-500/25 text-[8px] font-extrabold px-1 rounded-none leading-none">
                              {tTag}
                            </span>
                          )}
                          <span className="text-slate-500 font-mono text-[9px]">{dateStr}</span>
                          <span className="font-medium text-slate-200">信号 #{filteredInstances.length - index}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Price Action Chart component */}
        <PriceActionChart
          candles={visibleChallengeCandles}
          patterns={activePattern ? [{ 
            ...activePattern, 
            type: isAnswered ? activePattern.type : "PENDING_SIGNAL",
            name: isAnswered ? activePattern.name : "待判信号",
            candleIndices: activePattern.candleIndices.map(i => i - Math.max(0, cutoffIndex - 70)) 
          }] : []}
          zones={zones}
          trend={{ direction: "SIDEWAYS", strength: 50, labels: [] }}
          selectedPattern={activePattern ? { 
            ...activePattern, 
            type: isAnswered ? activePattern.type : "PENDING_SIGNAL",
            name: isAnswered ? activePattern.name : "待判信号",
            candleIndices: activePattern.candleIndices.map(i => i - Math.max(0, cutoffIndex - 70)) 
          } : null}
          onSelectPattern={() => {}}
          showPatterns={true}
          showZones={showZones}
          showTrends={false}
          showVolume={true}
          focusIndex={visibleChallengeCandles.length - 1} // Center on cutoff bar
          isChineseStyle={isChineseStyle}
          isChallengeMode={true}
        />
      </div>

      {/* Column 2: Interactive Questionnaire Area (Right side) */}
      <div className="lg:col-span-1 h-full flex flex-col">
        <div className="bg-[#050508] border border-neutral-900 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col justify-between flex-1 min-h-[460px] lg:max-h-[calc(100vh-220px)] xl:max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-none">
          
          <div className="space-y-5">
            {/* Merged Sleek Header with Title, Subtitle, and Score Badge */}
            <div className="flex flex-row items-center justify-between gap-3 pb-2">
              <div className="flex items-center gap-2.5 text-left min-w-0">
                {/* Custom candlestick visual graphic */}
                <div className="flex items-center gap-1 shrink-0 p-1.5 bg-neutral-950/80 border border-neutral-900 rounded-lg">
                  <div className="flex flex-col items-center">
                    <div className="w-[1.5px] h-1.5 bg-emerald-500/80" />
                    <div className="w-2 h-4 bg-emerald-500/60 rounded-[1px]" />
                    <div className="w-[1.5px] h-1.5 bg-emerald-500/80" />
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-[1.5px] h-2 bg-rose-500/80" />
                    <div className="w-2 h-5 bg-rose-500/60 rounded-[1px]" />
                    <div className="w-[1.5px] h-1 bg-rose-500/80" />
                  </div>
                </div>

                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-black text-white tracking-wide flex items-center gap-1.5">
                    裸K实战对抗
                  </h4>
                  <p className="text-[10px] text-neutral-400 leading-normal font-sans">
                    屏蔽信号右侧 K 线，研判未来发力方向
                  </p>
                </div>
              </div>

              {/* Dynamic Winrate Score Pill in Cyan (Softer / elegant color) */}
              <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-1 pr-3 flex items-center gap-2 select-none shrink-0 shadow-lg">
                <div className="bg-gradient-to-r from-cyan-500/85 to-teal-500/85 rounded-xl px-2.5 py-1 text-white text-[10px] font-black shadow-[0_0_12px_rgba(6,182,212,0.15)] shrink-0">
                  {winPercent}%
                </div>
                
                <div className="flex flex-col justify-center text-left">
                  <span className="text-[8px] text-neutral-500 uppercase font-bold tracking-wider leading-none">胜率</span>
                  <span className="text-[11px] font-mono font-black text-white mt-1 leading-none">
                    {quizScore.wins}<span className="text-neutral-600 font-normal"> / </span>{quizScore.total}
                  </span>
                </div>
              </div>
            </div>

            {activePattern && (
              <div className="space-y-4">
                {/* Instruction / Information Cards: Rounded, elegant, breathing room */}
                <div className="rounded-2xl p-4 bg-neutral-950/60 border border-neutral-900/80 shadow-[0_4px_20px_rgba(0,0,0,0.2)] text-left space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-neutral-200 uppercase tracking-wider font-sans">
                      {isAnswered ? activePattern.name : "未知价格行为信号"}
                    </span>
                    <span className="text-[10px] bg-neutral-900 border border-neutral-800/80 text-neutral-400 px-2 py-0.5 rounded-full font-bold font-mono">
                      {isAnswered ? `$${activePattern.price}` : "位置: 信号收盘点"}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed font-sans font-medium">
                    {isAnswered ? activePattern.description : "最右侧 K 线为信号 K 线。请结合历史走势与支撑压力水位，研判未来的发力方向。"}
                  </p>
                </div>

                {/* Answer status / Results ribbon and Next Challenge button */}
                {isAnswered && (
                  <div className="space-y-3 animate-fade-in text-left">
                    <div className={`p-4 rounded-2xl border flex items-start gap-3 shadow-md ${
                      selectedOption === "SKIP"
                        ? "bg-neutral-950/60 border-neutral-800 text-slate-300"
                        : selectedOption === correctAns 
                          ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                          : "bg-rose-500/5 border-rose-500/20 text-rose-400"
                    }`}>
                      {selectedOption === "SKIP" ? (
                        <Eye className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      ) : selectedOption === correctAns ? (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <h5 className="text-xs font-black tracking-wide">
                          {selectedOption === "SKIP" 
                            ? "选择空仓观望（不计入总胜率）" 
                            : selectedOption === correctAns 
                              ? "决策完美！预案符合真实走向" 
                              : "判断偏差！市场做出了相反的选择"}
                        </h5>
                        <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed font-sans">
                          {selectedOption === "SKIP"
                            ? `本次待定。真实突破方向为：${correctAns === "LONG" ? "突破多单 (Long Breakout)" : "跌破空单 (Short Breakdown)"}。`
                            : `真实突破方向为：${correctAns === "LONG" ? "突破多单 (Long Breakout)" : "跌破空单 (Short Breakdown)"}。`}
                        </p>
                      </div>
                    </div>

                    {/* Primary CTA button */}
                    <button
                      onClick={() => {
                        const matched = sortedPatterns.filter(p => {
                          if (selectedCategory === "ALL") return true;
                          if (selectedCategory === "PIN_BAR") return p.type.includes("PIN_BAR");
                          if (selectedCategory === "ENGULFING") return p.type.includes("ENGULFING");
                          if (selectedCategory === "DOUBLE") return p.type.includes("DOUBLE");
                          if (selectedCategory === "HEAD_AND_SHOULDERS") return p.type.includes("HEAD_AND_SHOULDERS") || p.type.includes("STAR");
                          return false;
                        });
                        if (matched.length > 0) {
                          const rand = matched[Math.floor(Math.random() * matched.length)];
                          selectPatternForChallenge(rand);
                        } else {
                          setupNewChallenge(false);
                        }
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black font-black transition-all duration-200 flex items-center justify-center gap-1.5 shadow-lg shadow-white/5 cursor-pointer text-xs min-h-[38px]"
                    >
                      下一场实战对抗
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Option list */}
                <div className="space-y-3 pt-1">
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider text-left font-sans">
                    {isAnswered ? "决策对账单:" : "请给出你的交易决策预案:"}
                  </p>
                  
                  {/* Option A: LONG (Green theme / Emerald) */}
                  <button 
                    onClick={() => handleAnswerSubmit("LONG")}
                    disabled={isAnswered}
                    className={`w-full rounded-2xl border text-left flex items-center gap-3.5 transition-all duration-300 relative overflow-hidden ${
                      isAnswered
                        ? correctAns === "LONG"
                          ? "p-4 bg-emerald-950/20 border-emerald-500/30 text-emerald-400"
                          : selectedOption === "LONG"
                            ? "p-4 bg-rose-950/15 border-rose-500/30 text-rose-400"
                            : "p-4 bg-transparent border-neutral-900 text-neutral-600 opacity-30"
                        : "p-4 bg-[#050507] border-neutral-900 hover:border-emerald-500/40 hover:bg-emerald-950/5 text-neutral-200 cursor-pointer group hover:scale-[1.01] shadow-sm hover:shadow-md"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl border shrink-0 transition-colors duration-200 ${
                      isAnswered && correctAns === "LONG"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : isAnswered && selectedOption === "LONG" && correctAns !== "LONG"
                          ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                          : "bg-neutral-950/80 border-neutral-800 group-hover:border-emerald-500/30 group-hover:text-emerald-400 text-neutral-400"
                    }`}>
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <h5 className="text-xs sm:text-sm font-black tracking-wide text-white">突破多单 (Long Breakout)</h5>
                      <p className={`text-[10px] mt-0.5 leading-relaxed truncate ${
                        isAnswered && correctAns === "LONG" ? "text-emerald-400/70" : "text-neutral-500"
                      }`}>
                        在信号 K 线最高点上方挂多单，预计上涨。
                      </p>
                    </div>
                    {isAnswered && correctAns === "LONG" && <Check className="w-4.5 h-4.5 text-emerald-400 shrink-0" />}
                    {isAnswered && selectedOption === "LONG" && correctAns !== "LONG" && <X className="w-4.5 h-4.5 text-rose-400 shrink-0" />}
                  </button>

                  {/* Option B: SHORT (Red theme / Rose) */}
                  <button
                    onClick={() => handleAnswerSubmit("SHORT")}
                    disabled={isAnswered}
                    className={`w-full rounded-2xl border text-left flex items-center gap-3.5 transition-all duration-300 relative overflow-hidden ${
                      isAnswered
                        ? correctAns === "SHORT"
                          ? "p-4 bg-emerald-950/20 border-emerald-500/30 text-emerald-400"
                          : selectedOption === "SHORT"
                            ? "p-4 bg-rose-950/15 border-rose-500/30 text-rose-400"
                            : "p-4 bg-transparent border-neutral-900 text-neutral-600 opacity-30"
                        : "p-4 bg-[#050507] border-neutral-900 hover:border-rose-500/40 hover:bg-rose-950/5 text-neutral-200 cursor-pointer group hover:scale-[1.01] shadow-sm hover:shadow-md"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl border shrink-0 transition-colors duration-200 ${
                      isAnswered && correctAns === "SHORT"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : isAnswered && selectedOption === "SHORT" && correctAns !== "SHORT"
                          ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                          : "bg-neutral-950/80 border-neutral-800 group-hover:border-rose-500/30 group-hover:text-rose-400 text-neutral-400"
                    }`}>
                      <TrendingDown className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <h5 className="text-xs sm:text-sm font-black tracking-wide text-white">跌破空单 (Short Breakdown)</h5>
                      <p className={`text-[10px] mt-0.5 leading-relaxed truncate ${
                        isAnswered && correctAns === "SHORT" ? "text-emerald-400/70" : "text-neutral-500"
                      }`}>
                        在信号 K 线最低点下方挂空单，预计下行。
                      </p>
                    </div>
                    {isAnswered && correctAns === "SHORT" && <Check className="w-4.5 h-4.5 text-emerald-400 shrink-0" />}
                    {isAnswered && selectedOption === "SHORT" && correctAns !== "SHORT" && <X className="w-4.5 h-4.5 text-rose-400 shrink-0" />}
                  </button>

                  {/* Option C: SKIP (Neutral theme / Slate Blue) */}
                  <button
                    onClick={() => handleAnswerSubmit("SKIP")}
                    disabled={isAnswered}
                    className={`w-full rounded-2xl border text-left flex items-center gap-3.5 transition-all duration-300 relative overflow-hidden ${
                      isAnswered
                        ? selectedOption === "SKIP"
                          ? "p-4 bg-neutral-900/40 border-neutral-800 text-slate-400"
                          : "p-4 bg-transparent border-neutral-900 text-neutral-600 opacity-30"
                        : "p-4 bg-[#050507] border-neutral-900 hover:border-slate-500/45 hover:bg-slate-950/10 text-neutral-200 cursor-pointer group hover:scale-[1.01] shadow-sm hover:shadow-md"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl border shrink-0 transition-colors duration-200 ${
                      isAnswered && selectedOption === "SKIP"
                        ? "bg-neutral-800 border-neutral-700 text-slate-300"
                        : "bg-neutral-950/80 border-neutral-800 group-hover:border-slate-500/30 group-hover:text-slate-300 text-neutral-400"
                    }`}>
                      <Coins className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <h5 className="text-xs sm:text-sm font-black tracking-wide text-white">空仓观望 / 不确定 (Stay Cash)</h5>
                      <p className="text-[10px] mt-0.5 text-neutral-500 leading-relaxed truncate">
                        不确定未来方向，选择跳过此信号。不计入胜率。
                      </p>
                    </div>
                    {isAnswered && selectedOption === "SKIP" && <Eye className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Commentary Area */}
          {isAnswered && activePattern && (
            <div className="mt-4 pt-4 border-t border-neutral-900 animate-fade-in text-left">
              <div className="p-3.5 bg-neutral-950/60 border border-neutral-900/80 rounded-2xl">
                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider font-sans">微观博弈机制 (Order Flow):</p>
                <p className="text-[10px] text-neutral-400 mt-1.5 leading-relaxed font-sans font-medium">
                  {correctAns === "LONG" 
                    ? "看涨结构：信号 K 线下方买盘托底，空方压制无力。一旦突破高点，大量空头止损买单与多头追涨盘交织，爆发上涨行情。"
                    : "看跌结构：高位抛压明显，多头无意接盘。一旦跌破最低点，大批多头止损盘与市场抢跑单齐出，助推价格快速下坠。"}
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

