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
  ChevronRight
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

        return (
          <div className="bg-black border border-neutral-800 rounded-none p-5 shadow-2xl text-left transition-all relative">
            <h4 className="text-xs font-semibold text-slate-100 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-white font-medium tracking-widest font-mono uppercase">
                <Layers className="w-3.5 h-3.5 text-white" />
                支撑与阻力
              </span>
              
              {/* Hoverable Information Tag */}
              <div className="relative group/tag">
                <span className="text-[9px] bg-neutral-900 text-white px-2 py-0.5 rounded-none font-mono border border-neutral-700 font-bold flex items-center gap-1 cursor-help">
                  {zoneMeta.tag}
                  <Info className="w-2.5 h-2.5 text-white" />
                </span>
                
                {/* Tooltip on Hover */}
                <div className="absolute right-0 top-full mt-1.5 w-60 p-2.5 bg-[#08090d] border border-neutral-700 text-[10px] text-slate-300 rounded-none shadow-2xl z-50 pointer-events-none opacity-0 group-hover/tag:opacity-100 transition-opacity duration-200 leading-normal">
                  {zoneMeta.desc}
                </div>
              </div>
            </h4>

            <div className="grid grid-cols-2 gap-2 mt-4">
              {zones.length === 0 ? (
                <p className="col-span-2 text-[10px] text-slate-500 text-center py-4 font-mono">
                  暂未检测到筹码共识关键位，平移图表即可触发计算
                </p>
              ) : (
                zones.slice(0, 4).map(z => {
                  const isSupport = z.type === "support";
                  const isResistance = z.type === "resistance";
                  return (
                    <div
                      key={z.id}
                      className={`p-3 rounded-none border text-center transition-all ${
                        isSupport
                          ? "bg-black border-[var(--up-color)] text-[var(--up-color)] shadow-sm"
                          : isResistance
                            ? "bg-black border-[var(--down-color)] text-[var(--down-color)] shadow-sm"
                            : "bg-black border-neutral-800 text-slate-200"
                      }`}
                    >
                      <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider font-mono">
                        {z.type === "flip" ? "多空互换" : z.type === "support" ? "买方支撑" : "卖方阻力"}
                      </p>
                      <h5 className="text-xs font-mono font-bold mt-1 text-white">${z.price}</h5>
                      <p className="text-[8px] text-slate-400 font-mono mt-0.5 opacity-80">
                        共识触碰: {z.strength} 次
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* 2. Quantitative Insights Panel */}
      <div className="bg-black border border-neutral-800 rounded-none p-5 shadow-2xl flex flex-col gap-4 text-left transition-all">
        
        {/* Title */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 tracking-widest text-white uppercase font-mono">
            <Activity className="w-3.5 h-3.5 text-white" />
            价格行为诊断
          </h4>
        </div>

        {activeFocus ? (
          <div className="flex flex-col gap-3 relative">
            
            {/* Metadata Badges */}
            <div className="flex items-center justify-between bg-neutral-950 px-3 py-2 border border-neutral-900 rounded-lg">
              <div className="flex flex-col">
                <span className="text-[8px] text-slate-500 uppercase tracking-wider font-mono">
                  信号置信度
                </span>
                <span className="text-xs font-mono font-bold text-yellow-500 mt-0.5">
                  {Math.round(activeFocus.confidence * 100)}%
                </span>
              </div>
              <div className="text-right">
                <span className="text-[8px] text-slate-500 uppercase tracking-wider font-mono">
                  关键临界价
                </span>
                <span className="text-xs font-mono font-bold text-white block mt-0.5">
                  ${activeFocus.price}
                </span>
              </div>
            </div>

            {/* Structure Description */}
            <div className="border border-neutral-900 bg-neutral-950/30 p-3 rounded-lg flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-[8px] text-slate-400 font-mono">
                  {activeFocus.type}
                </span>
                <span className="text-[8px] text-slate-500 font-mono">
                  ({activeFocus.candleIndices.length}根K线)
                </span>
              </div>
              
              <h3 className="text-xs font-bold text-white font-mono leading-tight">
                {getPatternDisplayLabel(activeFocus.type, activeFocus.name)}
              </h3>

              {/* Click trigger report button */}
              <button
                onClick={() => setShowLocalDiag(true)}
                className="mt-1 w-full py-2 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-slate-200 hover:text-white rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer flex items-center justify-between"
              >
                <span className="flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                  查看形态详情与多空分析
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>

            {showLocalDiag && (
              <DiagnosticModal
                pattern={activeFocus}
                onClose={() => setShowLocalDiag(false)}
              />
            )}

          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 flex flex-col items-center justify-center font-mono">
            <HelpCircle className="w-8 h-8 text-slate-800 mb-2" />
            <p className="text-xs">未选定 K 线价格行为结构</p>
            <p className="text-[9px] text-slate-500 mt-1.5 leading-normal max-w-xs mx-auto">在左侧主图表中点击带标记 of K 线区域，即可载入该位置的多空博弈诊断数据</p>
          </div>
        )}

      </div>

      {/* 3. Detected Pattern Waves */}
      <div className="bg-black border border-neutral-800 rounded-none p-5 shadow-2xl flex flex-col gap-4 text-left transition-all">
        
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 text-white tracking-widest uppercase font-mono">
            <Search className="w-3.5 h-3.5 text-white" />
            历史信号监测
          </h4>
          <button
            onClick={onTriggerSync}
            disabled={syncing}
            className="px-3 py-2 sm:py-1 rounded-none bg-black hover:bg-neutral-900 active:scale-[0.98] text-white font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-1 text-[10px] sm:text-[9px] border border-neutral-700 cursor-pointer min-h-[44px] sm:min-h-0"
            title="拉取最新 SPX 真实K线"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "同步中" : "同步数据"}
          </button>
        </div>



        {patterns.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <p className="text-xs">暂未捕捉到高置信度多空信号</p>
            <p className="text-[9px] text-slate-600 mt-1">请尝试平移或缩放图表，或切换到“日K”载入大周期结构</p>
          </div>
        ) : (
          <div className="space-y-2">
            
            {/* Scrollable Container with restricted height to match layout seamlessly without empty spaces */}
            <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2 font-mono">
              {/* Show Top Signals */}
              {(showAllBehaviors ? patterns : topObservations).map(p => {
                const isSel = activeFocus?.id === p.id;
                const isBullish = p.type.includes("BULLISH") || p.type.includes("BOTTOM") || p.type.includes("MORNING") || p.type.includes("FLAG_BULLISH") || p.type.includes("DOUBLE_BOTTOM");
                const isBearish = p.type.includes("BEARISH") || p.type.includes("TOP") || p.type.includes("EVENING") || p.type.includes("FLAG_BEARISH") || p.type.includes("DOUBLE_TOP") || p.type.includes("HEAD_AND_SHOULDERS");
                
                let accentColor = "text-[#eab308]";
                let leftBorder = "border-l-amber-500";
                if (isBullish) {
                  accentColor = "text-[var(--up-color)]";
                  leftBorder = "border-l-[var(--up-color)]";
                } else if (isBearish) {
                  accentColor = "text-[var(--down-color)]";
                  leftBorder = "border-l-[var(--down-color)]";
                }

                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectPattern(p)}
                    className={`p-3.5 text-left cursor-pointer transition-all flex items-center justify-between rounded-none border text-xs gap-3 ${
                      isSel
                        ? "bg-neutral-900 border-white border-l-[4px] " + leftBorder + " shadow-md"
                        : "bg-black border-neutral-800 hover:bg-neutral-900 hover:border-white"
                    }`}
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-1.5 justify-start">
                        <span className="font-bold text-white truncate text-left font-mono">
                          {getPatternDisplayLabel(p.type, p.name)}
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono mt-1 flex items-center gap-1.5 justify-start">
                        <span>临界价: ${p.price}</span>
                        <span>·</span>
                        <span className={`${accentColor} font-bold`}>权重: {Math.round(p.confidence * 100)}%</span>
                      </div>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-white shrink-0 opacity-80" />
                  </div>
                );
              })}
            </div>

            {/* Toggle Show All Collapsible Button */}
            {patterns.length > 4 && (
              <button
                onClick={() => setShowAllBehaviors(!showAllBehaviors)}
                className="w-full py-2.5 sm:py-2 border border-dashed border-neutral-800 hover:border-white text-slate-400 hover:text-white text-[10px] font-mono rounded-none transition-all flex items-center justify-center gap-1 cursor-pointer mt-1 min-h-[44px] sm:min-h-0"
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
