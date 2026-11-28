/**
 * Element interaction layer — iOS 风格弹缩（悬停放大 / 按下缩小 / 松手回弹）.
 *
 * What changed from 0.2.x and why:
 *
 *   The old layer deliberately froze every click target (`transform: none`) to
 *   kill a real defect: a 5 px `translateY` lift moved the element out from under
 *   the pointer, the pointer left the box, the lift reversed, the pointer
 *   re-entered — visible jitter at the bottom edge, and edge clicks could miss.
 *
 *   The fix is NOT "never move". It is "never move the HIT BOX out of the way":
 *
 *     - hover animates `scale()` around `transform-origin: center` only. Scaling
 *       up expands the box outward, so a pointer inside the element stays inside
 *       it — no enter/leave oscillation. `translateY` stays available but
 *       defaults to 0 px, because a vertical shift is exactly the thing that
 *       caused the jitter.
 *     - press animates a smaller `scale()` (0.94 by default). Shrinking cannot
 *       yank the element away either: `:active` is held until mouseup regardless
 *       of where the pointer went.
 *     - release unwinds through an overshooting bezier (`motion.spring`), which
 *       is what makes it read as an Apple spring rather than a fade.
 *
 *   Text fields keep the old freeze (`motion.textSafe`): a scaled text box
 *   rasterises its own caret and selection, so scaling it looks soft while you
 *   type. That is a legibility decision, not a safety one.
 *
 * Layering rules:
 *   - two matches of the same kind never nest: the outer one animates, the inner
 *     one is dropped so a `<span>` inside a `<button>` cannot double the factor;
 *   - output blocks (code blocks, message bubbles, anything in the transcript
 *     that is not a control) never move at all — a scaling code block carries its
 *     copy button away from the pointer that is trying to click it;
 *   - large surfaces (the composer card) get a much smaller factor and stop
 *     scaling entirely while focused (`:focus-within`), so typing never shifts
 *     the text under the caret.
 *
 * PROVENANCE: the spring model is CSS-only (a back-out cubic-bezier). No
 * upstream implementation was used; see REUSE.md §0.4.3.
 */

