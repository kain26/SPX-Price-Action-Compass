import React, { useState, useRef, useEffect } from "react";
import { Candle, DetectedPattern, SupportResistanceZone, MarketTrend } from "../types.js";
import { Layers, Eye, EyeOff, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Minimize2, Clock, ChevronDown, Check, Grid, Triangle, ArrowUpDown, BarChart3, SlidersHorizontal } from "lucide-react";

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

const getPatternLabel = (type: string, name: string): string => {
  switch (type) {
    case "PIN_BAR_BULLISH": return "↗ 看涨 Pin Bar";
    case "PIN_BAR_BEARISH": return "↘ 看跌 Pin Bar";
    case "ENGULFING_BULLISH": return "↗ 看涨吞没";
    case "ENGULFING_BEARISH": return "↘ 看跌吞没";
    case "MORNING_STAR": return "↗ 启明星";
    case "EVENING_STAR": return "↘ 黄昏星";
    case "DOJI": return "⇅ 十字星";
    case "INSIDE_BAR": return "⇄ 内含线";
    case "DOUBLE_TOP": return "↘ 双顶结构";
    case "DOUBLE_BOTTOM": return "↗ 双底结构";
    case "HEAD_AND_SHOULDERS": return "↘ 头肩顶";
    case "INVERSE_HEAD_AND_SHOULDERS": return "↗ 头肩底";
    case "FLAG_BULLISH": return "↗ 看涨旗形";
    case "FLAG_BEARISH": return "↘ 看跌旗形";
    case "TRIANGLE_ASCENDING": return "↗ 上升三角";
    case "TRIANGLE_DESCENDING": return "↘ 下降三角";
    case "TRIANGLE_SYMMETRICAL": return "⇄ 对称三角";
    default: return name.split(" (")[0];
  }
};

interface PriceActionChartProps {
  candles: Candle[];
  patterns: DetectedPattern[];
  zones: SupportResistanceZone[];
  trend: MarketTrend;
  selectedPattern: DetectedPattern | null;
  onSelectPattern: (pattern: DetectedPattern | null) => void;
  showPatterns: boolean;
  setShowPatterns?: (show: boolean) => void;
  showZones: boolean;
  setShowZones?: (show: boolean) => void;
  showTrends: boolean;
  setShowTrends?: (show: boolean) => void;
  showVolume: boolean;
  setShowVolume?: (show: boolean) => void;
  // Controls for interactive zoom/scroll from parent if needed
  focusIndex?: number | null;
  onCandleClick?: (candle: Candle) => void;
  timeframe?: "1m" | "5m" | "15m" | "4h" | "1d";
  setTimeframe?: (tf: "1m" | "5m" | "15m" | "4h" | "1d") => void;
  isChineseStyle?: boolean;
  setIsChineseStyle?: (isChinese: boolean) => void;
  // Pattern filter values and actions
  patternFilters?: string[];
  onTogglePatternFilter?: (val: string) => void;
  getCategoryCount?: (val: string) => number;
  isChallengeMode?: boolean;
  symbol?: "spx" | "es" | "qqq" | "spy";
}

