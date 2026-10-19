/**
 * Interaction animation layer — 悬停弹起放大 / 按压下沉 / 面板入场.
 *
 * Two rules shape this file:
 *
 *   1. A click target never changes geometry. A 5 px lift on a 20 px switch
 *      moves the control out from under the pointer: near the bottom edge the
 *      pointer leaves the element, the lift reverses, the pointer re-enters,
 *      and the result is a visible hover oscillation. The same translate also
 *      moves the mouseup target, so an edge click can miss. Click targets
 *      therefore only animate colour / background / border / shadow / opacity;
 *      `transform` stays `none` in every pointer state.
 *   2. Decorative surfaces may still lift, but only when they are neither
 *      clickable themselves nor contain anything clickable. The lift is an
 *      optional visual flourish, never part of the hit-testing path.
 *
 * The panel entrance is opacity-only for the same reason: a dialog that rises
 * 6 px while the user is already aiming at a switch makes the first click land
 * on a different control.
 *
 * The host already animates `background-color` on most of these elements, and a
 * bare `transition: transform …` would *replace* that. So the transition list
 * restates the properties the host animates on controls, which keeps host
 * feedback intact without adding geometry.
 *
 * PROVENANCE: no upstream implementation was used — the hover/active semantics
 * here are this project's own (see REUSE.md §0.4.3). The list of touchable
 * host elements is derived from the DOM hooks in src/host-hooks.js, not copied.
 */

