# SPX Price Action Compass (SPX 价格行为罗盘)

`SPX Price Action Compass` 是一款专为标普500指数（SPX）打造的高交互性价格行为（Price Action）深度分析与复盘系统。它集成了多周期行情图表、日内高精精细走势下钻、自动价格行为模式识别、支撑/阻力位（S&R）动态检测，助力投资者快速精通盘面结构。

该项目完全开源，无任何广告及无关商业跟踪组件，专为注重技术分析与流畅体验的交易员和研究者设计。

---

## 🌟 核心特性 (Key Features)

- **📈 多周期券商级K线展示 (Multi-Timeframe Charts)**
  - 支持 **1分钟（1m K）**、**5分钟（5m K）**、**15分钟（15m K）**、**4小时（4h K）** 以及 **日线（日 K）**。
  - 数据由后端自动拼接合规且具有代表性的指数交易时段真实 K 线。

- **⚡ 每日自动增量更新 & 本地极速缓存 (Fast Local Caching)**
  - 拥有智能的本地 JSON 数据文件双缓存机制，所有周期的行情文件自动在服务端离线沉淀。
  - 引入**每日自动更新机制**（纽约时间每日 16:18 收盘后自动触发多周期全量增量拉取），无需频繁向第三方 API 发送请求，图表加载瞬间完成。

- **🔍 日K线一键下钻日内5分钟走势 (Intraday 5m Drilldown)**
  - 在日 K 图表模式下，鼠标轻点任意一根历史日 K 线，系统将自动向后台查询并动态组装**该交易日专属的5分钟超高精细分时走势图**。
  - 分时走势中同样附带高精统计面板（日内开/收/最高/最低），支持完整的技术复盘。

- **🎯 鼠标十字准线与实时刻度 (Professional Crosshair)**
  - 完美复刻专业券商软件的交互体验，鼠标在图表上滑动时自动呈现十字虚线。
  - 坐标轴左侧和底部实时同步高亮当前鼠标指向的**价格（Price）**与**精确交易时间标签（Time Badge）**。

- **🏷️ 自动化价格行为算法标记 (Auto Price Action Labeling)**
  - 采用高度精确的数学几何模型，100% 离线、实时识别经典的 K 线和形态学价格行为（不依赖任何 AI 大模型，全本地高性能运行）。
  - 支持趋势结构点自动打标：最高点（HH）、次高点（LH）、最低点（LL）、次低点（HL）。
  - 动态识别并描绘历史交易密集区的支撑与阻力带（Support & Resistance Zones）。

---

## 🔬 价格行为（Price Action）识别算法原理 (Algorithm Principles)

系统完全基于 **Al Brooks** 与 **Bob Volman** 的经典价格行为理论，编写了一套高精度、无延迟、确定性的量化分析算法。算法核心逻辑位于 `/src/utils/patternDetector.ts` 中：

### 1. 局部波段极点检测 (Swing Points Detection)
* **原理**：通过在指定周期内实施前向与后向的双向滑动窗口（Lookback/Lookforward）对比，寻找局部的高点和低点（Local Swings）。
* **判定标准**：若某一根 K 线的 `high` 大于其左右相邻各 $N$ 根 K 线的 `high`，则标记为 **Swing High**；反之，若 `low` 小于其左右相邻各 $N$ 根 K 线的 `low`，则标记为 **Swing Low**。

### 2. 市场结构标签 (Market Structure Classification)
* **HH (Higher High)**：当前波段高点高于前一个波段高点。
* **LH (Lower High)**：当前波段高点低于前一个波段高点。
* **HL (Higher Low)**：当前波段低点高于前一个波段低点。
* **LL (Lower Low)**：当前波段低点低于前一个波段低点。
* **趋势判定**：通过综合最近 K 线的平均斜率以及 HH/HL、LH/LL 的出现频率，动态量化当前市场的整体方向（上涨、下跌、或横盘震荡）以及趋势强度。

