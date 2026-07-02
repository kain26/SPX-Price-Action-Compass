import React, { useState, useEffect } from "react";
import { Candle, DetectedPattern, PatternType } from "../types.js";
import { Award, Eye, Play, Sparkles, Check, X, HelpCircle, ArrowRight } from "lucide-react";
import PriceActionChart from "./PriceActionChart.tsx";

interface ChallengeModeProps {
  candles: Candle[];
  patterns: DetectedPattern[];
  zones: any[];
  trend: any;
}

export default function ChallengeMode({ candles, patterns, zones, trend }: ChallengeModeProps) {
  // Filter only high quality / recognizable patterns to test the user on
  const challengePatterns = patterns.filter(p => 
    p.type.includes("PIN_BAR") || 
    p.type.includes("ENGULFING") || 
    p.type.includes("DOUBLE") || 
    p.type.includes("HEAD_AND_SHOULDERS")
  );

  const [activePattern, setActivePattern] = useState<DetectedPattern | null>(null);
  const [cutoffIndex, setCutoffIndex] = useState<number>(-1);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [quizScore, setQuizScore] = useState<{ wins: number; total: number }>({ wins: 0, total: 0 });
  const [revealFuture, setRevealFuture] = useState<boolean>(false);

  // Set up a new challenge
  const setupNewChallenge = () => {
    if (challengePatterns.length === 0) return;

    // Pick a random pattern
    const randPattern = challengePatterns[Math.floor(Math.random() * challengePatterns.length)];
    setActivePattern(randPattern);

    // Find the end index of the pattern (the signal bar)
    const patternEndIdx = Math.max(...randPattern.candleIndices);
    setCutoffIndex(patternEndIdx);

    // Reset states
    setSelectedOption(null);
    setIsAnswered(false);
    setRevealFuture(false);
  };

  useEffect(() => {
    if (challengePatterns.length > 0 && !activePattern) {
      setupNewChallenge();
    }
  }, [challengePatterns]);

  if (challengePatterns.length === 0) {
    return (
      <div className="h-[480px] flex flex-col items-center justify-center bg-[#0a0b0e] border border-slate-800 rounded-2xl text-slate-400 p-8 text-center">
        <HelpCircle className="w-10 h-10 text-slate-700 mb-3 animate-pulse" />
        <h4 className="font-bold text-slate-100 text-sm">暂无可供挑战的形态</h4>
        <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
          交互复盘需要当前数据源包含 Pin Bar, 吞没, 双底/双顶等反转型价格形态。
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white cursor-pointer transition-colors"
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

  // Determine correct choice
  const getCorrectAnswer = (): "LONG" | "SHORT" | "NONE" => {
    if (!activePattern) return "NONE";
    const t = activePattern.type;
    
    if (t.includes("BULLISH") || t.includes("BOTTOM") || t.includes("MORNING")) {
      return "LONG";
    }
    if (t.includes("BEARISH") || t.includes("TOP") || t.includes("EVENING")) {
      return "SHORT";
    }
    return "NONE";
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      
      {/* Column 1: Chart Canvas Area (Left side) */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        
        {/* Score & Header info - Sleek, flat, borderless inline layout */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 py-1">
          <div className="text-left">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              裸K实战对抗训练 <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-lg font-normal">Blind Sandbox</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">盲盒式实盘训练，屏蔽形态信号右侧 K 线，训练你的裸K盘感</p>
          </div>
          
          <div className="flex items-center gap-2.5 self-start sm:self-center bg-[#0d0e12]/80 border border-slate-800 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider font-mono">训练得分</span>
            <span className="text-xs font-mono font-bold text-[#00c805]">
              胜率: {quizScore.total > 0 ? Math.round((quizScore.wins / quizScore.total) * 100) : 0}%
              <span className="text-slate-500 font-normal ml-1">({quizScore.wins}/{quizScore.total})</span>
            </span>
          </div>
        </div>

        {/* Price Action Chart component */}
        <PriceActionChart
          candles={visibleChallengeCandles}
          patterns={activePattern ? [{ ...activePattern, candleIndices: activePattern.candleIndices.map(i => i - Math.max(0, cutoffIndex - 70)) }] : []}
          zones={[]}
          trend={{ direction: "SIDEWAYS", strength: 50, labels: [] }}
          selectedPattern={activePattern ? { ...activePattern, candleIndices: activePattern.candleIndices.map(i => i - Math.max(0, cutoffIndex - 70)) } : null}
          onSelectPattern={() => {}}
          showPatterns={true}
          showZones={false}
          showTrends={false}
          showVolume={true}
          focusIndex={visibleChallengeCandles.length - 1} // Center on cutoff bar
        />
        
        {/* Clean borderless guide text block */}
        <div className="px-1 text-left text-[11px] text-slate-500 leading-relaxed flex gap-2">
          <Sparkles className="w-4 h-4 text-[#00c805] shrink-0 mt-0.5" />
          <p>
            <b>提示:</b> 图表最右侧最后一根 K 线即为<b>形态信号K线 (Signal Bar)</b>。由于未来数据被遮蔽，你需要观察它前面的蜡烛图振幅、是否发生过关键压力支撑位的长影线假突破、当前吞没力度，从而预判价格的下一步发力方向。
          </p>
        </div>
      </div>

      {/* Column 2: Interactive Questionnaire Area (Right side) */}
      <div className="lg:col-span-1 h-full">
        <div className="bg-[#0c0d10] border border-[#1e222d] rounded-2xl p-5 shadow-xl flex flex-col justify-between h-full min-h-[460px]">
          
          <div>
            {/* Flat Header inside Sidecard */}
            <div className="flex items-center justify-between gap-2 border-b border-[#1e222d] pb-3.5 mb-5">
              <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-blue-400" />
                交易方案决策 (Quiz Box)
              </h4>
              <span className="text-[9px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-mono font-bold border border-amber-500/25">
                ACTIVE
              </span>
            </div>

            {activePattern && (
              <div className="space-y-5">
                {/* Clean, unnested details block */}
                <div className="text-left">
                  <div className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">当前标注形态</div>
                  <h4 className="text-sm font-bold text-blue-400 mt-1 flex items-center gap-2">
                    {activePattern.name}
                    <span className="text-[10px] bg-neutral-900 text-slate-400 px-2 py-0.5 rounded font-mono border border-[#1e222d]">
                      ${activePattern.price}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">{activePattern.desc}</p>
                </div>

                {/* Flat Option Buttons */}
                <div className="space-y-3 pt-2">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-left">请给出你的交易决策预案:</p>
                  
                  {/* Option A: LONG */}
                  <button 
                    onClick={() => handleAnswerSubmit("LONG")}
                    disabled={isAnswered}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isAnswered
                        ? correctAns === "LONG"
                          ? "bg-[#00c805]/10 border-[#00c805] text-[#00c805]"
                          : selectedOption === "LONG"
                            ? "bg-[#ff3b30]/10 border-[#ff3b30] text-[#ff3b30]"
                            : "bg-transparent border-[#1e222d]/60 text-slate-600"
                        : "bg-[#050608] border-[#1e222d] hover:border-[#00c805] hover:bg-[#00c805]/5 text-slate-200"
                    }`}
                  >
                    <div className="flex flex-col pr-2">
                      <span className="text-xs font-bold">方案 A: 突破多单 (Long Breakout)</span>
                      <span className="text-[10px] opacity-75 mt-0.5 text-slate-400">在信号 K 线高点上方挂多单，预判反转上涨。</span>
                    </div>
                    {isAnswered && correctAns === "LONG" && <Check className="w-5 h-5 text-[#00c805] shrink-0" />}
                    {isAnswered && selectedOption === "LONG" && correctAns !== "LONG" && <X className="w-5 h-5 text-[#ff3b30] shrink-0" />}
                  </button>

                  {/* Option B: SHORT */}
                  <button
                    onClick={() => handleAnswerSubmit("SHORT")}
                    disabled={isAnswered}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isAnswered
                        ? correctAns === "SHORT"
                          ? "bg-[#00c805]/10 border-[#00c805] text-[#00c805]"
                          : selectedOption === "SHORT"
                            ? "bg-[#ff3b30]/10 border-[#ff3b30] text-[#ff3b30]"
                            : "bg-transparent border-[#1e222d]/60 text-slate-600"
                        : "bg-[#050608] border-[#1e222d] hover:border-[#ff3b30] hover:bg-[#ff3b30]/5 text-slate-200"
                    }`}
                  >
                    <div className="flex flex-col pr-2">
                      <span className="text-xs font-bold">方案 B: 跌破空单 (Short Breakdown)</span>
                      <span className="text-[10px] opacity-75 mt-0.5 text-slate-400">在信号 K 线低点下方挂空单，预判顺势下泄。</span>
                    </div>
                    {isAnswered && correctAns === "SHORT" && <Check className="w-5 h-5 text-[#00c805] shrink-0" />}
                    {isAnswered && selectedOption === "SHORT" && correctAns !== "SHORT" && <X className="w-5 h-5 text-[#ff3b30] shrink-0" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Dynamic Status & Next Question */}
          <div className="mt-6 pt-4 border-t border-[#1e222d]/60">
            {isAnswered ? (
              <div className="space-y-4 animate-fade-in text-left">
                {/* Flat, cohesive results ribbon */}
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  selectedOption === correctAns 
                    ? "bg-[#00c805]/5 border-[#00c805]/20 text-[#00c805]" 
                    : "bg-[#ff3b30]/5 border-[#ff3b30]/20 text-[#ff3b30]"
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

                {/* Flat commentary text (no heavy inner dark box) */}
                <div className="px-1 text-left">
                  <p className="text-[9px] text-[#00c805] font-bold uppercase tracking-wider font-mono">形态复盘心理学：</p>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    {correctAns === "LONG" 
                      ? "看涨形态。信号K线下方聚集了海量买盘（体现为长下影线或阳线吞没），空头多次打压失败，在突破信号K线高点时不得不进行被迫止损或空头回补，最终引发多头爆发。"
                      : "看跌形态。高位压制或连续冲高失败，表明上方供应巨大。跌破信号K线低点触发了大量多头头寸的多米诺骨牌式止损踩踏，造成极速下跌。"}
                  </p>
                </div>

                <button
                  onClick={setupNewChallenge}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#00c805] hover:opacity-95 active:scale-[0.98] text-black font-extrabold font-sans transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-[#00c805]/10 cursor-pointer text-xs"
                >
                  下一场实战对抗
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-6 text-slate-500">
                <Eye className="w-6 h-6 text-slate-700 mb-2 animate-bounce" />
                <p className="text-[11px]">请在上方做出你的交易决策</p>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
