import React from "react";
import { DetectedPattern } from "../types.js";
import { X, ShieldAlert, TrendingUp, Sparkles, AlertCircle, CheckCircle } from "lucide-react";

interface DiagnosticModalProps {
  pattern: DetectedPattern;
  onClose: () => void;
}

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

function PatternDiagram({ type }: { type: string }) {
  if (type.includes("PIN_BAR_BULLISH")) {
    return (
      <div className="flex items-center justify-center gap-6 py-5 bg-neutral-900/60 rounded-xl border border-neutral-800">
        <div className="flex flex-col items-center">
          <div className="text-[9px] text-slate-500 font-mono mb-2">前序跌势</div>
          <div className="flex flex-col items-center h-16 w-8 justify-center">
            <div className="w-0.5 h-2 bg-red-500/50" />
            <div className="w-3 h-5 bg-red-500/20 border border-red-500/50" />
            <div className="w-0.5 h-2 bg-red-500/50" />
          </div>
        </div>
        <div className="text-sm text-neutral-600 font-mono">→</div>
        <div className="flex flex-col items-center">
          <div className="text-[9px] text-emerald-400 font-mono mb-2">看涨 Pin Bar (锤子线)</div>
          <div className="flex flex-col items-center h-16 w-8 justify-start">
            <div className="w-0.5 h-1 bg-emerald-500" />
            <div className="w-4 h-3 bg-emerald-500 border border-emerald-400" />
            <div className="w-0.5 h-10 bg-emerald-500" />
          </div>
        </div>
      </div>
    );
  }

  if (type.includes("PIN_BAR_BEARISH")) {
    return (
      <div className="flex items-center justify-center gap-6 py-5 bg-neutral-900/60 rounded-xl border border-neutral-800">
        <div className="flex flex-col items-center">
          <div className="text-[9px] text-slate-500 font-mono mb-2">前序涨势</div>
          <div className="flex flex-col items-center h-16 w-8 justify-center">
            <div className="w-0.5 h-2 bg-emerald-500/50" />
            <div className="w-3 h-5 bg-emerald-500/20 border border-emerald-500/50" />
            <div className="w-0.5 h-2 bg-emerald-500/50" />
          </div>
        </div>
        <div className="text-sm text-neutral-600 font-mono">→</div>
        <div className="flex flex-col items-center">
          <div className="text-[9px] text-red-400 font-mono mb-2">看跌 Pin Bar (流星线)</div>
          <div className="flex flex-col items-center h-16 w-8 justify-end">
            <div className="w-0.5 h-10 bg-red-500" />
            <div className="w-4 h-3 bg-red-500 border border-red-400" />
            <div className="w-0.5 h-1 bg-red-500" />
          </div>
        </div>
      </div>
    );
  }

  if (type.includes("ENGULFING_BULLISH")) {
    return (
      <div className="flex items-center justify-center gap-6 py-5 bg-neutral-900/60 rounded-xl border border-neutral-800">
        <div className="flex flex-col items-center">
          <div className="text-[9px] text-red-400 font-mono mb-2">1. 跌势阴线</div>
          <div className="flex flex-col items-center h-16 w-8 justify-center">
            <div className="w-0.5 h-2 bg-red-500" />
            <div className="w-4 h-6 bg-red-500 border border-red-400" />
            <div className="w-0.5 h-2 bg-red-500" />
          </div>
        </div>
        <div className="text-sm text-neutral-600 font-mono">+</div>
        <div className="flex flex-col items-center">
          <div className="text-[9px] text-emerald-400 font-mono mb-2">2. 强势反吞没</div>
          <div className="flex flex-col items-center h-16 w-8 justify-center">
            <div className="w-0.5 h-1 bg-emerald-500" />
            <div className="w-5 h-12 bg-emerald-500 border border-emerald-400" />
            <div className="w-0.5 h-1 bg-emerald-500" />
          </div>
        </div>
      </div>
    );
  }

  if (type.includes("ENGULFING_BEARISH")) {
    return (
      <div className="flex items-center justify-center gap-6 py-5 bg-neutral-900/60 rounded-xl border border-neutral-800">
        <div className="flex flex-col items-center">
          <div className="text-[9px] text-emerald-400 font-mono mb-2">1. 升势阳线</div>
          <div className="flex flex-col items-center h-16 w-8 justify-center">
            <div className="w-0.5 h-2 bg-emerald-500" />
            <div className="w-4 h-6 bg-emerald-500 border border-emerald-400" />
            <div className="w-0.5 h-2 bg-emerald-500" />
          </div>
        </div>
        <div className="text-sm text-neutral-600 font-mono">+</div>
        <div className="flex flex-col items-center">
          <div className="text-[9px] text-red-400 font-mono mb-2">2. 强势覆吞没</div>
          <div className="flex flex-col items-center h-16 w-8 justify-center">
            <div className="w-0.5 h-1 bg-red-500" />
            <div className="w-5 h-12 bg-red-500 border border-red-400" />
            <div className="w-0.5 h-1 bg-red-500" />
          </div>
        </div>
      </div>
    );
  }

  if (type.includes("STAR") || type.includes("MORNING") || type.includes("EVENING")) {
    const isBullish = type.includes("BULLISH") || type.includes("MORNING");
    return (
      <div className="flex items-center justify-center gap-4 py-5 bg-neutral-900/60 rounded-xl border border-neutral-800">
        <div className="flex flex-col items-center">
          <div className="text-[8px] text-slate-500 font-mono mb-1">1. 单向趋势</div>
          <div className={`w-3.5 h-10 ${isBullish ? "bg-red-500" : "bg-emerald-500"}`} />
        </div>
        <div className="flex flex-col items-center">
          <div className="text-[8px] text-slate-400 font-mono mb-1">2. 十字/孕星</div>
          <div className="w-2.5 h-2.5 bg-neutral-700 mt-4" />
        </div>
        <div className="flex flex-col items-center">
          <div className="text-[8px] text-emerald-400 font-mono mb-1">3. 绝地反击</div>
          <div className={`w-3.5 h-10 ${isBullish ? "bg-emerald-500" : "bg-red-500"}`} />
        </div>
      </div>
    );
  }

  // Generic fallback
  return (
    <div className="flex flex-col items-center justify-center py-5 bg-neutral-900/60 rounded-xl border border-neutral-800">
      <div className="w-32 h-12 flex items-end justify-center gap-1.5">
        <div className="w-2 h-6 bg-red-500/40" />
        <div className="w-2 h-10 bg-emerald-500" />
        <div className="w-2 h-8 bg-neutral-800" />
      </div>
      <div className="text-[8px] text-slate-500 font-mono mt-2">量化波段共振形态架构</div>
    </div>
  );
}

