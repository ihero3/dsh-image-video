# 示例项目包：Hello Workbench

一个**可以直接导入**的最小项目包，用来验证「拿到一个别人的项目」这条链路，也是
3 分钟演示（[`docs/DEMO-3MIN.md`](../docs/DEMO-3MIN.md)）的第一个镜头。

## 里面有什么

| 内容 | 说明 |
| --- | --- |
| 项目 | `Hello Workbench（示例）` |
| 素材 ×1 | `files/sample-cover.png`（320×180 渐变封面，随包带 sha256） |
| 创作资源 ×1 | 风格约束「冷静科技感 / 低饱和」 |
| 工作流 ×1 | 三节点一条链：`creative-input → image-generate → video-generate` |
| 时间轴 ×1 | 5 秒成片：一条视频轨 + 一条字幕轨，烧字幕开启 |
| 项目包格式 | `formatVersion: 3`（与当前插件一致） |

`missing: []` —— 包内**没有缺件**，导入即完整可用（这是它作为「验收样本」的前提）。

## 怎么导入

方式一（界面，推荐演示用）：右侧栏打开 **图片/视频工作台** → 项目区 → **导入项目包** →
选中本目录。

方式二（宿主 RPC，等价）：

```jsonc
// channel: /image-video
{ "kind": "call", "method": "packages/import", "payload": { "packageDir": "<本目录绝对路径>" } }
```

先预检、不落盘：

```jsonc
{ "method": "packages/inspect", "payload": { "packageDir": "<本目录>", "verifyFiles": true } }
```

`inspect` 会逐文件重算 sha256 并与清单比对（`verifyFiles: true`），确认包没在传输中损坏。

导入是**加副本**：同名项目会自动加序号，不会覆盖你现有的项目。

## 怎么重新生成

示例包不是手写 JSON——它由真实的导出实现产出，所以格式永远和用户导出的包同构：

```bash
npx tsx examples/build-hello-workbench.ts      # 重新生成 manifest + files/
npx vitest run tests/example-package.test.ts   # 验收：自洽性 + 真导入
```

生成脚本只做一件人工事：把清单里会泄露本机绝对路径的 `originPath` 换成包内文件名，
`sha256` 与字节数保持原值（仍可校验）。
