import React, { useState, useEffect } from "react";
import { Candle, DetectedPattern, PatternType } from "../types.js";
import { Award, Eye, Play, Sparkles, Check, X, HelpCircle, ArrowRight, Target, Filter, ChevronDown, ChevronUp } from "lucide-react";
import PriceActionChart from "./PriceActionChart.tsx";

interface ChallengeModeProps {
  candles: Candle[];
  patterns: DetectedPattern[];
  zones: any[];
  trend: any;
  isChineseStyle?: boolean;
}

const CATEGORIES = [
  { id: "ALL", label: "全部实战样本" },
  { id: "PIN_BAR", label: "Pin Bar 系列" },
  { id: "ENGULFING", label: "吞没 K线系列" },
  { id: "DOUBLE", label: "双底/双顶系列" },
  { id: "HEAD_AND_SHOULDERS", label: "星体/头肩系列" }
];

export default function ChallengeMode({ candles, patterns, zones, trend, isChineseStyle = false }: ChallengeModeProps) {
  // Filter only high quality / recognizable patterns to test the user on
  const challengePatterns = patterns.filter(p => 
    p.type.includes("PIN_BAR") || 
    p.type.includes("ENGULFING") || 
    p.type.includes("DOUBLE") || 
    p.type.includes("HEAD_AND_SHOULDERS") ||
    p.type.includes("STAR")
  );

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
  const [quizScore, setQuizScore] = useState<{ wins: number; total: number }>({ wins: 0, total: 0 });
  const [revealFuture, setRevealFuture] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

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
    
    let triggered: "LONG" | "SHORT" | null = null;
    for (const c of futureCandles) {
      if (c.high > highTrigger && c.low < lowTrigger) {
        // Outside day: use the close price direction relative to trigger close
        triggered = c.close > signalCandle.close ? "LONG" : "SHORT";
        break;
      } else if (c.high > highTrigger) {
        triggered = "LONG";
        break;
      } else if (c.low < lowTrigger) {
        triggered = "SHORT";
        break;
      }
    }
    
    if (!triggered) {
      // Fallback: look at the general trend of the last future candle relative to signal candle
      const lastFutureCandle = futureCandles[futureCandles.length - 1];
      triggered = lastFutureCandle.close >= signalCandle.close ? "LONG" : "SHORT";
    }
    
    return triggered;
  };

  const handleAnswerSubmit = (option: "LONG" | "SHORT" | "NONE") => {
    if (isAnswered) return;
    
    setSelectedOption(option);
    setIsAnswered(true);
    setRevealFuture(true); // Auto-reveal future bars when answered!

    const correctAns = getCorrectAnswer();
    const isCorrect = option === correctAns;

    setQuizScore(prev => ({
      wins: isCorrect ? prev.wins + 1 : prev.wins,
      total: prev.total + 1
    }));
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start select-none">
      
      {/* Column 1: Chart Canvas Area & Practice Selector (Left side) */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        
        {/* Score & Header info - Sleek, flat, borderless inline layout with premium circular stat */}
        <div className="flex flex-row items-center justify-between gap-3 px-1 py-1">
          <div className="text-left flex-1 min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2 font-mono uppercase tracking-widest">
              裸K实战对抗
            </h3>
            <p className="text-xs text-slate-500 mt-1 truncate">屏蔽形态信号右侧 K 线，研判下一步发力方向</p>
          </div>
          
          <div className="flex items-center gap-3 bg-[#0d0d11] border border-neutral-800/80 p-2 pl-3 pr-3.5 rounded-xl shrink-0">
            <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
              <svg className="w-10 h-10 transform -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r={radius}
                  stroke="#1c1c24"
                  strokeWidth="3"
                  fill="transparent"
                />
                <circle
                  cx="20"
                  cy="20"
                  r={radius}
                  stroke={quizScore.total > 0 ? "#00c805" : "#3b3b4f"}
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <span className="absolute text-[9px] font-mono font-black text-white">
                {winPercent}%
              </span>
            </div>
            
            <div className="flex flex-col justify-center text-left">
              <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-wider font-mono">胜率得分</span>
              <span className="text-xs font-mono font-bold text-white leading-none mt-1">
                {quizScore.wins} <span className="text-neutral-500 text-[10px] font-normal">/ {quizScore.total}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Targeted Practice Selector Panel */}
        <div className="bg-black border border-neutral-800 rounded-none p-4 flex flex-col gap-3 text-left">
          {/* Row 1: Fast Mode Selection & Quick t-1/t-2 & Toggleable Advanced Picker */}
          <div className="flex flex-row items-center justify-between gap-2 overflow-x-auto no-scrollbar w-full whitespace-nowrap">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono shrink-0">
                模式：
              </span>
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

            <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-auto">
              总形态: <span className="text-slate-300 font-bold">{challengePatterns.length}</span>
            </span>
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
                          <span className="text-slate-500 font-mono text-[9px]">${Math.round(p.price)}</span>
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
          zones={[]}
          trend={{ direction: "SIDEWAYS", strength: 50, labels: [] }}
          selectedPattern={activePattern ? { 
            ...activePattern, 
            type: isAnswered ? activePattern.type : "PENDING_SIGNAL",
            name: isAnswered ? activePattern.name : "待判信号",
            candleIndices: activePattern.candleIndices.map(i => i - Math.max(0, cutoffIndex - 70)) 
          } : null}
          onSelectPattern={() => {}}
          showPatterns={true}
          showZones={false}
          showTrends={false}
          showVolume={true}
          focusIndex={visibleChallengeCandles.length - 1} // Center on cutoff bar
          isChineseStyle={isChineseStyle}
        />
        
        {/* Clean borderless guide text block */}
        <div className="px-1 text-left text-[11px] text-slate-500 leading-relaxed flex gap-2 font-mono">
          <Sparkles className="w-4 h-4 text-white shrink-0 mt-0.5" />
          <p>
            <b>提示:</b> 图表最右侧最后一根 K 线即为<b>形态信号K线 (Signal Bar)</b>。由于未来数据被遮蔽，你需要观察前面的蜡烛图振幅、是否发生关键支撑阻力位的假突破，从而研判下一步发力方向。
          </p>
        </div>
      </div>

      {/* Column 2: Interactive Questionnaire Area (Right side) */}
      <div className="lg:col-span-1 h-full">
        <div className="bg-black border border-neutral-800 rounded-none p-5 shadow-xl flex flex-col justify-between h-full min-h-[460px]">
          
          <div>
            {/* Flat Header inside Sidecard */}
            <div className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-3.5 mb-5">
              <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 font-mono uppercase tracking-widest">
                <HelpCircle className="w-4 h-4 text-white" />
                交易决策
              </h4>
            </div>

            {activePattern && (
              <div className="space-y-5">
                {/* Clean, unnested details block */}
                <div className="text-left font-mono">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider">
                    {isAnswered ? "形态解析" : "实战待决信号"}
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 flex items-center gap-2">
                    {isAnswered ? activePattern.name : "未知价格行为信号"}
                    <span className="text-[10px] bg-[#0d0d11] text-slate-400 px-2 py-0.5 rounded-none font-mono border border-neutral-800">
                      {isAnswered ? `$${activePattern.price}` : "位置: 信号收盘点"}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-2.5 leading-relaxed font-sans">
                    {isAnswered 
                      ? activePattern.description 
                      : "请研判左侧信号 K 线 (Signal Bar) 附近的价格行为。结合上方支撑阻力以及量价表现，在下方给出你的多空挂单突破决策。答题后将实时复盘并揭晓裸K形态和机构订单流逻辑。"}
                  </p>
                </div>

                {/* Flat Option Buttons */}
                <div className="space-y-3 pt-2 font-sans">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-left font-mono">请给出你的交易决策预案:</p>
                  
                  {/* Option A: LONG */}
                  <button 
                    onClick={() => handleAnswerSubmit("LONG")}
                    disabled={isAnswered}
                    className={`w-full p-3.5 rounded-none border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isAnswered
                        ? correctAns === "LONG"
                          ? "bg-[#00c805]/10 border-[#00c805] text-[#00c805]"
                          : selectedOption === "LONG"
                            ? "bg-[#ff3b30]/10 border-[#ff3b30] text-[#ff3b30]"
                            : "bg-transparent border-neutral-900 text-slate-600"
                        : "bg-black border-neutral-800 hover:border-white hover:bg-neutral-900 text-slate-200"
                    }`}
                  >
                    <div className="flex flex-col pr-2">
                      <span className="text-xs font-bold">突破多单 (Long Breakout)</span>
                      <span className="text-[10px] opacity-75 mt-0.5 text-slate-400">在信号 K 线高点上方挂多单，预判上涨。</span>
                    </div>
                    {isAnswered && correctAns === "LONG" && <Check className="w-4 h-4 text-[#00c805] shrink-0" />}
                    {isAnswered && selectedOption === "LONG" && correctAns !== "LONG" && <X className="w-4 h-4 text-[#ff3b30] shrink-0" />}
                  </button>

                  {/* Option B: SHORT */}
                  <button
                    onClick={() => handleAnswerSubmit("SHORT")}
                    disabled={isAnswered}
                    className={`w-full p-3.5 rounded-none border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isAnswered
                        ? correctAns === "SHORT"
                          ? "bg-[#00c805]/10 border-[#00c805] text-[#00c805]"
                          : selectedOption === "SHORT"
                            ? "bg-[#ff3b30]/10 border-[#ff3b30] text-[#ff3b30]"
                            : "bg-transparent border-neutral-900 text-slate-600"
                        : "bg-black border-neutral-800 hover:border-white hover:bg-neutral-900 text-slate-200"
                    }`}
                  >
                    <div className="flex flex-col pr-2">
                      <span className="text-xs font-bold">跌破空单 (Short Breakdown)</span>
                      <span className="text-[10px] opacity-75 mt-0.5 text-slate-400">在信号 K 线低点下方挂空单，预判下行。</span>
                    </div>
                    {isAnswered && correctAns === "SHORT" && <Check className="w-4 h-4 text-[#00c805] shrink-0" />}
                    {isAnswered && selectedOption === "SHORT" && correctAns !== "SHORT" && <X className="w-4 h-4 text-[#ff3b30] shrink-0" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Dynamic Status & Next Question */}
          <div className="mt-6 pt-4 border-t border-neutral-800">
            {isAnswered ? (
              <div className="space-y-4 animate-fade-in text-left">
                {/* Flat, cohesive results ribbon */}
                <div className={`p-3 rounded-none border flex items-start gap-2.5 ${
                  selectedOption === correctAns 
                    ? "bg-[#00c805]/5 border-[#00c805] text-[#00c805]" 
                    : "bg-[#ff3b30]/5 border-[#ff3b30] text-[#ff3b30]"
                }`}>
                  {selectedOption === correctAns ? (
                    <Check className="w-4 h-4 text-[#00c805] shrink-0 mt-0.5" />
                  ) : (
                    <X className="w-4 h-4 text-[#ff3b30] shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h5 className="text-xs font-bold">
                      {selectedOption === correctAns ? "决策完美！预案符合真实走向" : "判断偏差！市场做出了相反的选择"}
                    </h5>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      真实后续行情已拉出，可以通过左侧图表复盘走位。
                    </p>
                  </div>
                </div>

                {/* Flat commentary text */}
                <div className="px-1 text-left font-mono">
                  <p className="text-[9px] text-white font-bold uppercase tracking-wider">微观博弈机制 (Order Flow Dynamics):</p>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed font-sans">
                    {correctAns === "LONG" 
                      ? "看涨结构：信号 K 线下方堆积大额被动买单（表现为下影线或阳线吞没），空方深砸无果。当价格向上刺穿信号 K 线高点时，空头止损买单（Buy Stops）与多头破位追多单合流，形成动能喷发。"
                      : "看跌结构：高位主动卖单不断蚕食多头买盘。当价格跌破信号 K 线低点时，瞬间触发密集的追高多头平仓卖单与多米诺骨牌式的多头保护性止损，从而诱发急剧下行。"}
                  </p>
                </div>

                <button
                  onClick={() => {
                    // Pick a random pattern from currently filtered category, or all
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
                  className="w-full py-2.5 px-4 rounded-md bg-white hover:bg-neutral-200 text-black font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-white/5 cursor-pointer text-xs min-h-[38px]"
                >
                  下一场实战对抗
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-6 text-slate-500 font-mono">
                <Eye className="w-6 h-6 text-slate-700 mb-2 animate-pulse" />
                <p className="text-[11px]">请在上方做出你的交易决策</p>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}

