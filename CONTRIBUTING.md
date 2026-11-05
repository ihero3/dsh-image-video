# 贡献指南

感谢你对 dsh-image-video 的兴趣！本文档说明如何参与开发与提交贡献。

## 开发环境准备

```sh
git clone git@github.com:ihero3/dsh-image-video.git
cd dsh-image-video
pnpm install --ignore-workspace
```

> 本插件是独立仓库，不在 deepseek-harness monorepo 内。`--ignore-workspace` 防止 pnpm 误向上查找 workspace 配置。

## 开发命令

```sh
pnpm run dev          # tsdown --watch，监听变更实时构建
pnpm exec tsc --noEmit   # 类型检查（提交前必跑）
pnpm run build        # 构建到 lib/
```

> **`lib/` 是提交进仓库的构建产物。**消费方以 git/npm 安装时不执行任何构建脚本（因此不会被 pnpm 的 allowBuilds 拦截），直接使用仓库中的 `lib/index.js`。改了 `src/` 就必须重新 `pnpm run build` 并把 `lib/index.js`、`lib/index.d.ts` 一起提交，否则仓库里的产物会与源码不一致。

## 代码规范

- TypeScript `strict: true` + `noImplicitAny` + `noUnusedLocals/Parameters`
- ESM only（`"type": "module"`），相对导入带 `.ts` 扩展名
- 遵循 [DeepSeek Harness 插件规范](https://github.com/deepseek-ai/deepseek-harness)：
  - 通过 `ctx.effect()` / `ctx.inject()` / `ctx.tools.register()` 等官方插槽声明能力
  - 不假设其他插件内部实现，依赖通过服务接口交互
  - 配置项用 Schemastery 声明，提供默认值

## Commit 规范

采用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：

```
<type>(<scope>): <subject>

<body>
```

- `type`：`feat`（新功能）/ `fix`（修复）/ `docs`（文档）/ `refactor`（重构）/ `chore`（杂项）
- `scope`：如 `generate-image` / `generate-video` / `task-manager` / `config`
- 示例：`feat(generate-video): 支持自定义宽高比`

## PR 流程

1. Fork 仓库，从 `main` 拉特性分支：`git checkout -b feat/your-feature`
2. 确保本地通过 `pnpm exec tsc --noEmit` 和 `pnpm run build`
3. 如有行为变更，更新 [CHANGELOG.md](./CHANGELOG.md) 的 Unreleased 段
4. 提交 PR，描述动机、变更点、测试方式
5. CI 通过 + review 后合入 `main`

## 版本发布

- 合入 `main` 不自动发版
- 维护者打 git tag `v0.x.y` 触发 GitHub Release，CHANGELOG 对应段落作为 Release notes
- 遵循语义化版本：patch 修 bug / minor 加功能向后兼容 / major 破坏性变更

## 工作约定：每轮收尾必须"提交并推送干净"

> 起因（2026-11-05 用户要求）："把你没提交的每次都提交了，与仓库每次保持一致"。
> 会话中断、机器重启、换人接手时，**仓库状态就是唯一的事实来源**；留在工作区的改动等于没做。

每一轮改动的固定收尾动作（缺一不可）：

1. `bash scripts/gate.sh` —— 5 道门禁全绿才继续（体积 / 类型 / 构建 / 测试 / 覆盖率）。
2. 插件仓库提交并推送：
   ```sh
   git add -A && git commit -m "<type>(<scope>): <subject>" && git push origin main
   ```
   文档/台账与代码**可以分成两个提交**（`feat`/`fix` + `docs`），但都要推上去。
3. 上游 Harness 仓库同步子模块指针并推送：
   ```sh
   cd ../.. && git add plugins/dsh-image-video && git commit -m "chore(fork): bump 插件指针（<sha>，<一句话>）" && git push origin master
   ```
4. **核对一致**（这一步别省）：
   ```sh
   git -C plugins/dsh-image-video rev-parse HEAD        # 插件 HEAD
   git -C plugins/dsh-image-video rev-parse origin/main # 插件远端
   git ls-tree HEAD plugins/dsh-image-video             # Harness 里记录的指针
   ```
   三者必须指向同一个 commit，且 `git status` 干净。

补充约定：

- 推送遇到 GitHub 5xx / `Permission denied` 属服务端抖动，**重试直到 `HEAD == origin`**，
  不要把"没推上去"当成完成（`git push` 输出里出现 `rejected` 一律视为失败，即使它含 `main -> main`）。
- `lib/` 是提交进仓库的构建产物：改了 `src/` 必须 `pnpm run build` 后一并提交。
