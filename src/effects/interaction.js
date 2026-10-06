/**
 * Interaction animation layer — 悬停弹起放大 / 按压下沉 / 面板入场.
 *
 * Everything here animates `transform` and `opacity` only, so no frame can
 * trigger layout or paint of anything but a composited layer. There is no
 * overshoot: every value is a plain translate/scale, and the easing is the same
 * "fast out, slow in" curve the rest of the plugin uses.
 *
 * The host already animates `background-color` on most of these elements, and a
 * bare `transition: transform …` would *replace* that. So the transition list
 * restates the properties the host animates on controls, which keeps host
 * feedback intact while adding the lift.
 *
 * PROVENANCE: no upstream implementation was used — the hover/актив semantics
 * here are this project's own (see REUSE.md §0.4.3). The list of touchable
 * host elements is derived from the DOM hooks in src/host-hooks.js, not copied.
 */

export const INTERACTION_CSS = `
html[data-dts-interaction] :is(.dts-hover-target) {
  transition:
    transform var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    background-color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    border-color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    opacity var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    box-shadow var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)) !important;
  transform-origin: center;
  will-change: auto;
}
html[data-dts-interaction] :is(.dts-hover-target):hover {
  transform: translateY(calc(-1 * var(--dts-hover-lift, 5px))) scale(var(--dts-hover-scale, 1.045));
  will-change: transform;
}
/* The dialogue box reads as "focus", not "click": a whole-card scale that is
   deliberately larger than a small control's, lifted above its neighbours so
   the enlargement is not clipped by them. It settles back down on press. */
html[data-dts-interaction] :is(.dts-focus-target):hover {
  transform: translateY(calc(-1 * var(--dts-hover-lift, 5px))) scale(var(--dts-composer-scale, 1.04));
  z-index: 1;
  will-change: transform;
}
html[data-dts-interaction] :is(.dts-hover-target):active {
  transform: translateY(0) scale(var(--dts-press-scale, 0.985));
}
html[data-dts-interaction] :is(.dts-hover-target):disabled {
  transform: none;
}

/* Panel / dialog entrance: a short rise + fade, never longer than the spec's
   240 ms ceiling, and driven by the same duration token. */
@keyframes dts-panel-enter {
  from { opacity: 0; transform: translateY(6px) scale(0.994); }
  to   { opacity: 1; transform: none; }
}
html[data-dts-interaction] .dts-panel-enter {
  animation: dts-panel-enter var(--dts-panel-enter, 200ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)) both;
}
@media (prefers-reduced-motion: reduce) {
  html[data-dts-interaction] :is(.dts-hover-target):hover,
  html[data-dts-interaction] :is(.dts-hover-target):active { transform: none; }
  html[data-dts-interaction] .dts-panel-enter { animation: none; }
}
`

/** Never lift these: layout columns, scroll containers, overlays, our own DOM. */
const NEVER_TARGETS = [
  '[class*="_frame"]',
  '[class*="_centerCol"]',
  '[class*="_sidebarCol"]',
  '[class*="_scrollBody"]',
  '[data-conversation-scroll]',
  '[role="dialog"]',
  '[class^="dts-"]',
]

/** Cap how many elements get marked, so a huge list cannot cost a long task. */
const MAX_TARGETS = 400

/**
 * Create the interaction layer.
 *
 * @param options.readConfig - parameter snapshot.
 * @param options.document - target document.
 */
