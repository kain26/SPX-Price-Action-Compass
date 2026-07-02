import React, { useState } from "react";
import { Candle, DetectedPattern } from "../types.js";
import { Sparkles, BookOpen, GraduationCap, Flame, AlertCircle, ArrowUpRight, HelpCircle } from "lucide-react";

interface CoachPanelProps {
  candles: Candle[];
  activePattern: DetectedPattern | null;
}

export default function CoachPanel({ candles, activePattern }: CoachPanelProps) {
  const [activeTab, setActiveTab] = useState<"coach" | "guide">("coach");
  const [analysisText, setAnalysisText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleAskCoach = async () => {
    setLoading(true);
    setError("");
    setAnalysisText("");

    try {
      // Send the latest 100 visible candles to keep payload light and accurate
      const payloadCandles = candles.slice(-100);
      const response = await fetch("/api/coach-analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candles: payloadCandles,
          activePattern,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      setAnalysisText(data.text || "AI Coach returned empty response.");
    } catch (err: any) {
      console.error(err);
      setError("AI 导师分析服务暂时不可用，请稍后再试或检查配置。" + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Static Study Guide Data
  const guideLessons = [
    {
      title: "1. 📌 Pin Bar (锤子线 / 射击之星)",
      type: "K线反转形态",
      signal: "强烈的多空扭转",
      visual: "───┬───  (上影长 = 射击之星)\n   │\n  [ ]    (实体小)\n   │\n───┴───  (下影长 = 锤子线)",
      keyPoints: [
        "拥有长影线和小实体。影线长度通常应大于整根 K 线的 2/3。",
        "长影线代表价格曾经强势冲锋但被对手盘迎头痛击，最终被强势‘拒绝’。",
        "看涨 Pin Bar (锤子线) 发生在支撑位时，是极高概率的买入信号；看跌 Pin Bar (射击之星) 发生在阻力位时则看跌。"
      ],
      tradingTip: "等 Pin Bar 收盘确认后，在下一根 K 线突破 Pin Bar 高点(看涨)或跌破低点(看跌)时入场，止损设在影线最尖端。"
    },
    {
      title: "2. 🔋 吞没形态 (Engulfing)",
      type: "K线反转形态",
      signal: "力量瞬间反转",
      visual: "  [ 阴 ]   [   阳   ]\n  [    ]   [        ]\n  [____]   [        ]\n           [________]",
      keyPoints: [
        "由两根 K 线组成。当前 K 线的实体完全覆盖并超越前一根 K 线的实体。",
        "看涨吞没：在下跌行情中，一根强力的阳线实体完全吞噬前面的阴线实体，代表买方瞬间夺取控制权。",
        "看跌吞没：在上涨行情中，强力阴线实体完全吞噬阳线实体，代表空头宣泄。"
      ],
      tradingTip: "吞没形态实体越饱满、成交量越大，信号越强。可在吞没 K 线收盘时立即入场，或等待小幅回调 50% 实体位置挂单。"
    },
    {
      title: "3. 📦 Inside Bar (内含线)",
      type: "K线持续形态",
      signal: "筹码盘整 / 暴风雨前的宁静",
      visual: " [ 母线 ]  [ 子线 ]\n [      ]  [      ]\n [      ]  [______]\n [______]",
      keyPoints: [
        "当前 K 线（子线）的最高价和最低价，完全包含在前一根 K 线（母线）的价格范围内。",
        "代表市场在此区间波动收缩，成交意愿降低，多空在进行激烈的拉锯和蓄势。",
        "通常预示着即将发生剧烈的单边‘突破’。"
      ],
      tradingTip: "不要在 Inside Bar 内部交易。在母线的最高点上方放置买入限价单，在最低点下方放置卖出限价单。一旦突破，顺势追击。"
    },
    {
      title: "4. 👑 头肩顶与双顶 (M顶/W底)",
      type: "经典图表形态",
      signal: "中长期趋势反转",
      visual: "      [头部]\n    _/\t  \\_\n [左肩]\t    [右肩]\n / \t\t  \\\n--------[颈线]--------",
      keyPoints: [
        "头肩顶：由三个峰组成，中间最高（头部），两侧稍低且高度相近（左右肩）。连接两个低点的线称为‘颈线’。",
        "双顶/双底 (M顶/W底)：价格两次冲击某一关键位置失败，形成双峰并立。意味着原趋势力量枯竭。"
      ],
      tradingTip: "最安全的主动交易法是等待价格跌破(或涨破)颈线并伴随收盘价确立，或者等待突破后回踩颈线遇阻(或支撑)时入场。"
    }
  ];

  return (
    <div className="bg-[#0d0e12] border border-slate-800 rounded-2xl h-full flex flex-col overflow-hidden shadow-xl">
      {/* Tab Selectors */}
      <div className="flex border-b border-slate-800 bg-[#0a0b0e]">
        <button
          onClick={() => setActiveTab("coach")}
          className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "coach"
              ? "text-blue-400 border-b-2 border-blue-500 bg-[#0d0e12]/60"
              : "text-slate-500 hover:text-slate-300 hover:bg-[#0d0e12]/20"
          }`}
        >
          <Sparkles className="w-4.5 h-4.5" />
          AI 价格行为导师
        </button>
        <button
          onClick={() => setActiveTab("guide")}
          className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "guide"
              ? "text-blue-400 border-b-2 border-blue-500 bg-[#0d0e12]/60"
              : "text-slate-500 hover:text-slate-300 hover:bg-[#0d0e12]/20"
          }`}
        >
          <BookOpen className="w-4.5 h-4.5" />
          K线行为自学手册
        </button>
      </div>

      {/* Content Container */}
      <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
        {activeTab === "coach" ? (
          <div className="flex flex-col gap-4 h-full">
            {/* AI Coach intro card */}
            <div className="bg-gradient-to-br from-blue-950/25 to-slate-900/10 border border-blue-900/20 rounded-xl p-4">
              <div className="flex gap-3">
                <GraduationCap className="w-9 h-9 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    SPX 实时 Price Action 教练
                    <span className="text-[8px] bg-blue-500 text-slate-950 px-1 rounded font-bold">PRO</span>
                  </h4>
                  <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                    我会扮演资深的裸 K 行为导师（Bob Volman & Al Brooks 风格）。结合您当前选中的 K 线、支撑区间及当前标注的形态，为你梳理市场多空博弈的底层心理，并给出实战级的入场、止损与出场诊断。
                  </p>
                </div>
              </div>
              
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleAskCoach}
                  disabled={loading}
                  className="w-full py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold font-sans transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  {loading ? "导师正在剖析盘面..." : "请 AI 导师剖析当前图表"}
                </button>
              </div>
            </div>

            {/* Pattern focus banner */}
            {activePattern ? (
              <div className="bg-[#0a0b0e] border border-slate-850 p-3 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <Flame className="w-4.5 h-4.5 text-amber-500" />
                  <div className="text-left">
                    <p className="text-[9px] text-slate-400">当前已选聚焦形态</p>
                    <h5 className="text-xs font-bold text-slate-200 mt-0.5">{activePattern.name}</h5>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900/30">
                  ${activePattern.price}
                </span>
              </div>
            ) : (
              <div className="text-center py-2 px-3 border border-slate-800 border-dashed rounded-xl text-[10px] text-slate-500 flex items-center justify-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-slate-650" />
                提示：在左侧列表中选择一个识别形态，分析将更精准！
              </div>
            )}

            {/* AI Coach Analysis Output */}
            <div className="flex-1 flex flex-col min-h-[220px]">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <div className="relative mb-4">
                    <div className="w-10 h-10 border-t-2 border-blue-500 border-r-2 border-transparent rounded-full animate-spin"></div>
                    <Sparkles className="w-4.5 h-4.5 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <p className="text-xs font-semibold text-slate-300">博弈剖析中...</p>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                    导师正在解构 ${candles[candles.length - 1]?.close.toFixed(1)} 价格处的成交分布与买卖盘挤压状态...
                  </p>
                </div>
              ) : error ? (
                <div className="p-4 bg-rose-950/20 border border-rose-900/30 rounded-xl text-rose-300 text-xs flex gap-2.5 items-start">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{error}</p>
                </div>
              ) : analysisText ? (
                <div className="bg-[#0a0b0e]/80 border border-slate-800 rounded-xl p-4.5 text-left text-slate-300 text-xs leading-relaxed overflow-y-auto max-h-[380px] custom-scrollbar animate-fade-in">
                  <div className="prose prose-invert max-w-none text-xs">
                    {analysisText.split("\n").map((line, idx) => {
                      if (line.startsWith("### ")) {
                        return <h3 key={idx} className="text-sm font-bold text-blue-300 mt-4 mb-2 first:mt-0">{line.replace("### ", "")}</h3>;
                      } else if (line.startsWith("#### ")) {
                        return <h4 key={idx} className="text-xs font-bold text-slate-100 mt-3 mb-1">{line.replace("#### ", "")}</h4>;
                      } else if (line.startsWith("## ")) {
                        return <h2 key={idx} className="text-base font-bold text-blue-400 mt-5 mb-2.5">{line.replace("## ", "")}</h2>;
                      } else if (line.startsWith("- ") || line.startsWith("* ")) {
                        return <li key={idx} className="ml-4 list-disc mt-1">{line.substring(2)}</li>;
                      } else if (line.startsWith("1. ") || line.startsWith("2. ") || line.startsWith("3. ") || line.startsWith("4. ")) {
                        return <div key={idx} className="ml-2 font-semibold text-slate-100 mt-2">{line}</div>;
                      }
                      return <p key={idx} className="mt-1.5 min-h-[1em]">{line}</p>;
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-slate-800/80 rounded-xl text-slate-500">
                  <GraduationCap className="w-10 h-10 text-slate-700 mb-2" />
                  <p className="text-xs">导师处于倾听状态</p>
                  <p className="text-[10px] text-slate-600 mt-1 max-w-[220px]">点击上方“剖析图表”按钮，即可获取专属的裸K与趋势课程</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Static Study Guide Tab */
          <div className="flex flex-col gap-4 text-left">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <GraduationCap className="w-5 h-5 text-blue-400" />
              <h4 className="text-xs font-bold text-slate-100">裸 K 核心价格行为自学宝典</h4>
            </div>

            <div className="space-y-4">
              {guideLessons.map((lesson, idx) => (
                <div key={idx} className="bg-[#0a0b0e] border border-slate-800 rounded-xl overflow-hidden p-4">
                  <div className="flex items-center justify-between gap-2 border-b border-[#0d0e12] pb-2 mb-3">
                    <h5 className="text-xs font-bold text-blue-300">{lesson.title}</h5>
                    <div className="flex gap-1.5">
                      <span className="text-[8px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">
                        {lesson.type}
                      </span>
                      <span className="text-[8px] bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded font-bold border border-blue-900/30">
                        {lesson.signal}
                      </span>
                    </div>
                  </div>

                  {/* ASCII Visualization */}
                  <pre className="bg-[#0d0e12] p-3 rounded-lg text-[10px] font-mono text-slate-400 mb-3 leading-tight overflow-x-auto text-center">
                    {lesson.visual}
                  </pre>

                  <div className="space-y-1.5">
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">形态特征 & 判别要点：</p>
                    {lesson.keyPoints.map((pt, pIdx) => (
                      <p key={pIdx} className="text-[10px] text-slate-300 pl-3 relative leading-relaxed">
                        <span className="absolute left-0 text-blue-500">•</span>
                        {pt}
                      </p>
                    ))}
                  </div>

                  <div className="mt-3.5 p-2.5 bg-blue-950/10 border border-blue-900/20 rounded-lg">
                    <p className="text-[9px] text-blue-400 font-bold flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      实战交易指南 (Trading Tip)：
                    </p>
                    <p className="text-[10px] text-blue-200 mt-1 leading-relaxed">
                      {lesson.tradingTip}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
