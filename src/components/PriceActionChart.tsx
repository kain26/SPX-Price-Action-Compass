import React, { useState, useRef, useEffect } from "react";
import { Candle, DetectedPattern, SupportResistanceZone, MarketTrend } from "../types.js";
import { Layers, Eye, EyeOff, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";

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

  // Initialize view: scroll to the very end but leave a beautiful blank padding on the right
  useEffect(() => {
    if (totalCandles > 0) {
      const defaultZoom = Math.min(totalCandles, 100);
      setZoomLevel(defaultZoom);
      const pad = Math.max(8, Math.floor(defaultZoom * 0.15));
      setStartIndex(Math.max(0, totalCandles - defaultZoom + pad));
    }
  }, [totalCandles]);

  // Adjust view when focusIndex is requested (e.g. clicking a pattern in the sidebar)
  useEffect(() => {
    if (focusIndex !== null && focusIndex !== undefined && focusIndex >= 0 && focusIndex < totalCandles) {
      // Center the focused index in the view
      const halfZoom = Math.floor(zoomLevel / 2);
      const targetStart = Math.max(0, Math.min(maxStartIndex, focusIndex - halfZoom));
      setStartIndex(targetStart);
    }
  }, [focusIndex, zoomLevel, maxStartIndex]);

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

  // Coordinate projection helper
  const getX = (indexInVisible: number) => {
    const candleWidth = chartWidth / zoomLevel;
    const val = indexInVisible * candleWidth + candleWidth / 2;
    return isNaN(val) || !isFinite(val) ? 0 : val;
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

  const handleMouseMove = (e: React.MouseEvent) => {
    // Tooltip/hover candle & crosshair detection
    if (containerRef.current && totalCandles > 0) {
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      
      // Map client position to SVG viewBox coordinates (width = 720)
      const svgX = (clientX / rect.width) * chartWidth;
      const svgY = (clientY / rect.height) * totalChartHeight;
      
      const clampedX = Math.max(0, Math.min(chartWidth, svgX));
      const clampedY = Math.max(0, Math.min(totalChartHeight, svgY));
      
      const candleWidth = chartWidth / zoomLevel;
      const relativeIndex = Math.floor(clampedX / candleWidth);
      const actualIndexInVisible = Math.max(0, Math.min(visibleCandles.length - 1, relativeIndex));
      const candle = visibleCandles[actualIndexInVisible];
      
      if (candle) {
        const actualIndex = startIndex + actualIndexInVisible;
        setHoveredCandle({ candle, index: actualIndex });
        
        // Calculate price corresponding to clampedY
        const priceY = minPrice + priceRange * (chartHeight - 20 - clampedY) / (chartHeight - 40);
        
        // Format date and time
        const d = new Date(candle.time);
        let dateStr = "";
        const daysOfWeek = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
        const datePart = d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
        
        // If daily view or timeframe has 00:00:00 (daily), omit hours/mins
        if (zoomLevel > 300 || (d.getHours() === 0 && d.getMinutes() === 0)) {
          dateStr = `${datePart} ${daysOfWeek[d.getDay()]}`;
        } else {
          const timePart = d.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" });
          dateStr = `${datePart} ${timePart}`;
        }
        
        setCrosshairPos({
          x: getX(actualIndexInVisible),
          y: clampedY,
          price: priceY,
          dateStr,
        });
      }
    }

    if (!isDragging) return;

    const deltaX = e.clientX - dragStart;
    const candleWidth = containerRef.current ? containerRef.current.clientWidth / zoomLevel : 8;
    const candlesMoved = Math.round(deltaX / candleWidth);

    if (Math.abs(candlesMoved) >= 1) {
      setStartIndex(prev => Math.max(0, Math.min(maxStartIndex, prev - candlesMoved)));
      setDragStart(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredCandle(null);
    setCrosshairPos(null);
  };

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
      const minBoundY = getY(zone.minPrice);
      const maxBoundY = getY(zone.maxPrice);
      const bandHeight = Math.max(4, Math.abs(minBoundY - maxBoundY));

      if (isNaN(y) || isNaN(minBoundY) || isNaN(maxBoundY) || isNaN(bandHeight)) return null;

      const isSupport = zone.type === "support";
      const isResistance = zone.type === "resistance";
      const colorClass = isSupport 
        ? "fill-[#00c805]/5 stroke-[#00c805]/20" 
        : isResistance 
          ? "fill-[#ff3b30]/5 stroke-[#ff3b30]/20" 
          : "fill-amber-500/5 stroke-amber-500/20";

      return (
        <g key={zone.id} className="transition-all duration-300">
          {/* Main Translucent Zone Band */}
          <rect
            x={0}
            y={Math.min(minBoundY, maxBoundY)}
            width={chartWidth}
            height={bandHeight}
            className={`${colorClass} stroke-1`}
          />
          {/* Level Dashed Line */}
          <line
            x1={0}
            y1={y}
            x2={chartWidth}
            y2={y}
            className={
              isSupport 
                ? "stroke-[#00c805]/30 stroke-[1] stroke-dasharray-[3,3]" 
                : isResistance 
                  ? "stroke-[#ff3b30]/30 stroke-[1] stroke-dasharray-[3,3]" 
                  : "stroke-amber-400/30 stroke-[1] stroke-dasharray-[3,3]"
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
            {zone.type === "support" ? "支撑" : zone.type === "resistance" ? "阻力" : "互换"} ({zone.strength}次触碰, 21天): {zone.price}
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
        const isBullish = pattern.type.includes("BULLISH") || pattern.type.includes("BOTTOM") || pattern.type.includes("MORNING");
        
        let borderClass = isBullish ? "stroke-[#00c805]/40" : "stroke-[#ff3b30]/40";
        let fillClass = isBullish ? "fill-[#00c805]/[0.02]" : "fill-[#ff3b30]/[0.02]";

        if (isSelected) {
          borderClass = isBullish ? "stroke-[#00c805] stroke-[2] drop-shadow-[0_0_4px_rgba(0,200,5,0.3)]" : "stroke-[#ff3b30] stroke-[2] drop-shadow-[0_0_4px_rgba(255,59,48,0.3)]";
          fillClass = isBullish ? "fill-[#00c805]/10" : "fill-[#ff3b30]/10";
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
            {/* Pattern Badge on Top */}
            <rect
              x={xStart + (width - 70) / 2}
              y={yTop - 12}
              width={70}
              height={12}
              rx={2}
              className={isSelected ? "fill-blue-600" : "fill-slate-800 group-hover:fill-slate-700"}
            />
            <text
              x={xStart + width / 2}
              y={yTop - 3}
              textAnchor="middle"
              className={`font-sans text-[7px] font-bold ${isSelected ? "fill-white" : "fill-slate-300"}`}
            >
              {pattern.label.split(" ")[0]}
            </text>
          </g>
        );
      })
      .filter(Boolean);
  };

  return (
    <div className="flex flex-col bg-[#0c0d10] border border-[#1e222d] rounded-2xl overflow-hidden shadow-2xl">
      {/* Chart Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-[#1e222d] bg-[#000000] gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 rounded-full bg-[#00c805]"></span>
          <div className="flex flex-col">
            <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
              S&P 500 Index (SPX) <span className="text-[9px] bg-neutral-900 px-1.5 py-0.5 rounded text-slate-400 font-mono">5 MIN</span>
            </h3>
            {hoveredCandle ? (
              <p className="text-[10px] font-mono text-slate-400 flex gap-2.5 mt-0.5">
                <span>时间: <b className="text-slate-200">{new Date(hoveredCandle.candle.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></span>
                <span>O: <b className="text-[#00c805]">{hoveredCandle.candle.open}</b></span>
                <span>H: <b className="text-[#00c805]">{hoveredCandle.candle.high}</b></span>
                <span>L: <b className="text-[#ff3b30]">{hoveredCandle.candle.low}</b></span>
                <span>C: <b className={hoveredCandle.candle.close >= hoveredCandle.candle.open ? "text-[#00c805]" : "text-[#ff3b30]"}>{hoveredCandle.candle.close}</b></span>
                {hoveredCandle.candle.isReal ? (
                  <span className="text-[9px] bg-neutral-900 text-slate-300 px-1 rounded font-sans">REAL</span>
                ) : (
                  <span className="text-[9px] bg-neutral-900 text-slate-400 px-1 rounded font-sans">SIM</span>
                )}
              </p>
            ) : (
              <p className="text-[10px] text-slate-500 mt-0.5">鼠标悬停 K 线或按住鼠标左右拖拽平移</p>
            )}
          </div>
        </div>

        {/* Timeline Navigation Controls (Zoom & Scroll) */}
        <div className="flex items-center gap-1.5 bg-[#000000] p-1 rounded-xl border border-[#1e222d]">
          <button
            onClick={handleScrollLeft}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="向左移动图表 (历史)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleZoomOut}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="缩小 (查看更多 K 线)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-[9px] px-1.5 font-mono text-slate-400 select-none font-bold">
            {zoomLevel} 根K线
          </span>

          <button
            onClick={handleZoomIn}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="放大 (查看 K 线细节)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            onClick={handleScrollRight}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="向右移动图表 (最新)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className={`relative w-full select-none ${isDragging ? "cursor-grabbing" : "cursor-crosshair"}`}
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${totalChartHeight}`}
          width="100%"
          height="100%"
          className="overflow-visible"
        >
          {/* Grid lines */}
          <g className="stroke-[#16181d] stroke-[0.5]">
            {/* Horizontal grids */}
            {Array.from({ length: 6 }).map((_, i) => {
              const p = minPrice + (priceRange / 5) * i;
              const y = getY(p);
              return (
                <g key={`grid-h-${i}`}>
                  <line x1={0} y1={y} x2={chartWidth} y2={y} strokeDasharray="3,3" />
                  <text
                    x={5}
                    y={y + 11}
                    className="fill-slate-600 font-mono text-[9px]"
                  >
                    {Math.round(p)}
                  </text>
                </g>
              );
            })}

            {/* Vertical grid lines (Trading day breaks) */}
            {visibleCandles.map((c, i) => {
              const date = new Date(c.time);
              const isMarketOpen = date.getHours() === 9 && date.getMinutes() === 30;
              if (isMarketOpen) {
                const x = getX(i);
                return (
                  <g key={`grid-v-${i}`}>
                    <line x1={x} y1={0} x2={x} y2={totalChartHeight} className="stroke-[#1e222d] stroke-[0.8] stroke-dasharray-[2,2]" />
                    <text
                      x={x + 3}
                      y={12}
                      className="fill-slate-500 font-sans text-[8px]"
                    >
                      {date.toLocaleDateString([], { month: "short", day: "numeric" })}
                    </text>
                  </g>
                );
              }
              return null;
            })}
          </g>

          {/* Render Support & Resistance zones */}
          {renderSRZones()}

          {/* Candlestick drawing */}
          <g>
            {visibleCandles.map((c, i) => {
              const x = getX(i);
              const yOpen = getY(c.open);
              const yClose = getY(c.close);
              const yHigh = getY(c.high);
              const yLow = getY(c.low);

              const isBullish = c.close >= c.open;
              const strokeColor = isBullish ? "stroke-[#00c805]" : "stroke-[#ff3b30]";
              const fillColor = isBullish ? "fill-[#00c805]" : "fill-[#ff3b30]";
              const candleWidth = Math.max(1.5, (chartWidth / zoomLevel) * 0.75);

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
              <line x1={0} y1={chartHeight} x2={chartWidth} y2={chartHeight} className="stroke-[#1e222d] stroke-[1]" />
              {visibleCandles.map((c, i) => {
                const x = getX(i);
                const yVol = getVolY(c.volume);
                const candleWidth = Math.max(1.5, (chartWidth / zoomLevel) * 0.7);
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
              {/* Vertical line */}
              <line
                x1={crosshairPos.x}
                y1={0}
                x2={crosshairPos.x}
                y2={totalChartHeight}
                className="stroke-slate-400 stroke-[0.8]"
                strokeDasharray="3,3"
              />
              {/* Horizontal line */}
              <line
                x1={0}
                y1={crosshairPos.y}
                x2={chartWidth}
                y2={crosshairPos.y}
                className="stroke-slate-400 stroke-[0.8]"
                strokeDasharray="3,3"
              />
              {/* Price badge (left axis) */}
              <g transform={`translate(2, ${Math.max(2, Math.min(totalChartHeight - 18, crosshairPos.y - 8))})`}>
                <rect x={0} y={0} width={50} height={16} rx={3} fill="#000000" stroke="#1e222d" strokeWidth={1} />
                <text x={25} y={11} textAnchor="middle" className="fill-white font-mono text-[9px] font-bold">
                  {crosshairPos.price.toFixed(2)}
                </text>
              </g>
              {/* Date/Time badge (bottom axis) */}
              <g transform={`translate(${Math.max(50, Math.min(chartWidth - 50, crosshairPos.x)) - 50}, ${totalChartHeight - 18})`}>
                <rect x={0} y={0} width={100} height={16} rx={3} fill="#000000" stroke="#1e222d" strokeWidth={1} />
                <text x={50} y={11} textAnchor="middle" className="fill-slate-200 font-sans text-[8px] font-bold">
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
          范围: {new Date(visibleCandles[0]?.time).toLocaleString()} ~ {new Date(visibleCandles[visibleCandles.length - 1]?.time).toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <span>{totalCandles} 根数据点</span>
        </div>
      </div>
    </div>
  );
}
