import { defineConfig } from 'tsdown'

/**
 * 自包含构建：直接转译 src/index.ts 为单个 ESM bundle，不依赖 monorepo
 * 上下文或项目引用。产物随仓库提交，消费方安装时无需执行构建脚本。
 * dts 生成类型声明供消费方 IDE 解析。
 */
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  outputOptions: {
    // 单文件 bundle，避免 code-splitting 产生额外 chunk
    codeSplitting: false,
    // dts chunk 默认带内容哈希（index-<hash>.d.ts），会让 package.json 的
    // types 指向一个每次改源码都变的文件名；固定为 index.d.ts
    chunkFileNames: (chunk) => (chunk.name.includes('.d') ? 'index.d.ts' : '[name]-[hash].js'),
  },
  // 生成 .d.ts 类型声明
  dts: true,
  // 构建前清理 outDir，避免旧产物残留
  clean: true,
  // 固定扩展名为 .js，匹配 package.json main 字段
  fixedExtension: false,
})
