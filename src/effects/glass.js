/**
 * Frosted glass (毛玻璃) — whitelist-only, attribute-gated.
 *
 * PROVENANCE (MIT)
 *   Declaration values and the "no refraction layer, no specular highlight, no
 *   shadow" decision are taken from ycqaq233/dsh-unknown-theme lib/client.js
 *   (MIT, Copyright (c) 2026 ycqaq233) lines 185-200, which reproduces the
 *   harness landing page's terminal card: `background: rgba(0,0,0,.2)` +
 *   `backdrop-filter: blur(24px)` + `1px solid rgba(255,255,255,.08)` +
 *   `box-shadow: none`.
 *   The `@supports` gate and the "only touch an explicit allow-list of host
 *   classes" discipline come from RevolutionLA/dsh-dream-skin lib/client.js
 *   (MIT) lines 2275-2283.
 *
 * WHY THIS IS NOT A GLOBAL OVERRIDE (spec 3.4)
 *   Every rule is nested under `html[data-dts-glass-root]`, which exists only
 *   while the effect is on. Nothing is styled by element name, nothing uses a
 *   bare `!important` blanket over host components, and removing one attribute
 *   plus one <style> node restores the host exactly (spec 5.2, pixel diff = 0).
 *
 * BLACKLIST (spec 2.3)
 *   backdrop-filter creates a containing block, so applying it to an ancestor
 *   of a `position: fixed` overlay traps that overlay inside the ancestor. A
 *   guard pass marks such candidates `data-dts-glass-skip`, together with any
 *   candidate beyond the on-screen cap of 6.
 */

import { GLASS_SLOTS, GLASS_MAX_TARGETS } from '../params.js'
import { hexToRgba } from './grid.js'

/**
 * Elements that must never receive the effect, even when a slot selector names
 * them: the layout columns own the scroll and the stacking, and body/html would
 * filter the entire page.
 *
 * Note the deliberate omission of `[role="dialog"]`. An earlier revision
 * refused dialogs outright because `backdrop-filter` creates a containing block
 * for `position: fixed` descendants. That refusal also made "the settings page
 * should be translucent glass" impossible. Slot targets are an explicit user
 * choice with an editable selector, so the guard now refuses only the surfaces
 * where the effect cannot work at all, and the trade-off is documented.
 */
const HARD_DENYLIST = [
  'body',
  'html',
  '[class*="_frame"]',
  '[class*="_centerCol"]',
  '[class*="_sidebarCol"]',
]

const SKIP_ATTR = 'data-dts-glass-skip'
const GLASS_ROOT_ATTR = 'data-dts-glass-root'

/**
 * Slots with their own tint strength.
 *
 * The composer is the "bottom layer" surface: it lies over the background and
 * must read as glass *on* the backdrop rather than a card floating above it, so
 * its tint is much weaker than a panel's.
 */
const SLOT_TINT_VAR = {
  'glass.slot.composer': '--dts-glass-tint-composer',
  'glass.slot.dialog': '--dts-glass-tint-panel',
}

/**
 * Lower number claims a place in the shared on-screen cap first. Large surfaces
 * first, small repeated controls last — a page that hits the cap must lose a
 * sidebar button, never the settings panel.
 */
/** Slots that get their own blur radius (a big panel needs more than a chip). */
const SLOT_BLUR_VAR = {
  'glass.slot.dialog': '--dts-glass-blur-panel',
}

/**
 * Slots with real elevation. A panel that must read as a layer above the page
 * needs a hairline it can be seen against and a single soft shadow; small
 * controls keep the flat no-shadow look. One shadow layer only — the spec's ban
 * on stacked shadows still holds.
 */
const SLOT_SHADOW_VAR = {
  'glass.slot.dialog': '--dts-glass-shadow-panel',
}

/** Slots with their own saturation push. */
const SLOT_SATURATION_VAR = {
  'glass.slot.dialog': '--dts-glass-saturation-panel',
}

const SLOT_PRIORITY = {
  'glass.slot.dialog': 10,
  'glass.slot.composer': 20,
  'glass.slot.bubble': 40,
  'glass.slot.sidebar': 60,
  'glass.slot.sessionlog': 70,
}