export function createInteractionLayer(options) {
  const readConfig = options.readConfig
  const doc = options.document ?? document
  let style = null
  let observer = null
  let marked = []
  let scheduled = false

  function ensureStyle() {
    if (style !== null) return style
    style = doc.createElement('style')
    style.dataset.plugin = 'dsh-deepseek-theme-studio'
    style.dataset.pluginCss = 'interaction'
    style.textContent = INTERACTION_CSS
    doc.head.appendChild(style)
    return style
  }

  function unmark() {
    for (const el of marked) {
      el.classList.remove('dts-hover-target')
      el.classList.remove('dts-focus-target')
    }
    marked = []
  }

  /** Mark the current hover targets (idempotent; re-runs on DOM changes). */
  function mark() {
    scheduled = false
    const config = readConfig()
    if (config['motion.hoverEnabled'] !== true || config['motion.enabled'] !== true) {
      unmark()
      return
    }
    const selector = String(config['motion.hoverTargets'] ?? '').trim()
    if (selector === '') {
      unmark()
      return
    }
    // With motion.scopeToDialog on and a panel open, only the panel's own
    // controls animate: the page behind a modal must stay still, otherwise the
    // whole plane appears to react while the user is working inside a panel.
    const scope = config['motion.scopeToDialog'] === true
      ? (doc.querySelector('[role="dialog"]') ?? doc)
      : doc
    let found
    try {
      found = [...scope.querySelectorAll(selector)]
    } catch {
      unmark()
      return
    }
    found = found.filter((el) => !NEVER_TARGETS.some((bad) => {
      try {
        return el.matches(bad)
      } catch {
        return false
      }
    })).slice(0, MAX_TARGETS)
    const next = new Set(found)
    // Drop marks that no longer match (elements removed or re-rendered).
    for (const el of marked) {
      if (!next.has(el) || !el.isConnected) el.classList.remove('dts-hover-target')
    }
    for (const el of next) {
      el.classList.add('dts-hover-target')
      // The dialogue box gets a stronger "focus" scale than a small control.
      if (el.matches('[data-composer-card]')) el.classList.add('dts-focus-target')
      else el.classList.remove('dts-focus-target')
    }
    marked = [...next]
  }

  function scheduleMark() {
    if (scheduled) return
    scheduled = true
    window.requestAnimationFrame(() => {
      mark()
      // Panels open long after the last sync(), so the entrance class has to be
      // re-applied on every DOM change too — otherwise it never lands.
      markPanels()
    })
  }

  /** Dialogs and the settings surface get the entrance animation. */
  function markPanels() {
    const config = readConfig()
    const on = config['motion.enabled'] === true && config['motion.panelEnter'] > 0
    for (const panel of doc.querySelectorAll('[role="dialog"]')) {
      panel.classList.toggle('dts-panel-enter', on)
      panel.classList.toggle('dts-hover-target', false)
    }
  }

  return {
    refresh() {
      const config = readConfig()
      const on = config['motion.enabled'] === true && config['motion.hoverEnabled'] === true
      if (!on) {
        doc.documentElement.removeAttribute('data-dts-interaction')
        unmark()
        if (style !== null) {
          style.remove()
          style = null
        }
        return
      }
      doc.documentElement.setAttribute('data-dts-interaction', '')
      doc.documentElement.style.setProperty('--dts-hover-lift', `${config['motion.hoverLift']}px`)
      doc.documentElement.style.setProperty('--dts-hover-scale', String(config['motion.hoverScale']))
      doc.documentElement.style.setProperty('--dts-press-scale', String(config['motion.pressScale']))
      doc.documentElement.style.setProperty('--dts-panel-enter', `${Math.round(config['motion.panelEnter'])}ms`)
      doc.documentElement.style.setProperty('--dts-composer-scale', String(config['motion.composerScale']))
      ensureStyle()
      mark()
      markPanels()
    },
    /** Called after any DOM mutation by the owner's single observer budget. */
    onDomChanged: scheduleMark,
    getDiagnostics: () => ({
      enabled: doc.documentElement.hasAttribute('data-dts-interaction'),
      markedTargets: marked.length,
      focusTargets: doc.querySelectorAll('.dts-focus-target').length,
      scope: doc.querySelector('[role="dialog"]') !== null && readConfig()['motion.scopeToDialog'] === true ? 'dialog' : 'page',
      panels: doc.querySelectorAll('.dts-panel-enter').length,
    }),
    destroy() {
      observer?.disconnect()
      observer = null
      unmark()
      for (const panel of doc.querySelectorAll('.dts-panel-enter')) panel.classList.remove('dts-panel-enter')
      if (style !== null) {
        style.remove()
        style = null
      }
      doc.documentElement.removeAttribute('data-dts-interaction')
      for (const name of ['--dts-hover-lift', '--dts-hover-scale', '--dts-press-scale', '--dts-panel-enter', '--dts-composer-scale']) {
        doc.documentElement.style.removeProperty(name)
      }
    },
  }
}
