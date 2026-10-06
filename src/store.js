/**
 * Parameter store: one in-memory value set, three ways to reach it.
 *
 *   settings row UI  ─┐
 *   window.dshThemeStudio / ctx.provide('themeStudio') ─┼─→ store ─→ effects
 *   $DSH_HOME/theme-studio.json (hot reload) ──────────┘
 *
 * Persistence is layered on purpose:
 *   - localStorage is a *seed* only, so the first paint after a refresh is
 *     already correct before any network round trip;
 *   - the JSON file behind the host API is authoritative, because it survives
 *     origin changes (a desktop profile re-binds its web server to a new port
 *     on every launch, which would otherwise orphan localStorage).
 *
 * The store never invents values: everything it can hold is declared in
 * src/params.js and everything it writes is coerced by that table first.
 */

import {
  PARAM_DEFS, PARAM_NAMES, STORAGE_PREFIX, PRESETS,
  defaults, coerce, coercePatch,
} from './params.js'

/** Host API prefix, matching lib/index.js. */
export const API_PATH = '/deepseek-theme-studio/api'

/** How often to ask the host whether the JSON file changed underneath us. */
const DEFAULT_POLL_MS = 3000

function safeLocalStorage() {
  try {
    const probe = '__dts_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}

/** Read the localStorage seed (values only; unknown keys are dropped). */
function readSeed(storage) {
  if (storage === null) return {}
  const raw = {}
  for (const key of PARAM_NAMES) {
    const stored = storage.getItem(STORAGE_PREFIX + key)
    if (stored === null) continue
    raw[key] = stored
  }
  return coercePatch(raw)
}

/**
 * Create the store.
 *
 * @param options.log - console-like logger.
 * @param options.pollMs - hot-reload poll interval (0 disables polling).
 */
export function createStore(options = {}) {
  const log = options.log ?? console
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS
  const storage = safeLocalStorage()
  const listeners = new Set()

  let values = { ...defaults(), ...readSeed(storage) }
  let presetId = null
  let hostAvailable = false
  let hostRevision = -1
  let hostPath = ''
  let lastError = ''
  let pollTimer = 0
  let pushTimer = 0
  let stopped = false

  const notify = () => {
    for (const fn of [...listeners]) {
      try {
        fn()
      } catch (error) {
        log.error('[theme-studio] listener failed', error)
      }
    }
  }

  const snapshot = () => ({
    values: { ...values },
    preset: presetId,
    hostAvailable,
    hostRevision,
    hostPath,
    error: lastError,
  })

  function persistLocal(patch) {
    if (storage === null) return
    try {
      for (const [key, value] of Object.entries(patch)) {
        storage.setItem(STORAGE_PREFIX + key, typeof value === 'boolean' ? String(value) : String(value))
      }
    } catch (error) {
      log.warn('[theme-studio] could not write the localStorage seed', error)
    }
  }

  function clearLocal() {
    if (storage === null) return
    try {
      for (const key of PARAM_NAMES) storage.removeItem(STORAGE_PREFIX + key)
    } catch { /* nothing to do */ }
  }

  /** Debounced push of the full value set to the JSON file. */
  function pushHost() {
    if (!hostAvailable) return
    if (pushTimer) window.clearTimeout(pushTimer)
    pushTimer = window.setTimeout(async () => {
      pushTimer = 0
      if (stopped) return
      try {
        const response = await fetch(API_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ method: 'set', patch: values }),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const body = await response.json()
        if (body && typeof body.revision === 'number') hostRevision = body.revision
        lastError = ''
      } catch (error) {
        lastError = `参数文件写入失败：${error.message}`
        log.warn('[theme-studio]', lastError)
      }
      notify()
    }, 220)
  }

  /** Apply a coerced patch to memory + both persistence layers. */
  function applyPatch(patch, { persist = true, origin = 'user' } = {}) {
    const coerced = coercePatch(patch)
    const changed = {}
    for (const [key, value] of Object.entries(coerced)) {
      if (values[key] === value) continue
      values[key] = value
      changed[key] = value
    }
    if (Object.keys(changed).length === 0) return false
    if (origin !== 'host') presetId = null
    if (persist) {
      persistLocal(changed)
      pushHost()
    }
    notify()
    return true
  }

  /** Replace the whole value set (used by preset apply / import / host load). */
  function replaceAll(next, { persist = true, origin = 'user' } = {}) {
    const coerced = coercePatch(next)
    values = { ...defaults(), ...coerced }
    if (origin !== 'host') presetId = null
    if (persist) {
      persistLocal(values)
      pushHost()
    }
    notify()
  }

  async function fetchHost({ silent = false } = {}) {
    try {
      const response = await fetch(API_PATH, { method: 'GET', headers: { accept: 'application/json' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.json()
      if (!body || body.ok !== true) throw new Error('malformed response')
      const wasAvailable = hostAvailable
      hostAvailable = true
      hostPath = typeof body.path === 'string' ? body.path : ''
      hostRevision = typeof body.revision === 'number' ? body.revision : 0
      // A malformed hand-edited file must surface, not vanish into a `{}`.
      if (typeof body.fileError === 'string' && body.fileError !== '') {
        lastError = `参数文件解析失败：${body.fileError}`
      } else if (!silent) {
        lastError = ''
      }
      const next = coercePatch(body.value ?? {})
      // The file is authoritative, but only for keys it actually carries: an
      // empty file must not wipe a value the user just set in the UI.
      const merged = { ...values }
      for (const [key, value] of Object.entries(next)) merged[key] = value
      const changed = PARAM_NAMES.some((key) => merged[key] !== values[key])
      if (changed) {
        values = merged
        persistLocal(values)
        notify()
      } else if (!wasAvailable) {
        notify()
      }
      if (!silent) lastError = ''
      return true
    } catch (error) {
      hostAvailable = false
      if (!silent) {
        lastError = `参数文件不可用：${error.message}`
        notify()
      }
      return false
    }
  }

  async function pollHost() {
    if (stopped || !hostAvailable) return
    try {
      const response = await fetch(API_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: 'get' }),
      })
      if (!response.ok) return
      const body = await response.json()
      if (!body || body.ok !== true) return
      if (typeof body.revision === 'number' && body.revision !== hostRevision) {
        hostRevision = body.revision
        if (typeof body.fileError === 'string' && body.fileError !== '') {
          // Report the broken file and leave the in-memory values alone.
          lastError = `参数文件解析失败：${body.fileError}`
          notify()
          return
        }
        if (lastError !== '') lastError = ''
        const next = coercePatch(body.value ?? {})
        values = { ...values, ...next }
        persistLocal(values)
        log.info('[theme-studio] parameter file changed on disk — hot reloaded')
        notify()
      }
    } catch { /* transient; the next tick retries */ }
  }

  function startPolling() {
    if (pollMs <= 0 || pollTimer) return
    pollTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void pollHost()
    }, pollMs)
  }

  return {
    // ── reads ────────────────────────────────────────────────────────────
    snapshot,
    get: (key) => values[key],
    values: () => ({ ...values }),

    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },

    // ── writes ───────────────────────────────────────────────────────────
    set(key, value) {
      if (!Object.hasOwn(PARAM_DEFS, key)) throw new Error(`unknown parameter "${key}"`)
      return applyPatch({ [key]: value })
    },

    setMany(patch) {
      return applyPatch(patch)
    },

    reset() {
      clearLocal()
      const clean = defaults()
      const changed = PARAM_NAMES.some((key) => values[key] !== clean[key])
      values = clean
      presetId = null
      hostRevision += 0
      // Push the pristine state to the file so a stale file cannot resurrect
      // old values on the next load.
      if (hostAvailable) void fetch(API_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: 'replace', value: {} }),
      }).catch(() => {})
      notify()
      return changed
    },

    // ── presets ──────────────────────────────────────────────────────────
    presets: () => Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label, labelEn: p.labelEn })),

    applyPreset(id) {
      const preset = PRESETS[id]
      if (preset === undefined) throw new Error(`unknown preset "${id}"`)
      replaceAll(preset.values, { persist: true, origin: 'preset' })
      presetId = id
      notify()
      return true
    },

    exportPreset() {
      return JSON.stringify({
        $schema: 'dsh-deepseek-theme-studio/preset@1',
        exportedAt: new Date().toISOString(),
        values,
      }, null, 2)
    },

    importPreset(text) {
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch (error) {
        throw new Error(`JSON 解析失败：${error.message}`)
      }
      const payload = parsed !== null && typeof parsed === 'object' && parsed.values !== undefined
        ? parsed.values
        : parsed
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('预设内容必须是对象或带 values 字段的对象')
      }
      const coerced = coercePatch(payload)
      const unknown = Object.keys(payload).filter((key) => !Object.hasOwn(PARAM_DEFS, key))
      replaceAll(coerced)
      presetId = null
      return { applied: Object.keys(coerced).length, unknown }
    },

    // ── host channel ─────────────────────────────────────────────────────
    load: fetchHost,
    start() {
      stopped = false
      void fetchHost().then(() => startPolling())
    },
    stop() {
      stopped = true
      if (pollTimer) window.clearInterval(pollTimer)
      if (pushTimer) window.clearTimeout(pushTimer)
      pollTimer = 0
      pushTimer = 0
      listeners.clear()
    },
  }
}
