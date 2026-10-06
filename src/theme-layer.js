/**
 * Theme layer: colour tokens, appearance mode, motion variables and the
 * decorative background element.
 *
 * Two rules shape this file:
 *
 *   1. Prefer the official Theme API. When `ctx.theme.overrideTokens` exists
 *      (host 0.2.0-rc.2 has it: @deepseek-ai/dsh-client-ui-theme/lib/client.js
 *      `overrideTokens(source, tokens)`, taking {light, dark} pairs), colour
 *      overrides go through it, so the host composes them with its own theme
 *      and a `null`/empty parameter set composes to nothing. Direct CSS
 *      variables are the fallback for hosts without the service.
 *   2. Nothing is written unless a parameter asks for it, and everything
 *      written is recorded so it can be restored byte-for-byte. That is what
 *      makes "还原原生外观后像素差 = 0" true rather than aspirational.
 */

import { hexToRgba } from './effects/grid.js'
import { staticGradientCss } from './effects/fluid-shaders.js'

/** Root attribute gating every rule this plugin owns. */
export const ROOT_ATTR = 'data-dts'

/** Tokens we may write, with the pristine value captured before we touch them. */
const WRITABLE_TOKENS = [
  '--dsw-alias-bg-base',
  '--dsw-alias-brand-primary',
  '--dts-decoration-opacity',
  '--dts-motion-duration',
  '--dts-motion-easing',
]