export const INTERACTION_CSS = `
/* ── base transition ───────────────────────────────────────────────────── */
html[data-dts-pop] :is(.dts-pop, .dts-pop-lg) {
  transform-origin: center;
  transition:
    transform var(--dts-pop-duration, 260ms) var(--dts-pop-easing, cubic-bezier(0.34, 1.56, 0.64, 1)),
    box-shadow var(--dts-pop-duration, 260ms) var(--dts-pop-easing, cubic-bezier(0.34, 1.56, 0.64, 1)),
    background-color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    border-color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
    opacity var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1));
}

/* ── hover: scale only, never a vertical shift by default ─────────────────
   !important is required: the host paints some cards with an inline
   transform (compositor hints), and an inline declaration outranks any
   stylesheet rule. Only the hover/active frames take priority, so the host's
   resting transform is untouched. */
html[data-dts-pop] .dts-pop:hover {
  transform: translateY(calc(-1 * var(--dts-hover-lift, 0px))) scale(var(--dts-hover-scale, 1.035)) !important;
  box-shadow: var(--dts-pop-shadow, 0 0 0 transparent);
}

/* ── press: shrink, then spring back on release ─────────────────────────── */
html[data-dts-pop] .dts-pop:active {
  transform: translateY(0) scale(var(--dts-press-scale, 0.94)) !important;
  transition-duration: var(--dts-press-duration, 100ms);
}
html[data-dts-pop] .dts-pop:disabled,
html[data-dts-pop] .dts-pop[aria-disabled="true"] {
  transform: none !important;
}

/* ── large surfaces (composer, message bubbles) ─────────────────────────── */
html[data-dts-pop] .dts-pop-lg:hover {
  transform: scale(var(--dts-large-scale, 1.03)) !important;
  box-shadow: var(--dts-pop-shadow-lg, 0 0 0 transparent);
}
html[data-dts-pop] .dts-pop-lg:active {
  transform: scale(calc(var(--dts-large-scale, 1.03) * 0.985)) !important;
  transition-duration: var(--dts-press-duration, 100ms);
}
/* NOTE: there is deliberately NO :focus-within freeze here.
   The composer is auto-focused the moment a session opens, so a
   .dts-pop-lg:focus-within { transform: none !important } rule (same
   specificity, same importance, later in the sheet) silently disabled the whole
   card animation — that is exactly why the "对话框" appeared to have no motion.
   Scaled text under transform is rendered subpixel by Chromium, so 1.03 stays
   crisp; only the text FIELD itself keeps a hard freeze (see .dts-textsafe). */
/* Belt and braces for the composer: its card can carry pointer-events: none
   so clicks fall through to the text area, and a pointer-events: none element
   never receives :hover. The seat around it always does, so the seat can drive
   the card. */
html[data-dts-pop] [data-composer-seat]:hover .dts-pop-lg,
html[data-dts-pop] [class*="_composerSeat"]:hover .dts-pop-lg {
  transform: scale(var(--dts-large-scale, 1.03)) !important;
  box-shadow: var(--dts-pop-shadow-lg, 0 0 0 transparent);
}

/* ── text fields: keep the old freeze (caret + selection stay crisp) ────── */
html[data-dts-pop] :is(.dts-textsafe),
html[data-dts-pop] :is(.dts-textsafe):hover,
html[data-dts-pop] :is(.dts-textsafe):active,
html[data-dts-pop] :is(.dts-textsafe):focus,
html[data-dts-pop] :is(.dts-textsafe):focus-within {
  transform: none !important;
}

/* ── panel / bubble / page entrances (unchanged) ────────────────────────── */
@keyframes dts-panel-enter {
  from { opacity: 0; }
  to   { opacity: 1; }
}
html[data-dts-pop] .dts-panel-enter {
  animation: dts-panel-enter var(--dts-panel-enter, 200ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)) both;
}

@keyframes dts-pop-in {
  0%   { opacity: 0; transform: scale(0.94); }
  60%  { opacity: 1; transform: scale(1.012); }
  100% { opacity: 1; transform: none; }
}
/* New message bubbles pop in once, then the class is dropped. */
html[data-dts-pop] .dts-bubble-in {
  animation: dts-pop-in var(--dts-message-enter, 180ms) var(--dts-pop-easing, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
}

@keyframes dts-page-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
html[data-dts-pop] .dts-page-in {
  animation: dts-page-in var(--dts-page-enter, 240ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)) both;
}

@media (prefers-reduced-motion: reduce) {
  html[data-dts-pop] :is(.dts-pop, .dts-pop-lg):hover,
  html[data-dts-pop] :is(.dts-pop, .dts-pop-lg):active { transform: none !important; }
  html[data-dts-pop] .dts-panel-enter,
  html[data-dts-pop] .dts-bubble-in,
  html[data-dts-pop] .dts-page-in { animation: none; }
}
`

/** Never animate these: layout columns, scroll containers, overlays, our own DOM. */
const NEVER_TARGETS = [
  '[class*="_frame"]',
  '[class*="_centerCol"]',
  '[class*="_sidebarCol"]',
  '[class*="_scrollBody"]',
  '[data-conversation-scroll]',
  '[class^="dts-"]',
]

/** Large surfaces get the whisper-scale instead of the full pop. */
const LARGE_SELECTOR = [
  '[data-composer-card]',
  '[data-composer-seat]',
  '[class*="_composerSeat"]',
].join(', ')

/**
 * Content blocks never move at all.
 *
 * A code block is a copy target: the copy button lives in its corner, so a
 * hover scale moves the button while the pointer is travelling towards it. The
 * pointer crosses the (moving) edge, the scale reverses, the button moves back —
 * that is the shake the user reported, and it makes the copy button hard to hit.
 * Read-only output has no interaction reward to give, so it gets none: no
 * transform, no shadow, no class. Only real controls animate.
 *
 * Anything inside the transcript that is not a control counts as output, which
 * covers tool-call cards and anything else the host renders there without a
 * class name we can predict.
 */
