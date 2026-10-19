/** 测试用确定性 id 生成器（Track A 测试共享）。 */
export function makeClipIds(prefix: string): () => string {
  let counter = 0
  return () => `${prefix}-${counter++}`
}
