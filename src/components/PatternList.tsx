import React from "react";
import { DetectedPattern, SupportResistanceZone, MarketTrend, PatternType } from "../types.js";
import { TrendingUp, TrendingDown, RefreshCw, BarChart2, ShieldAlert, CheckCircle, HelpCircle, Flame } from "lucide-react";

interface PatternListProps {
  patterns: DetectedPattern[];
  zones: SupportResistanceZone[];
  trend: MarketTrend;
  selectedPattern: DetectedPattern | null;
  onSelectPattern: (pattern: DetectedPattern | null) => void;
  onTriggerSync: () => void;
  syncing: boolean;
  lastUpdated: string;
}

export default function PatternList({
  patterns,
  zones,
  trend,
  selectedPattern,
  onSelectPattern,
  onTriggerSync,
  syncing,
  lastUpdated,
}: PatternListProps) {
  
  // Categorize patterns
  const reversals = patterns.filter(
    p => 
      p.type.includes("PIN_BAR") || 
      p.type.includes("ENGULFING") || 
      p.type.includes("STAR") || 
      p.type.includes("DOJI") ||
      p.type.includes("DOUBLE") ||
      p.type.includes("HEAD_AND_SHOULDERS")
  );
  
  const continuations = patterns.filter(
    p => p.type.includes("INSIDE_BAR") || p.type.includes("FLAG") || p.type.includes("TRIANGLE")
  );

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* 2. Detected Price Action Patterns List */}
      <div className="bg-[#0c0d10] border border-[#1e222d] rounded-2xl p-4 shadow-xl flex-1 flex flex-col min-h-[300px]">
        <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center justify-between">
          <span className="tracking-tight flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
            自动识别价格行为 ({patterns.length})
          </span>
          <button
            onClick={onTriggerSync}
            disabled={syncing}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-slate-300 disabled:opacity-50 transition-all flex items-center gap-1 text-[9px] border border-[#1e222d] font-mono cursor-pointer"
            title="手动刷新 SPX 真实行情"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "更新中" : "同步数据"}
          </button>
        </h4>

        {patterns.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <HelpCircle className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-xs">当前周期下暂无明显形态</p>
            <p className="text-[9px] text-slate-600 mt-1">您可以缩放、平移图表或手动切换上方时区拉取更多K线</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto max-h-[480px] pr-1 space-y-4 custom-scrollbar">
            {reversals.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 mb-1 sticky top-0 bg-[#0c0d10] py-1 z-10 uppercase tracking-wider">
                  K线反转与核心形态 (Reversals)
                </p>
                <div className="divide-y divide-[#1e222d]/40">
                  {reversals.map(p => {
                    const isSel = selectedPattern && selectedPattern.id === p.id;
                    const confidencePercent = Math.round(p.confidence * 100);
                    const isBullish = p.type.includes("BULLISH") || p.type.includes("BOTTOM") || p.type.includes("MORNING");
                    const isBearish = p.type.includes("BEARISH") || p.type.includes("TOP") || p.type.includes("EVENING");
                    
                    let dotColor = "bg-amber-500";
                    let indicatorBg = "bg-amber-500/10 text-amber-500";
                    let indicatorText = "整理";
                    
                    if (isBullish) {
                      dotColor = "bg-[#00c805]";
                      indicatorBg = "bg-[#00c805]/10 text-[#00c805]";
                      indicatorText = "多头";
                    } else if (isBearish) {
                      dotColor = "bg-[#ff3b30]";
                      indicatorBg = "bg-[#ff3b30]/10 text-[#ff3b30]";
                      indicatorText = "空头";
                    }

                    return (
                      <div
                        key={p.id}
                        onClick={() => onSelectPattern(p)}
                        className={`py-3.5 px-2.5 text-left cursor-pointer transition-all flex gap-3 relative overflow-hidden rounded-xl border border-transparent ${
                          isSel
                            ? "bg-[#12161a] border-[#1e222d] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]"
                            : "hover:bg-[#12161a]/30"
                        }`}
                      >
                        {/* Robinhood style Left selection indicator line */}
                        {isSel && (
                          <div className={`absolute left-0 top-1 bottom-1 w-[3px] rounded-r ${isBullish ? "bg-[#00c805]" : isBearish ? "bg-[#ff3b30]" : "bg-amber-500"}`} />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                            <span className="text-xs font-semibold text-slate-100 truncate">{p.label}</span>
                          </div>
                          
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {p.description}
                          </p>
                          
                          <div className="flex items-center gap-1.5 mt-2 text-[9px] text-slate-500 font-mono">
                            <span>涉及 {p.candleIndices.length} 根K线</span>
                            <span>·</span>
                            <span>置信度 {confidencePercent}%</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end justify-between shrink-0 text-right min-w-[65px]">
                          <span className="text-xs font-mono font-bold text-slate-100">
                            ${p.price.toFixed(1)}
                          </span>
                          <span className={`text-[8px] font-bold font-sans tracking-wide px-1.5 py-0.5 rounded ${indicatorBg}`}>
                            {indicatorText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {continuations.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-slate-500 mb-1 sticky top-0 bg-[#0c0d10] py-1 z-10 uppercase tracking-wider">
                  盘整突破形态 (Continuations)
                </p>
                <div className="divide-y divide-[#1e222d]/40">
                  {continuations.map(p => {
                    const isSel = selectedPattern && selectedPattern.id === p.id;
                    const confidencePercent = Math.round(p.confidence * 100);
                    const isBullish = p.type.includes("BULLISH") || p.type.includes("BOTTOM") || p.type.includes("MORNING");
                    const isBearish = p.type.includes("BEARISH") || p.type.includes("TOP") || p.type.includes("EVENING");
                    
                    let dotColor = "bg-amber-500";
                    let indicatorBg = "bg-amber-500/10 text-amber-500";
                    let indicatorText = "整理";
                    
                    if (isBullish) {
                      dotColor = "bg-[#00c805]";
                      indicatorBg = "bg-[#00c805]/10 text-[#00c805]";
                      indicatorText = "多头";
                    } else if (isBearish) {
                      dotColor = "bg-[#ff3b30]";
                      indicatorBg = "bg-[#ff3b30]/10 text-[#ff3b30]";
                      indicatorText = "空头";
                    }

                    return (
                      <div
                        key={p.id}
                        onClick={() => onSelectPattern(p)}
                        className={`py-3.5 px-2.5 text-left cursor-pointer transition-all flex gap-3 relative overflow-hidden rounded-xl border border-transparent ${
                          isSel
                            ? "bg-[#12161a] border-[#1e222d] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]"
                            : "hover:bg-[#12161a]/30"
                        }`}
                      >
                        {/* Robinhood style Left selection indicator line */}
                        {isSel && (
                          <div className={`absolute left-0 top-1 bottom-1 w-[3px] rounded-r ${isBullish ? "bg-[#00c805]" : isBearish ? "bg-[#ff3b30]" : "bg-amber-500"}`} />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                            <span className="text-xs font-semibold text-slate-100 truncate">{p.label}</span>
                          </div>
                          
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {p.description}
                          </p>
                          
                          <div className="flex items-center gap-1.5 mt-2 text-[9px] text-slate-500 font-mono">
                            <span>涉及 {p.candleIndices.length} 根K线</span>
                            <span>·</span>
                            <span>置信度 {confidencePercent}%</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end justify-between shrink-0 text-right min-w-[65px]">
                          <span className="text-xs font-mono font-bold text-slate-100">
                            ${p.price.toFixed(1)}
                          </span>
                          <span className={`text-[8px] font-bold font-sans tracking-wide px-1.5 py-0.5 rounded ${indicatorBg}`}>
                            {indicatorText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Key Support & Resistance Levels Summary */}
      <div className="bg-[#0c0d10] border border-[#1e222d] rounded-2xl p-4 shadow-xl">
        <h4 className="text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
          <span>经典支撑/压力关键位 (Zones)</span>
          <span className="text-[9px] bg-[#00c805]/10 text-[#00c805] px-1.5 py-0.5 rounded font-mono border border-[#00c805]/20">
            21天统计
          </span>
        </h4>
        <p className="text-[9px] text-slate-500 mb-3.5 leading-tight">
          基于过去 21 个交易日的关键结构高低点聚合，属于中长期强效筹码密集区。
        </p>

        <div className="grid grid-cols-2 gap-2">
          {zones.length === 0 ? (
            <p className="col-span-2 text-[10px] text-slate-500 text-center py-2">
              暂未检测到共识关键位，平移图表试试
            </p>
          ) : (
            zones.slice(0, 4).map(z => {
              const isSupport = z.type === "support";
              const isResistance = z.type === "resistance";
              return (
                <div
                  key={z.id}
                  className={`p-2 rounded-xl border text-center ${
                    isSupport
                      ? "bg-[#00c805]/5 border-[#00c805]/20 text-[#00c805]"
                      : isResistance
                        ? "bg-[#ff3b30]/5 border-[#ff3b30]/20 text-[#ff3b30]"
                        : "bg-neutral-900 border-neutral-800 text-slate-450"
                  }`}
                >
                  <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">
                    {z.type === "flip" ? "互换(FLIP)" : z.type}
                  </p>
                  <h5 className="text-xs font-mono font-bold mt-0.5">${z.price}</h5>
                  <p className="text-[8px] text-slate-500 font-mono mt-0.5">
                    有效触碰: {z.strength} 次
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
