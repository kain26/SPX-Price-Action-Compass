# SPX Price Action Compass (SPX 价格行为罗盘) - 项目系统架构文档

本项目是一套全栈式（React + TypeScript + Node.js/Express）高交互性价格行为（Price Action）深度分析与复盘系统。下面为您详细梳理本项目的整体技术设计与核心架构体系。

---

## 🧭 架构总览 (System Architecture)

系统由**前端渲染交互层（SVG Canvas 引擎）**与**后端服务及数据同步层（JSON Cache Server）**组成，两层之间通过 API 接口进行毫秒级数据交换与算法计算。

```
                    ┌──────────────────────────────────────────────┐
                    │               Web Browser (Client)           │
                    │  ┌────────────────────────────────────────┐  │
                    │  │            React SPA Context           │  │
                    │  └───────────────────▲────────────────────┘  │
                    │                      │ (Data Sync/Zoom/Drag) │
                    │  ┌───────────────────▼────────────────────┐  │
                    │  │    Custom High-Performance SVG Canvas  │  │
                    │  └────────────────────────────────────────┘  │
                    └──────────────────────▲───────────────────────┘
                                           │
                                           │ HTTP REST APIs (/api/spx)
                                           │
                    ┌──────────────────────▼───────────────────────┐
                    │             Node.js / Express Server         │
                    │  ┌────────────────────────────────────────┐  │
                    │  │             REST API Handlers          │  │
                    │  └───────────────────▲────────────────────┘  │
                    │                      │ (File System I/O)     │
                    │  ┌───────────────────▼────────────────────┐  │
                    │  │      Local JSON Storage Cache Manager   │  │
                    │  └───────────────────▲────────────────────┘  │
                    │                      │ (Auto Incremental Sync)│
                    │  ┌───────────────────▼────────────────────┐  │
                    │  │      Yahoo Finance API Proxy Engine     │  │
                    │  └────────────────────────────────────────┘  │
                    └──────────────────────────────────────────────┘
```

---

## 📂 核心目录结构说明 (Directory Structure)

```bash
├── README.md               # 快速启动与用户指南
├── ARCHITECTURE.md         # 项目核心架构文档 (本文件)
├── package.json            # 依赖与打包脚本配置
├── server.ts               # 后端 Express 服务器入口与数据同步调度引擎
├── data/                   # 缓存的本地 K 线 JSON 数据集 (按周期分级)
│   ├── spx_1m.json
│   ├── spx_5m.json
│   ├── spx_15m.json
│   ├── spx_4h.json
│   └── spx_1d.json
└── src/                    # 前端代码目录
    ├── main.tsx            # React 入口点
    ├── index.css           # Tailwind CSS 全局配置与极客深色系皮肤 (Dark Slate Theme)
    ├── App.tsx             # 顶层布局容器，主导时间周期、形态控制和主要交互状态
    ├── types.ts            # 全量 TypeScript 严格类型接口 (Candle, Pattern, Zones...)
    ├── components/         # 模块化前端视图组件
    │   ├── PriceActionChart.tsx   # 核心组件：高精度 SVG 矢量 K 线图 canvas（包含平移、缩放、十字光标）
    │   ├── PatternList.tsx        # 信号分析面板：检测到的形态列表与过滤器
    │   └── ChallengeMode.tsx      # 交易强化复盘：盲盒挑战训练器（支持下一根K线和历史下钻）
    └── utils/              # 价格行为基础数学/几何识别算法
        ├── patternDetector.ts     # 核心算法：100% 离线确定性 Swing 极点、支阻聚类与经典形态识别
        ├── yahooFinance.ts        # 雅虎财经 API 数据获取及 4H 周期定制化合成分流工具
        └── spxGenerator.ts        # 无网络模式下的极速高仿真 SPX 行情冷启动生成器
```

---

## 🎨 前端系统设计 (Frontend Deep Dive)

### 1. 极致轻量的纯 SVG Canvas K 线引擎
为避免传统第三方 Chart 库带来的打包臃肿和定制限制，我们通过 **React + SVG** 重构了底层绘图层。
- **自适应视口比例**：通过 `viewBox` 与容器 `ResizeObserver` 达成多终端（手机、Pad、PC）的完美像素级缩放。
- **高频交互性能**：鼠标悬停（Hover）、触摸长按（TouchPress）时，系统利用高性能指针索引定位，提供几乎 0 延迟的十字虚线与坐标轴价格/时间标签高亮。
- **浮动式缩放滑块 (Zoom Control)**：在图表右下角集成浮动 `[+]` `[-]` 以及高灵敏度滑动条，帮助手机端和电脑端用户随时调整图表一屏容纳的 K 线数量 (15 - 150根)。

### 2. 紧凑型手机 Web 极简优化
针对移动端窄屏设计，我们进行了控制链路的扁平与收纳重构：
- **时间周期收纳**：将原有的 5 组独立文本按钮收纳为一体化的 `时间周期: 5m [▼]` 弹出式选择下拉。
- **功能快捷工具条 (Toolbar)**：将 `支撑/阻力`、`图上形态`、`HH/LL`、`成交量` 及 `筛选` 聚拢为单行无边框快捷控制排，默认仅显示高对比度微型图标，极大地释放了 K 线图表的纵向显示高度。
- **自然滑动手势**：支持移动端单指滑动平移图表，长按精准定位，无需繁琐的操作指南。

---

## ⚙️ 后端数据流与离线算法 (Backend & Data Pipeline)

### 1. 本地双缓存及自动增量更新引擎
- **冷启动与就地恢复**：服务器启动时，首先尝试读取本地 `data/*.json` 缓存。如果不存在，则通过 `spxGenerator.ts` 提供高仿真历史行情进行保底填充。
- **Yahoo Finance 数据防抖**：通过 `fetchYahooFinanceSPXGeneric` 自动拉取实时数据。获取后使用 `mergeCandles` 函数进行主键（时间戳）覆盖去重，保证数据高可靠度合并，同时进行定制级 K 线（如 1H 合成 4H）的计算。
- **每日定时刷新**：内置纽约时间 16:18 收盘检测机制，自动执行数据拉取与追加，保持本地行情的每日自生长。

### 2. 价格行为（Price Action）识别算法（全离线运行）
项目彻底摒弃了繁重的大模型 API，完全基于**纯几何与数学公式**，提供高性能的离线识别：
- **Swing High / Low 极点识别**：利用前后向局部最大值滚动窗口，精准挖掘波段极点。
- **AGGLOMERATIVE 一维层级聚类算法**：对历史极点价格在数轴上按 $0.12\% - 0.15\%$ 的极限公差进行归类聚类，提取出支撑和阻力带。触碰次数高代表该带更强。
- **经典的几何约束判定**：
  - **Pin Bar**：影线长度 > 60%，实体 < 30%，反向影线 < 15%。
  - **Inside Bar & Engulfing**：基于多根相邻 K 线的高低点与开收价几何包容性。
  - **双顶双底 / 头肩顶 / 收敛三角形**：通过计算波段高低极点的时间跨度与斜率变化进行逻辑标定。

---

## 🌐 线上部署与在线访问 (Deployment & Online Access)

本项目可在各大主流容器平台及 Cloud Run 服务中秒级构建部署。

- **官方推荐在线访问地址**: [https://spx-price-action-compass-773950940183.asia-south1.run.app/](https://spx-price-action-compass-773950940183.asia-south1.run.app/)
