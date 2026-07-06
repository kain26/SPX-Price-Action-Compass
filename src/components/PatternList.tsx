import React, { useState } from "react";
import { DetectedPattern, SupportResistanceZone, MarketTrend } from "../types.js";
import { 
  RefreshCw, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpRight,
  Activity,
  Layers,
  Search,
  Filter,
  Check,
  Info,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight
} from "lucide-react";
import DiagnosticModal from "./DiagnosticModal.tsx";

const PATTERN_CATEGORIES = [
  { val: "ALL", label: "全部形态" },
  { val: "PIN_BAR", label: "针形 K线 (Pin Bar)" },
  { val: "ENGULFING", label: "吞没 K线 (Engulfing)" },
  { val: "STAR", label: "星体反转 (Star)" },
  { val: "DOJI", label: "十字星 (Doji)" },
  { val: "DOUBLE", label: "双顶双底 (Double)" },
  { val: "HEAD_SHOULDERS", label: "头肩结构 (H&S)" },
  { val: "TRIANGLE", label: "收敛整理 (Triangle)" },
];

interface PatternListProps {
  patterns: DetectedPattern[];
  allPatterns: DetectedPattern[];
  patternFilters: string[];
  setPatternFilters: React.Dispatch<React.SetStateAction<string[]>>;
  showPatterns: boolean;
  setShowPatterns: (show: boolean) => void;
  zones: SupportResistanceZone[];
  trend: MarketTrend;
  selectedPattern: DetectedPattern | null;
  onSelectPattern: (pattern: DetectedPattern | null) => void;
  onTriggerSync: () => void;
  syncing: boolean;
  lastUpdated: string;
  timeframe?: string;
  candles?: any[];
  isChineseStyle?: boolean;
  quizScore: { wins: number; total: number };
  setQuizScore: React.Dispatch<React.SetStateAction<{ wins: number; total: number }>>;
  setActiveTab: (tab: "review" | "challenge") => void;
}

// Convert structure types into clinical, standard quantitative jargon
const getPatternDisplayLabel = (type: string, name: string): string => {
  switch (type) {
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
    default: return name.split(" (")[0];
  }
};

