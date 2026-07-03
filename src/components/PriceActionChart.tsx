import React, { useState, useRef, useEffect } from "react";
import { Candle, DetectedPattern, SupportResistanceZone, MarketTrend } from "../types.js";
import { Layers, Eye, EyeOff, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";

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
  showZones: boolean;
  showTrends: boolean;
  showVolume: boolean;
  // Controls for interactive zoom/scroll from parent if needed
  focusIndex?: number | null;
  onCandleClick?: (candle: Candle) => void;
  timeframe?: string;
}

export default function PriceActionChart({
  candles,
  patterns,
  zones,
  trend,
  selectedPattern,
  onSelectPattern,
  showPatterns,
  showZones,
  showTrends,
  showVolume,
  focusIndex = null,
  onCandleClick,
  timeframe,
}: PriceActionChartProps) {
  // Chart view state: indices of visible candles
  const totalCandles = candles.length;
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [startIndex, setStartIndex] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<number>(0);

  const [hoveredCandle, setHoveredCandle] = useState<{ candle: Candle; index: number } | null>(null);
  const [crosshairPos, setCrosshairPos] = useState<{ x: number; y: number; price: number; dateStr: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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
  const chartHeight = 380;
  const volumeHeight = 60;
  const totalChartHeight = chartHeight + (showVolume ? volumeHeight : 0);
  const chartWidth = 720; // Will scale responsively inside parent SVG viewBox
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

        const badgeColor = l.label.startsWith("H") ? "fill-[#00c805]" : "fill-[#ff3b30]";
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
        
        let borderClass = isPending ? "stroke-[#2663ff]/40" : (isBullish ? "stroke-[#00c805]/40" : "stroke-[#ff3b30]/40");
        let fillClass = isPending ? "fill-[#2663ff]/[0.02]" : (isBullish ? "fill-[#00c805]/[0.02]" : "fill-[#ff3b30]/[0.02]");

        if (isSelected) {
          borderClass = isPending 
            ? "stroke-[#2663ff] stroke-[1.5] drop-shadow-[0_0_4px_rgba(38,99,255,0.3)]" 
            : (isBullish 
              ? "stroke-[#00c805] stroke-[2] drop-shadow-[0_0_4px_rgba(0,200,5,0.3)]" 
              : "stroke-[#ff3b30] stroke-[2] drop-shadow-[0_0_4px_rgba(255,59,48,0.3)]");
          fillClass = isPending ? "fill-[#2663ff]/8" : (isBullish ? "fill-[#00c805]/10" : "fill-[#ff3b30]/10");
        }

        const labelText = getPatternLabel(pattern.type, pattern.name);
        const badgeWidth = labelText.length * 9.5 + 10;
        const badgeX = xStart + (width - badgeWidth) / 2;
        const badgeY = yTop - 15;

        let badgeBgClass = isPending 
          ? "fill-[#070d1a] stroke-[#2663ff]/40" 
          : (isBullish ? "fill-[#132c1e] stroke-[#24593b]" : "fill-[#3a1515] stroke-[#6e2727]");
        let textFillClass = isPending ? "fill-[#5185ff]" : (isBullish ? "fill-[#4ade80]" : "fill-[#f87171]");

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
    <div className="flex flex-col bg-[#0c0d10] border border-[#1e222d] rounded-2xl overflow-hidden shadow-2xl">
      {/* Chart Control Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-b border-[#1e222d] bg-[#000000] gap-2">
        <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-3">
          {/* S&P 500 Index Title / SPX 5m */}
          <div className="flex items-center gap-2">
            <span className="flex h-1.5 w-1.5 rounded-full bg-[#00c805] animate-pulse"></span>
            <h3 className="text-xs font-semibold text-slate-100 font-mono">
              {/* Desktop version */}
              <span className="hidden sm:inline">
                S&P 500 Index (SPX) <span className="text-[9px] bg-neutral-900 px-1.5 py-0.5 rounded text-slate-400 font-mono ml-1">{getDisplayTimeframe()}</span>
              </span>
              {/* Mobile version - centered or simple */}
              <span className="inline sm:hidden text-xs font-black tracking-widest text-white uppercase">
                SPX {timeframe ? timeframe.toLowerCase() : '5m'}
              </span>
            </h3>
          </div>

          {/* Clean scroll controls - on mobile keep them micro and on the right side of the header */}
          <div className="flex items-center gap-1 bg-[#000000] p-0.5 rounded-lg border border-[#1e222d]">
            <button
              onClick={handleScrollLeft}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="向左平移"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[8px] font-mono text-slate-500 px-1 select-none font-bold">
              平移
            </span>
            <button
              onClick={handleScrollRight}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="向右平移"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Price Action Details - clean and responsive */}
        <div className="min-h-[16px] flex items-center justify-start sm:justify-end">
          {hoveredCandle ? (
            <p className="text-[9px] sm:text-[10px] font-mono text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5">
              <span>时间: <b className="text-slate-200">{new Date(hoveredCandle.candle.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></span>
              <span>开: <b className="text-[#00c805]">{hoveredCandle.candle.open}</b></span>
              <span>高: <b className="text-[#00c805]">{hoveredCandle.candle.high}</b></span>
              <span>低: <b className="text-[#ff3b30]">{hoveredCandle.candle.low}</b></span>
              <span>收: <b className={hoveredCandle.candle.close >= hoveredCandle.candle.open ? "text-[#00c805]" : "text-[#ff3b30]"}>{hoveredCandle.candle.close}</b></span>
            </p>
          ) : (
            <p className="hidden sm:inline-block text-[10px] text-slate-500">
              提示：长按或悬停 K 线查看细节，拖动平移
            </p>
          )}
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
        className={`relative w-full select-none ${isDragging ? "cursor-grabbing" : "cursor-crosshair"}`}
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
            min={15}
            max={Math.min(totalCandles, 150)}
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
              const strokeColor = isBullish ? "stroke-[#00c805]" : "stroke-[#ff3b30]";
              const fillColor = isBullish ? "fill-[#00c805]" : "fill-[#ff3b30]";
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
                const fillClass = isBullish ? "fill-[#00c805]/20" : "fill-[#ff3b30]/20";

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