export default function PriceActionChart({
  candles,
  patterns,
  zones,
  trend,
  selectedPattern,
  onSelectPattern,
  showPatterns: propShowPatterns,
  setShowPatterns: propSetShowPatterns,
  showZones: propShowZones,
  setShowZones: propSetShowZones,
  showTrends: propShowTrends,
  setShowTrends: propSetShowTrends,
  showVolume: propShowVolume,
  setShowVolume: propSetShowVolume,
  focusIndex = null,
  onCandleClick,
  timeframe: propTimeframe = "5m",
  setTimeframe: propSetTimeframe,
  isChineseStyle: propIsChineseStyle = false,
  setIsChineseStyle: propSetIsChineseStyle,
  patternFilters: propPatternFilters,
  onTogglePatternFilter: propOnTogglePatternFilter,
  getCategoryCount: propGetCategoryCount,
  isChallengeMode = false,
  symbol = "spx",
}: PriceActionChartProps) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showTimeframeDropdown, setShowTimeframeDropdown] = useState<boolean>(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);

  // Fallback states if parent doesn't provide them
  const [localShowPatterns, setLocalShowPatterns] = useState<boolean>(true);
  const showPatterns = propSetShowPatterns ? propShowPatterns : localShowPatterns;
  const setShowPatterns = propSetShowPatterns || setLocalShowPatterns;

  const [localShowZones, setLocalShowZones] = useState<boolean>(true);
  const showZones = propSetShowZones ? propShowZones : localShowZones;
  const setShowZones = propSetShowZones || setLocalShowZones;

  const [localShowTrends, setLocalShowTrends] = useState<boolean>(true);
  const showTrends = propSetShowTrends ? propShowTrends : localShowTrends;
  const setShowTrends = propSetShowTrends || setLocalShowTrends;

  const [localShowVolume, setLocalShowVolume] = useState<boolean>(true);
  const showVolume = propSetShowVolume ? propShowVolume : localShowVolume;
  const setShowVolume = propSetShowVolume || setLocalShowVolume;

  const [localTimeframe, setLocalTimeframe] = useState<"1m" | "5m" | "15m" | "4h" | "1d">("5m");
  const timeframe = propSetTimeframe ? propTimeframe : localTimeframe;
  const setTimeframe = propSetTimeframe || setLocalTimeframe;

  const [localIsChineseStyle, setLocalIsChineseStyle] = useState<boolean>(false);
  const isChineseStyle = propSetIsChineseStyle ? propIsChineseStyle : localIsChineseStyle;
  const setIsChineseStyle = propSetIsChineseStyle || setLocalIsChineseStyle;

  const [localPatternFilters, setLocalPatternFilters] = useState<string[]>(["ALL"]);
  const patternFilters = propPatternFilters !== undefined ? propPatternFilters : localPatternFilters;

  const onTogglePatternFilter = propOnTogglePatternFilter || ((val: string) => {
    if (val === "ALL") {
      setLocalPatternFilters(["ALL"]);
    } else if (val === "NONE") {
      setLocalPatternFilters(["NONE"]);
    } else {
      setLocalPatternFilters(prev => {
        const withoutAllOrNone = prev.filter(x => x !== "ALL" && x !== "NONE");
        if (withoutAllOrNone.includes(val)) {
          const updated = withoutAllOrNone.filter(x => x !== val);
          return updated.length === 0 ? ["ALL"] : updated;
        } else {
          return [...withoutAllOrNone, val];
        }
      });
    }
  });

  const getCategoryCount = propGetCategoryCount || ((val: string) => {
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
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const [containerWidth, setContainerWidth] = useState<number>(720);
  const [containerHeight, setContainerHeight] = useState<number>(480);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const rect = entries[0].contentRect;
      setContainerWidth(rect.width || 720);
      setContainerHeight(rect.height || 480);
    });
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Chart view state: indices of visible candles
  const totalCandles = candles.length;
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [startIndex, setStartIndex] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<number>(0);

  const [hoveredCandle, setHoveredCandle] = useState<{ candle: Candle; index: number } | null>(null);
  const [crosshairPos, setCrosshairPos] = useState<{ x: number; y: number; price: number; dateStr: string } | null>(null);

  const [showMobileTip, setShowMobileTip] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowMobileTip(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Calculate dynamic right-side blank padding and start index bound
  const rightPadding = Math.max(8, Math.floor(zoomLevel * 0.15));
  const maxStartIndex = Math.max(0, totalCandles - zoomLevel + rightPadding);

  const getNYFormattedString = (timeMs: number) => {
    const et = getETComponents(timeMs);
    const yyyy = et.year;
    const mm = String(et.month).padStart(2, "0");
    const dd = String(et.day).padStart(2, "0");
    const hh = String(et.hour).padStart(2, "0");
    const min = String(et.minute).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  // Initialize view: scroll to the very end but leave a beautiful blank padding on the right
  useEffect(() => {
    if (totalCandles > 0) {
      const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
      if (timeframe === "15m") {
        let targetStart = -1;
        let targetEnd = -1;
        for (let i = 0; i < totalCandles; i++) {
          const nyStr = getNYFormattedString(candles[i].time);
          if (targetStart === -1 && nyStr >= "2026-06-29 14:30") {
            targetStart = i;
          }
          if (nyStr <= "2026-07-02 16:00") {
            targetEnd = i;
          }
        }
        if (targetStart !== -1 && targetEnd !== -1 && targetEnd >= targetStart) {
          const computedZoom = targetEnd - targetStart + 1;
          const finalZoom = isMobile ? Math.min(computedZoom, 45) : computedZoom;
          setZoomLevel(finalZoom);
          setStartIndex(isMobile ? Math.max(targetStart, targetEnd - finalZoom + 1) : targetStart);
          return;
        }
      }

      // Default zoom sizing
      let defaultZoom = isMobile ? Math.min(totalCandles, 45) : Math.min(totalCandles, 100);
      if (timeframe === "4h") {
        defaultZoom = isMobile ? Math.min(totalCandles, 25) : Math.min(totalCandles, 60);
      }
      
      setZoomLevel(defaultZoom);
      const pad = Math.max(8, Math.floor(defaultZoom * 0.15));
      setStartIndex(Math.max(0, totalCandles - defaultZoom + pad));
    }
  }, [totalCandles, timeframe, candles]);

  // Adjust view when focusIndex is requested (e.g. clicking a pattern in the sidebar)
  useEffect(() => {
    if (focusIndex !== null && focusIndex !== undefined && focusIndex >= 0 && focusIndex < totalCandles) {
      // Center the focused index in the view
      const halfZoom = Math.floor(zoomLevel / 2);
      const targetStart = Math.max(0, Math.min(maxStartIndex, focusIndex - halfZoom));
      setStartIndex(targetStart);
    }
  }, [focusIndex, zoomLevel, maxStartIndex]);

  // Calculate visible range (safely clamped to bounds)
  const activeStartIndex = Math.max(0, Math.min(totalCandles - 1, startIndex));
  const endIndex = Math.min(totalCandles, activeStartIndex + zoomLevel);
  const visibleCandles = candles.slice(activeStartIndex, endIndex);

  // Auto-scale vertical axis based strictly on visible candles
  const visibleHighs = visibleCandles.map(c => c.high).filter(h => typeof h === "number" && !isNaN(h) && isFinite(h));
  const visibleLows = visibleCandles.map(c => c.low).filter(l => typeof l === "number" && !isNaN(l) && isFinite(l));
  
  const rawMax = visibleHighs.length > 0 ? Math.max(...visibleHighs) : 100;
  const rawMin = visibleLows.length > 0 ? Math.min(...visibleLows) : 0;
  
  const maxPrice = rawMax * 1.001;
  const minPrice = rawMin * 0.999;
  const priceRange = Math.max(0.01, maxPrice - minPrice);

  // Chart dimensions
  const xAxisHeight = 20;
  const volumeHeight = isFullscreen ? 80 : 50;
  const chartHeight = Math.max(180, containerHeight - xAxisHeight - (showVolume ? volumeHeight : 0));
  const totalChartHeight = chartHeight + (showVolume ? volumeHeight : 0);
  const chartWidth = containerWidth;
  const candleAreaWidth = chartWidth - 60; // 60px reserved for the left-side Y-axis column

  // Coordinate projection helper
  const getX = (indexInVisible: number) => {
    const candleWidth = candleAreaWidth / zoomLevel;
    const val = 60 + indexInVisible * candleWidth + candleWidth / 2;
    return isNaN(val) || !isFinite(val) ? 0 : val;
  };

  // Helper to format/parse timestamp into Eastern Time (America/New_York) components
  const getETComponents = (timeMs: number) => {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: false
      });
      const parts = formatter.formatToParts(new Date(timeMs));
      const partMap: Record<string, string> = {};
      parts.forEach(p => {
        partMap[p.type] = p.value;
      });
      return {
        year: parseInt(partMap.year || "0", 10),
        month: parseInt(partMap.month || "0", 10),
        day: parseInt(partMap.day || "0", 10),
        hour: parseInt(partMap.hour || "0", 10),
        minute: parseInt(partMap.minute || "0", 10),
      };
    } catch (e) {
      const d = new Date(timeMs);
      return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        hour: d.getHours(),
        minute: d.getMinutes(),
      };
    }
  };

  const getETDateString = (timeMs: number, format: "short" | "full" | "month-only") => {
    try {
      const d = new Date(timeMs);
      if (format === "month-only") {
        return new Intl.DateTimeFormat("zh-CN", {
          timeZone: "America/New_York",
          month: "short"
        }).format(d);
      }
      if (format === "full") {
        const formatted = new Intl.DateTimeFormat("zh-CN", {
          timeZone: "America/New_York",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).format(d);
        return formatted.replace(/\//g, "-");
      }
      const et = getETComponents(timeMs);
      return `${et.month}/${et.day}`;
    } catch (e) {
      const d = new Date(timeMs);
      if (format === "month-only") {
        return d.toLocaleDateString("zh-CN", { month: "short" });
      }
      if (format === "full") {
        return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
      }
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }
  };

  const getETFormattedString = (timeMs: number, showTime = !isDaily) => {
    const et = getETComponents(timeMs);
    const yearStr = et.year;
    const monthStr = String(et.month).padStart(2, "0");
    const dayStr = String(et.day).padStart(2, "0");
    const datePart = `${yearStr}-${monthStr}-${dayStr}`;
    if (!showTime) {
      return datePart;
    }
    const hourStr = String(et.hour).padStart(2, "0");
    const minStr = String(et.minute).padStart(2, "0");
    return `${datePart} ${hourStr}:${minStr}`;
  };

  const isDaily = timeframe === "1d";

  const getPeriodLabel = () => {
    switch (timeframe) {
      case "1d":
        return "200天";
      case "4h":
        return "54根K线";
      case "15m":
        return "150根K线";
      case "5m":
        return "75根K线";
      case "1m":
        return "390根K线";
      default:
        return "75根K线";
    }
  };

  // Helper to generate beautifully aligned ticks on the X-axis
  const getXAxisTicks = () => {
    const ticks: { index: number; label: string; isStrong?: boolean }[] = [];
    if (visibleCandles.length === 0) return ticks;

    if (!isDaily) {
      // Find candles on the exact hour in Eastern Time
      const candidates: { index: number; et: ReturnType<typeof getETComponents> }[] = [];
      visibleCandles.forEach((c, i) => {
        const et = getETComponents(c.time);
        if (et.minute === 0) {
          candidates.push({ index: i, et });
        }
      });

      // If too few hourly marks (e.g. zoomed in very close), add half-hours
      if (candidates.length < 3) {
        visibleCandles.forEach((c, i) => {
          const et = getETComponents(c.time);
          if (et.minute === 30) {
            if (!candidates.some(cand => cand.index === i)) {
              candidates.push({ index: i, et });
            }
          }
        });
        candidates.sort((a, b) => a.index - b.index);
      }

      // If still too few, fall back to simple spacing
      if (candidates.length < 3) {
        const step = Math.max(1, Math.floor(visibleCandles.length / 5));
        for (let i = 0; i < visibleCandles.length; i += step) {
          candidates.push({ index: i, et: getETComponents(visibleCandles[i].time) });
        }
      }

      // Filter candidates if there are too many (limit to max 7 ticks for cleanliness)
      let filtered = candidates;
      if (candidates.length > 7) {
        const skip = Math.ceil(candidates.length / 5);
        filtered = candidates.filter((_, idx) => idx % skip === 0);
      }

      filtered.forEach(item => {
        const hourStr = String(item.et.hour).padStart(2, "0");
        const minStr = String(item.et.minute).padStart(2, "0");
        // Check if market opens to show full date context (9:30 AM Eastern Time)
        const isMarketOpen = item.et.hour === 9 && item.et.minute === 30;
        const label = isMarketOpen
          ? `${item.et.month}/${item.et.day} ${hourStr}:${minStr}`
          : `${hourStr}:${minStr}`;

        ticks.push({
          index: item.index,
          label,
          isStrong: isMarketOpen
        });
      });
    } else {
      // Daily (1d) timeframe - DO NOT show time!
      const candidates: { index: number; et: ReturnType<typeof getETComponents>; label: string }[] = [];
      visibleCandles.forEach((c, i) => {
        const et = getETComponents(c.time);
        const prevC = visibleCandles[i - 1];
        const prevEt = prevC ? getETComponents(prevC.time) : null;
        
        if (prevEt && et.month !== prevEt.month) {
          candidates.push({
            index: i,
            et,
            label: getETDateString(c.time, "month-only")
          });
        } else if (i === 0 || i === visibleCandles.length - 1) {
          candidates.push({
            index: i,
            et,
            label: `${et.month}/${et.day}`
          });
        } else if (visibleCandles.length < 40) {
          // Zooms in, show Mondays
          // To calculate if it is Monday in Eastern Time:
          const etDate = new Date(new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            year: "numeric",
            month: "numeric",
            day: "numeric"
          }).format(new Date(c.time)));
          if (etDate.getDay() === 1) {
            candidates.push({
              index: i,
              et,
              label: `${et.month}/${et.day}`
            });
          }
        }
      });

      if (candidates.length < 3) {
        const step = Math.max(1, Math.floor(visibleCandles.length / 5));
        for (let i = 0; i < visibleCandles.length; i += step) {
          const et = getETComponents(visibleCandles[i].time);
          candidates.push({
            index: i,
            et,
            label: `${et.month}/${et.day}`
          });
        }
      }

      const uniqueIndices = new Set<number>();
      const uniqueCandidates = candidates.filter(item => {
        if (uniqueIndices.has(item.index)) return false;
        uniqueIndices.add(item.index);
        return true;
      });
      uniqueCandidates.sort((a, b) => a.index - b.index);

      let filtered = uniqueCandidates;
      if (uniqueCandidates.length > 7) {
        const skip = Math.ceil(uniqueCandidates.length / 5);
        filtered = uniqueCandidates.filter((_, idx) => idx % skip === 0);
      }

      filtered.forEach(item => {
        ticks.push({
          index: item.index,
          label: item.label,
          isStrong: item.label.includes("月")
        });
      });
    }

    return ticks;
  };

  const getY = (price: number) => {
    if (priceRange <= 0 || isNaN(price) || !isFinite(price)) return 0;
    const val = chartHeight - ((price - minPrice) / priceRange) * (chartHeight - 40) - 20;
    return isNaN(val) || !isFinite(val) ? 0 : val;
  };

  const getVolY = (vol: number) => {
    const volumes = visibleCandles.map(c => c.volume).filter(v => typeof v === "number" && !isNaN(v) && isFinite(v));
    const maxVol = volumes.length > 0 ? Math.max(...volumes) : 1;
    const safeMaxVol = maxVol > 0 ? maxVol : 1;
    const height = (vol / safeMaxVol) * (volumeHeight - 10);
    const val = totalChartHeight - height - 5;
    return isNaN(val) || !isFinite(val) ? totalChartHeight - 5 : val;
  };

  // Drag-to-pan & hover detection
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      setIsDragging(true);
      setDragStart(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Tooltip/hover candle & crosshair detection
    if (containerRef.current && totalCandles > 0) {
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      
      // Map client position to SVG viewBox coordinates (width = 720, height = totalChartHeight + 20)
      const svgX = (clientX / rect.width) * chartWidth;
      const svgY = (clientY / rect.height) * (totalChartHeight + 20);
      
      // Only track candles & show crosshair if mouse is inside the active candle area (60 to 720)
      if (svgX >= 60 && svgX <= chartWidth && svgY >= 0 && svgY <= totalChartHeight) {
        const clampedX = Math.max(60, Math.min(chartWidth, svgX));
        const clampedY = Math.max(0, Math.min(totalChartHeight, svgY));
        
        const candleWidth = candleAreaWidth / zoomLevel;
        const relativeIndex = Math.floor((clampedX - 60) / candleWidth);
        const actualIndexInVisible = Math.max(0, Math.min(visibleCandles.length - 1, relativeIndex));
        const candle = visibleCandles[actualIndexInVisible];
        
        if (candle) {
          const actualIndex = startIndex + actualIndexInVisible;
          setHoveredCandle({ candle, index: actualIndex });
          
          // Calculate price corresponding to clampedY
          const priceY = minPrice + priceRange * (chartHeight - 20 - clampedY) / (chartHeight - 40);
          
          // Format date and time in Eastern Time
          const et = getETComponents(candle.time);
          const daysOfWeek = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
          
          // Get the correct day of the week in Eastern Time
          const etDate = new Date(new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            year: "numeric",
            month: "numeric",
            day: "numeric"
          }).format(new Date(candle.time)));
          const dayOfWeekStr = daysOfWeek[etDate.getDay()];

          const yearStr = et.year;
          const monthStr = String(et.month).padStart(2, "0");
          const dayStr = String(et.day).padStart(2, "0");
          const datePart = `${yearStr}-${monthStr}-${dayStr}`;

          let dateStr = "";
          if (isDaily) {
            dateStr = `${datePart} ${dayOfWeekStr}`;
          } else {
            const hourStr = String(et.hour).padStart(2, "0");
            const minStr = String(et.minute).padStart(2, "0");
            dateStr = `${datePart} ${hourStr}:${minStr} ${dayOfWeekStr}`;
          }
          
          setCrosshairPos({
            x: getX(actualIndexInVisible),
            y: clampedY,
            price: priceY,
            dateStr,
          });
        }
      } else {
        setCrosshairPos(null);
        setHoveredCandle(null);
      }
    }

    if (!isDragging) return;

    const deltaX = e.clientX - dragStart;
    const activeWidth = containerRef.current ? containerRef.current.clientWidth * (candleAreaWidth / chartWidth) : 660;
    const candleWidth = activeWidth / zoomLevel;
    const candlesMoved = Math.round(deltaX / candleWidth);

    if (Math.abs(candlesMoved) >= 1) {
      setStartIndex(prev => Math.max(0, Math.min(maxStartIndex, prev - candlesMoved)));
      setDragStart(e.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;

    if (containerRef.current && totalCandles > 0) {
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const relativeY = clientY - rect.top;
      
      const svgX = (relativeX / rect.width) * chartWidth;
      const svgY = (relativeY / rect.height) * (totalChartHeight + 20);
      
      if (svgX >= 60 && svgX <= chartWidth && svgY >= 0 && svgY <= totalChartHeight) {
        const clampedX = Math.max(60, Math.min(chartWidth, svgX));
        const clampedY = Math.max(0, Math.min(totalChartHeight, svgY));
        
        const candleWidth = candleAreaWidth / zoomLevel;
        const relativeIndex = Math.floor((clampedX - 60) / candleWidth);
        const actualIndexInVisible = Math.max(0, Math.min(visibleCandles.length - 1, relativeIndex));
        const candle = visibleCandles[actualIndexInVisible];
        
        if (candle) {
          const actualIndex = startIndex + actualIndexInVisible;
          setHoveredCandle({ candle, index: actualIndex });
          
          const priceY = minPrice + priceRange * (chartHeight - 20 - clampedY) / (chartHeight - 40);
          
          const et = getETComponents(candle.time);
          const daysOfWeek = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
          
          const etDate = new Date(new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            year: "numeric",
            month: "numeric",
            day: "numeric"
          }).format(new Date(candle.time)));
          const dayOfWeekStr = daysOfWeek[etDate.getDay()];

          const yearStr = et.year;
          const monthStr = String(et.month).padStart(2, "0");
          const dayStr = String(et.day).padStart(2, "0");
          const datePart = `${yearStr}-${monthStr}-${dayStr}`;

          let dateStr = "";
          if (isDaily) {
            dateStr = `${datePart} ${dayOfWeekStr}`;
          } else {
            const hourStr = String(et.hour).padStart(2, "0");
            const minStr = String(et.minute).padStart(2, "0");
            dateStr = `${datePart} ${hourStr}:${minStr} ${dayOfWeekStr}`;
          }
          
          setCrosshairPos({
            x: getX(actualIndexInVisible),
            y: clampedY,
            price: priceY,
            dateStr,
          });
        }
      }
    }

    if (!isDragging) return;

    const deltaX = clientX - dragStart;
    const activeWidth = containerRef.current ? containerRef.current.clientWidth * (candleAreaWidth / chartWidth) : 660;
    const candleWidth = activeWidth / zoomLevel;
    const candlesMoved = Math.round(deltaX / candleWidth);

    if (Math.abs(candlesMoved) >= 1) {
      setStartIndex(prev => Math.max(0, Math.min(maxStartIndex, prev - candlesMoved)));
      setDragStart(clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredCandle(null);
    setCrosshairPos(null);
  };

  // Modern broker-style wheel zoom centered under the cursor
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      if (totalCandles === 0) return;

      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const svgX = (clientX / rect.width) * chartWidth;
      const clampedX = Math.max(60, Math.min(chartWidth, svgX));
      const ratio = (clampedX - 60) / candleAreaWidth;

      // Locate the exact candle index under the mouse cursor before zoom
      const mouseCandleIndex = startIndex + ratio * zoomLevel;

      // Adjust zoom multiplier (scroll up -> zoom in, scroll down -> zoom out)
      const zoomFactor = e.deltaY < 0 ? 0.85 : 1.15;
      let nextZoom = Math.round(zoomLevel * zoomFactor);
      nextZoom = Math.max(10, Math.min(totalCandles, nextZoom));

      if (nextZoom === zoomLevel) return;

      const nextPad = Math.max(8, Math.floor(nextZoom * 0.15));
      const nextMaxStart = Math.max(0, totalCandles - nextZoom + nextPad);

      // Re-anchor start index so that the same candle index stays under the cursor ratio
      let nextStart = mouseCandleIndex - ratio * nextZoom;
      nextStart = Math.max(0, Math.min(nextMaxStart, Math.round(nextStart)));

      setZoomLevel(nextZoom);
      setStartIndex(nextStart);

      // Immediately refresh the crosshair coordinates to keep it perfectly snapped
      const svgY = (e.clientY - rect.top) / rect.height * (totalChartHeight + 20);
      if (clampedX >= 60 && clampedX <= chartWidth && svgY >= 0 && svgY <= totalChartHeight) {
        const candleWidth = candleAreaWidth / nextZoom;
        const relativeIndex = Math.floor((clampedX - 60) / candleWidth);
        const activeStartIndex = Math.max(0, Math.min(totalCandles - 1, nextStart));
        const endIndex = Math.min(totalCandles, activeStartIndex + nextZoom);
        const nextVisibleCandles = candles.slice(activeStartIndex, endIndex);
        const actualIndexInVisible = Math.max(0, Math.min(nextVisibleCandles.length - 1, relativeIndex));
        const candle = nextVisibleCandles[actualIndexInVisible];

        if (candle) {
          // Re-scale min-max range for the new visible candles to project exact price at mouse Y
          const nextVisibleHighs = nextVisibleCandles.map(c => c.high).filter(h => typeof h === "number" && !isNaN(h) && isFinite(h));
          const nextVisibleLows = nextVisibleCandles.map(c => c.low).filter(l => typeof l === "number" && !isNaN(l) && isFinite(l));
          const nextRawMax = nextVisibleHighs.length > 0 ? Math.max(...nextVisibleHighs) : 100;
          const nextRawMin = nextVisibleLows.length > 0 ? Math.min(...nextVisibleLows) : 0;
          const nextMaxPrice = nextRawMax * 1.001;
          const nextMinPrice = nextRawMin * 0.999;
          const nextPriceRange = Math.max(0.01, nextMaxPrice - nextMinPrice);
          const priceY = nextMinPrice + nextPriceRange * (chartHeight - 20 - svgY) / (chartHeight - 40);

          const daysOfWeek = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
          const etDate = new Date(new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            year: "numeric",
            month: "numeric",
            day: "numeric"
          }).format(new Date(candle.time)));
          const dayOfWeekStr = daysOfWeek[etDate.getDay()];
          const et = getETComponents(candle.time);
          const yearStr = et.year;
          const monthStr = String(et.month).padStart(2, "0");
          const dayStr = String(et.day).padStart(2, "0");
          const datePart = `${yearStr}-${monthStr}-${dayStr}`;

          let dateStr = "";
          if (isDaily) {
            dateStr = `${datePart} ${dayOfWeekStr}`;
          } else {
            const hourStr = String(et.hour).padStart(2, "0");
            const minStr = String(et.minute).padStart(2, "0");
            dateStr = `${datePart} ${hourStr}:${minStr} ${dayOfWeekStr}`;
          }

          const getXNew = (idx: number) => {
            const cWidth = candleAreaWidth / nextZoom;
            const val = 60 + idx * cWidth + cWidth / 2;
            return isNaN(val) || !isFinite(val) ? 0 : val;
          };

          setCrosshairPos({
            x: getXNew(actualIndexInVisible),
            y: svgY,
            price: priceY,
            dateStr,
          });
          setHoveredCandle({ candle, index: nextStart + actualIndexInVisible });
        }
      } else {
        setCrosshairPos(null);
        setHoveredCandle(null);
      }
    };

    container.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheelNative);
    };
  }, [startIndex, zoomLevel, totalCandles, maxStartIndex, candles, minPrice, priceRange, isDaily, showVolume]);

  const handleZoomIn = () => {
    const nextZoom = Math.max(20, Math.round(zoomLevel * 0.8));
    setZoomLevel(nextZoom);
    const nextPad = Math.max(8, Math.floor(nextZoom * 0.15));
    const nextMaxStart = Math.max(0, totalCandles - nextZoom + nextPad);
    setStartIndex(prev => Math.min(nextMaxStart, Math.max(0, prev + Math.floor((zoomLevel - nextZoom) / 2))));
  };

  const handleZoomOut = () => {
    const nextZoom = Math.min(totalCandles, Math.round(zoomLevel * 1.25));
    setZoomLevel(nextZoom);
    const nextPad = Math.max(8, Math.floor(nextZoom * 0.15));
    const nextMaxStart = Math.max(0, totalCandles - nextZoom + nextPad);
    setStartIndex(prev => Math.min(nextMaxStart, Math.max(0, prev - Math.floor((nextZoom - zoomLevel) / 2))));
  };

  const handleScrollLeft = () => {
    setStartIndex(prev => Math.max(0, prev - Math.max(1, Math.floor(zoomLevel * 0.25))));
  };

  const handleScrollRight = () => {
    setStartIndex(prev => Math.min(maxStartIndex, prev + Math.max(1, Math.floor(zoomLevel * 0.25))));
  };

  // Render S&R Zones
  const renderSRZones = () => {
    if (!showZones) return null;
    return zones.map(zone => {
      // Check if price zone falls within current vertical bounds
      if (zone.price < minPrice || zone.price > maxPrice) return null;
      const y = getY(zone.price);
      
      // Dynamic narrow zone (price +- 0.04%, which is ~3 points for S&P 500 around 7500)
      const halfRange = Math.max(1, zone.price * 0.0004);
      const minBoundY = getY(zone.price - halfRange);
      const maxBoundY = getY(zone.price + halfRange);
      const bandHeight = Math.max(4, Math.abs(minBoundY - maxBoundY));

      if (isNaN(y) || isNaN(minBoundY) || isNaN(maxBoundY) || isNaN(bandHeight)) return null;

      const isSupport = zone.type === "support";
      const isResistance = zone.type === "resistance";
      
      // No borders (stroke) - pure soft translucent colored block (色块)
      const colorClass = isSupport 
        ? "fill-[#00c805]/10" 
        : isResistance 
          ? "fill-[#ff3b30]/10" 
          : "fill-amber-500/10";

      return (
        <g key={zone.id} className="transition-all duration-300">
          {/* Main Translucent Zone Band (Borderless block) */}
          <rect
            x={60}
            y={Math.min(minBoundY, maxBoundY)}
            width={candleAreaWidth}
            height={bandHeight}
            className={colorClass}
          />
          {/* Level Dashed Line (Single Clean Line) */}
          <line
            x1={60}
            y1={y}
            x2={chartWidth}
            y2={y}
            strokeDasharray="4,3"
            className={
              isSupport 
                ? "stroke-[#00c805]/45 stroke-[1]" 
                : isResistance 
                  ? "stroke-[#ff3b30]/45 stroke-[1]" 
                  : "stroke-amber-400/45 stroke-[1]"
            }
          />
          {/* Tag text */}
          <text
            x={chartWidth - 5}
            y={y - 4}
            textAnchor="end"
            className={`font-mono text-[9px] font-medium ${
              isSupport 
                ? "fill-[#00c805]" 
                : isResistance 
                  ? "fill-[#ff3b30]" 
                  : "fill-amber-400"
            }`}
          >
            {zone.type === "support" ? "支撑" : zone.type === "resistance" ? "阻力" : "互换"} ({zone.strength}次触碰, {getPeriodLabel()}): {zone.price}
          </text>
        </g>
      );
    });
  };

  // Render Trend labels (HH, HL, LH, LL)
  const renderTrendLabels = () => {
    if (!showTrends) return null;
    return trend.labels
      .filter(l => l.index >= startIndex && l.index < endIndex)
      .map(l => {
        const visibleIdx = l.index - startIndex;
        const x = getX(visibleIdx);
        const candle = candles[l.index];
        if (!candle) return null;
        const isHigh = l.label === "HH" || l.label === "LH";
        const y = isHigh ? getY(candle.high) - 15 : getY(candle.low) + 20;

        if (isNaN(x) || isNaN(y)) return null;

        const badgeColor = l.label.startsWith("H")
          ? (isChineseStyle ? "fill-[#ff3b30]" : "fill-[#00c805]")
          : (isChineseStyle ? "fill-[#00c805]" : "fill-[#ff3b30]");
        const textColor = "fill-slate-950";

        return (
          <g key={`trend-${l.index}-${l.label}`} className="animate-fade-in">
            {/* Tiny vertical connector indicator */}
            <line
              x1={x}
              y1={isHigh ? getY(candle.high) : getY(candle.low)}
              x2={x}
              y2={isHigh ? y + 5 : y - 5}
              className="stroke-slate-700/50 stroke-[1] stroke-dasharray-[2,2]"
            />
            {/* Circle Badge background */}
            <circle cx={x} cy={y} r={7} className={`${badgeColor}`} />
            {/* Text Label */}
            <text
              x={x}
              y={y + 2.5}
              textAnchor="middle"
              className="text-[8px] font-bold fill-slate-950 font-sans"
            >
              {l.label}
            </text>
          </g>
        );
      });
  };

  // Render Highlighted pattern bounding boxes
  const renderPatternHighlights = () => {
    if (!showPatterns) return null;

    return patterns
      .map((pattern, idx) => {
        // Find if pattern spans inside the current visible indices
        const visibleIndices = pattern.candleIndices.filter(i => i >= startIndex && i < endIndex);
        if (visibleIndices.length === 0) return null;

        const firstIdx = Math.min(...pattern.candleIndices);
        const lastIdx = Math.max(...pattern.candleIndices);

        const xStart = getX(Math.max(startIndex, firstIdx) - startIndex) - 5;
        const xEnd = getX(Math.min(endIndex - 1, lastIdx) - startIndex) + 5;
        const width = Math.max(10, xEnd - xStart);

        // Find min/max price inside pattern candles
        const patternCandles = pattern.candleIndices.map(i => candles[i]).filter(Boolean);
        if (patternCandles.length === 0) return null;

        const pMax = Math.max(...patternCandles.map(c => c.high));
        const pMin = Math.min(...patternCandles.map(c => c.low));
        if (isNaN(pMax) || isNaN(pMin) || !isFinite(pMax) || !isFinite(pMin)) return null;

        const yTop = getY(pMax) - 8;
        const yBottom = getY(pMin) + 8;
        const height = Math.max(15, yBottom - yTop);

        if (isNaN(xStart) || isNaN(width) || isNaN(yTop) || isNaN(height)) return null;

        const isSelected = selectedPattern && selectedPattern.id === pattern.id;
        const isPending = pattern.type === "PENDING_SIGNAL";
        const isBullish = !isPending && (pattern.type.includes("BULLISH") || pattern.type.includes("BOTTOM") || pattern.type.includes("MORNING") || pattern.type.includes("FLAG_BULLISH") || pattern.type.includes("DOUBLE_BOTTOM"));
        
        let borderClass = isPending 
          ? "stroke-[#2663ff]/40" 
          : (isBullish 
            ? (isChineseStyle ? "stroke-[#ff3b30]/40" : "stroke-[#00c805]/40") 
            : (isChineseStyle ? "stroke-[#00c805]/40" : "stroke-[#ff3b30]/40"));
        let fillClass = isPending 
          ? "fill-[#2663ff]/[0.02]" 
          : (isBullish 
            ? (isChineseStyle ? "fill-[#ff3b30]/[0.02]" : "fill-[#00c805]/[0.02]") 
            : (isChineseStyle ? "fill-[#00c805]/[0.02]" : "fill-[#ff3b30]/[0.02]"));

        if (isSelected) {
          borderClass = isPending 
            ? "stroke-[#2663ff] stroke-[1.5] drop-shadow-[0_0_4px_rgba(38,99,255,0.3)]" 
            : (isBullish 
              ? (isChineseStyle ? "stroke-[#ff3b30] stroke-[2] drop-shadow-[0_0_4px_rgba(255,59,48,0.3)]" : "stroke-[#00c805] stroke-[2] drop-shadow-[0_0_4px_rgba(0,200,5,0.3)]") 
              : (isChineseStyle ? "stroke-[#00c805] stroke-[2] drop-shadow-[0_0_4px_rgba(0,200,5,0.3)]" : "stroke-[#ff3b30] stroke-[2] drop-shadow-[0_0_4px_rgba(255,59,48,0.3)]"));
          fillClass = isPending 
            ? "fill-[#2663ff]/8" 
            : (isBullish 
              ? (isChineseStyle ? "fill-[#ff3b30]/10" : "fill-[#00c805]/10") 
              : (isChineseStyle ? "fill-[#00c805]/10" : "fill-[#ff3b30]/10"));
        }

        const labelText = getPatternLabel(pattern.type, pattern.name);
        const badgeWidth = labelText.length * 9.5 + 10;
        const badgeX = xStart + (width - badgeWidth) / 2;
        const badgeY = yTop - 15;

        let badgeBgClass = isPending 
          ? "fill-[#070d1a] stroke-[#2663ff]/40" 
          : (isBullish 
            ? (isChineseStyle ? "fill-[#3a1515] stroke-[#6e2727]" : "fill-[#132c1e] stroke-[#24593b]") 
            : (isChineseStyle ? "fill-[#132c1e] stroke-[#24593b]" : "fill-[#3a1515] stroke-[#6e2727]"));
        let textFillClass = isPending 
          ? "fill-[#5185ff]" 
          : (isBullish 
            ? (isChineseStyle ? "fill-[#f87171]" : "fill-[#4ade80]") 
            : (isChineseStyle ? "fill-[#4ade80]" : "fill-[#f87171]"));

        if (isSelected && !isPending) {
          badgeBgClass = "fill-[#2663ff] stroke-[#4f80ff]";
          textFillClass = "fill-white";
        }

        return (
          <g 
            key={pattern.id} 
            className="cursor-pointer group"
            onClick={() => onSelectPattern(pattern)}
          >
            {/* Outline Box */}
            <rect
              x={xStart}
              y={yTop}
              width={width}
              height={height}
              rx={4}
              className={`${borderClass} ${fillClass} transition-all duration-200`}
            />
            {/* Pattern Badge on Top - Dynamic width & premium teacher marker look */}
            <rect
              x={badgeX}
              y={badgeY}
              width={badgeWidth}
              height={14}
              rx={3}
              className={`${badgeBgClass} stroke-[1] transition-all duration-200`}
            />
            <text
              x={badgeX + badgeWidth / 2}
              y={badgeY + 9.5}
              textAnchor="middle"
              className={`font-sans text-[8px] font-bold ${textFillClass}`}
            >
              {labelText}
            </text>
          </g>
        );
      })
      .filter(Boolean);
  };

  const getDisplayTimeframe = () => {
    if (!timeframe) return "5 MIN";
    if (timeframe === "1d") return "1D";
    if (timeframe.endsWith("m")) return timeframe.replace("m", " MIN").toUpperCase();
    return timeframe.toUpperCase();
  };

  if (totalCandles === 0) {
    return (
      <div className="h-[500px] flex flex-col items-center justify-center bg-gray-950 border border-gray-800 rounded-2xl text-gray-400">
        <div className="animate-pulse flex flex-col items-center">
          <Layers className="w-12 h-12 text-gray-600 mb-3" />
          <p className="text-sm">等待 K 线数据载入...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-[#0c0d10] overflow-hidden shadow-2xl ${
      isFullscreen 
        ? "fixed inset-0 z-[9999] w-screen h-screen rounded-none p-0 border-none" 
        : "relative border border-[#1e222d] rounded-2xl"
    }`}>
      {/* Chart Control Toolbar */}
      <div className="flex items-center justify-between px-1.5 xs:px-2.5 sm:px-4 py-1 border-b border-[#1e222d] bg-[#000000] select-none min-h-10 sm:min-h-12 shrink-0 gap-1.5 sm:gap-3 w-full relative z-30">
        {/* Left Side: Symbol, Timeframe, Divider, Hovered details */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Symbol */}
          <div className="flex items-center gap-1">
            <span className="flex h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-[#00c805] animate-pulse"></span>
            <span className="text-[11px] sm:text-xs font-black tracking-wider text-slate-100 font-mono">{symbol.toUpperCase()}</span>
          </div>

          {/* Timeframe Selector */}
          <div className="relative shrink-0">
            {isChallengeMode ? (
              <div className="relative group shrink-0">
                <div className="flex items-center justify-center gap-1 h-6 sm:h-7 px-1.5 sm:px-2 bg-[#1e222d]/25 border border-[#1e222d]/40 rounded text-[9px] sm:text-[10px] font-bold font-mono text-slate-400 cursor-help select-none">
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500" />
                  <span>5M</span>
                </div>
                <div className="absolute left-0 top-full mt-1.5 hidden group-hover:block bg-[#16171d] border border-[#2d313f] text-slate-200 text-[10px] px-2 py-1 rounded shadow-2xl whitespace-nowrap z-50 pointer-events-none font-bold">
                  仅针对 5M 图进行价格行为训练
                </div>
              </div>
            ) : (
              <>
                {/* Desktop View: direct borderless buttons */}
                <div className="hidden sm:flex items-center gap-1.5 bg-transparent select-none">
                  {[
                    { label: "1", val: "1m" },
                    { label: "5", val: "5m" },
                    { label: "15", val: "15m" },
                    { label: "4H", val: "4h" },
                    { label: "日", val: "1d" },
                  ].map(t => (
                    <button
                      key={t.val}
                      onClick={() => setTimeframe(t.val as any)}
                      className={`px-2.5 py-1 text-xs font-bold font-mono transition-all duration-150 rounded cursor-pointer min-h-[22px] border-none outline-none ${
                        timeframe === t.val
                          ? "text-white bg-[#1e222d] font-black"
                          : "text-slate-400 hover:text-white hover:bg-[#1e222d]/40"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Mobile View: existing compact dropdown */}
                <div className="sm:hidden relative">
                  <button
                    onClick={() => setShowTimeframeDropdown(!showTimeframeDropdown)}
                    className="flex items-center justify-center gap-1 h-6 px-1.5 bg-[#1e222d]/40 hover:bg-[#1e222d] text-slate-200 border border-[#1e222d]/60 hover:border-slate-500 rounded text-[9px] font-bold tracking-wide transition-all cursor-pointer min-h-[20px] font-mono"
                  >
                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                    <span>{timeframe ? timeframe.toUpperCase() : "5M"}</span>
                    <ChevronDown className="w-2 h-2 text-slate-400" />
                  </button>
                  
                  {showTimeframeDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowTimeframeDropdown(false)} />
                      <div className="absolute left-0 mt-1 rounded bg-[#0d0d11] border border-[#1e222d] p-1 shadow-2xl z-50 animate-fade-in w-36">
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
                              setShowTimeframeDropdown(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-bold transition-colors flex items-center justify-between min-h-[26px] ${
                              timeframe === t.val
                                ? "bg-white text-black font-black"
                                : "text-slate-400 hover:bg-neutral-950 hover:text-white"
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
              </>
            )}
          </div>

          <div className="hidden md:block w-[1px] h-3.5 bg-[#1e222d]/80" />

          {/* Inline OHLC Details */}
          <div className="hidden md:flex items-center text-[10px] font-mono text-slate-400 gap-2">
            {hoveredCandle && (
              <>
                <span className="text-slate-500">O</span> <span className="text-slate-200 font-bold">{hoveredCandle.candle.open}</span>
                <span className="text-slate-500">H</span> <span className="text-slate-200 font-bold">{hoveredCandle.candle.high}</span>
                <span className="text-slate-500">L</span> <span className="text-slate-200 font-bold">{hoveredCandle.candle.low}</span>
                <span className="text-slate-500">C</span> <span className={`font-bold ${hoveredCandle.candle.close >= hoveredCandle.candle.open 
                  ? (isChineseStyle ? "text-[#ff3b30]" : "text-[#00c805]") 
                  : (isChineseStyle ? "text-[#00c805]" : "text-[#ff3b30]")}`}>{hoveredCandle.candle.close}</span>
                <span className="text-slate-500 ml-1">V</span> <span className="text-slate-400">{hoveredCandle.candle.volume?.toLocaleString() || "0"}</span>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Clean Icon Toggles with absolute hover tooltips */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Support/Resistance Zone Toggle */}
          <div className="relative group">
            <button
              onClick={() => setShowZones(!showZones)}
              className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded transition-all cursor-pointer ${
                showZones
                  ? "bg-white text-black"
                  : "text-slate-400 hover:text-white hover:bg-[#1e222d]"
              }`}
            >
              <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block bg-[#16171d] border border-[#2d313f] text-slate-200 text-[10px] px-2 py-1 rounded shadow-2xl whitespace-nowrap z-50 pointer-events-none font-bold">
              支撑/阻力水位
            </div>
          </div>

          {/* Show Patterns Toggle */}
          <div className="relative group">
            <button
              onClick={() => setShowPatterns(!showPatterns)}
              className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded transition-all cursor-pointer ${
                showPatterns
                  ? "bg-white text-black"
                  : "text-slate-400 hover:text-white hover:bg-[#1e222d]"
              }`}
            >
              <Triangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block bg-[#16171d] border border-[#2d313f] text-slate-200 text-[10px] px-2 py-1 rounded shadow-2xl whitespace-nowrap z-50 pointer-events-none font-bold">
              图表形态标记
            </div>
          </div>

          {/* Show Trends (HH/LL) Toggle */}
          {!isChallengeMode && (
            <div className="relative group">
              <button
                onClick={() => setShowTrends(!showTrends)}
                className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded transition-all cursor-pointer ${
                  showTrends
                    ? "bg-white text-black"
                    : "text-slate-400 hover:text-white hover:bg-[#1e222d]"
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block bg-[#16171d] border border-[#2d313f] text-slate-200 text-[10px] px-2 py-1 rounded shadow-2xl whitespace-nowrap z-50 pointer-events-none font-bold">
                HH/LL 趋势标记
              </div>
            </div>
          )}

          {/* Volume Histogram Toggle */}
          {!isChallengeMode && (
            <div className="relative group">
              <button
                onClick={() => setShowVolume(!showVolume)}
                className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded transition-all cursor-pointer ${
                  showVolume
                    ? "bg-white text-black"
                    : "text-slate-400 hover:text-white hover:bg-[#1e222d]"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block bg-[#16171d] border border-[#2d313f] text-slate-200 text-[10px] px-2 py-1 rounded shadow-2xl whitespace-nowrap z-50 pointer-events-none font-bold">
                成交量柱状图
              </div>
            </div>
          )}

          {/* Pattern Filtering Dropdown */}
          {!isChallengeMode && (
            <div className="relative group">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded transition-all cursor-pointer ${
                  showFilterDropdown
                    ? "bg-white text-black"
                    : "text-slate-400 hover:text-white hover:bg-[#1e222d]"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block bg-[#16171d] border border-[#2d313f] text-slate-200 text-[10px] px-2 py-1 rounded shadow-2xl whitespace-nowrap z-50 pointer-events-none font-bold">
                筛选特定形态
              </div>

              {showFilterDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />
                  <div className="absolute right-0 mt-2 rounded-lg bg-[#0d0d11] border border-neutral-700 p-1.5 shadow-2xl z-50 animate-fade-in w-48 sm:w-56 max-h-[300px] overflow-y-auto">
                    <div className="px-2 py-1 text-[9px] font-mono text-slate-500 uppercase tracking-wider border-b border-neutral-800 mb-1 text-left">
                      选择形态 (多选)
                    </div>
                    {PATTERN_CATEGORIES.map(cat => {
                      const isSelected = cat.val === "ALL" 
                        ? patternFilters.includes("ALL")
                        : patternFilters.includes(cat.val);
                      const count = getCategoryCount ? getCategoryCount(cat.val) : 0;
                      return (
                        <button
                          key={cat.val}
                          onClick={() => {
                            if (onTogglePatternFilter) onTogglePatternFilter(cat.val);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-bold transition-colors flex items-center justify-between min-h-[26px] ${
                            isSelected
                              ? "bg-white text-black font-black"
                              : "text-slate-400 hover:bg-neutral-950 hover:text-white"
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
          )}

          <div className="w-[1px] h-3.5 bg-[#1e222d] mx-0.5 sm:mx-1" />

          {/* Red/Green Color Switcher */}
          <div className="relative group">
            <button
              onClick={() => setIsChineseStyle(!isChineseStyle)}
              className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded hover:bg-[#1e222d] transition-all cursor-pointer select-none"
            >
              <span className="flex items-center gap-0.5">
                <span className={`w-0.5 h-2.5 sm:w-1 sm:h-3 rounded-full transition-all duration-300 ${isChineseStyle ? "bg-[#ff3b30]" : "bg-[#00c805]"}`} />
                <span className={`w-0.5 h-2.5 sm:w-1 sm:h-3 rounded-full transition-all duration-300 ${isChineseStyle ? "bg-[#00c805]" : "bg-[#ff3b30]"}`} />
              </span>
            </button>
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block bg-[#16171d] border border-[#2d313f] text-slate-200 text-[10px] px-2 py-1 rounded shadow-2xl whitespace-nowrap z-50 pointer-events-none font-bold">
              {isChineseStyle ? "习惯：红涨绿跌" : "习惯：绿涨红跌"}
            </div>
          </div>

          {/* Fullscreen Button */}
          <div className="relative group">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 hover:bg-[#1e222d] text-slate-400 hover:text-white rounded transition-all cursor-pointer select-none"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block bg-[#16171d] border border-[#2d313f] text-slate-200 text-[10px] px-2 py-1 rounded shadow-2xl whitespace-nowrap z-50 pointer-events-none font-bold">
              {isFullscreen ? "退出全屏 (Esc)" : "全屏模式"}
            </div>
          </div>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative w-full select-none ${isDragging ? "cursor-grabbing" : "cursor-crosshair"} ${
          isFullscreen ? "flex-1 h-0 min-h-[300px]" : "h-[320px] sm:h-[450px] lg:h-[calc(100vh-250px)] lg:min-h-[520px] xl:h-[calc(100vh-230px)] xl:min-h-[620px]"
        }`}
      >
        {/* Floating Zoom Slider in the bottom-right corner of the chart */}
        <div className="absolute bottom-6 right-3 sm:right-5 flex items-center gap-1.5 bg-black/85 backdrop-blur-md px-2 py-1 rounded-full border border-neutral-800 shadow-2xl z-20 hover:border-neutral-700 transition-all">
          <button
            onClick={handleZoomOut}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="缩小"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            min={Math.min(15, totalCandles)}
            max={Math.max(Math.min(15, totalCandles), Math.min(totalCandles, 150))}
            value={zoomLevel}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setZoomLevel(val);
              setStartIndex(prev => Math.max(0, Math.min(totalCandles - val, prev)));
            }}
            className="w-16 sm:w-24 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
          />
          <button
            onClick={handleZoomIn}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="放大"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>



        {/* Floating fade-out mobile instruction overlay */}
        <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 bg-neutral-900/95 border border-neutral-800 text-[10px] text-slate-300 px-3 py-1.5 rounded-full shadow-2xl z-30 pointer-events-none transition-opacity duration-1000 sm:hidden ${
          showMobileTip ? "opacity-100" : "opacity-0"
        }`}>
          📱 提示：单指左右拖动平移，双指捏合缩放 K 线
        </div>
        <svg
          viewBox={`0 0 ${chartWidth} ${totalChartHeight + 20}`}
          width="100%"
          height="100%"
          className="overflow-visible"
        >
          {/* Main Chart Area Background (60 to chartWidth) */}
          <rect
            x={60}
            y={0}
            width={candleAreaWidth}
            height={totalChartHeight}
            fill="#090a0d"
          />

          {/* Left Y-Axis Column Background */}
          <rect
            x={0}
            y={0}
            width={60}
            height={totalChartHeight + 20}
            fill="#050608"
          />

          {/* Bottom X-Axis Row Background */}
          <rect
            x={60}
            y={totalChartHeight}
            width={candleAreaWidth}
            height={20}
            fill="#050608"
          />

          {/* Column/Row Border Lines */}
          <line
            x1={60}
            y1={0}
            x2={60}
            y2={totalChartHeight + 20}
            className="stroke-[#1e222d] stroke-[1]"
          />
          <line
            x1={60}
            y1={totalChartHeight}
            x2={chartWidth}
            y2={totalChartHeight}
            className="stroke-[#1e222d] stroke-[1]"
          />

          {/* Grid lines and Ticks */}
          <g>
            {/* Horizontal Grid Lines (Price) */}
            {Array.from({ length: 6 }).map((_, i) => {
              const p = minPrice + (priceRange / 5) * i;
              const y = getY(p);
              return (
                <g key={`grid-h-${i}`}>
                  {/* Grid Line */}
                  <line 
                    x1={60} 
                    y1={y} 
                    x2={chartWidth} 
                    y2={y} 
                    className="stroke-[#1e222d]/60 stroke-[0.8]" 
                    strokeDasharray="2,2" 
                  />
                  {/* Tick Mark in Left Y-Axis Area */}
                  <line 
                    x1={56} 
                    y1={y} 
                    x2={60} 
                    y2={y} 
                    className="stroke-slate-500 stroke-[1]" 
                  />
                  {/* Clean, legible text in the left sidebar */}
                  <text
                    x={52}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-slate-300 font-mono text-[9px] font-semibold"
                  >
                    {p.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Vertical Grid Lines & X-Axis labels (Time) */}
            {getXAxisTicks().map((tick, i) => {
              const x = getX(tick.index);
              if (x < 60 || x > chartWidth) return null; // Keep inside active area
              return (
                <g key={`grid-v-${i}`}>
                  {/* Vertical Grid Line */}
                  <line 
                    x1={x} 
                    y1={0} 
                    x2={x} 
                    y2={totalChartHeight} 
                    className={tick.isStrong ? "stroke-slate-700/80 stroke-[0.8]" : "stroke-[#1e222d]/40 stroke-[0.8] stroke-dasharray-[2,2]"} 
                  />
                  {/* Tick Mark on X-Axis Border */}
                  <line 
                    x1={x} 
                    y1={totalChartHeight} 
                    x2={x} 
                    y2={totalChartHeight + 4} 
                    className="stroke-slate-500 stroke-[1]" 
                  />
                  {/* legilble time text in X-axis row */}
                  <text
                    x={x}
                    y={totalChartHeight + 14}
                    textAnchor="middle"
                    className={`font-mono text-[9px] ${tick.isStrong ? "fill-slate-200 font-bold" : "fill-slate-400"}`}
                  >
                    {tick.label}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Render Support & Resistance zones */}
          {renderSRZones()}

          {/* Candlestick drawing */}
          <g>
            {visibleCandles.map((c, i) => {
              const x = getX(i);
              if (x < 60 || x > chartWidth) return null;
              const yOpen = getY(c.open);
              const yClose = getY(c.close);
              const yHigh = getY(c.high);
              const yLow = getY(c.low);

              const isBullish = c.close >= c.open;
              const strokeColor = isBullish 
                ? (isChineseStyle ? "stroke-[#ff3b30]" : "stroke-[#00c805]") 
                : (isChineseStyle ? "stroke-[#00c805]" : "stroke-[#ff3b30]");
              const fillColor = isBullish 
                ? (isChineseStyle ? "fill-[#ff3b30]" : "fill-[#00c805]") 
                : (isChineseStyle ? "fill-[#00c805]" : "fill-[#ff3b30]");
              const candleWidth = Math.max(1.5, (candleAreaWidth / zoomLevel) * 0.75);

              return (
                <g 
                  key={`candle-${i}-${c.time}`}
                  className={onCandleClick ? "cursor-pointer hover:opacity-85 transition-opacity" : ""}
                  onClick={() => onCandleClick?.(c)}
                >
                  {/* Shadow Line */}
                  <line x1={x} y1={yHigh} x2={x} y2={yLow} className={`${strokeColor} stroke-[1.2]`} />
                  {/* Candle Body */}
                  <rect
                    x={x - candleWidth / 2}
                    y={Math.min(yOpen, yClose)}
                    width={candleWidth}
                    height={Math.max(1, Math.abs(yOpen - yClose))}
                    className={`${strokeColor} ${fillColor} stroke-[0.8]`}
                  />
                </g>
              );
            })}
          </g>

          {/* Volume Chart */}
          {showVolume && (
            <g>
              <line x1={60} y1={chartHeight} x2={chartWidth} y2={chartHeight} className="stroke-[#1e222d] stroke-[1]" />
              {visibleCandles.map((c, i) => {
                const x = getX(i);
                if (x < 60 || x > chartWidth) return null;
                const yVol = getVolY(c.volume);
                const candleWidth = Math.max(1.5, (candleAreaWidth / zoomLevel) * 0.7);
                const isBullish = c.close >= c.open;
                const fillClass = isBullish 
                  ? (isChineseStyle ? "fill-[#ff3b30]/20" : "fill-[#00c805]/20") 
                  : (isChineseStyle ? "fill-[#00c805]/20" : "fill-[#ff3b30]/20");

                return (
                  <rect
                    key={`vol-${i}`}
                    x={x - candleWidth / 2}
                    y={yVol}
                    width={candleWidth}
                    height={totalChartHeight - yVol - 5}
                    className={fillClass}
                  />
                );
              })}
            </g>
          )}

          {/* Render pattern highlight bounding boxes */}
          {renderPatternHighlights()}

          {/* Render HH, HL, LH, LL labels */}
          {renderTrendLabels()}

          {/* Mouse Crosshair dashed lines with price and date/time badges */}
          {crosshairPos && !isDragging && (
            <g className="pointer-events-none">
              {/* Vertical line restricted to active candle area */}
              <line
                x1={crosshairPos.x}
                y1={0}
                x2={crosshairPos.x}
                y2={totalChartHeight}
                className="stroke-slate-400 stroke-[0.8]"
                strokeDasharray="3,3"
              />
              {/* Horizontal line restricted to active candle area */}
              <line
                x1={60}
                y1={crosshairPos.y}
                x2={chartWidth}
                y2={crosshairPos.y}
                className="stroke-slate-400 stroke-[0.8]"
                strokeDasharray="3,3"
              />
              {/* Price badge (on the left Y-axis, 0 to 60px) */}
              <g transform={`translate(2, ${Math.max(2, Math.min(totalChartHeight - 16, crosshairPos.y - 8))})`}>
                <rect x={0} y={0} width={56} height={16} rx={0} fill="#ffffff" stroke="#000000" strokeWidth={1} />
                <text x={28} y={11} textAnchor="middle" className="fill-black font-mono text-[9px] font-black">
                  {crosshairPos.price.toFixed(1)}
                </text>
              </g>
              {/* Date/Time badge (bottom X-axis, centered on candle inside 60 to 720) */}
              <g transform={`translate(${Math.max(60 + 75, Math.min(chartWidth - 75, crosshairPos.x)) - 75}, ${totalChartHeight + 1})`}>
                <rect x={0} y={0} width={150} height={16} rx={0} fill="#ffffff" stroke="#000000" strokeWidth={1} />
                <text x={75} y={11} textAnchor="middle" className="fill-black font-mono text-[8px] font-black">
                  {crosshairPos.dateStr}
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* Empty state instruction when zoom is too far out */}
        {zoomLevel > 300 && (
          <div className="absolute top-4 right-4 bg-black/90 border border-[#1e222d] px-3 py-1.5 rounded-lg text-[10px] text-slate-400 font-sans pointer-events-none">
            💡 提示: 放大图表可获得更清晰的 K 线细节
          </div>
        )}
      </div>

      {/* Synchronized timeline scrollbar/minimap */}
      <div className="px-5 py-2 bg-[#000000] border-t border-[#1e222d] flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span>
          范围: {visibleCandles.length > 0 ? getETFormattedString(visibleCandles[0].time) : ""} ~ {visibleCandles.length > 0 ? getETFormattedString(visibleCandles[visibleCandles.length - 1].time) : ""}
        </span>
        <div className="flex items-center gap-2">
          <span>{totalCandles} 根数据点</span>
        </div>
      </div>
    </div>
  );
}