export default function PatternList({
  patterns,
  allPatterns,
  patternFilters,
  setPatternFilters,
  showPatterns,
  setShowPatterns,
  zones,
  trend,
  selectedPattern,
  onSelectPattern,
  onTriggerSync,
  syncing,
  lastUpdated,
  timeframe,
  candles,
  isChineseStyle,
  quizScore,
  setQuizScore,
  setActiveTab,
}: PatternListProps) {
  
  const [showAllBehaviors, setShowAllBehaviors] = useState(false);
  const [showLocalDiag, setShowLocalDiag] = useState(false);

  // Sort and select top patterns based on confidence for "Today's Lessons"
  const topObservations = [...patterns]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);

  // Active educational focus (use selected pattern or fallback to highest confidence one)
  const activeFocus = selectedPattern || topObservations[0] || null;

  return (
    <div className="flex flex-col gap-6 h-full font-sans select-none">
      
      {/* 1. Key Support & Resistance Levels Summary (Moved to top by User Request) */}
      {(() => {
        const getZonePeriodLabel = () => {
          switch (timeframe) {
            case "1d": return { tag: "500天大周期共识", desc: "基于过去 500 个交易日的关键波段高低点聚合，属于中长期强效多空筹码密集防区。" };
            case "4h": return { tag: "300根 K线共识", desc: "基于过去 300 根 4小时K线的波段价格极值，适合寻找大波段支撑压力拐点。" };
            case "15m": return { tag: "200根 K线共识", desc: "基于过去 200 根 15分钟K线的多空对峙区，属于隔夜/日内共振支撑阻力。" };
            case "5m": return { tag: "150根 K线共识", desc: "基于过去 150 根 5分钟K线（约单交易日内时段）的关键多空换手密集分布。" };
            case "1m": return { tag: "390根 K线共识", desc: "基于过去 390 根 1分钟K线（极精细高频），属于微观多空前线白刃战防区。" };
            default: return { tag: "21天共识", desc: "基于过去 21 个交易日的关键结构高低点聚合，属于中长期强效筹码密集区。" };
          }
        };
        const zoneMeta = getZonePeriodLabel();
        const maxStrength = zones.length > 0 ? Math.max(...zones.map(z => z.strength), 6) : 6;

        return (
          <div className="bg-[#050507] border border-neutral-900 rounded-2xl p-4 sm:p-5 shadow-[0_4px_30px_rgba(0,0,0,0.4)] text-left relative overflow-hidden">
            {/* Background glowing effects for premium look */}
            <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-neutral-700 to-transparent opacity-60" />

            <h4 className="text-xs sm:text-sm font-bold text-white mb-3 sm:mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-white font-space uppercase tracking-wider">
                {/* Custom candlestick icon for visual distinction */}
                <div className="flex items-center gap-[3px] shrink-0 select-none">
                  <div className="w-[3.5px] h-3.5 bg-white/20 relative flex items-center justify-center">
                    <div className="w-[7.5px] h-1.5 bg-[#00c805] absolute" />
                  </div>
                  <div className="w-[3.5px] h-3.5 bg-white/20 relative flex items-center justify-center">
                    <div className="w-[7.5px] h-2.5 bg-[#ff3b30] absolute" />
                  </div>
                </div>
                支撑与压力
              </span>
              
              {/* Hoverable Information Tag */}
              <div className="relative group/tag">
                <span className="text-[10px] sm:text-xs bg-teal-950/45 border border-teal-500/60 shadow-[0_0_12px_rgba(20,184,166,0.15)] text-teal-300 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 cursor-help tracking-wide transition-all hover:bg-teal-900/60">
                  {zoneMeta.tag}
                  <Info className="w-3 h-3 text-teal-300" />
                </span>
                
                {/* Tooltip on Hover */}
                <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-[#0a0a0f] border border-neutral-800 text-[11px] text-neutral-300 rounded-xl shadow-2xl z-50 pointer-events-none opacity-0 group-hover/tag:opacity-100 transition-opacity duration-200 leading-relaxed font-sans">
                  {zoneMeta.desc}
                </div>
              </div>
            </h4>

            <div className="grid grid-cols-2 gap-3 mt-2 sm:mt-4">
              {zones.length === 0 ? (
                <div className="col-span-2 text-[11px] text-neutral-400 text-center py-6 font-mono border border-dashed border-neutral-800 rounded-xl bg-neutral-900/10">
                  暂未检测到筹码共识关键位，平移图表即可触发计算
                </div>
              ) : (
                (() => {
                  // Put first resistance in Top-Left (slot 0), first support in Bottom-Left (slot 2)
                  const firstResistance = zones.find(z => z.type === "resistance");
                  const firstSupport = zones.find(z => z.type === "support");
                  
                  const remaining = zones.filter(
                    z => z.id !== firstResistance?.id && z.id !== firstSupport?.id
                  );

                  let rIdx = 0;
                  const slot0 = firstResistance || remaining[rIdx++];
                  const slot1 = remaining[rIdx++];
                  const slot2 = firstSupport || remaining[rIdx++];
                  const slot3 = remaining[rIdx++];

                  const orderedGrid = [slot0, slot1, slot2, slot3].filter((item): item is typeof zones[0] => !!item);

                  return orderedGrid.map(z => {
                    const isSupport = z.type === "support";
                    const isResistance = z.type === "resistance";
                    const isFlip = z.type === "flip" || (!isSupport && !isResistance);
                    
                    // Progress width percentage
                    const progressWidthPct = Math.min((z.strength / maxStrength) * 100, 100);

                    // Setup specific styles
                    let bgClass = "bg-cyan-50/95";
                    let textAccentClass = "text-cyan-700";
                    let priceColorClass = "text-cyan-800";
                    let fillBarClass = "bg-cyan-600";
                    let trackBarClass = "bg-cyan-100";
                    let titleText = "多空互换";
                    let iconElement = <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-600 shrink-0" strokeWidth={3} />;

                    if (isSupport) {
                      bgClass = "bg-emerald-50/95";
                      textAccentClass = "text-emerald-700";
                      priceColorClass = "text-emerald-800";
                      fillBarClass = "bg-emerald-600";
                      trackBarClass = "bg-emerald-100";
                      titleText = "买方支撑";
                      iconElement = <ArrowUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" strokeWidth={3} />;
                    } else if (isResistance) {
                      bgClass = "bg-rose-50/95";
                      textAccentClass = "text-rose-700";
                      priceColorClass = "text-rose-800";
                      fillBarClass = "bg-rose-600";
                      trackBarClass = "bg-rose-100";
                      titleText = "卖方压力";
                      iconElement = <ArrowDown className="w-3.5 h-3.5 text-rose-600 shrink-0" strokeWidth={3} />;
                    }

                    return (
                      <div
                        key={z.id}
                        className={`p-3.5 rounded-2xl ${bgClass} text-left flex flex-col justify-between shadow-[0_8px_20px_rgba(0,0,0,0.12)] border border-white/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_24px_rgba(255,255,255,0.05)]`}
                      >
                        <div>
                          {/* Header with Icon and Label */}
                          <div className="flex items-center gap-1.5 mb-1.5">
                            {iconElement}
                            <span className="text-[11px] sm:text-xs font-black font-sans tracking-wide text-neutral-800 uppercase">
                              {titleText}
                            </span>
                          </div>

                          {/* Price display - extremely bold and high recognition */}
                          <h5 className={`text-base sm:text-2xl font-mono font-black tracking-tight ${priceColorClass}`}>
                            ${z.price.toFixed(2)}
                          </h5>
                        </div>

                        {/* Consensus times and elegant progress bar */}
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold font-sans text-neutral-600 mb-1">
                            <span>共识: {z.strength}次</span>
                            <span>{Math.round(progressWidthPct)}%</span>
                          </div>
                          <div className={`h-1.5 w-full ${trackBarClass} rounded-full overflow-hidden`}>
                            <div
                              className={`h-full ${fillBarClass} rounded-full transition-all duration-500`}
                              style={{ width: `${progressWidthPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        );
      })()}

      {/* 2. Active Focus Pattern Banner (Moved from main chart column to here) */}
      {(() => {
        if (!activeFocus) return null;

        const displayLabel = getPatternDisplayLabel(activeFocus.type, activeFocus.name);

        const isBullish = activeFocus.type.includes("BULLISH") || 
                          activeFocus.type.includes("BOTTOM") || 
                          activeFocus.type === "MORNING_STAR" ||
                          activeFocus.type.includes("ASCENDING");

        const isBearish = activeFocus.type.includes("BEARISH") || 
                          activeFocus.type.includes("TOP") || 
                          activeFocus.type === "EVENING_STAR" ||
                          activeFocus.type === "HEAD_AND_SHOULDERS" ||
                          activeFocus.type.includes("DESCENDING");

        const upColor = isChineseStyle ? "#ff3b30" : "#00c805";
        const downColor = isChineseStyle ? "#00c805" : "#ff3b30";

        const activeColor = isBullish ? upColor : isBearish ? downColor : "#06b6d4";
        const activeColorBg = isBullish 
          ? (isChineseStyle ? "bg-rose-950/20" : "bg-emerald-950/20") 
          : isBearish 
            ? (isChineseStyle ? "bg-emerald-950/20" : "bg-rose-950/20") 
            : "bg-cyan-950/20";
        const activeColorBorder = isBullish 
          ? (isChineseStyle ? "border-rose-900/50" : "border-emerald-900/50") 
          : isBearish 
            ? (isChineseStyle ? "border-emerald-900/50" : "border-rose-900/50") 
            : "border-cyan-900/50";
        const activeTextColor = isBullish 
          ? (isChineseStyle ? "text-rose-400" : "text-emerald-400") 
          : isBearish 
            ? (isChineseStyle ? "text-emerald-400" : "text-rose-400") 
            : "text-cyan-400";

        return (
          <>
            <button
              onClick={() => setShowLocalDiag(true)}
              className={`w-full text-left p-4 rounded-2xl bg-[#050507] border border-neutral-900 ${activeColorBg} ${activeColorBorder} shadow-[0_4px_24px_rgba(0,0,0,0.3)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_24px_rgba(255,255,255,0.02)] cursor-pointer group relative overflow-hidden`}
              style={{ borderLeft: `4px solid ${activeColor}` }}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white font-space">
                    <span className="flex h-2.5 w-2.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: activeColor }} />
                    形态识别
                  </span>
                  
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeTextColor} border border-current/20 font-space bg-black/40`}>
                    ACTIVE
                  </span>
                </div>

                <h4 className="text-sm sm:text-base font-black text-white font-sans tracking-wide">
                  {displayLabel}
                </h4>

                <div className="flex items-center gap-3.5 text-xs text-neutral-400 font-mono mt-0.5">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-neutral-500 uppercase tracking-wider">置信度</span>
                    <span className="text-amber-500 font-bold">{Math.round(activeFocus.confidence * 100)}%</span>
                  </div>
                  <div className="h-6 w-[1px] bg-neutral-800" />
                  <div className="flex flex-col">
                    <span className="text-[9px] text-neutral-500 uppercase tracking-wider">参考价</span>
                    <span className="text-neutral-200 font-bold">${activeFocus.price.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-neutral-900/60 flex items-center justify-between text-xs font-bold text-white/80 group-hover:text-white transition-colors">
                  <span className="text-[11px] tracking-wide">查看形态详解与操作指南</span>
                  <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" style={{ color: activeColor }} />
                </div>
              </div>
            </button>

            {showLocalDiag && (
              <DiagnosticModal
                pattern={activeFocus}
                onClose={() => setShowLocalDiag(false)}
                candles={candles}
                isChineseStyle={isChineseStyle}
              />
            )}
          </>
        );
      })()}

      {/* 2.5. Challenge Mode Quick Access Card (User Request: "把这个放在右边，支持阻力下面") */}
      {(() => {
        const winPercent = quizScore.total > 0 ? Math.round((quizScore.wins / quizScore.total) * 100) : 0;
        const radius = 16;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (winPercent / 100) * circumference;

        return (
          <button
            onClick={() => setActiveTab("challenge")}
            className="w-full text-left p-4 rounded-2xl bg-[#050507] border border-neutral-900 shadow-[0_4px_24px_rgba(0,0,0,0.3)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_24px_rgba(255,255,255,0.02)] cursor-pointer group relative overflow-hidden flex items-center justify-between gap-3"
          >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-bold text-white font-space uppercase tracking-wider mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                裸K实战对抗
              </span>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans pr-1">
                屏蔽形态信号右侧 K 线，研判下一步发力方向
              </p>
              
              <div className="mt-2.5 flex items-center gap-1 text-[10px] font-bold text-cyan-400 uppercase tracking-wide group-hover:text-cyan-300 transition-colors">
                <span>进入实战模拟</span>
                <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </div>

            {/* Circular Winrate Stat Dial */}
            <div className="flex items-center gap-3 bg-neutral-950/60 border border-neutral-900 px-3 py-2 rounded-xl shrink-0">
              <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                <svg className="w-10 h-10 transform -rotate-90">
                  {/* Background Track */}
                  <circle
                    cx="20"
                    cy="20"
                    r={radius}
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="3"
                    fill="transparent"
                  />
                  {/* Glowing Colored Indicator */}
                  <circle
                    cx="20"
                    cy="20"
                    r={radius}
                    stroke="#06b6d4"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <span className="absolute text-[10px] font-black font-mono text-white">
                  {winPercent}%
                </span>
              </div>

              <div className="flex flex-col text-left justify-center select-none shrink-0">
                <span className="text-[8px] sm:text-[9px] text-neutral-500 font-bold uppercase tracking-wider">胜率得分</span>
                <span className="text-xs sm:text-xs font-black font-mono text-white tracking-wide mt-0.5">
                  {quizScore.wins} <span className="text-neutral-600 font-normal">/</span> {quizScore.total}
                </span>
              </div>
            </div>
          </button>
        );
      })()}


      {/* 3. Detected Pattern Waves */}
      <div className="bg-black border border-neutral-800 rounded-none p-3 sm:p-5 shadow-2xl flex-1 flex flex-col gap-3 sm:gap-4 text-left transition-all">
        
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2 sm:pb-3">
          <h4 className="text-[10px] sm:text-xs font-bold text-slate-100 flex items-center gap-1 sm:gap-1.5 text-white tracking-widest uppercase font-mono">
            <Search className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-white" />
            历史信号监测
          </h4>
          <button
            onClick={onTriggerSync}
            disabled={syncing}
            className="px-2 sm:px-3 py-1.5 sm:py-1 rounded-none bg-black hover:bg-neutral-900 active:scale-[0.98] text-white font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-1 text-[9px] sm:text-[9px] border border-neutral-700 cursor-pointer min-h-[36px] sm:min-h-0"
            title="拉取最新 SPX 真实K线"
          >
            <RefreshCw className={`w-2 h-2 sm:w-2.5 sm:h-2.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "同步中" : "同步数据"}
          </button>
        </div>



        {patterns.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <p className="text-xs">暂未捕捉到高置信度多空信号</p>
            <p className="text-[9px] text-slate-600 mt-1">请尝试平移或缩放图表，或切换到“日K”载入大周期结构</p>
          </div>
        ) : (
          <div className="space-y-2 flex-1 flex flex-col min-h-0">
            
            {/* Scrollable Container with restricted height to match layout seamlessly without empty spaces */}
            <div className="flex-1 min-h-[150px] lg:max-h-[calc(100vh-420px)] overflow-y-auto pr-1 space-y-2 font-mono">
              {/* Show Top Signals */}
              {(showAllBehaviors ? patterns : topObservations).map(p => {
                const isSel = activeFocus?.id === p.id;
                const isBullish = p.type.includes("BULLISH") || p.type.includes("BOTTOM") || p.type.includes("MORNING") || p.type.includes("FLAG_BULLISH") || p.type.includes("DOUBLE_BOTTOM");
                const isBearish = p.type.includes("BEARISH") || p.type.includes("TOP") || p.type.includes("EVENING") || p.type.includes("FLAG_BEARISH") || p.type.includes("DOUBLE_TOP") || p.type.includes("HEAD_AND_SHOULDERS");
                
                let accentColor = "text-[#eab308]";
                let leftBorder = "border-l-amber-500";
                if (isBullish) {
                  accentColor = "text-[#00c805]";
                  leftBorder = "border-l-[#00c805]";
                } else if (isBearish) {
                  accentColor = "text-[#ff3b30]";
                  leftBorder = "border-l-[#ff3b30]";
                }

                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectPattern(p)}
                    className={`p-2 sm:p-3.5 text-left cursor-pointer transition-all flex items-center justify-between rounded-none border text-[11px] sm:text-xs gap-2 sm:gap-3 ${
                      isSel
                        ? "bg-neutral-900 border-white border-l-[4px] " + leftBorder + " shadow-md"
                        : "bg-black border-neutral-800 hover:bg-neutral-900 hover:border-white"
                    }`}
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-1 sm:gap-1.5 justify-start">
                        <span className="font-bold text-white truncate text-left font-mono">
                          {getPatternDisplayLabel(p.type, p.name)}
                        </span>
                      </div>
                      <div className="text-[8px] sm:text-[9px] text-slate-400 font-mono mt-0.5 sm:mt-1 flex items-center gap-1 sm:gap-1.5 justify-start">
                        <span>临界价: ${p.price}</span>
                        <span>·</span>
                        <span className={`${accentColor} font-bold`}>权重: {Math.round(p.confidence * 100)}%</span>
                      </div>
                    </div>
                    <ArrowUpRight className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-white shrink-0 opacity-80" />
                  </div>
                );
              })}
            </div>

            {/* Toggle Show All Collapsible Button */}
            {patterns.length > 4 && (
              <button
                onClick={() => setShowAllBehaviors(!showAllBehaviors)}
                className="w-full py-2 sm:py-2 border border-dashed border-neutral-800 hover:border-white text-slate-400 hover:text-white text-[9px] sm:text-[10px] font-mono rounded-none transition-all flex items-center justify-center gap-1 cursor-pointer mt-1 min-h-[36px] sm:min-h-0"
              >
                {showAllBehaviors ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    <span>收起其他过滤信号 ({patterns.length - 4})</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    <span>展开其余诊断信号 ({patterns.length - 4})</span>
                  </>
                )}
              </button>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
