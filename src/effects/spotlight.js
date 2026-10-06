/**
 * Cursor spotlight (标题聚光灯) — mix-blend-mode: difference ring.
 *
 * PROVENANCE (MIT)
 *   Ported from ycqaq233/dsh-unknown-theme lib/client.js (MIT, Copyright (c)
 *   2026 ycqaq233): the `.ds-ring` rule (fixed, difference blend, 64 px,
 *   opacity transition), the pointer-driven `translate()`, and — the part that
 *   matters — the trigger test, which asks whether the pointer's target sits
 *   inside headline text or an icon, so the ring stays off over empty
 *   container space.
 *
 * LOCAL ADDITIONS (this project, MIT)
 *   - diameter and colour are parameters;
 *   - the trigger selector is a parameter (the ported original hard-coded
 *     `[class$="_headlineText"], [class$="_fishHitbox"]`, and neither of those
 *     class names exists on host 0.2.0-rc.2 — see REUSE.md §0.2);
 *   - the ring is created lazily on the first qualifying pointer move and
 *     removed on disable, so a disabled spotlight costs nothing.
 */

export function createSpotlightLayer(options) {
  const readConfig = options.readConfig
  const reducedMotion = options.reducedMotion === true
  const document_ = options.document ?? document

  let ring = null
  let enabled = false
  let active = false

  function ensureRing() {
    if (ring !== null) return ring
    ring = document_.createElement('div')
    ring.className = 'dts-spotlight-ring'
    ring.setAttribute('aria-hidden', 'true')
    ring.dataset.on = '0'
    document_.body.appendChild(ring)
    return ring
  }

  function removeRing() {
    if (ring === null) return
    ring.remove()
    ring = null
    active = false
  }

  function isTrigger(target) {
    if (!(target instanceof Element)) return false
    const selector = readConfig()['spotlight.selector']
    if (typeof selector !== 'string' || selector.trim() === '') return false
    try {
      // Only the element under the pointer (or its ancestors) counts: the ring
      // must not light up when the pointer is over empty container space.
      return target.closest(selector) !== null
    } catch {
      return false
    }
  }

  function onPointerMove(event) {
    if (!enabled) return
    const shouldShow = isTrigger(event.target)
    if (!shouldShow && !active) return
    const node = ensureRing()
    if (shouldShow) {
      node.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`
      if (!active) {
        node.dataset.on = '1'
        active = true
      }
    } else {
      node.dataset.on = '0'
      active = false
    }
  }

  function onPointerLeave() {
    if (ring === null) return
    ring.dataset.on = '0'
    active = false
  }

  document_.addEventListener('pointermove', onPointerMove, { passive: true })
  document_.addEventListener('pointerleave', onPointerLeave, { passive: true })

  return {
    setEnabled(value) {
      enabled = value === true
      document_.documentElement.toggleAttribute('data-dts-spotlight', enabled)
      if (!enabled) removeRing()
    },
    refresh() {
      if (ring === null) return
      const config = readConfig()
      ring.style.width = `${config['spotlight.size']}px`
      ring.style.height = `${config['spotlight.size']}px`
      ring.style.margin = `${-config['spotlight.size'] / 2}px 0 0 ${-config['spotlight.size'] / 2}px`
      ring.style.background = config['spotlight.color']
      ring.style.transition = reducedMotion
        ? 'none'
        : `opacity var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2, 0, 0, 1))`
    },
    getDiagnostics: () => ({ enabled, mounted: ring !== null, active, reducedMotion }),
    destroy() {
      document_.removeEventListener('pointermove', onPointerMove)
      document_.removeEventListener('pointerleave', onPointerLeave)
      removeRing()
      document_.documentElement.removeAttribute('data-dts-spotlight')
    },
  }
}
