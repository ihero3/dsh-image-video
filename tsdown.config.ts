import { defineConfig } from 'tsdown'

/**
 * 自包含构建：直接转译 src/index.ts 为单个 ESM bundle，不依赖 monorepo
 * 上下文或项目引用。`prepare` 脚本在 git 安装时由 pnpm 触发运行此配置。
 * dts 生成类型声明供消费方 IDE 解析。
 */
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  // 单文件 bundle，避免 code-splitting 产生额外 chunk
  outputOptions: { codeSplitting: false },
  // 生成 .d.ts 类型声明
  dts: true,
  // 不清理 lib（prepare 可能与其他产物共存）
  clean: true,
  // 固定扩展名为 .js，匹配 package.json main 字段
  fixedExtension: false,
})