export function createGlassLayer(options) {
  const readConfig = options.readConfig
  const doc = options.document ?? document

  let style = null
  let enabled = false
  let applied = 0
  let skipped = 0
  let matched = 0

  /** Compose the stylesheet from the current parameters. */
  function buildCss() {
    const config = readConfig()
    const blur = config['glass.blur']
    const saturation = config['glass.saturation']
    const darkTint = hexToRgba(config['glass.tintDark'], config['glass.tintDarkAlpha'])
    const lightTint = hexToRgba(config['glass.tintLight'], config['glass.tintLightAlpha'])
    const composerDark = hexToRgba(config['glass.tintDark'], config['glass.composerTintAlpha'])
    const composerLight = hexToRgba(config['glass.tintLight'], config['glass.composerTintAlpha'])
    const panelBlur = config['glass.panelBlur']
    const panelSaturation = config['glass.panelSaturation']
    const panelScrim = config['glass.panelScrim']
    const panelDark = hexToRgba(config['glass.tintDark'], config['glass.panelTintAlpha'])
    const panelLight = hexToRgba(config['glass.tintLight'], config['glass.panelTintAlpha'])
    const borderDark = hexToRgba('#ffffff', config['glass.borderAlpha'])
    const borderLight = hexToRgba(config['glass.borderColorLight'], config['glass.borderAlphaLight'])
    const shadow = config['glass.panelShadowAlpha'] > 0
      ? `0 ${Math.round(config['glass.panelShadowY'])}px ${Math.round(config['glass.panelShadowBlur'])}px `
        + hexToRgba(config['glass.panelShadowColor'], config['glass.panelShadowAlpha'])
      : 'none'
    const highlight = config['glass.panelHighlight'] > 0
      ? `, inset 0 1px 0 ${hexToRgba('#ffffff', config['glass.panelHighlight'])}`
      : ''
    const panelElevation = shadow === 'none' ? 'none' : shadow + highlight

    const declarations = [
      'background: var(--dts-glass-tint-slot) !important;',
      'border: 1px solid var(--dts-glass-border-slot) !important;',
      '-webkit-backdrop-filter: blur(var(--dts-glass-blur-slot)) saturate(var(--dts-glass-saturation-slot)) !important;',
      'backdrop-filter: blur(var(--dts-glass-blur-slot)) saturate(var(--dts-glass-saturation-slot)) !important;',
      // Flat by default; the panel slot overrides this with one soft shadow.
      'box-shadow: var(--dts-glass-shadow-slot, none) !important;',
    ].join('\n  ')

    const rules = []
    for (const slot of GLASS_SLOTS) {
      const on = config[slot.key] === true
      const selector = config[`${slot.key}.selector`]
      if (!on || typeof selector !== 'string' || selector.trim() === '') continue
      const tintVar = SLOT_TINT_VAR[slot.key] ?? '--dts-glass-tint'
      const blurVar = SLOT_BLUR_VAR[slot.key] ?? '--dts-glass-blur'
      const shadowVar = SLOT_SHADOW_VAR[slot.key] ?? '--dts-glass-shadow-plain'
      const saturationVar = SLOT_SATURATION_VAR[slot.key] ?? '--dts-glass-saturation'
      rules.push(
        `html[${GLASS_ROOT_ATTR}] ${selector}:not([${SKIP_ATTR}]) {\n`
        + `  --dts-glass-tint-slot: var(${tintVar});\n`
        + `  --dts-glass-blur-slot: var(${blurVar});\n`
        + `  --dts-glass-shadow-slot: var(${shadowVar});\n`
        + `  --dts-glass-saturation-slot: var(${saturationVar});\n`
        + `  ${declarations}\n}`,
      )
    }
    if (rules.length === 0 && panelScrim === 0) return ''

    // The modal scrim is a full-screen sibling of the panel. Neutralising it is
    // what makes "opening Settings changes nothing about the page underneath"
    // true rather than approximate.
    const scrimRule = `html[${GLASS_ROOT_ATTR}] [class*="_overlay"] > [class*="_mask"] {
  background: rgba(0, 0, 0, var(--dts-panel-scrim, 0)) !important;
}`

    return `@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
${scrimRule}
${rules.join('\n')}
}
html[${GLASS_ROOT_ATTR}] {
  --dts-glass-blur: ${blur}px;
  --dts-glass-saturation: ${saturation};
  --dts-glass-border: ${borderDark};
  /* Every slot inherits this; a slot may override it with its own hairline. */
  --dts-glass-border-slot: var(--dts-glass-border);
  --dts-glass-shadow-plain: none;
  --dts-glass-saturation-panel: ${panelSaturation};
  --dts-glass-shadow-panel: ${panelElevation};
  --dts-glass-tint: ${darkTint};
  --dts-glass-tint-composer: ${composerDark};
  --dts-glass-tint-panel: ${panelDark};
  --dts-glass-blur-panel: ${panelBlur}px;
  --dts-panel-scrim: ${panelScrim};
}
html[${GLASS_ROOT_ATTR}][data-dts-glass-mode='light'] {
  --dts-glass-border: ${borderLight};
  --dts-glass-tint: ${lightTint};
  --dts-glass-tint-composer: ${composerLight};
  --dts-glass-tint-panel: ${panelLight};
}`
  }

  function ensureStyle() {
    if (style !== null) return style
    style = doc.createElement('style')
    style.dataset.plugin = 'dsh-deepseek-theme-studio'
    style.dataset.pluginCss = 'glass'
    doc.head.appendChild(style)
    return style
  }

  /** Hard-refuse only the surfaces where the effect cannot work at all. */
  function isUnsafeTarget(element) {
    for (const denylist of HARD_DENYLIST) {
      if (element.matches(denylist)) return true
    }
    return false
  }

  /**
   * Walk every enabled slot, clear stale marks, then mark the unsafe and the
   * over-cap candidates so the stylesheet skips exactly those.
   *
   * Order matters: the on-screen cap is shared, and a page usually offers
   * several small candidates (sidebar buttons, switches) that would eat the
   * whole budget before one large panel is ever reached — which is exactly how
   * the settings dialog silently missed out. Panels therefore claim their place
   * first, and zero-size matches (hidden/collapsed nodes) never count.
   */
  function markTargets() {
    const config = readConfig()
    for (const stale of doc.querySelectorAll(`[${SKIP_ATTR}]`)) stale.removeAttribute(SKIP_ATTR)
    matched = 0
    skipped = 0
    applied = 0
    const slots = [...GLASS_SLOTS].sort(
      (a, b) => (SLOT_PRIORITY[a.key] ?? 50) - (SLOT_PRIORITY[b.key] ?? 50),
    )
    // Collect every candidate first: a broad selector such as [class*="_x"]
    // matches a control AND its inner spans, and filtering per-slot cannot see
    // that they nest. Only the outermost of a nested set is kept — otherwise
    // each inner layer draws its own border and eats a slot.
    const candidates = []
    for (const slot of slots) {
      if (config[slot.key] !== true) continue
      const selector = config[`${slot.key}.selector`]
      if (typeof selector !== 'string' || selector.trim() === '') continue
      let list
      try {
        list = doc.querySelectorAll(selector)
      } catch {
        continue
      }
      for (const element of list) candidates.push(element)
    }
    const candidateSet = new Set(candidates)
    const isNested = (element) => {
      for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
        if (candidateSet.has(parent)) return true
      }
      return false
    }
    for (const element of candidateSet) {
      if (element.offsetWidth === 0 && element.offsetHeight === 0) continue
      if (isNested(element)) {
        // Inside another glassed element: invisible work, and it steals a slot.
        element.setAttribute(SKIP_ATTR, '')
        skipped += 1
        continue
      }
      matched += 1
      if (applied >= GLASS_MAX_TARGETS || isUnsafeTarget(element)) {
        element.setAttribute(SKIP_ATTR, '')
        skipped += 1
        continue
      }
      applied += 1
    }
  }

  function onThemeChange() {
    if (!enabled) return
    const dark = doc.body.hasAttribute('data-ds-dark-theme')
    doc.documentElement.setAttribute('data-dts-glass-mode', dark ? 'dark' : 'light')
  }

  let observer = null

  return {
    setEnabled(value) {
      enabled = value === true
      if (!enabled) {
        if (style !== null) {
          style.remove()
          style = null
        }
        doc.documentElement.removeAttribute(GLASS_ROOT_ATTR)
        doc.documentElement.removeAttribute('data-dts-glass-mode')
        for (const stale of doc.querySelectorAll(`[${SKIP_ATTR}]`)) stale.removeAttribute(SKIP_ATTR)
        observer?.disconnect()
        observer = null
        return
      }
      doc.documentElement.setAttribute(GLASS_ROOT_ATTR, '')
      onThemeChange()
      const node = ensureStyle()
      node.textContent = buildCss()
      markTargets()
      if (observer === null && typeof MutationObserver === 'function') {
        observer = new MutationObserver(() => {
          markTargets()
        })
        observer.observe(doc.body, { childList: true, subtree: true })
      }
    },
    refresh() {
      if (!enabled) return
      onThemeChange()
      const node = ensureStyle()
      node.textContent = buildCss()
      markTargets()
    },
    getDiagnostics: () => ({ enabled, matched, applied, skipped, cap: GLASS_MAX_TARGETS }),
    destroy() {
      observer?.disconnect()
      observer = null
      if (style !== null) style.remove()
      style = null
      for (const stale of doc.querySelectorAll(`[${SKIP_ATTR}]`)) stale.removeAttribute(SKIP_ATTR)
      doc.documentElement.removeAttribute(GLASS_ROOT_ATTR)
      doc.documentElement.removeAttribute('data-dts-glass-mode')
      enabled = false
    },
  }
}
