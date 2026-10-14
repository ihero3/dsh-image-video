/** Guard: the version the workbench reports matches the published manifest. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PLUGIN_VERSION } from '../src/version.ts'

describe('plugin version', () => {
  it('matches package.json', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string }
    expect(PLUGIN_VERSION).toBe(manifest.version)
  })
})