export const INTERACTION_CSS = `
/* Every marked target keeps the host's colour feedback. No transform here:
   only .dts-motion-target is allowed to move. */
html[data-dts-interaction] :is(.dts-hover-target) {
  transition:
    background-color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    border-color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    opacity var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    box-shadow var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)) !important;
}

/* Decorative-only surfaces may move. They contain no click target, so moving
   them cannot change what a click hits. */
html[data-dts-interaction] :is(.dts-motion-target) {
  transform-origin: center;
  transition:
    transform var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    background-color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    border-color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    opacity var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    box-shadow var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)) !important;
}
html[data-dts-interaction] :is(.dts-motion-target):hover {
  transform: translateY(calc(-1 * var(--dts-hover-lift, 5px))) scale(var(--dts-hover-scale, 1.045));
}
/* The dialogue box reads as "focus", not "click": a whole-card scale that is
   deliberately larger than a small control's. It is only assigned to a
   decorative composer (clickSafe off); under the default click-safe mode the
   composer is a click target and never moves. */
html[data-dts-interaction] :is(.dts-focus-target):hover {
  transform: translateY(calc(-1 * var(--dts-hover-lift, 5px))) scale(var(--dts-composer-scale, 1.04));
  z-index: 1;
}
html[data-dts-interaction] :is(.dts-motion-target):active {
  transform: translateY(0) scale(var(--dts-press-scale, 0.985));
}
html[data-dts-interaction] :is(.dts-motion-target):disabled {
  transform: none;
}

/* Click targets: no geometry in any pointer state. !important is required
   because host controls may carry their own hover transform with a stronger
   selector; stabilising the hit box is the whole point of this rule. */
html[data-dts-interaction] :is(.dts-stable-target),
html[data-dts-interaction] :is(.dts-stable-target):hover,
html[data-dts-interaction] :is(.dts-stable-target):active,
html[data-dts-interaction] :is(.dts-stable-target):focus-visible {
  transform: none !important;
}

/* Panel / dialog entrance: a short fade, never longer than the spec's 240 ms
   ceiling, and driven by the same duration token. Opacity does not move the
   hit box, so a quick click during the entrance still lands where it was
   aimed. */
@keyframes dts-panel-enter {
  from { opacity: 0; }
  to   { opacity: 1; }
}
html[data-dts-interaction] .dts-panel-enter {
  animation: dts-panel-enter var(--dts-panel-enter, 200ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)) both;
}
@media (prefers-reduced-motion: reduce) {
  html[data-dts-interaction] :is(.dts-motion-target):hover,
  html[data-dts-interaction] :is(.dts-motion-target):active { transform: none; }
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

/**
 * A target is clickable if it is, contains, or sits inside one of these. The
 * composer card is included explicitly because it is one large focus/click
 * surface whose children move with it.
 */
const CLICK_TARGET_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  'label',
  '[role="button"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="treeitem"]',
  '[role="combobox"]',
  '[role="slider"]',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[data-composer-card]',
].join(', ')

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
  let marked = []
  let scheduled = false
  let stableCount = 0
  let motionCount = 0

  function ensureStyle() {
    if (style !== null) return style
    style = doc.createElement('style')
    style.dataset.plugin = 'dsh-deepseek-theme-studio'
    style.dataset.pluginCss = 'interaction'
    style.textContent = INTERACTION_CSS
    doc.head.appendChild(style)
    return style
  }

  function clearClasses(el) {
    el.classList.remove('dts-hover-target')
    el.classList.remove('dts-focus-target')
    el.classList.remove('dts-stable-target')
    el.classList.remove('dts-motion-target')
  }

  function unmark() {
    for (const el of marked) clearClasses(el)
    marked = []
    stableCount = 0
    motionCount = 0
  }

  /**
   * Collect the interactive elements in this scope once, then derive the
   * container set by walking their ancestors. This keeps classification O(n)
   * in the number of click targets instead of running a deep query per marked
   * element.
   */
  function classify(scope, candidates, clickSafe) {
    const clickSet = new Set()
    if (clickSafe) {
      let found
      try {
        found = scope.querySelectorAll(CLICK_TARGET_SELECTOR)
      } catch {
        found = []
      }
      for (const el of found) clickSet.add(el)
      // `[tabindex]` needs a value check: tabindex="-1" is not a pointer target.
      for (const el of scope.querySelectorAll('[tabindex]')) {
        if (el.tabIndex >= 0) clickSet.add(el)
      }
    }

    const containsClick = new Set()
    if (clickSet.size > 0) {
      for (const el of clickSet) {
        let parent = el.parentElement
        while (parent !== null && parent !== scope && !containsClick.has(parent)) {
          containsClick.add(parent)
          parent = parent.parentElement
        }
      }
    }

    const unstable = new Set()
    const stable = new Set()
    for (const el of candidates) {
      if (!clickSafe) {
        unstable.add(el)
        continue
      }
      let isStable = clickSet.has(el) || containsClick.has(el)
      if (!isStable) {
        // An inner decorative span inside a button/label is still part of the
        // click surface; it must not lift on its own. Walk the cached Set
        // instead of running closest() per candidate: the walk stops at the
        // first interactive ancestor and never leaves the current scope.
        let parent = el.parentElement
        while (parent !== null && parent !== scope) {
          if (clickSet.has(parent)) {
            isStable = true
            break
          }
          parent = parent.parentElement
        }
      }
      if (isStable) stable.add(el)
      else unstable.add(el)
    }
    return { stable, unstable }
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

    const clickSafe = config['motion.clickSafe'] !== false
    const { stable, unstable } = classify(scope, found, clickSafe)

    // Drop marks that no longer match (elements removed or re-rendered).
    const foundSet = new Set(found)
    for (const el of marked) {
      if (!foundSet.has(el) || !el.isConnected) clearClasses(el)
    }
    for (const el of found) {
      el.classList.add('dts-hover-target')
      if (stable.has(el)) {
        el.classList.add('dts-stable-target')
        el.classList.remove('dts-motion-target')
      } else {
        el.classList.remove('dts-stable-target')
        el.classList.add('dts-motion-target')
      }
      // Only a decorative composer may use the stronger focus scale. Under the
      // default click-safe mode the composer is stable, so it never gets it.
      const focus = unstable.has(el) && el.matches('[data-composer-card]')
      el.classList.toggle('dts-focus-target', focus)
    }
    marked = found
    stableCount = stable.size
    motionCount = unstable.size
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
    const on = config['motion.enabled'] === true
      && config['motion.hoverEnabled'] === true
      && config['motion.panelEnter'] > 0
    for (const panel of doc.querySelectorAll('[role="dialog"]')) {
      panel.classList.toggle('dts-panel-enter', on)
      panel.classList.remove('dts-hover-target', 'dts-focus-target', 'dts-stable-target', 'dts-motion-target')
    }
  }

  return {
    refresh() {
      const config = readConfig()
      const on = config['motion.enabled'] === true && config['motion.hoverEnabled'] === true
      if (!on) {
        doc.documentElement.removeAttribute('data-dts-interaction')
        unmark()
        markPanels()
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
    getDiagnostics: () => {
      const config = readConfig()
      return {
        enabled: doc.documentElement.hasAttribute('data-dts-interaction'),
        markedTargets: marked.length,
        focusTargets: doc.querySelectorAll('.dts-focus-target').length,
        scope: doc.querySelector('[role="dialog"]') !== null && config['motion.scopeToDialog'] === true ? 'dialog' : 'page',
        panels: doc.querySelectorAll('.dts-panel-enter').length,
        clickSafe: config['motion.clickSafe'] !== false,
        stableTargets: stableCount,
        motionTargets: motionCount,
      }
    },
    destroy() {
      unmark()
      // Belt-and-braces: a stale node could have been re-rendered between the
      // last mark() and disposal. Leave no plugin class behind.
      for (const el of doc.querySelectorAll('.dts-hover-target, .dts-focus-target, .dts-stable-target, .dts-motion-target')) {
        clearClasses(el)
      }
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
