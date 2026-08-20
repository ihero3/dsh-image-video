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
