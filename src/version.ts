/**
 * The plugin's own version, surfaced to the browser half through the workbench
 * RPC health check.
 *
 * A published plugin cannot read its own manifest at runtime without bundling
 * it, so the value lives here — and `tests/version.test.ts` fails loudly when it
 * drifts from `package.json`.
 */
export const PLUGIN_VERSION = '0.3.44'