export function createThemeLayer(options) {
  const readConfig = options.readConfig
  const doc = options.document ?? document
  const themeService = options.themeService ?? null
  const log = options.log ?? console

  const saved = new Map()
  let releaseOverride = null
  let backgroundEl = null
  let modeOwned = false
  let motionStyle = null
  let appliedKeys = new Set()

  function remember(target, name) {
    const key = `${target === doc.documentElement ? 'root' : 'body'}:${name}`
    if (saved.has(key)) return
    saved.set(key, {
      target,
      name,
      value: target.style.getPropertyValue(name),
      priority: target.style.getPropertyPriority(name),
    })
  }

  function setVar(target, name, value) {
    remember(target, name)
    target.style.setProperty(name, value)
  }

  function restoreVars() {
    for (const entry of saved.values()) {
      if (entry.value === '') entry.target.style.removeProperty(entry.name)
      else entry.target.style.setProperty(entry.name, entry.value, entry.priority)
    }
    saved.clear()
    appliedKeys = new Set()
  }

  // ── appearance mode ──────────────────────────────────────────────────────
  // `system` leaves the host's own preference alone; only an explicit
  // light/dark choice writes the attribute, and the previous state is put back
  // when the user returns to `system` or disables the plugin.
  let savedDark = null

  function applyMode() {
    const mode = readConfig()['appearance.mode']
    if (mode === 'system') {
      if (modeOwned && savedDark !== null) {
        doc.body.toggleAttribute('data-ds-dark-theme', savedDark)
        modeOwned = false
      }
      return
    }
    if (!modeOwned) {
      savedDark = doc.body.hasAttribute('data-ds-dark-theme')
      modeOwned = true
    }
    doc.body.toggleAttribute('data-ds-dark-theme', mode === 'dark')
  }

  function restoreMode() {
    if (modeOwned && savedDark !== null) {
      doc.body.toggleAttribute('data-ds-dark-theme', savedDark)
    }
    modeOwned = false
    savedDark = null
  }

  // ── colours ──────────────────────────────────────────────────────────────

  function applyColors() {
    const config = readConfig()
    const bg = config['appearance.bgColor']
    const accent = config['appearance.accentColor']
    const dark = doc.body.hasAttribute('data-ds-dark-theme')

    // Official path: stack a token layer; an empty layer removes everything.
    if (themeService !== null && typeof themeService.overrideTokens === 'function') {
      const tokens = {}
      if (typeof bg === 'string' && bg !== '') {
        tokens['--dsw-alias-bg-base'] = { light: bg, dark: bg }
      }
      if (typeof accent === 'string' && accent !== '') {
        tokens['--dsw-alias-brand-primary'] = { light: accent, dark: accent }
      }
      try {
        const next = themeService.overrideTokens('dsh-deepseek-theme-studio', tokens)
        if (typeof releaseOverride === 'function') releaseOverride()
        releaseOverride = typeof next === 'function' ? next : null
        appliedKeys.add('theme-service')
        return
      } catch (error) {
        log.warn('[theme-studio] theme.overrideTokens failed, falling back to CSS variables', error)
      }
    }

    if (typeof bg === 'string' && bg !== '') setVar(doc.documentElement, '--dsw-alias-bg-base', bg)
    else restoreOne('--dsw-alias-bg-base')
    if (typeof accent === 'string' && accent !== '') setVar(doc.documentElement, '--dsw-alias-brand-primary', accent)
    else restoreOne('--dsw-alias-brand-primary')
    appliedKeys.add('css-vars')
    void dark
  }

  function restoreOne(name) {
    const key = `root:${name}`
    const entry = saved.get(key)
    if (entry === undefined) return
    if (entry.value === '') entry.target.style.removeProperty(entry.name)
    else entry.target.style.setProperty(entry.name, entry.value, entry.priority)
    saved.delete(key)
  }

  // ── decoration opacity + motion variables ────────────────────────────────

  function applyScalars() {
    const config = readConfig()
    setVar(doc.documentElement, '--dts-decoration-opacity', String(config['appearance.opacity']))
    setVar(doc.documentElement, '--dts-motion-duration', `${Math.round(config['motion.duration'])}ms`)
    setVar(doc.documentElement, '--dts-motion-easing', config['motion.easing'])

    if (motionStyle === null) {
      motionStyle = doc.createElement('style')
      motionStyle.dataset.plugin = 'dsh-deepseek-theme-studio'
      motionStyle.dataset.pluginCss = 'motion'
      doc.head.appendChild(motionStyle)
    }
    // Scoped to plugin-owned surfaces only: the spec forbids overriding host
    // component styles globally, so the unified duration governs the effects,
    // the settings row and the glass transition — not the host's own widgets.
    motionStyle.textContent = `
html[${ROOT_ATTR}] .dts-fluid-canvas,
html[${ROOT_ATTR}] .dts-grid-canvas,
html[${ROOT_ATTR}] .dts-particle-canvas,
html[${ROOT_ATTR}] .dts-spotlight-ring,
html[${ROOT_ATTR}] .dts-settings,
html[${ROOT_ATTR}] .dts-settings * {
  --dts-motion-duration: ${Math.round(config['motion.duration'])}ms;
  --dts-motion-easing: ${config['motion.easing']};
}
`
  }

  // ── background element ───────────────────────────────────────────────────

  function ensureBackground() {
    if (backgroundEl !== null && backgroundEl.isConnected) return backgroundEl
    // Single-instance guard: a hot reload must not stack two background layers.
    for (const stale of doc.querySelectorAll('.dts-background')) stale.remove()
    backgroundEl = doc.createElement('div')
    backgroundEl.className = 'dts-background'
    backgroundEl.setAttribute('aria-hidden', 'true')
    doc.body.appendChild(backgroundEl)
    return backgroundEl
  }

  function removeBackground() {
    if (backgroundEl === null) return
    backgroundEl.remove()
    backgroundEl = null
  }

  function applyBackground() {
    const config = readConfig()
    const mode = config['appearance.backgroundMode']
    const bg = config['appearance.bgColor']
    const hasColor = typeof bg === 'string' && bg !== ''
    if (mode === 'solid' && !hasColor) {
      removeBackground()
      return
    }
    const element = ensureBackground()
    element.dataset.mode = mode
    element.style.opacity = String(config['appearance.opacity'])
    if (mode === 'gradient') {
      const colors = [
        config['appearance.palette1'], config['appearance.palette2'],
        config['appearance.palette3'], config['appearance.palette4'],
      ]
      element.style.background = staticGradientCss(colors, config['appearance.gradientAngle'])
    } else if (mode === 'solid') {
      element.style.background = bg
    } else {
      // Fluid mode leaves the element transparent: the WebGL canvas paints it.
      element.style.background = 'transparent'
    }
  }

  /**
   * True when no parameter asks for anything at all.
   *
   * In this state the plugin must be byte-invisible: no root attribute, no
   * style tag, no background element, no token writes. That is what makes
   * "all effects off ⇒ pixel diff = 0 against an uninstalled host" true rather
   * than merely plausible.
   */
  function isPristine() {
    const config = readConfig()
    if (config['appearance.mode'] !== 'system') return false
    if (config['appearance.backgroundMode'] !== 'solid') return false
    if (config['appearance.bgColor'] !== '' || config['appearance.accentColor'] !== '') return false
    for (const key of ['fluid.enabled', 'glass.enabled', 'quantum.q1Enabled', 'quantum.q2Enabled',
      'quantum.q3Enabled', 'quantum.q4Enabled', 'spotlight.enabled']) {
      if (config[key] === true) return false
    }
    return true
  }

  function applyAll() {
    if (isPristine()) {
      // Hand everything back exactly as we found it.
      doc.documentElement.removeAttribute(ROOT_ATTR)
      restoreMode()
      if (typeof releaseOverride === 'function') {
        try { releaseOverride() } catch { /* already released */ }
        releaseOverride = null
      }
      restoreVars()
      removeBackground()
      if (motionStyle !== null) {
        motionStyle.remove()
        motionStyle = null
      }
      return
    }
    doc.documentElement.setAttribute(ROOT_ATTR, '')
    applyMode()
    applyColors()
    applyScalars()
    applyBackground()
  }

  return {
    applyAll,
    refresh: applyAll,
    isPristine,
    /** Called on host `theme/change` so dark/light tints follow the palette. */
    onThemeChange() {
      applyMode()
      applyColors()
    },
    getBackgroundElement: () => backgroundEl,
    getDiagnostics: () => ({
      mode: readConfig()['appearance.mode'],
      backgroundMode: readConfig()['appearance.backgroundMode'],
      backgroundMounted: backgroundEl !== null && backgroundEl.isConnected,
      officialTokenApi: releaseOverride !== null || (themeService !== null && typeof themeService.overrideTokens === 'function'),
      writtenTokens: WRITABLE_TOKENS.filter((name) => doc.documentElement.style.getPropertyValue(name) !== ''),
      savedTokens: saved.size,
      modeOwned,
    }),
    destroy() {
      if (typeof releaseOverride === 'function') {
        try { releaseOverride() } catch { /* already released */ }
        releaseOverride = null
      }
      restoreMode()
      removeBackground()
      if (motionStyle !== null) {
        motionStyle.remove()
        motionStyle = null
      }
      restoreVars()
      doc.documentElement.removeAttribute(ROOT_ATTR)
    },
  }
}
