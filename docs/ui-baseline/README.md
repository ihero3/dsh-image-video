# B11 视觉回归基线（`docs/ui-baseline/*.png`）

> Track B 视觉回归：对工作台各模式/关键场景各存一张截图基线，改样式后做像素对比。
> 状态：**采集机制已就位，PNG 基线待带显示的 CI / 本地浏览器采集**（无显示环境无法出图）。

## 为什么这里没有 PNG

视觉回归需要真实渲染。本执行环境是无显示（headless）的，无法启动浏览器对工作台
（React 应用，依赖宿主 `window.__ModuleLoader__` 注入）做像素截图。因此：

- 基线**采集脚本** `scripts/capture-ui-baseline.mjs` 已写好，参数化、可直接在带显示的机器上跑；
- 真机/CI（带显示器或 `xvfb`）上执行该脚本后，会把 PNG 落到本目录；
- 改样式后重跑，人工或接入 `pixelmatch` 做对比即可。

## 需要基线的场景（清单）

| 文件 | 场景 | 触发方式 |
|------|------|----------|
| `mode-quick.png`        | 快速模式空态（3 步引导 + 空列表） | 首次打开 / 清空项目 |
| `mode-advanced.png`     | 高级模式（画布 + 时间轴）         | 切到 advanced |
| `mode-expert.png`       | 专家模式（如有第三模式）           | 切到 expert |
| `pane-error.png`        | 单 pane 错误边界                   | 故意让某 pane 抛错 |
| `export-panel.png`      | 导出面板（含分辨率/帧率/宽高比选择）| 选中视频片段后展开导出工具条 |
| `responsive-narrow.png` | 窄窗（<768px）响应式折叠           | 视口宽 420px |
| `theme-dark.png`        | 暗色主题                          | 宿主切暗色 |
| `theme-light.png`       | 明色主题                          | 宿主切明色 |

> 模式数量以 `WORKBENCH_MODES` 实际枚举为准；若只有 quick/advanced 两种，专家模式基线跳过。

## 本地采集步骤

```sh
# 1) 起 harness 前端 dev server（根仓）
cd <repo-root>
pnpm run dev:web          # 或 start:web，记下本地 URL（默认 http://localhost:5173）

# 2) 另开终端，装 playwright + 跑采集脚本
cd plugins/dsh-image-video
npm i -D playwright        # 或 pnpm add -D playwright
npx playwright install chromium
DSH_WEB_URL=http://localhost:5173 \
  node scripts/capture-ui-baseline.mjs
```

脚本会把上述场景的 PNG 写入 `docs/ui-baseline/`，并打印每张的尺寸/字节数。

## 对比（后续）

- 纯人工：改样式后重跑脚本，肉眼 diff 新旧 PNG；
- 自动化：在脚本里接入 `pixelmatch`（已留 TODO 注释），设阈值后 CI 失败即回退。

## 与 gate 的关系

`scripts/gate.sh` 不依赖 PNG（它只跑 typecheck / test / build / check:bundle）。
视觉回归是独立的质量闸门，由本目录 + 上述脚本承载，不阻塞 `gate.sh`。
