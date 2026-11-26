# 时间轴精剪参考调研

> 目的：给本仓库「时间轴 pane」找可对标的开源实现，把它们的**数据模型、坐标系、交互口径**翻译成本页面 DOM/CSS 能落地的改动。
>
> 调研时间：2026-11-26。方法：把 5 个仓库 clone 到本地逐文件读（OpenCut classic `cf5e79e`、react-timeline-editor `4148f4a`、dnd-timeline `d332560`、etro `7eb5a7a`、lossless-cut `a30b053`），再对官方文档/手册逐条核对。**只写能在源码或官方文档里核到的点**；打不开的来源集中在文末「附：核实与断链」。
>
> 本仓库基线（下面「可落地清单」的落点都指这里）：`src/client/Workbench.tsx`（`.iv-tl` 区块，约 4144–4545 行）、`src/client/timeline-math.ts`、`src/client/modern-theme.ts`（`.iv-tl-*` 样式）、`src/client/workbench-style.ts`（`.iv-ruler` / `.iv-track` / `.iv-clip`）、`src/client/panels/TimelineSegmentPreview.tsx`。

## 结论摘要（先看这八条）

1. **时间轴要有唯一坐标系：像素/秒（pps）。** OpenCut 用 `BASE_TIMELINE_PIXELS_PER_SECOND = 50` 乘缩放系数得到 pps，所有 left/width 都由「时间 → px」一个函数算出来（[scale.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/scale.ts)、[pixel-utils.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/pixel-utils.ts)）。我们现在是「百分比 + `--iv-tl-zoom` 拉宽容器」，等于没有 pps：刻度、吸附、手柄、波形四套换算各自为政。
2. **刻度必须是时间的函数，不能等分。** OpenCut 按 pps 与帧率推导 label 间隔（帧级候选 `2/3/5/10/15`，注释写明「matches CapCut」），label 最小 120px、tick 最小 18px，并强制 tick 整除 label（[ruler-utils.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/ruler-utils.ts)）。我们现在是 `6 / 8 / 12` 个等分点（`Workbench.tsx:1734`），放大后刻度落在 `00:01.37` 这种位置。
3. **缩放要指数映射 + 锚点。** OpenCut 把滑块位置用 `minZoom * (max/min)^pos` 映射成缩放（[zoom-utils.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/zoom-utils.ts)），`ctrl/⌘ + wheel` 用 `exp(-delta/300)`（[zoom-controller.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/controllers/zoom-controller.ts)）；dnd-timeline 的默认策略是 `ctrl + 滚轮` 缩放、**偏向光标位置**（[Zoom & Pan](https://samuel-arbibe.gitbook.io/dnd-timeline/documentation/zoom-and-pan)）。线性 50%–300% 的滑杆是反例。
4. **吸附 = 候选点集合 + 「像素阈值换算成时间」。** OpenCut 的候选类型是 `element-start / element-end / playhead / bookmark / keyframe`（[snapping/types.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/snapping/types.ts)），阈值默认 10px，再按当前 pps 换算成时间刻度（[snapping/threshold.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/snapping/threshold.ts)），按 Shift 临时关掉（[resize-controller.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/controllers/resize-controller.ts)）。**像素阈值的意义是「手感与缩放无关」**，直接写 100ms 会在高倍缩放下粘手。
5. **缩略图与波形是离线产物，不是运行时解码。** OpenCut 的「胶片条」其实是一张缩略图用 `background-repeat: repeat-x` 平铺，`tileWidth = trackHeight * 宽高比`（[timeline-element.tsx](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/components/timeline-element.tsx)）；波形是从缓存服务取峰值、画 1px 柱 + 1px 间隔（[audio-waveform.tsx](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/components/audio-waveform.tsx)）。两者都能用 ffmpeg 预生成，见 §8。
6. **headless 库（dnd-timeline）与整机（OpenCut）之间，我们的位置是「自带 DOM/CSS、只抄交互口径」。** dnd-timeline 明确「0 styling、只给 hooks 与定位工具」（[Introduction](https://samuel-arbibe.gitbook.io/dnd-timeline/guide/introduction)），OpenCut 是 Next.js 整机（含 Rust/WASM 核心），都装不进我们现在这层薄 DOM。
7. **轨道头是独立列 + 纵向滚动同步，不是一个 grid 单元格。** OpenCut 的标签列固定 112px、与轨道区各自滚动再用 scroll 事件对齐（[layout.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/components/layout.ts)、[use-scroll-sync.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/hooks/use-scroll-sync.ts)）。我们把 46px 写进 `.iv-track` 的 `grid-template-columns`（[workbench-style.ts](../../src/client/workbench-style.ts)），改高度就得同步改标尺 `margin-left` 和播放头层。
8. **许可证是硬约束。** 可抄代码/模式的：OpenCut（MIT）、react-timeline-editor（MIT）、dnd-timeline（MIT）、WebAV（MIT）（[OpenCut LICENSE](https://github.com/OpenCut-app/OpenCut)、[react-timeline-editor](https://github.com/xzdarcy/react-timeline-editor)、[dnd-timeline](https://github.com/samuelarbibe/dnd-timeline)、[WebAV](https://github.com/WebAV-Tech/WebAV)）。**etro 是 GPL-3.0、lossless-cut 是 GPL-2.0**（[etro package.json](https://github.com/etro-js/etro/blob/7eb5a7a/package.json)、[lossless-cut LICENSE](https://github.com/mifi/lossless-cut/blob/a30b053/LICENSE)）——只读思路，不复制实现。

---

## 1. OpenCut（`OpenCut-app/OpenCut` / 经典版 `opencut-classic`）

### 它是什么

免费开源的剪映替代品，Web + 桌面 + 移动一套代码，MIT。**注意：主仓 `OpenCut-app/OpenCut` 已进入重写（Rust 核心、插件化、MCP server），README 明确说「今天的版本请看 `opencut-app/opencut-classic`」**（[README](https://github.com/OpenCut-app/OpenCut)）。所以本文的时间轴细节来自经典版仓库 `apps/web/src/timeline/`（[目录](https://github.com/OpenCut-app/opencut-classic/tree/cf5e79e/apps/web/src/timeline)），不要照主仓的目录结构去找。

### 数据模型与关键 API

| 概念 | 形状 | 来源 |
| --- | --- | --- |
| 轨道类型 | `"video" \| "text" \| "audio" \| "graphic" \| "effect"` | [types.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/types.ts) |
| 场景轨道 | `SceneTracks { overlay: OverlayTrack[]; main: VideoTrack; audio: AudioTrack[] }` —— 主轨唯一、覆盖轨成组、音频轨成组 | 同上 |
| 片段基类 | `{ id, name, duration, startTime, trimStart, trimEnd, sourceDuration?, animations?, params }`，时间单位是 `MediaTime`（WASM 侧的 tick，`TICKS_PER_SECOND`） | 同上 |
| 视频片段 | `VideoElement { type:"video", mediaId, isSourceAudioEnabled?, retime?: {rate, maintainPitch}, effects?, masks? }` | 同上 |
| 轨道开关 | `VideoTrack { muted, hidden }` / `AudioTrack { muted }`（**没有 solo，也没有 lock**，全仓 grep 无 `solo`、无轨道级 `locked`） | 同上 |
| pps 基线 | `BASE_TIMELINE_PIXELS_PER_SECOND = 50`、`ZOOM_MIN 0.1`、`ZOOM_MAX 100` | [scale.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/scale.ts) |
| 时间→px | `px = time / TICKS_PER_SECOND * (50 * zoomLevel)`，另有 `snapPixelToDeviceGrid` 按 DPR 取整 | [pixel-utils.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/pixel-utils.ts) |
| 轨道几何 | `video 65 / audio 50 / text 25 / graphic 25 / effect 25`，轨间距 6，标签列 112，标尺高 22，关键帧泳道 20 | [layout.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/components/layout.ts) |
| 刻度推导 | `getRulerConfig({zoomLevel, fps}) → {labelIntervalSeconds, tickIntervalSeconds}` | [ruler-utils.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/ruler-utils.ts) |
| 吸附候选 | `SnapPointType = element-start \| element-end \| playhead \| bookmark \| keyframe` | [snapping/types.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/snapping/types.ts) |
| 吸附阈值 | `DEFAULT_TIMELINE_SNAP_THRESHOLD_PX = 10` → `(10 / pps) * TICKS_PER_SECOND` | [snapping/threshold.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/snapping/threshold.ts) |
| 缩放视图状态 | 持久化 `{ zoomLevel, scrollLeft, playheadTime }` | [zoom-controller.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/controllers/zoom-controller.ts) |
| 快捷键定义 | 声明式 `ACTIONS` + `defaultShortcuts` | [actions/definitions.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/actions/definitions.ts) |

三个实现细节值得单独记：

- **刻度虚拟化**：标尺只渲染「可视窗口 + buffer」内的 tick，buffer 取 `max(200, (scrollLeft+viewportWidth)*0.15)`（[timeline-ruler.tsx](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/components/timeline-ruler.tsx)）。1 小时素材在 500% 缩放下不会 DOM 爆炸。
- **刻度整除**：`ensureTickDividesLabel` 保证 label 永远落在 tick 上（[ruler-utils.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/ruler-utils.ts)）——这是「刻度看起来专业」的关键一行。
- **缩放锚点分档**：滑杆位置 < 15% 时锚定「内容居中 + padding」，超过 15% 改为锚定播放头，回退时恢复原 scrollLeft（[zoom-controller.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/controllers/zoom-controller.ts)、[interaction.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/components/interaction.ts)）。

### 值得抄的 UX

1. **胶片条用「一张图重复」而不是抽 N 帧**：`backgroundImage: url(thumb); backgroundRepeat: repeat-x; backgroundSize: ${trackHeight*aspect}px ${trackHeight}px`（[timeline-element.tsx](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/components/timeline-element.tsx)）。一张 160px 图就能让空片段「像视频」，成本几乎为零。
2. **轨道头只有图标、没有文字**：右侧对齐的音量/眼睛切换，轨道名靠左，宽度 112px（[components/index.tsx](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/components/index.tsx)）。我们现在 `.iv-t-head` 里塞「id + 类型 + fade 输入 + ms」（`Workbench.tsx:4162-4190`），信息密度比它高一倍、可用面积比它小一半。
3. **JKL 是「±1s 跳」而不是变速 shuttle**：`j`→`seek-backward`、`l`→`seek-forward`、`space`/`k`→播放暂停，`s` 分割、`q`/`w` 分割后删左/右、`n` 吸附开关（[definitions.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/actions/definitions.ts)）。这比 Kdenlive 的变速 JKL 更容易实现，也更符合短视频精剪。
4. **`--iv-tl-head-w` 单点定义边界**：播放头层用 `left: var(--iv-tl-head-w)` 定位，标尺用同一变量（`modern-theme.ts:266`）。我们的 46px 分别硬编码在 `.iv-ruler{margin-left:46px}` 与 `.iv-track{grid-template-columns:46px 1fr}`（[workbench-style.ts](../../src/client/workbench-style.ts)），是同一个数写了两遍。
5. **拖动到边缘自动滚动**：rAF 循环，阈值 100px、最大 15px/帧（[use-edge-auto-scroll.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/hooks/use-edge-auto-scroll.ts)）。
6. **多容器滚动同步有 16ms 节流 + 重入保护**：ruler / tracks / labels / bookmarks 四者互相同步（[use-scroll-sync.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/hooks/use-scroll-sync.ts)）。我们的标尺和轨道在同一个 `overflow-x` 容器里才「碰巧」不脱节，一旦分列就会抖。
7. **状态层是 zustand，用 selector 订阅**：`useEditor(e => e.playback.getCurrentTime())` 这种写法让「播放头/缩放」只有一个来源，组件各自取自己关心的切片（依赖 `zustand 5`，[apps/web/package.json](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/package.json)）。这就是 #6「单一时钟」的参考实现。

### 不要抄

- **不要抄它的整体架构**：`MediaTime` tick + WASM + command 栈 + 场景/项目管理器 + 关键帧/曲线编辑器，是给「完整 NLE」准备的。我们只有三条轨、时长以 ms 计，套进去等于把 40 个文件搬进来。
- **不要抄 ripple 编辑**：OpenCut 把 ripple 做成命令层能力（`ripple/apply.ts`、`computeRippleAdjustments`，[use-editor-actions.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/actions/use-editor-actions.ts)），牵动后续所有片段重排。我们的数据是「每片段绝对 startMs」，没有 ripple 也能剪；做了要先解决重叠策略。
- **它自己也没有 solo/lock**：别把「专业 NLE 都该有 solo」当既成事实——46k 星的 LosslessCut 也没有轨道概念，OpenCut 只有 mute/hidden。solo 可以后置（见清单 #13）。
- **别学它的 5 类轨道细分**（text/graphic/effect 各自 25px）：我们只有 video/audio/subtitle 三类，细分会让轨道头更长。

---

## 2. react-timeline-editor（`xzdarcy/react-timeline-editor`）

### 它是什么

MIT、React 18、单包组件式时间轴（npm `@xzdarcy/react-timeline-editor` 1.0.0），底层用 `react-virtualized` 画标尺、`interactjs` 做拖拽/缩放（[package.json](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/timeline/package.json)）。定位是「动画/字幕时间轴」，不是「视频 NLE」。

### 数据模型与关键 API

- `TimelineAction { id, start, end, effectId, selected?, flexible?, movable?, disable?, minStart?, maxEnd? }`，`TimelineRow { id, actions[], rowHeight?, selected?, classNames? }`（[engine/src/interface/action.ts](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/engine/src/interface/action.ts)）。**时间是秒（小数），没有帧概念**。
- **时间↔像素是一组纯函数**（这是它最值得抄的部分）：
  `parserTimeToPixel(t) = startLeft + (t / scale) * scaleWidth`，
  `parserPixelToTime(px) = ((px - startLeft) / scaleWidth) * scale`，
  `parserTimeToTransform / parserTransformToTime` 处理 start/end ↔ left/width（[utils/deal_data.ts](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/timeline/src/utils/deal_data.ts)）。
  注意语义：**`scale` 是「一格代表多少秒」，`scaleWidth` 是「一格多少 px」**，所以 `pps = scaleWidth / scale`（默认 160/1 = 160 px/s，[interface/const.ts](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/timeline/src/interface/const.ts)）。
- 关键 props：`scale`、`scaleWidth`（默认 160）、`startLeft`（默认 20）、`scaleSplitCount`（默认 10，把一格再分 10 小格）、`minScaleCount`（20）、`maxScaleCount`（∞）、`rowHeight`（32）、`gridSnap`、`dragLine`、`autoScroll`、`hideCursor`、`disableDrag`（[interface/timeline.ts](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/timeline/src/interface/timeline.ts)）。
- 拖拽/修剪回调：`onActionMoveStart/Moving/MoveEnd`、`onActionResizeStart/Resizing/ResizeEnd`，**`Moving`/`Resizing` 返回 `false` 即可否决本次移动**（[interface/timeline.ts](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/timeline/src/interface/timeline.ts)）。这是「受控组件 + 业务校验」的干净切面。
- 吸附两档：`gridSnap`（按细分子格吸附，[Grid Snap 文档](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/document/docs/en/guide/editor/105-grid-snap.mdx)）与 `dragLine`（靠近其他 action / 光标时吸附，[Auxiliary Line Snap 文档](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/document/docs/en/guide/editor/106-auxiliary-line-snap.mdx)），吸附距离默认 8px（`DEFAULT_ADSORPTION_DISTANCE`，[const.ts](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/timeline/src/interface/const.ts)）。
- 自动滚动：越界距离 `/10` 作为速度、上限 3 倍，rAF 循环（[useAutoScroll.ts](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/timeline/src/components/row_rnd/hooks/useAutoScroll.ts)）。
- 标尺：`react-virtualized` 的 `Grid`，列数 `scaleCount * scaleSplitCount + 1`，第 0 列宽 = `startLeft`，`overscanColumnCount=10`（[time_area.tsx](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/timeline/src/components/time_area/time_area.tsx)）。
- 播放头（`Cursor`）用 `RowDnd` + bounds 限制在 `[0, maxScaleCount*scaleWidth+startLeft-scrollLeft]`（[cursor.tsx](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/timeline/src/components/cursor/cursor.tsx)）。

### 值得抄的

1. **「时间 ↔ 像素」写成无副作用的纯函数，并在拖拽回调里只传 `{start,end,dir}`**——业务层不需要知道 px。我们已经有 `timeline-math.ts`，但这套函数现在是「按 lane 宽度比例」，换 pps 后应改成「按 pps」。
2. **`startLeft` 的概念**：时间轴内容从左侧留一段固定偏移（默认 20px），让 0 点不贴边、也方便放「吸附到 0」的视觉提示。我们现在 0 点贴着 `.iv-t-lane` 的 `padding 8px`。
3. **`scaleSplitCount`（一格再细分）+ 大小刻度两套渲染**：粗刻度带 label、细刻度只有竖线。我们的 `.iv-ruler i` 与 `.iv-ruler b` 已经是两套元素，缺的是「细分」这一层。
4. **回调可返回 `false` 否决**：比在 reducer 里加「不允许」分支更直观，适合我们「片段不能重叠/不能短于 200ms」这类规则。
5. **越界速度线性增长的 autoScroll**：实现 30 行，手感比 `scrollBy(20)` 好很多。

### 不要抄

- **不要嵌这个组件**：它的 `scale` 语义是「秒/格」，标尺是「第 N 格 × N 秒」的等距网格，**做不出帧级刻度**；`ControlArea`（轨道头）源码里是一行 `// TODO: default control components(目前先由用户按需自定义)`（[control_area/index.tsx](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/timeline/src/components/control_area/index.tsx)），也就是说轨道头还得自己写——那我们不如自己写全套。
- **不要引入 `react-virtualized` + `interactjs` 两套依赖**：前者已停更（React 18 下需 patch），后者的手势模型与我们的 `onMouseDown + document mousemove` 冲突。
- **不要抄「秒为单位的 start/end」**：我们的模型是 `startMs/durationMs`（整数 ms），改成秒会引入浮点误差，与 ffmpeg 的 `-ss` 精度对不上。

---

## 3. dnd-timeline（`samuelarbibe/dnd-timeline`）

> 任务里写的 `NilsRosenberg/dnd-timeline` 现在 **404**（已改名/转移）。同名 headless 库的维护仓库是 [`samuelarbibe/dnd-timeline`](https://github.com/samuelarbibe/dnd-timeline)（MIT，252 star，最后推送 2026-08）。

### 它是什么

基于 `@dnd-kit` 的 **headless** 时间轴：只给 hooks、定位 style 和「span 换算」，**0 样式、0 组件**（[README](https://samuel-arbibe.gitbook.io/dnd-timeline/readme)、[Introduction](https://samuel-arbibe.gitbook.io/dnd-timeline/guide/introduction)）。

### 数据模型与关键 API

- 核心是「视窗 range」而不是「pps」：`TimelineContext` 接收 `range: {start, end}`、`onRangeChanged`、`sidebarWidth`、`resizeHandleWidth`、`usePanStrategy`（[types/timeline.ts](https://github.com/samuelarbibe/dnd-timeline/blob/d332560/packages/dnd-timeline/src/types/timeline.ts)）。
- `useTimelineContext()` 暴露：`style`（必须挂到容器）、`timelineRef`、`valueToPixels`、`pixelsToValue`、`getValueFromScreenX`、`getDeltaXFromScreenX`、`getSpanFromDragEvent`、`getSpanFromResizeEvent`（[useTimelineContext 文档](https://samuel-arbibe.gitbook.io/dnd-timeline/documentation/timelinecontext/usetimelinecontext)）。
- 换算实现就是 `valueToPixel = timelineViewportWidth / (range.end - range.start)`（[useTimeline.tsx](https://github.com/samuelarbibe/dnd-timeline/blob/d332560/packages/dnd-timeline/src/hooks/useTimeline.tsx)）。**所以它压根没有 `getPixelsPerSecond`**——任务描述里那个 API 在当前版本不存在（v1 叫 `millisecondsToPixels`/`pixelsToMilliseconds`，[v1 文档](https://samuel-arbibe.gitbook.io/dnd-timeline/1/documentation/timelinecontext/usetimelinecontext)）。**缩放 = 缩小 range**，不是乘 pps。
- 层级只有两层：`RowDefinition {id}`、`ItemDefinition {id, rowId, span:{start,end}}`（[types/row.ts](https://github.com/samuelarbibe/dnd-timeline/blob/d332560/packages/dnd-timeline/src/types/row.ts)、[types/item.ts](https://github.com/samuelarbibe/dnd-timeline/blob/d332560/packages/dnd-timeline/src/types/item.ts)）。
- 默认手势：`ctrl + 滚轮` 缩放（偏向光标）、`ctrl + shift + 滚轮` 平移；可换 `useWheelStrategy` / `useDragStrategy`（[Zoom & Pan](https://samuel-arbibe.gitbook.io/dnd-timeline/documentation/zoom-and-pan)）。
- 性能建议：range 变化会重算所有 item 的宽高位置，官方建议 `useDeferredValue(range)` + 给 item 加 `transition: left .2s linear, width .2s linear`（[Performance](https://samuel-arbibe.gitbook.io/dnd-timeline/documentation/zoom-and-pan/performance)）。

### 值得抄的（headless 为什么重要）

1. **「谁拥有像素换算」这个边界值得学**：它把「时间 → 像素」作为库的公共 API 暴露，UI 完全自定义。我们的 bug 恰恰是换算散落在 `laneTimeFromClientX`（按 ratio）、播放头 `playheadMs / timelineTotal`（按 %）、标尺 `ratio*100%`（按 %）三处。
2. **缩放是「改 range」而不是「改宽度」**：`range` 变小 = 看得更细，容器宽度永远 100%，天然不会出现「内容拉宽后滚动条长度突变」。如果我们要走「容器 100% + range」路线，刻度与片段的换算会统一到一个数：`pxPerValue = width / (range.end - range.start)`。
3. **`useDeferredValue` 解决缩放卡顿**：我们缩放时是「重设 `--iv-tl-zoom` → 整个 inner 重排 → 标尺 DOM 全量重建」，同样的病。
4. **手势约定：`ctrl + 滚轮` 缩放、`shift + 滚轮` 平移**（[Zoom & Pan](https://samuel-arbibe.gitbook.io/dnd-timeline/documentation/zoom-and-pan)）。OpenCut 用的是同一套（`ctrlKey||metaKey` 缩放、`shiftKey||deltaX>deltaY` 水平滚动，[zoom-controller.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/controllers/zoom-controller.ts)）——两家一致，说明这就是用户预期。

### 不要抄

- **不要为了「用上 dnd-kit」重写拖拽**：我们的拖拽已带键盘可达（`role="separator"` + `aria-valuenow`，`Workbench.tsx:4236-4262`），dnd-kit 会把这套 a11y 语义换掉。
- **它没有的东西正是我们要补的**：缩略图、波形、吸附、轨道头控件、标尺——全得自己写。headless 的代价就是这些。
- **`range` 双精度浮点**：它的 range 是数字（ms），缩放连续变化时会累积误差；OpenCut 用整数 tick 更稳。

---

## 4. etro（`etro-js/etro`）

### 它是什么

框架无关的 TypeScript **canvas 视频合成引擎**：图层（视频/音频/图片/文字）+ 效果（GLSL 滤镜）+ 关键帧，能把结果 `record()` 成 blob（[README](https://github.com/etro-js/etro)、[文档](https://etrojs.dev/docs/category/layers)）。**许可证 GPL-3.0**（[package.json](https://github.com/etro-js/etro/blob/7eb5a7a/package.json)）。

### 数据模型

- `Movie { canvas, background, layers[], effects[], actx }`，`movie.duration` 是 `max(layer.startTime + layer.duration)` 的归约（[movie.ts](https://github.com/etro-js/etro/blob/7eb5a7a/src/movie/movie.ts)）。
- 每个 layer 只有 `{ startTime, duration, enabled, active }`（[layer/base.ts](https://github.com/etro-js/etro/blob/7eb5a7a/src/layer/base.ts)）；`active` 由「当前时间是否落在窗口内」决定（`movie.ts` 里 `currentTime < startTime || currentTime > startTime+duration` 即跳过）。
- 动态属性：`new etro.KeyFrame([0,-75],[2,+75])` 或直接给函数（[README](https://github.com/etro-js/etro)）。
- 图层的顺序就是 z 序（`layers` 是 `CustomArray` 代理，`onAdd/onRemove` 时 attach/detach，[movie/layers.ts](https://github.com/etro-js/etro/blob/7eb5a7a/src/movie/layers.ts)）。

### 值得抄的

1. **「时间窗口 + z 序」的最小合成模型**：`startTime/duration/active` 三个字段就够表达「这一层什么时候出现」。我们的片段已经等价，但缺少「当前时间是否在片段内」的统一判定（现在散在 `splitInside`、`effectiveDurationMs`、播放推进三处）。
2. **关键帧用 `[time, value]` 元组**：比 `{t, v}` 省一半字符，序列化友好。若我们要做「片段淡入淡出曲线」，这是最省的表结构。
3. **属性既可以是常量、关键帧、也可以是函数**（`() => 100*Math.random()-50`）：给「程序化动效」留了口子，且不污染数据模型。

### 不要抄

- **GPL-3.0：一行代码都不要抄进本仓库**（我们不是 GPL 项目）。只保留「窗口 + z 序 + 关键帧」这三个概念。
- **不要用 canvas 重画时间轴/预览**：我们的预览已经是 `<video>`，再加一块 canvas 合成器意味着两条渲染路径、两套字体、两套缩放。
- **它没有轨道概念**：`layers` 是扁平数组，靠 `startTime` 错开。真要做「同轨不重叠」的约束，它帮不上忙。

---

## 5. WebAV（`WebAV-Tech/WebAV`，原 `bilibili/WebAV`）

> `github.com/bilibili/WebAV` 现在 **301 → `WebAV-Tech/WebAV`**（MIT，2103 star）。

### 它是什么

基于 **WebCodecs** 的浏览器音视频 SDK：`IClip`（素材解析）+ `Sprite`（给素材加时空属性）+ `Combinator`（多 Sprite 合成输出）+ `AVCanvas`（可拖拽缩放的画布）（[README](https://github.com/WebAV-Tech/WebAV)、[av-cliper API](https://webav-tech.github.io/WebAV/_api/av-cliper/)）。自述「比 ffmpeg.wasm 快 20 倍、约 50KB、Chrome 102+」（[README](https://github.com/WebAV-Tech/WebAV)）。

### 它能给我们什么

- **帧精确的解码/编码**：`VideoFrame`、`EncodedVideoChunk`、`VideoDecoder/Encoder` 都是逐帧接口（[MDN WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)）。真要做「拖动播放头逐帧预览」「按帧裁剪」，这是唯一浏览器原生路径。
- **合成语义**：`Sprite.time = {offset, duration}`、`zIndex`、`opacity`、`setAnimation({...})`（[README](https://github.com/WebAV-Tech/WebAV)）——和 etro 的「窗口 + z 序」同构，但走 WebCodecs 而非 canvas 2D。

### 它的限制（决定我们「不要现在用」）

1. **WebCodecs 只做编解码，不做封装**：读文件要 demux 库、写文件要 mux 库（MDN 点名 Mediabunny / web-demuxer），还要写完整 codec string（`"avc1.4d0034"` 而不是 `"h264"`）（[MDN WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)）。
2. **编解码器覆盖不齐**：H.265 在 Apple 平台之外「significant gaps」，AV1 硬件编码仍有限（[MDN WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)）。我们素材来自用户上传/生成，格式不可控。
3. **它不含时间轴 UI**：`AVCanvas` 是「画布上拖拽 Sprite」，没有轨道、刻度、吸附、波形——这些仍然要我们自己写。
4. **对缩略图是杀鸡用牛刀**：缩略图只需要「任意一帧」，`<video>` + `canvas.drawImage` 或 ffmpeg 预生成就够，不需要 WebCodecs 的帧精确。

### 结论

**只有当我们要做「帧精确 scrub / 逐帧步进（←/→ 一帧）」时才引入 WebCodecs**，且优先只引 `av-cliper` 的解码部分，不引 `AVCanvas`（它会和我们的 CSS 预览打架）。当前阶段：缩略图/波形走离线 ffmpeg（§8），预览走 `<video>`。

---

## 6. LosslessCut（`mifi/lossless-cut`）

### 它是什么

Electron + FFmpeg 的**无损剪切**工具（GPL-2.0，46.4k star）：只做「切/拼/换轨/remux」，不重新编码，所以极快（[README](https://github.com/mifi/lossless-cut)、[features.md](https://github.com/mifi/lossless-cut/blob/a30b053/docs/features.md)）。

### 数据模型与「怎么把时间轴做简单」

- 核心数据只有一个**片段列表**：`SegmentBase { start, end?, name?, tags? }`（`end` 缺省 = marker），每个文件存一份 `.llc` 工程（[types.ts](https://github.com/mifi/lossless-cut/blob/a30b053/src/renderer/src/types.ts)、[features.md](https://github.com/mifi/lossless-cut/blob/a30b053/docs/features.md)）。没有轨道、没有 z 序、没有重叠。
- **关键帧感知**：无损切只能从关键帧开始，所以「Keyframe cut mode」= ffmpeg 的 `-ss` 放在 `-i` **之前**；「Smart cut」是实验性补丁，「不保证所有文件可用」（[troubleshooting.md](https://github.com/mifi/lossless-cut/blob/a30b053/docs/troubleshooting.md)、[features.md](https://github.com/mifi/lossless-cut/blob/a30b053/docs/features.md)）。
- 导出预设/工程互操作做得很厚：章节、CSV、EDL、FCPXML、OTIO、SRT 都能进出（[features.md](https://github.com/mifi/lossless-cut/blob/a30b053/docs/features.md)）。
- 时间轴本身：**缩略图 + 波形都画在时间轴上**，支持缩放与「按帧/按关键帧跳转」（[features.md](https://github.com/mifi/lossless-cut/blob/a30b053/docs/features.md)）。

### 值得抄的

1. **「片段列表 + 检查器」的心智模型**：用户只关心「保留哪几段」。我们的三条轨里，video 轨其实也是「有序片段列表」，subtitle 轨是「带文字的片段列表」——把「片段」当第一公民、轨道当分组，UI 会简单很多。
2. **对能力边界诚实**：它把「切点会被拉到前一个关键帧」写成显眼文档（[features.md](https://github.com/mifi/lossless-cut/blob/a30b053/docs/features.md)），而不是让用户以为是 bug。我们的「导出会重编码、切点可能偏移一帧」也该在 UI 里说清楚。
3. **缩略图 + 波形是时间轴标配**，连「切段工具」都做了，我们更没有理由空着（§8 给低成本做法）。
4. **导入/导出中间格式**：`.llc`/CSV/EDL 这种「文本即工程」的做法，比自定义二进制更好调试——我们的 timeline JSON 已经是这个路子，保持住。

### 不要抄

- **GPL-2.0**：不复制代码。
- **不要做「只有一条轨」**：它的简单来自「单文件单轨」，我们有 video/audio/subtitle 三轨 + 叠加需求，退不回去。
- **不要抄关键帧吸附的复杂度**：它要算 GOP、要试 `-ss` 前后位置；我们导出走重编码（`libx264`），切点就是时间点，不需要关键帧对齐。
- **Electron 专属能力**（本地 ffmpeg 子进程、文件系统直读）我们没有——我们通过 `/outputs` 静态服务 + 已有 ffmpeg 检测走同一条路，但别假设能拿到任意本地路径。

---

## 7. Kdenlive（概念参考，只读）

> Shotcut 官方文档站本次访问返回 503，未取到可引用页面；Olive 未取（项目活跃度低）。所以这一节只留 Kdenlive 官方手册里能核到的条目。

### 值得抄的概念（附出处）

| 概念 | Kdenlive 的做法 | 我们的落点 |
| --- | --- | --- |
| 轨道头三态 | 锁定（禁止增删移）、静音（音频）、隐藏（视频），快捷键 `Ctrl+Shift+H` | 我们只有 audio 轨的 fade 输入，三态全缺（`Workbench.tsx:4162`） |
| 轨道高度 | 每轨可单独调高矮、可折叠；另有「Fit Tracks to view height」 | 我们用固定 `.iv-track` 高度；应改 CSS 变量 + 三档（[Timeline 手册](https://docs.kdenlive.org/en/user_interface/timeline.html)） |
| Zoombar | 拖时间轴滚动条的两端来缩放（不是只有滑杆/按钮） | 我们的 `.iv-scrub` 滑杆是唯一入口，且是线性的（[Timeline 手册](https://docs.kdenlive.org/en/user_interface/timeline.html)） |
| 工具集 | Selection / Razor / Spacer / Slip / Ripple；`ESC` 回选择工具 | 我们只需要 Selection + 快捷键 `S` 分割，不做工具态（[Edit Tools](https://docs.kdenlive.org/en/cutting_and_assembling/editing.html)） |
| 吸附 | 靠近另一段的首尾、光标、marker 时吸附，**跨轨道也吸** | 我们完全没有吸附（[Snap](https://docs.kdenlive.org/en/cutting_and_assembling/editing.html)） |
| 缩放到全片 | 「Fit Zoom to Project」一键把整个工程装进窗口 | 我们滑杆只能 50%–300%，长素材永远看不全（[Fit Zoom](https://docs.kdenlive.org/en/cutting_and_assembling/editing.html)） |
| Ripple trim to playhead | 开启 ripple 后 `(` / `)` 在播放头处切并删左/右，不留空隙 | 我们的分割已有，删左/右可用 `q`/`w` 语义补（[Ripple Trim](https://docs.kdenlive.org/en/cutting_and_assembling/editing.html)） |
| JKL | 用 JKL 在源监视器里导航并 `I`/`O` 设入出点 | 我们只做「±1s 跳」，不做入出点（[3-point editing](https://docs.kdenlive.org/en/cutting_and_assembling/editing.html)） |

### 不要抄

- **工具态（Razor mode）**：桌面 NLE 因为鼠标没有修饰键才需要「换工具」；Web 上「播放头 + S 键」更快，OpenCut 也是这么做的（[definitions.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/actions/definitions.ts)）。
- **3 点编辑 / 多机位 / 时间线 zone**：超出「短视频精剪」范围。
- **Kdenlive 的指标名称不统一**：手册里这个功能叫 **Snap**，没有出现「magnet」字样（[Snap 段落](https://docs.kdenlive.org/en/cutting_and_assembling/editing.html)）；OpenCut 的图标才叫 Magnet。写文案时别混。

---

## 8. ffmpeg 侧：低成本缩略图与波形

时间轴要「便宜的好看」，正确做法是**导入/上传时离线生成，运行时只贴图**。

### 胶片条（filmstrip）

`tile` 滤镜把连续帧拼成网格图，参数 `layout=COLUMNSxROWS`、`nb_frames`、`padding`、`margin`，官方示例：

```
ffmpeg -skip_frame nokey -i file.avi -vf 'scale=128:72,tile=8x8' -an -fps_mode passthrough keyframes%03d.png
```

（[tile 滤镜文档](https://ffmpeg.org/ffmpeg-filters.html#tile)）

给时间轴用的实用变体（每 2 秒取 1 帧、横向 10 格、每格 160×90）：

```
ffmpeg -i in.mp4 -vf "fps=1/2,scale=160:90,tile=10x1" -frames:v 1 strip.png
```

`fps` 负责「隔多久取一帧」，`tile` 负责拼图（[fps 滤镜](https://ffmpeg.org/ffmpeg-filters.html#fps)、[tile 滤镜](https://ffmpeg.org/ffmpeg-filters.html#tile)）。落地时同时产出一个 `{intervalSec, tileW, tileH, cols}` 的 JSON，前端按 `background-position` 取第 N 格——**一张 PNG 服务整条时间轴**。

> 如果连 ffmpeg 都不想调：OpenCut 的做法是「一张缩略图 `repeat-x`」（[timeline-element.tsx](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/components/timeline-element.tsx)）。我们已经有 `<img class="iv-clip-thumb">` 但只给图片片段用（`Workbench.tsx:4265`），把视频片段的封面也走这条就能先「不空」。

### 波形

`showwavespic` 直接出「整段音频一张波形图」，示例：

```
ffmpeg -i audio.flac -lavfi showwavespic=split_channels=1:s=1024x800 waveform.png
```

支持 `size`、`split_channels`、`colors`、`scale=lin|log|sqrt|cbrt`、`draw=scale|full`、`filter=average|peak`（[showwavespic 文档](https://ffmpeg.org/ffmpeg-filters.html#showwavespic)）。时间轴用 `filter=peak` + 单通道更接近剪辑软件观感；把 PNG 按片段宽度拉伸（`background-size: 100% 100%`）即可，**不需要按缩放重算采样**。

### 缓存与失效

- key 用 `assetPath + mtime + size`（我们已有 `/outputs` 静态服务与 ffmpeg 检测，`Workbench.tsx:4068`）。
- 生成失败要能降级：没有缩略图 → 纯色块 + 文件名；没有波形 → 一条中线。**不能因为 ffmpeg 缺失让时间轴不可用。**

---

## 可落地清单

> 评分口径：影响 1–5（对「看得懂 / 剪得动」的贡献）× 省力 1–5（5 = 半天内能上）。**表按分数降序；组内按依赖排序。**
> 「落点」都指本仓库现有文件与类名，行号是量级，实施前以实际代码为准。

| # | 改进 | 影响 | 省力 | 分 | 落点 |
| --- | --- | --- | --- | --- | --- |
| 5 | 轨道头：46px → `--iv-tl-head-w`，每轨独立高度 + mute/solo/lock 三键 | 5 | 4 | **20** | `../../src/client/workbench-style.ts`、`Workbench.tsx:4162` |
| 8 | 视频片段铺胶片条：先单图 `repeat-x`，再升级 ffmpeg sprite | 4 | 5 | **20** | `Workbench.tsx:4265`（`.iv-clip-thumb`） |
| 10 | 键盘：`space`/`k` 播、`j`/`l` ±1s、`s` 分割、`n` 吸附、`Delete`、`⌘Z`、`Home/End`、`←/→` 1 帧 | 4 | 5 | **20** | 新增 `use-timeline-keys.ts` |
| 1 | 引入 `--iv-tl-pps`（像素/秒）单一坐标系，片段/播放头/刻度全部由 ms 算 px | 5 | 3 | **15** | `../../src/client/modern-theme.ts` + `Workbench.tsx:4144` |
| 2 | 刻度改成「时间的函数」：按 pps 选 label/tick 间隔，只渲染可视窗口，1px 线按 DPR 取整 | 5 | 3 | **15** | 新增 `ruler-utils` 等价模块 |
| 3 | 缩放接真：指数映射 + 光标/播放头锚定 + `ctrl/⌘+wheel` + 双击适配全片 | 5 | 3 | **15** | `Workbench.tsx:4131`（`.iv-zoom`）、`tlZoom` |
| 4 | 吸附：候选点集合（片段首尾/播放头/0/字幕边界）+ 10px 阈值 + 吸附线 + `Alt` 临时关闭 | 5 | 3 | **15** | `../../src/client/timeline-math.ts` + 手柄/drop 处理 |
| 6 | 播放头单一时钟：段预览改成只读跟随（同一 `playheadMs`），删掉自己的 `playing` | 5 | 3 | **15** | `Workbench.tsx:4687`、`panels/TimelineSegmentPreview.tsx` |
| 11 | 拖拽到边缘自动滚动（越界距离线性调速，上限 3×） | 3 | 5 | **15** | 手柄拖拽循环 |
| 12 | 标尺/轨道/标签滚动同步加 16ms 节流 + 重入保护 | 3 | 5 | **15** | `../../src/client/modern-theme.ts` / 新增 hook |
| 13 | 空态与轨道高度三档（25/50/65）+ 折叠 | 3 | 5 | **15** | `.iv-track` 高度变量 |
| 7 | 轨道头与轨道体分列 + 纵向滚动同步（ruler/tracks/labels 三者） | 4 | 3 | **12** | `../../src/client/modern-theme.ts` `.iv-tl-*` |
| 9 | 音频波形：ffmpeg `showwavespic` 出图 + 按片段宽度拉伸 + 缓存 | 4 | 3 | **12** | 新增 `clip-waveform` 子组件 |
| 14 | 视图状态持久化 `{zoom, scrollLeft, playhead}` 到 timeline 记录 | 3 | 4 | **12** | `src/workbench/timeline.ts` 数据模型 |
| 15 | 片段内只留「缩略底 + 名 + 时长 + 双手柄」，分割按钮上移到 transport | 3 | 4 | **12** | `Workbench.tsx:4273`（`.iv-clip-split`） |

### 第一梯队（分 20）：一天内能看见的收益

- **#5 轨道头**：`.iv-track{grid-template-columns: var(--iv-tl-head-w, 68px) 1fr}`、`.iv-ruler{margin-left: var(--iv-tl-head-w)}`、`.iv-tl-lane-layer{left: var(--iv-tl-head-w)}`——**一个变量三处引用**，彻底解决「46px 写三遍」（[workbench-style.ts](../../src/client/workbench-style.ts)、[modern-theme.ts:266](../../src/client/modern-theme.ts)）。三键用图标按钮：`mute` 只对 audio 显示、`lock` 禁用拖拽与落点、`solo` 是「其它轨临时静音」的纯 UI 状态（不改数据，避免引入导出语义）。轨道高度用 `--iv-t-h`，25/50/65 三档（数值参考 OpenCut 的 `TIMELINE_TRACK_HEIGHTS_PX`，[layout.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/components/layout.ts)）。
- **#8 胶片条**：`<img>` 换成 `div` + `background-repeat: repeat-x`，`background-size: ${trackH*16/9}px ${trackH}px`（OpenCut 的 `TiledMediaContent`，[timeline-element.tsx](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/components/timeline-element.tsx)）；有 sprite 后改 `background-position: -${index*tileW}px`。**没有 ffmpeg 也要能用**：`<video>` 首帧截一张当封面即可（现有 `/outputs/<name>` 路由就能取到图，`Workbench.tsx:4266`）。
- **#10 键盘**：语义照 OpenCut 的 `defaultShortcuts`（[definitions.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/actions/definitions.ts)），但**必须做「输入框聚焦时禁用单字符快捷键」**——字幕输入框里打 `s` 不能分割。`←/→` 一帧步进的前提是知道 FPS，没有就退化为 10ms。

### 第二梯队（分 15）：坐标系与手感

**#1 #2 #3 #4 是同一个坐标系的三面加一层吸附，必须连着做**，分开做会返工。先定一个数：

```ts
const BASE_PPS = 50;                 // 100% 时 50px/秒
const pps = BASE_PPS * zoom;         // zoom ∈ [0.2, 20]
const toPx = (ms: number) => (ms / 1000) * pps;
const toMs = (px: number) => (px / pps) * 1000;
```

- **#1**：`left/width` 从 `%` 改 `px`，`.iv-tl-inner` 宽度 = `toPx(timelineTotal) + 2*LANE_PADDING_PX`，删掉 `width: calc(100% * var(--iv-tl-zoom))`（[modern-theme.ts:263](../../src/client/modern-theme.ts)）。`timeline-math.ts` 的 `laneTimeFromClientX` 改成 `toMs(clientX - lane.left - PAD)`，不再依赖 lane 宽度比例——顺带修掉「缩放后拖拽落点偏移」。
- **#2**：抄 `getRulerConfig` 的结构：帧级候选 `[1,2,3,5,10,15]`、秒级候选 `[1,2,3,5,10,15,30,60,…]`、label 最小 120px、tick 最小 18px，并强制 tick 整除 label（[ruler-utils.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/ruler-utils.ts)）。只渲染 `[scrollLeft-buffer, scrollLeft+vw+buffer]` 区间，buffer 取 `max(200, (scrollLeft+vw)*0.15)`（[timeline-ruler.tsx](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/components/timeline-ruler.tsx)）。刻度线坐标按 DPR 取整：`Math.round(px*dpr)/dpr`（[pixel-utils.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/pixel-utils.ts)）。
- **#3**：滑杆值 `s∈[0,1]` → `zoom = minZoom * (maxZoom/minZoom)^s`，并保持「光标下的时间点不动」：`scrollLeft' = toPx_new(t_cursor) - (clientX - rect.left)`。`minZoom` 用「全片恰好占 75% 宽」反算（OpenCut 的 `getTimelineZoomMin`，[zoom-utils.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/zoom-utils.ts)），这样 100% 不再是魔法数；双击标尺 = `setZoom(minZoom)`。
- **#4 吸附**：三个小模块就够——`snap-points.ts`（收集候选）、`snap-resolve.ts`（就近取最小距离）、`snap-indicator.tsx`（一条竖线 + 类型色）。候选至少含：所有片段 `startMs` / `startMs+durationMs`、`playheadMs`、`0`。阈值 `snapPx/pps*1000` ms，默认 10px（[snapping/threshold.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/snapping/threshold.ts)）。**吸附只改「拖拽中的 delta」，松手才提交**——这样撤销栈里只留一次操作。
- **#6 单一时钟**：`playheadMs` 提升为唯一真相；段预览接收 `{playheadMs, playing}`，内部只做 `video.currentTime = (playheadMs - clip.startMs)/1000` + `paused = !playing`，**删掉自己的 `playing`/`index` 状态机**（现状见 [TimelineSegmentPreview.tsx](../../src/client/panels/TimelineSegmentPreview.tsx)）。播放推进用一个 rAF 循环写 `playheadMs`，监视器与段预览都读它——OpenCut 的 `editor.playback.getCurrentTime()` 就是这个角色（[use-timeline-playhead.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/hooks/use-timeline-playhead.ts)）。
- **#11 自动滚动**：`clientX` 进入容器边缘 100px 内时，`scrollLeft += sign * ceil(over/10)`，rAF 循环、松手停止（口径来自 [useAutoScroll.ts](https://github.com/xzdarcy/react-timeline-editor/blob/4148f4a/packages/timeline/src/components/row_rnd/hooks/useAutoScroll.ts)）。
- **#12 滚动同步**：`isSyncing` 标志 + 16ms 时间戳节流（[use-scroll-sync.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/hooks/use-scroll-sync.ts)）；分列（#7）之后这一步是必需品。
- **#13 空态/高度**：空轨给「拖素材到这里 / 点 + 添加」两个入口，不要只留一行灰字（现在 `timelineEmpty` 就是一行灰字，`Workbench.tsx:4205`）。

### 第三梯队（分 12）：补齐信息与状态

- **#7 分列**：标签列与轨道区各自 `overflow`，靠 #12 的同步对齐；OpenCut 用 112px 标签列 + 各自滚动（[use-scroll-sync.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/hooks/use-scroll-sync.ts)）。我们若不做分列，#5 的三键会一直挤在 46px 里。
- **#9 波形**：`showwavespic` 出 PNG，`filter=peak`、单通道，`<img>` + `background-size:100% 100%` 拉伸（[showwavespic](https://ffmpeg.org/ffmpeg-filters.html#showwavespic)）；缓存 key = `assetPath + mtime + size`，生成失败降级为一条中线。
- **#14 视图持久化**：`{zoom, scrollLeft, playheadMs}` 存进 timeline 记录，重进页面还原（OpenCut 的 `setTimelineViewState`，[zoom-controller.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/controllers/zoom-controller.ts)）。
- **#15 片段内容**：删 `.iv-clip-split`（`Workbench.tsx:4273`），分割统一走 `S` 与 transport 按钮；片段内只留 label + 时长，宽度 < 60px 时只留色条。

### 实施顺序

`#5 → #1 → #2 → #3 → #8 → #4 → #6 → #10`，其余穿插。理由：#5/#8 立刻可见，先建立「这版真的变了」的感知；#1–#4 共享 pps，必须连做；#6 独立且改动在组件边界，适合单独一个 PR；#10 最后做，避免快捷键先于吸附/缩放就位而产生「按了没反应」。

---

## 反模式

1. **百分比布局 + 放大容器冒充缩放。** `left: (startMs/total)*100%` 再给容器 `width: calc(100% * zoom)`，看起来能放大，但刻度、吸附、波形、播放头全都要靠「比例」二次换算；一旦总时长变化，所有像素级微调（1px 刻度线、8px 手柄）会被同比放大。**解法：pps + px（#1）。**
2. **固定等分刻度。** `6/8/12` 个等分点意味着标签是「总时长的分数」（8 等分就是 12.5% 一段），而不是「整秒 / 整 5 秒 / 整帧」。专业感全在刻度上（对照 [ruler-utils.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/ruler-utils.ts) 的两级间隔 + 整除约束）。
3. **线性缩放滑杆。** 50%–300% 线性映射下，低倍率几乎无变化、高倍率一格跳很远。指数映射 + 锚点是唯一正确解（[zoom-utils.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/zoom-utils.ts)）。
4. **两个播放器各自持有 `playing`。** 我们的段预览与监视器互不同步（`TimelineSegmentPreview` 自己 `useState(playing)`、自己推进 `index`），用户建立不了「播的就是这一处」的因果。OpenCut 把「当前时间」放在单一 playback store，所有视图订阅它（[use-timeline-playhead.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/hooks/use-timeline-playhead.ts)）。**解法：#6。**
5. **把参数塞进片段。** 13 个输入框塞进 58px 高的片段曾是本页最大问题（已迁到 `.iv-clip-ins` 检查器，`Workbench.tsx:4341`）；**不要因为「少点一次」又把常用字段搬回片段**。片段只承载「时间 + 身份 + 缩略」。
6. **引入 GPL 实现。** etro（GPL-3.0）、lossless-cut（GPL-2.0）只读思路；抄一行代码就把整个项目的许可证拖下水（[etro package.json](https://github.com/etro-js/etro/blob/7eb5a7a/package.json)、[lossless-cut LICENSE](https://github.com/mifi/lossless-cut/blob/a30b053/LICENSE)）。
7. **为了缩略图引入 WebCodecs。** 需要 demux/mux 库、codec string、还要面对 H.265 的浏览器缺口（[MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)）。缩略图/波形用 ffmpeg 离线生成即可（§8）；WebCodecs 只留给「帧精确 scrub」。
8. **抄 NLE 的工具态。** Razor/Slip/Space 工具是桌面 NLE 为「没有修饰键可用」付出的代价；Web 上「播放头 + `S`」更快，OpenCut/LosslessCut 都选了快捷键（[definitions.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/actions/definitions.ts)）。
9. **先做 ripple。** 我们的片段是绝对 `startMs`，ripple 需要「删/移后重排后续所有片段 + 处理重叠」，是命令层重构（OpenCut 专门开了 `ripple/` 目录）。当前阶段收益远小于成本。
10. **同一个尺寸写三遍。** 46px 在 `.iv-ruler{margin-left}`、`.iv-track{grid-template-columns}`、`.iv-tl-lane-layer{left}` 各写一次；改一次高度就要改三处。**解法：`--iv-tl-head-w`（#5）。**
11. **忽略 DPR 的 1px 线。** 非整数缩放下刻度线会糊成 1.5px 灰边，专业感立刻掉；OpenCut 专门写了 `snapPixelToDeviceGrid`（[pixel-utils.ts](https://github.com/OpenCut-app/opencut-classic/blob/cf5e79e/apps/web/src/timeline/pixel-utils.ts)）。
12. **在没有波形/缩略图时假装「够用」。** 时间轴的第一功能是「让用户认出这一段是什么」；纯色块 + 文件名做不到（LosslessCut 连纯剪切工具都画缩略图 + 波形，[features.md](https://github.com/mifi/lossless-cut/blob/a30b053/docs/features.md)）。

---

## 附：核实与断链

- **OpenCut 主仓已重写**：`OpenCut-app/OpenCut` 的 README 写明「正在从零重写，今天的版本见 `opencut-app/opencut-classic`」（[README](https://github.com/OpenCut-app/OpenCut)）。本文所有 `apps/web/src/timeline/*` 路径都在 classic 仓 `cf5e79e` 上核对。
- **`mintlify.wiki/OpenCut-app/OpenCut/concepts/timeline`** 返回 404（Vercel deployment not found），未采用。
- **`NilsRosenberg/dnd-timeline`** 返回 404；同名库现维护在 `samuelarbibe/dnd-timeline`（[仓库](https://github.com/samuelarbibe/dnd-timeline)）。任务描述里的 `getPixelsPerSecond` **在 v3 源码与文档中不存在**；v3 用 `valueToPixels/pixelsToValue` + `range`，v1 用 `millisecondsToPixels/pixelsToMilliseconds`（[v3 文档](https://samuel-arbibe.gitbook.io/dnd-timeline/documentation/timelinecontext/usetimelinecontext)、[v1 文档](https://samuel-arbibe.gitbook.io/dnd-timeline/1/documentation/timelinecontext/usetimelinecontext)）。
- **`bilibili/WebAV`** 301 到 `WebAV-Tech/WebAV`（[仓库](https://github.com/WebAV-Tech/WebAV)）。
- **Shotcut 官方文档**本次访问 503，未引用；Kdenlive 手册可用，但**手册里没有「magnet」字样**，该功能名为 **Snap**（[editing.html](https://docs.kdenlive.org/en/cutting_and_assembling/editing.html)）。
- **Kdenlive 旧路径** `editing/editing_workflow.html` 已 404（手册迁移到 Sphinx），现行路径是 `user_interface/timeline.html` 与 `cutting_and_assembling/editing.html`。
- **ffmpeg 结论**来自官方滤镜文档（[#tile](https://ffmpeg.org/ffmpeg-filters.html#tile)、[#showwavespic](https://ffmpeg.org/ffmpeg-filters.html#showwavespic)、[#fps](https://ffmpeg.org/ffmpeg-filters.html#fps)），命令示例为文档原例 + 时间轴场景的参数替换，未在本机执行验证。
- **本仓库现状**以 `src/client/Workbench.tsx`、`src/client/modern-theme.ts`、`src/client/workbench-style.ts`、`src/client/timeline-math.ts` 的当前代码为准；`docs/TIMELINE-PANE-REDESIGN.md` v1.2 里「缩放是死控件」「13 个控件在片段内」两条**已被代码部分修复**（缩放已接 `--iv-tl-zoom`、控件已迁检查器），清单按「还缺什么」重新排过。
