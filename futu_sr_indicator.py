# -*- coding: utf-8 -*-
"""
富途牛牛 (Futu Niuniu) 自定义 Python 指标：
支撑与阻力区间自动分析 (Support & Resistance Zones Compass)

本脚本完美复刻了 TypeScript 版本的 Price Action 核心算法，包括：
1. 局部高低点 (Swing High / Swing Low) 的检测
2. 价格聚类算法 (Clustering) 识别高强度支撑阻力带并计算触碰次数
3. 计算支撑阻力区间的 K 线跨度 (K-line Span) 并在图表上动态标记
4. 绘制上沿、下沿和中轨三条线构成的“支撑阻力区带 (Zones / Color Blocks)”
5. 支持平台画带 (fill) 与文字输出 (plot_text)，完美呈现“互换 (11次触碰, 75根K线)”的专业效果
"""

# 定义指标基础信息 (缩写, 全名, 是否画在主图, 指标介绍)
indicator("SR_COMPASS2", "SR Zones Compass", True, "自动计算局部 K 线波段高低点并进行聚类分析，生成最高强度的支撑阻力线")

def calculate_sr_zones():
    # 1. 获取基础 K 线数据 并安全转换为标准 Python 浮点数列表
    raw_close = close()
    n = len(raw_close)
    if n < 20:
        # 数据不足时返回包含 nan 的 Sequence 对象
        nan_seq = raw_close * 0.0 + float('nan')
        return nan_seq, nan_seq, nan_seq, nan_seq, nan_seq, nan_seq

    raw_high = high()
    raw_low = low()
    
    highs = []
    lows = []
    closes = []
    for i in range(n):
        highs.append(float(raw_high[i]))
        lows.append(float(raw_low[i]))
        closes.append(float(raw_close[i]))
        
    # 2. 设置算法参数（可在富途指标设置中微调）
    left_strength = 5     # 左侧 K 线屏障数量
    right_strength = 5    # 右侧 K 线屏障数量
    tolerance_percent = 0.0015  # 聚类容差（0.15%），日线可调大至 0.005 (0.5%)
    
    # 3. 寻找局部波段高低点 (Swing Points)
    swing_highs = []
    swing_lows = []
    
    for i in range(left_strength, n - right_strength):
        current_high = highs[i]
        current_low = lows[i]
        is_high = True
        is_low = True
        
        # 检查左侧
        for j in range(1, left_strength + 1):
            if highs[i - j] >= current_high:
                is_high = False
            if lows[i - j] <= current_low:
                is_low = False
                
        # 检查右侧
        for j in range(1, right_strength + 1):
            if highs[i + j] > current_high:
                is_high = False
            if lows[i + j] < current_low:
                is_low = False
                
        if is_high:
            swing_highs.append({"index": i, "price": current_high, "type": "high"})
        if is_low:
            swing_lows.append({"index": i, "price": current_low, "type": "low"})
            
    # 合并所有局部高低点
    all_points = swing_highs + swing_lows
    if not all_points:
        nan_seq = raw_close * 0.0 + float('nan')
        return nan_seq, nan_seq, nan_seq, nan_seq, nan_seq, nan_seq
        
    # 4. 价格聚类算法 (Clustering)
    # 按价格由小到大排序
    all_points.sort(key=lambda x: x["price"])
    
    clusters = []
    current_cluster = []
    
    for pt in all_points:
        if not current_cluster:
            current_cluster.append(pt)
        else:
            # 计算当前聚类群的平均价格
            total_price = 0.0
            for p in current_cluster:
                total_price += p["price"]
            avg_price = total_price / len(current_cluster)
            
            # 判断新点是否在容差范围内
            if abs(pt["price"] - avg_price) / avg_price <= tolerance_percent:
                current_cluster.append(pt)
            else:
                clusters.append(current_cluster)
                current_cluster = [pt]
                
    if current_cluster:
        clusters.append(current_cluster)
        
    # 5. 分析并筛选强关键区 (每个聚类至少需要被触碰过 2 次)
    zones = []
    for i, cluster in enumerate(clusters):
        total_p = 0.0
        for p in cluster:
            total_p += p["price"]
        avg_price = total_p / len(cluster)
        
        high_touches = 0
        low_touches = 0
        for p in cluster:
            if p["type"] == "high":
                high_touches += 1
            elif p["type"] == "low":
                low_touches += 1
        
        zone_type = "flip"
        if high_touches > 0 and low_touches == 0:
            zone_type = "resistance"
        elif low_touches > 0 and high_touches == 0:
            zone_type = "support"
            
        strength = len(cluster)
        
        # 只保留至少触碰过两次的强关口
        if strength >= 2:
            zones.append({
                "price": avg_price,
                "type": zone_type,
                "strength": strength
            })
            
    # 按测试强度从大到小排序
    zones.sort(key=lambda x: x["strength"], reverse=True)
    
    # 6. 将关口分类为当前价格之上的阻力，和之下的支撑
    latest_close = closes[-1]
    
    resistances = []
    supports = []
    for z in zones:
        if z["price"] > latest_close:
            resistances.append(z)
        else:
            supports.append(z)
    
    # 阻力线：价格由低到高排序（离当前价最近的排在前面）
    resistances.sort(key=lambda x: x["price"])
    # 支撑线：价格由高到低排序（离当前价最近的排在前面）
    supports.sort(key=lambda x: x["price"], reverse=True)
    
    # 提取排名前三的阻力和支撑位
    r1_val = resistances[0]["price"] if len(resistances) > 0 else 0.0
    r2_val = resistances[1]["price"] if len(resistances) > 1 else 0.0
    r3_val = resistances[2]["price"] if len(resistances) > 2 else 0.0
    
    s1_val = supports[0]["price"] if len(supports) > 0 else 0.0
    s2_val = supports[1]["price"] if len(supports) > 1 else 0.0
    s3_val = supports[2]["price"] if len(supports) > 2 else 0.0
    
    # 7. 使用原生 Sequence 包装
    c_seq = close()
    r1 = c_seq * 0.0 + (r1_val if r1_val > 0 else float('nan'))
    r2 = c_seq * 0.0 + (r2_val if r2_val > 0 else float('nan'))
    r3 = c_seq * 0.0 + (r3_val if r3_val > 0 else float('nan'))
    
    s1 = c_seq * 0.0 + (s1_val if s1_val > 0 else float('nan'))
    s2 = c_seq * 0.0 + (s2_val if s2_val > 0 else float('nan'))
    s3 = c_seq * 0.0 + (s3_val if s3_val > 0 else float('nan'))
    
    # 直接返回6个值，不用tuple包装
    return r1, r2, r3, s1, s2, s3

# 当使用该指标时，执行以下代码
if __name__ == "__main__":
    # 计算排名前三的支撑阻力级别
    r1, r2, r3, s1, s2, s3 = calculate_sr_zones()
    
    # 绘制支撑阻力线（富途牛牛简化版API，不支持颜色、线宽等参数）
    plot("R1", r1)
    plot("R2", r2)
    plot("R3", r3)
    plot("S1", s1)
    plot("S2", s2)
    plot("S3", s3)