### 3. 动态支撑/阻力带聚类 (S&R Zones Clustering)
* **原理**：将历史上的所有 Swing High 和 Swing Low 点的价格映射到一维数轴上。
* **聚类计算**：采用一维近似凝聚层级聚类（Agglomerative Clustering）思想。如果多个极点价格在极小公差百分比（例如 $0.12\% - 0.15\%$）范围内重合，则它们会被归入同一个价格簇。
* **判定与强度**：
  - **阻力位 (Resistance)**：仅包含 Swing High 的价格簇。
  - **支撑位 (Support)**：仅包含 Swing Low 的价格簇。
  - **互换位 (Flip)**：同时包含 Swing High 和 Swing Low 的价格簇（经典支阻互换）。
  - **筛选**：过滤掉触碰次数小于 2 的噪声区间，仅保留触碰次数最多的 Top 8 强阻力与强支撑区间进行可视化，避免图表混乱。

### 4. 经典单 K 线与多 K 线形态判定 (Candlestick Pattern Recognition)
我们根据 K 线的**实体大小、上下影线比例以及与历史平均波动范围（ATR 近似值）的关系**，进行极其严格的几何条件约束：
* **Doji (十字星)**：K 线实体占比极小（`body / range < 8%`），且波动区间属于正常范围。表明多空陷入绝对均衡。
* **Pin Bar (针形线 / 锤子线 / 射击之星)**：
  - **看涨 Pin Bar**：下影线占比极长（`lowerShadow > range * 60%`），上影线占比极短（`upperShadow < 15%`），且实体占比小（`bodyRatio < 30%`）。代表下方买盘极强，拒绝低价。
  - **看跌 Pin Bar**：上影线占比极长（`upperShadow > range * 60%`），下影线占比极短（`lowerShadow < 15%`），且实体占比小（`bodyRatio < 30%`）。代表上方抛压极大，拒绝高价。
* **Inside Bar (内含线)**：当前 K 线的最高价与最低价完全包裹在前一根 K 线的波动范围之内。代表波动率收窄，通常是突破的前兆。
* **Engulfing (吞没形态)**：当前 K 线实体完全反向包裹了前一根 K 线的实体，并且伴随着波动范围的扩大。
* **Morning/Evening Star (晨星/暮星)**：经典三 K 线组合，判定首根大K线的方向、中间十字星（小实体）以及第三根反向大 K 线对首根 K 线实体的深幅穿透比例。

### 5. 复杂几何形态识别 (Chart Patterns)
* **双顶 (Double Top) / 双底 (Double Bottom)**：寻找连续的两个 Swing High / Low 极点，要求它们的价格差异在极小阈值内，且两点在时间轴上存在适当的距离（例如 $8 - 40$ 根 K 线），从而排除微型盘整干扰。
* **头肩形态 (Head & Shoulders)**：检测相邻的三个 Swing High 点。要求中间的点（头部）明显高于左右两边（左肩、右肩），且左右两肩的价格高度基本对称。
* **收敛三角形 (Triangles)**：当连续 3 个局部高点呈现递减斜率，而 3 个局部低点呈现递增斜率时，判定为对称三角形（Symmetrical Triangle）。单边持平则标记为上升/下降三角形。

---

## 🤝 欢迎指正与优化 (Contributions Welcome!)

虽然我们现在的算法已经能够极高精度地还原盘面价格行为，但真实的金融市场千变万化，阈值的设定（如影线占比、聚类公差等）在不同市场周期或不同时间框架下可能存在局限性。

**我们非常期待和欢迎您对我们的识别算法进行优化、调参或重构：**
- **更优的聚类算法**：如使用网格密度或 1D DBSCAN 来提高支撑阻力区间的定位精度。
- **动态阈值系统**：引入自适应 ATR 来动态调节 Pin Bar 和 吞没形态的判定条件。
- **新形态支撑**：如识别 FVG (Fair Value Gap 公允价值缺口)、OB (Order Block 订单块) 等现代价格行为概念。

