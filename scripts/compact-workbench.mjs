/**
 * 整理工作台账本：同一（项目, 文件）只保留最早的一条素材记录。
 *
 * 幂等登记是后来才加的（见 CHANGELOG「登记幂等」），在那之前重复点击会留下
 * 指向同一个文件的重复记录；这个脚本把它们合并掉，**只删记录、不动文件**，
 * 并在写回前留一份 `<file>.bak-<时间戳>` 备份。
 *
 *   node scripts/compact-workbench.mjs [--store <workbench.json 路径>] [--dry-run]
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const storeFlag = argv.indexOf('--store')
const storePath = storeFlag >= 0 && argv[storeFlag + 1] !== undefined
  ? resolve(argv[storeFlag + 1])
  : join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'profiles', 'desktop', 'image-video-workbench', 'workbench.json')

const document = JSON.parse(readFileSync(storePath, 'utf8'))
const seen = new Map()
const kept = []
const dropped = []
for (const asset of document.assets ?? []) {
  const key = `${asset.projectId}\u0000${asset.path}`
  const previous = seen.get(key)
  if (previous === undefined) { seen.set(key, asset); kept.push(asset); continue }
  // 保留最早的一条（createdAt 相同则保留先出现的）
  if (asset.createdAt < previous.createdAt) {
    kept[kept.indexOf(previous)] = asset
    seen.set(key, asset)
    dropped.push(previous)
  } else {
    dropped.push(asset)
  }
}

console.log(`台账本: ${storePath}`)
console.log(`素材记录: ${(document.assets ?? []).length} 条 → 去重后 ${kept.length} 条（移除 ${dropped.length} 条）`)
for (const asset of dropped.slice(0, 5)) console.log(`  移除 ${asset.id} (${asset.createdAt}) ${asset.path.split('/').pop()}`)
if (dropped.length === 0) { console.log('无需整理'); process.exit(0) }
if (dryRun) { console.log('（--dry-run：未写回）'); process.exit(0) }

const backup = `${storePath}.bak-${Date.now()}`
copyFileSync(storePath, backup)
writeFileSync(storePath, `${JSON.stringify({ ...document, assets: kept }, null, 2)}\n`)
console.log(`已写回；备份: ${backup}`)