export default function DiagnosticModal({ pattern, onClose }: DiagnosticModalProps) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fade-in">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />
      
      <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden relative z-50 flex flex-col max-h-[85vh] animate-zoom-in">
        
        {/* Decorative upper color band depending on trend direction */}
        <div className={`h-1 w-full ${
          pattern.type.includes("BULLISH") || pattern.type.includes("BOTTOM") || pattern.type.includes("MORNING")
            ? "bg-emerald-500"
            : pattern.type.includes("BEARISH") || pattern.type.includes("TOP") || pattern.type.includes("EVENING")
              ? "bg-red-500"
              : "bg-indigo-500"
        }`} />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-900">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] text-slate-400 font-mono font-bold tracking-widest uppercase">
              价格行为高级诊断报告
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-neutral-900 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Container (Scrollable) */}
        <div className="p-5 overflow-y-auto space-y-4 text-left">
          
          {/* Signal Header Section */}
          <div>
            <span className="inline-block px-2 py-0.5 bg-neutral-900 border border-neutral-800 text-[9px] text-slate-400 font-mono rounded mb-1.5 font-bold">
              {pattern.type}
            </span>
            <h2 className="text-base font-black text-white font-sans flex items-center gap-2">
              <span>{getPatternDisplayLabel(pattern.type, pattern.name)}</span>
            </h2>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 gap-3 bg-neutral-900/40 p-3 rounded-xl border border-neutral-900">
            <div>
              <div className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">信号置信度</div>
              <div className="text-sm font-black text-yellow-500 font-mono mt-0.5">
                {Math.round(pattern.confidence * 100)}%
              </div>
            </div>
            <div>
              <div className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">关键临界价</div>
              <div className="text-sm font-black text-white font-mono mt-0.5">
                ${pattern.price}
              </div>
            </div>
          </div>

          {/* Pattern Schema Diagram */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>标准形态图解</span>
            </div>
            <PatternDiagram type={pattern.type} />
          </div>

          {/* Game Theory Text Box */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
              <span>机构博弈与多空动能分析</span>
            </div>
            <div className="bg-neutral-900/30 p-4 border border-neutral-900 rounded-xl leading-relaxed text-xs text-slate-300 font-sans whitespace-pre-wrap">
              {pattern.description}
            </div>
          </div>

        </div>

        {/* Action / Dismiss Button */}
        <div className="px-5 py-4 border-t border-neutral-900 bg-neutral-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-white text-black hover:bg-neutral-200 text-xs font-bold font-mono tracking-wider transition-colors cursor-pointer rounded-lg text-center"
          >
            确认并返回
          </button>
        </div>

      </div>
    </div>
  );
}