如果您发现任何识别偏差，或者有更优雅的数学判定模型，欢迎提交意见或参与修改，我们一起打造最纯粹、最强大的价格行为复盘罗盘！

---

## 🏗️ 系统架构 & 部署地址 (Architecture & Live Demo)

SPX Price Action Compass 采用优雅的现代全栈架构：

- **🌐 在线演示地址**: [https://spx-price-action-compass-773950940183.europe-west2.run.app/](https://spx-price-action-compass-773950940183.europe-west2.run.app/)
- **📑 核心项目架构说明书**: 详情请参阅项目根目录下的 [ARCHITECTURE.md](ARCHITECTURE.md) 指引，涵盖了底层 SVG 矢量绘图引擎、一维凝聚层级聚类算法、以及全离线价格行为探测指标判定逻辑。

---

## 🔄 自动化持续集成与部署 (CI/CD Pipeline)

本项目已实现 **100% 自动化的 CI/CD 持续集成与持续部署**。采用 **GitHub**、**Google Cloud Build** 与 **Google Cloud Run** 的原生云原生方案：

- **⚡ 自动触发 (Continuous Integration)**：
  当有新的提交被推送（Push）或合并（Merge）到 GitHub 的 `main` 分支时，将通过 Google Cloud 的 Webhook 机制无缝触发持续集成流水线。
- **🐳 容器化多阶段构建 (Dockerized Build)**：
  - 流水线会自动读取项目根目录下的 `Dockerfile`，采用轻量级、安全的 `node:22-alpine` 基础镜像进行**多阶段构建 (Multi-stage Build)**。
  - **Builder 阶段**：安装全部依赖，执行前端资产打包与后端 TypeScript 服务器混淆编译 (`npm run build`)，将 `server.ts` 及其引用的文件打包为单一、极速启动的 `dist/server.cjs` 模块。
  - **Runner 阶段**：仅保留生产环境必需的轻量运行时和 `dist/`、`data/` 目录，剔除不必要的 `node_modules` 及开发工具，确保镜像精简、冷启动响应速度极快。
- **🚀 无缝滚动部署 (Continuous Deployment)**：
  编译并打包成 Docker 镜像后，系统将自动发布到 **Google Artifact Registry**，并秒级部署至 **Google Cloud Run**。支持**零停机时间（Zero-downtime）**滚动升级和自动弹性伸缩（Scale to Zero），保障系统始终高可用。

### 技术选型 (Tech Stack)

- **Frontend:**
  - **React 18** & **TypeScript** — 保证组件高度模块化与高类型安全。
  - **Tailwind CSS** — 精致轻量、高对比度的深色极客风（Dark Slate Theme）视觉设计。
  - **Custom Canvas & SVG Engine** — 弃用臃肿的第三方图表库，采用轻量级、高性能的纯 SVG 矢量图表引擎，带来极致平滑的拖拽（Drag & Pan）和缩放（Zoom）体验。

- **Backend:**
  - **Node.js** & **Express** — 处理图表的多周期行情数据分发与增量文件合并。
  - **Yahoo Finance API Proxy** — 安全隐藏 API 请求并拦截超时，自动处理 1h-to-4h 等定制级 K 线聚合。
  - **Cron-like Scheduler** — 自动化离线同步引擎，保证本地缓存行情的生命周期管理。

---

## 🚀 快速启动指南 (Getting Started)

### 1. 环境准备
确保您的运行环境已安装了 **Node.js (v18+)**。

### 2. 安装依赖
在项目根目录下，执行以下命令安装依赖：
```bash
npm install
```

### 3. 启动开发服务器
```bash
npm run dev
```
启动成功后，浏览器打开 `http://localhost:3000` 即可开始使用。

### 4. 项目打包
```bash
npm run build
```
打包生成的高效静态文件和后端编译成果将一并输出到 `dist/` 目录中。

---

## 📜 开源协议 (License)

本项目采用 [MIT License](LICENSE) 协议开源。任何人均可自由地克隆、修改、分发或用于商业复盘。