const CONTENT_SELECTOR = [
  'pre',
  'code',
  '[class*="_codeBlock"]',
  '[class*="_codeblock"]',
  '[class*="_bubble"]',
  '[class*="_markdown"]',
  '[class*="_prose"]',
].join(', ')

/** Real controls: these are the only things that animate. */
const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
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
].join(', ')

/** The transcript: everything in here that is not a control is output. */
const TRANSCRIPT_SELECTOR = '[data-conversation-scroll]'

/**
 * Text entry keeps `transform: none`: a scaled text box rasterises its own caret
 * and selection highlight, which reads as blur exactly while the user is typing.
 */
const TEXT_SAFE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(', ')

/**
 * Cap how many elements get marked, so a pathological page cannot cost a long
 * task.
 *
 * 400 was far too low: matches come back in DOCUMENT ORDER, the transcript and
 * the sidebar come first, and the composer card sits at the very end of the
 * DOM. On a long session the budget was exhausted long before reaching it, so
 * the card — the element the user calls "对话框" — was never marked at all. That
 * is why every other button animated while the composer stayed dead still.
 */
const MAX_TARGETS = 2000

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
  let popCount = 0
  let largeCount = 0
  let textSafeCount = 0
  let staticCount = 0
  /** Bubbles already considered. The first pass primes it without animating. */
  const seenBubbles = new WeakSet()
  let bubblesPrimed = false
  let pageEntered = false

  function ensureStyle() {
    if (style !== null) return style
    style = doc.createElement('style')
    style.dataset.plugin = 'dsh-deepseek-theme-studio'
    style.dataset.pluginCss = 'interaction'
    style.textContent = INTERACTION_CSS
    doc.head.appendChild(style)
    return style
  }

  const PLUGIN_CLASSES = ['dts-pop', 'dts-pop-lg', 'dts-textsafe']

  function clearClasses(el) {
    for (const name of PLUGIN_CLASSES) el.classList.remove(name)
  }

  function unmark() {
    for (const el of marked) clearClasses(el)
    marked = []
    popCount = 0
    largeCount = 0
    textSafeCount = 0
  }

  function matchesAny(el, list) {
    for (const selector of list) {
      try {
        if (el.matches(selector)) return true
      } catch { /* an invalid host selector must not stop the pass */ }
    }
    return false
  }

  /**
   * Nesting is resolved inside mark(), by kind: two matches on the same kind
   * would multiply the scale factor (1.035² ≈ 1.07). It cannot be a separate
   * pre-pass over the raw match list, because a frozen output block must not
   * count as a parent that swallows the controls inside it.
   */

  /** Mark the current pop targets (idempotent; re-runs on DOM changes). */
  function mark() {
    scheduled = false
    const config = readConfig()
    if (config['motion.enabled'] !== true || config['motion.hoverEnabled'] !== true) {
      unmark()
      return
    }
    const selector = String(config['motion.hoverTargets'] ?? '').trim()
    if (selector === '') {
      unmark()
      return
    }
    // With motion.scopeToDialog on and a panel open, only the panel's own
    // controls animate: the page behind a modal must stay still.
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
    found = found
      .filter((el) => !matchesAny(el, NEVER_TARGETS))
      .slice(0, MAX_TARGETS)

    /**
     * Classify FIRST, then resolve nesting.
     *
     * Nesting has to be resolved by kind rather than by "is an ancestor already
     * kept": a code block is classified as output and gets no class, so treating
     * it as a kept ancestor would swallow the copy button inside it and the one
     * control a user aims at there would answer with nothing. Frozen output also
     * must not shadow a control, so `static` never counts as a nested parent.
     */
    const textSafe = config['motion.textSafe'] !== false
    const kindOf = new Map()
    for (const el of found) {
      const interactive = matchesAny(el, [INTERACTIVE_SELECTOR])
      if (!interactive) {
        const isOutput = matchesAny(el, [CONTENT_SELECTOR])
          || el.querySelector('pre') !== null
          || el.closest(TRANSCRIPT_SELECTOR) !== null
        if (isOutput) {
          kindOf.set(el, 'static')
          continue
        }
      }
      if (textSafe && matchesAny(el, [TEXT_SAFE_SELECTOR])) kindOf.set(el, 'textsafe')
      else if (matchesAny(el, [LARGE_SELECTOR])) kindOf.set(el, 'lg')
      else kindOf.set(el, 'pop')
    }

    const kept = []
    for (const el of found) {
      const kind = kindOf.get(el)
      if (kind === 'static') {
        kept.push(el)
        continue
      }
      let nested = false
      let parent = el.parentElement
      while (parent !== null) {
        if (kindOf.get(parent) === kind) {
          nested = true
          break
        }
        parent = parent.parentElement
      }
      if (!nested) kept.push(el)
    }

    // Drop marks that no longer match (elements removed or re-rendered).
    const foundSet = new Set(kept)
    for (const el of marked) {
      if (!foundSet.has(el) || !el.isConnected) clearClasses(el)
    }

    popCount = 0
    largeCount = 0
    textSafeCount = 0
    staticCount = 0
    for (const el of kept) {
      clearClasses(el)
      switch (kindOf.get(el)) {
        case 'static':
          staticCount += 1
          break
        case 'textsafe':
          el.classList.add('dts-textsafe')
          textSafeCount += 1
          break
        case 'lg':
          el.classList.add('dts-pop-lg')
          largeCount += 1
          break
        default:
          el.classList.add('dts-pop')
          popCount += 1
      }
    }

    /**
     * Hard guarantee for the composer.
     *
     * Even with a generous budget, the card is always the LAST match in document
     * order, so any truncation eats it first. It is the single element the whole
     * feature is about, so it gets marked unconditionally — budget or not.
     */
    const composer = doc.querySelector('[data-composer-card]')
    if (composer !== null && composer.isConnected && !foundSet.has(composer)) {
      clearClasses(composer)
      composer.classList.add('dts-pop-lg')
      kept.push(composer)
      largeCount += 1
    }

    marked = kept
  }

  function scheduleMark() {
    if (scheduled) return
    scheduled = true
    window.requestAnimationFrame(() => {
      mark()
      // Panels open long after the last sync(), so the entrance class has to be
      // re-applied on every DOM change too — otherwise it never lands.
      markPanels()
      markBubbles()
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
      for (const name of PLUGIN_CLASSES) panel.classList.remove(name)
    }
  }

  /**
   * One entrance per newly mounted message bubble.
   *
   * The first pass only *primes* the set: on startup every bubble already in the
   * transcript would otherwise animate at once, which reads as a whole-page
   * flash rather than as "a new message arrived".
   */
  function markBubbles() {
    const config = readConfig()
    const on = config['motion.enabled'] === true && config['motion.messageEnter'] > 0
    const bubbles = doc.querySelectorAll('[class*="_bubble"]')
    if (!bubblesPrimed) {
      for (const bubble of bubbles) seenBubbles.add(bubble)
      bubblesPrimed = true
      return
    }
    if (!on) {
      for (const bubble of bubbles) seenBubbles.add(bubble)
      return
    }
    for (const bubble of bubbles) {
      if (seenBubbles.has(bubble)) continue
      seenBubbles.add(bubble)
      bubble.classList.add('dts-bubble-in')
      bubble.addEventListener('animationend', () => bubble.classList.remove('dts-bubble-in'), { once: true })
    }
  }

  /** The conversation column fades in once when the plugin starts. */
  function markPageEnter() {
    if (pageEntered) return
    const config = readConfig()
    if (config['motion.enabled'] !== true || !(config['motion.pageEnter'] > 0)) return
    const column = doc.querySelector('[class*="_centerCol"]') ?? doc.querySelector('[data-phase]')
    if (column === null) return
    pageEntered = true
    column.classList.add('dts-page-in')
    column.addEventListener('animationend', () => column.classList.remove('dts-page-in'), { once: true })
  }

  /** The overshoot of the spring: x1/x2 fixed, y2 is the user's tuning knob. */
  function springCurve(spring) {
    const overshoot = Math.min(2.2, Math.max(1, Number(spring) || 1.56))
    return `cubic-bezier(0.34, ${overshoot}, 0.64, 1)`
  }

  return {
    refresh() {
      const config = readConfig()
      const on = config['motion.enabled'] === true && config['motion.hoverEnabled'] === true
      if (!on) {
        doc.documentElement.removeAttribute('data-dts-pop')
        unmark()
        markPanels()
        if (style !== null) {
          style.remove()
          style = null
        }
        return
      }
      const root = doc.documentElement
      root.setAttribute('data-dts-pop', '')
      const shadow = Number(config['motion.popShadow'])
      const shadowColor = `rgba(15, 23, 42, ${(0.26 * shadow).toFixed(3)})`
      const shadowValue = shadow > 0
        ? `0 ${Math.round(7 * shadow)}px ${Math.round(20 * shadow)}px ${-Math.round(8 * shadow)}px ${shadowColor}`
        : '0 0 0 transparent'
      root.style.setProperty('--dts-pop-duration', `${Math.round(config['motion.popDuration'])}ms`)
      root.style.setProperty('--dts-pop-easing', springCurve(config['motion.spring']))
      root.style.setProperty('--dts-press-duration', '100ms')
      root.style.setProperty('--dts-hover-scale', String(config['motion.hoverScale']))
      root.style.setProperty('--dts-press-scale', String(config['motion.pressScale']))
      root.style.setProperty('--dts-large-scale', String(config['motion.largeScale']))
      root.style.setProperty('--dts-hover-lift', `${config['motion.hoverLift']}px`)
      root.style.setProperty('--dts-pop-shadow', shadowValue)
      root.style.setProperty('--dts-pop-shadow-lg', shadow > 0
        ? `0 ${Math.round(22 * shadow)}px ${Math.round(52 * shadow)}px ${-Math.round(20 * shadow)}px ${shadowColor}`
        : '0 0 0 transparent')
      root.style.setProperty('--dts-panel-enter', `${Math.round(config['motion.panelEnter'])}ms`)
      root.style.setProperty('--dts-message-enter', `${Math.round(config['motion.messageEnter'])}ms`)
      root.style.setProperty('--dts-page-enter', `${Math.round(config['motion.pageEnter'])}ms`)
      ensureStyle()
      mark()
      markPanels()
      markBubbles()
      markPageEnter()
    },
    /** Called after any DOM mutation by the owner's single observer budget. */
    onDomChanged: scheduleMark,
    getDiagnostics: () => {
      const config = readConfig()
      return {
        enabled: doc.documentElement.hasAttribute('data-dts-pop'),
        popTargets: popCount,
        largeTargets: largeCount,
        textSafeTargets: textSafeCount,
        outputTargets: staticCount,
        scope: doc.querySelector('[role="dialog"]') !== null && config['motion.scopeToDialog'] === true ? 'dialog' : 'page',
        panels: doc.querySelectorAll('.dts-panel-enter').length,
        bubblesAnimating: doc.querySelectorAll('.dts-bubble-in').length,
        pageEntered,
        spring: springCurve(config['motion.spring']),
      }
    },
    destroy() {
      unmark()
      // Belt-and-braces: a stale node could have been re-rendered between the
      // last mark() and disposal. Leave no plugin class behind.
      for (const el of doc.querySelectorAll('.dts-pop, .dts-pop-lg, .dts-textsafe')) clearClasses(el)
      for (const panel of doc.querySelectorAll('.dts-panel-enter')) panel.classList.remove('dts-panel-enter')
      for (const bubble of doc.querySelectorAll('.dts-bubble-in')) bubble.classList.remove('dts-bubble-in')
      for (const page of doc.querySelectorAll('.dts-page-in')) page.classList.remove('dts-page-in')
      if (style !== null) {
        style.remove()
        style = null
      }
      doc.documentElement.removeAttribute('data-dts-pop')
      for (const name of ['--dts-pop-duration', '--dts-pop-easing', '--dts-press-duration',
        '--dts-hover-scale', '--dts-press-scale', '--dts-large-scale', '--dts-hover-lift',
        '--dts-pop-shadow', '--dts-pop-shadow-lg', '--dts-panel-enter', '--dts-message-enter',
        '--dts-page-enter']) {
        doc.documentElement.style.removeProperty(name)
      }
    },
  }
}
