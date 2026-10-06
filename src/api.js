/**
 * Programmatic API — control channel #2.
 *
 * Exposed twice, deliberately:
 *   - `window.dshThemeStudio` for console / userscripts / other page code
 *   - `ctx.provide('themeStudio', api)` for other Cordis plugins and agents
 *
 * Both are the *same* object, so a change made through either is immediately
 * visible to the other and to the settings row.
 */

import { PARAM_DEFS, PARAM_NAMES, labelOf } from './params.js'
import { selfCheck, formatSelfCheck } from './host-hooks.js'

/**
 * @param store - the parameter store.
 * @param deps - { version, diagnose }; diagnose returns per-effect diagnostics.
 */
export function createApi(store, deps = {}) {
  const api = {
    /** Contract marker: 'dsh-deepseek-theme-studio/client'. */
    id: 'dsh-deepseek-theme-studio',
    version: deps.version ?? '0.0.0',

    /** Every parameter with its declared contract. */
    list() {
      return Object.entries(PARAM_DEFS).map(([key, def]) => ({
        key,
        label: labelOf(key),
        group: def.group,
        type: def.type,
        default: def.default,
        ...(def.min !== undefined ? { min: def.min } : {}),
        ...(def.max !== undefined ? { max: def.max } : {}),
        ...(def.step !== undefined ? { step: def.step } : {}),
        ...(def.unit !== undefined ? { unit: def.unit } : {}),
        ...(def.options !== undefined ? { options: def.options.map((o) => o.value) } : {}),
        value: store.get(key),
      }))
    },

    /** One parameter's current value. */
    get(key) {
      if (!Object.hasOwn(PARAM_DEFS, key)) throw new Error(`unknown parameter "${key}"`)
      return store.get(key)
    },

    /** The whole current value set. */
    getAll: () => store.values(),

    /** Set one parameter (coerced + clamped by the schema). */
    set(key, value) {
      store.set(key, value)
      return store.get(key)
    },

    /** Set several parameters at once. */
    setMany(patch) {
      store.setMany(patch)
      return store.values()
    },

    /** Restore the pristine (native) state. */
    reset() {
      store.reset()
      return store.values()
    },

    /** JSON string of the current values, ready to hand to importPreset. */
    exportPreset: () => store.exportPreset(),

    /** Apply a preset JSON string or object. */
    importPreset(text) {
      const payload = typeof text === 'string' ? text : JSON.stringify({ values: text })
      return store.importPreset(payload)
    },

    /** Built-in entry presets. */
    presets: () => store.presets(),

    /** Apply a built-in preset by id. */
    applyPreset(id) {
      store.applyPreset(id)
      return store.values()
    },

    /** Subscribe to changes; returns an unsubscribe function. */
    subscribe(fn) {
      return store.subscribe(fn)
    },

    /** Token + DOM-hook drift report for this running instance. */
    selfCheck: () => selfCheck(),

    /** The same report as text, for copy/paste. */
    formatSelfCheck() {
      return formatSelfCheck(selfCheck())
    },

    /** Everything: parameters, host channel, each effect, and the self-check. */
    diagnostics() {
      const extra = typeof deps.diagnose === 'function' ? deps.diagnose() : {}
      const report = selfCheck()
      return {
        parameterCount: PARAM_NAMES.length,
        store: store.snapshot(),
        selfCheck: {
          ok: report.ok,
          tokensFound: report.tokensFound,
          tokensTotal: report.tokensTotal,
          missingTokens: report.missingTokens,
          missingHooks: report.missingHooks,
          invalidSelectors: report.invalidSelectors,
        },
        hooks: report.hooks,
        ...extra,
      }
    },

    /** Diagnostics rendered as text (used by the settings row). */
    diagnosticsText() {
      const report = selfCheck()
      const lines = [formatSelfCheck(report)]
      const extra = typeof deps.diagnose === 'function' ? deps.diagnose() : {}
      for (const [name, value] of Object.entries(extra)) {
        lines.push(`${name}: ${JSON.stringify(value)}`)
      }
      const snapshot = store.snapshot()
      lines.push(`参数文件: ${snapshot.hostAvailable ? snapshot.hostPath : '不可用'} (revision ${snapshot.hostRevision})`)
      return lines.join('\n')
    },
  }
  return api
}
