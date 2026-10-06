/**
 * Interaction sources — who disturbs the fluid, the grid and the particle field.
 *
 * Source 0 is the pointer; sources 1..2 are two autonomous wanderers so the
 * scene keeps breathing when nobody is moving the mouse.
 *
 * PROVENANCE (MIT)
 *   The source record shape (x/y normalised 0..1, vx/vy, active, gridRadius,
 *   gridStrength, fluidRadius, fluidStrength) is the contract that
 *   JohnnyTing/dsh-official-homepage-theme pointer-field.js and elastic-grid.js
 *   consume; the autonomous-source constants come from its fish-profile.js
 *   (boundaryPadding 12, boundaryLookAhead 72, boundaryWeight 2.8,
 *   maxTurnRate 1.9, wander 1.4..3.4 s, speeds 34/42) — Copyright (c) 2026
 *   JohnnyTing.
 *   The wanderer itself is a compact rewrite here, because Q3 of this project
 *   needs a point-cloud morph (ported from ycqaq233/dsh-unknown-theme) rather
 *   than JohnnyTing's vector-drawn fish; see REUSE.md §0.4.3.
 */

/** Normalised pointer radius for the grid / fluid, per source kind. */
const POINTER_GRID_RADIUS_RATIO = 0.09

const WANDER_PROFILE = {
  boundaryPadding: 12,
  boundaryLookAhead: 72,
  boundaryWeight: 2.8,
  maxTurnRate: 1.9,
  wanderMinSeconds: 1.4,
  wanderMaxSeconds: 3.4,
  fluidRadius: 0.065,
  fluidStrength: 0.55,
  gridRadius: 90,
  gridStrength: 1.4,
}

const WANDERERS = [
  { id: 'wander-a', speed: 34, x: 0.28, y: 0.34, heading: 0.2 },
  { id: 'wander-b', speed: 42, x: 0.72, y: 0.62, heading: Math.PI + 0.25 },
]

function clampSource01(value) {
  return Math.min(1, Math.max(0, value))
}

/**
 * @param options.reducedMotion - when true, wanderers hold still and only the
 *   pointer disturbs anything (spec: reduced motion keeps static effects only).
 * @param options.onPointer - called with the normalised pointer on every move;
 *   used to wake sleeping renderers without adding a second listener.
 */
export function createInteractionSources(options = {}) {
  const reducedMotion = options.reducedMotion === true
  const listeners = new Set()
  let pointerRadiusPx = 140
  let gridRadiusPx = 140
  let visible = true

  const pointer = {
    id: 'pointer',
    x: 0.5, y: 0.5, vx: 0, vy: 0,
    active: false,
    gridRadius: gridRadiusPx,
    gridStrength: 2.8,
    fluidRadius: POINTER_GRID_RADIUS_RATIO / 140 * pointerRadiusPx,
    fluidStrength: 1.8,
  }

  const wanderers = WANDERERS.map((spec) => ({
    id: spec.id,
    x: spec.x, y: spec.y, vx: 0, vy: 0,
    active: !reducedMotion,
    heading: spec.heading,
    speed: spec.speed,
    wanderTimer: 0,
    gridRadius: WANDER_PROFILE.gridRadius,
    gridStrength: WANDER_PROFILE.gridStrength,
    fluidRadius: WANDER_PROFILE.fluidRadius,
    fluidStrength: WANDER_PROFILE.fluidStrength,
  }))

  let sources = [pointer, ...wanderers]
  let lastPointerAt = 0
  let lastTick = 0

  const notify = () => {
    for (const fn of [...listeners]) {
      try {
        fn()
      } catch { /* a listener must not break the loop */ }
    }
  }

  const onPointerMove = (event) => {
    const width = Math.max(1, window.innerWidth)
    const height = Math.max(1, window.innerHeight)
    const x = clampSource01(event.clientX / width)
    const y = clampSource01(event.clientY / height)
    const now = performance.now()
    const dt = lastPointerAt === 0 ? 16 : Math.max(1, now - lastPointerAt)
    lastPointerAt = now
    pointer.vx = (x - pointer.x) / (dt / 16.667)
    pointer.vy = (y - pointer.y) / (dt / 16.667)
    pointer.x = x
    pointer.y = y
    pointer.active = true
    notify()
    options.onPointer?.(x, y)
  }

  const onPointerLeave = () => {
    pointer.active = false
    pointer.vx = 0
    pointer.vy = 0
    notify()
  }

  const onVisibility = () => {
    visible = document.visibilityState === 'visible'
    notify()
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerleave', onPointerLeave, { passive: true })
  document.addEventListener('visibilitychange', onVisibility, { passive: true })

  return {
    getSources: () => sources,
    getActiveCount: () => sources.filter((s) => s.active).length,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    /** Radius in px for the grid/fluid pointer disturbance. */
    setPointerRadius(px) {
      pointerRadiusPx = Math.max(0, px)
      pointer.gridRadius = pointerRadiusPx
      pointer.fluidRadius = (POINTER_GRID_RADIUS_RATIO / 140) * pointerRadiusPx
      notify()
    },
    /** Radius in px for the grid pointer disturbance (independent parameter). */
    setGridRadius(px) {
      gridRadiusPx = Math.max(0, px)
      pointer.gridRadius = gridRadiusPx
      notify()
    },
    setWanderersEnabled(enabled) {
      const active = enabled === true && !reducedMotion
      for (const wanderer of wanderers) wanderer.active = active
      notify()
    },
    /**
     * Advance the wanderers. Called from the grid/particle render loops so a
     * single animation frame drives every consumer.
     * @param dt - milliseconds since the previous tick.
     */
    tick(dt) {
      if (reducedMotion || !visible) return
      const step = Math.min(64, Math.max(1, dt)) / 1000
      lastTick += dt
      for (const wanderer of wanderers) {
        if (!wanderer.active) continue
        wanderer.wanderTimer -= step
        if (wanderer.wanderTimer <= 0) {
          wanderer.wanderTimer = WANDER_PROFILE.wanderMinSeconds
            + Math.random() * (WANDER_PROFILE.wanderMaxSeconds - WANDER_PROFILE.wanderMinSeconds)
          wanderer.heading += (Math.random() - 0.5) * WANDER_PROFILE.maxTurnRate
        }
        const px = wanderer.x * window.innerWidth
        const py = wanderer.y * window.innerHeight
        const margin = WANDER_PROFILE.boundaryPadding
        if (px < margin + WANDER_PROFILE.boundaryLookAhead) wanderer.heading += 0.06 * WANDER_PROFILE.boundaryWeight
        if (px > window.innerWidth - margin - WANDER_PROFILE.boundaryLookAhead) wanderer.heading -= 0.06 * WANDER_PROFILE.boundaryWeight
        if (py < margin + WANDER_PROFILE.boundaryLookAhead) wanderer.heading += 0.06 * WANDER_PROFILE.boundaryWeight
        if (py > window.innerHeight - margin - WANDER_PROFILE.boundaryLookAhead) wanderer.heading -= 0.06 * WANDER_PROFILE.boundaryWeight

        const dx = Math.cos(wanderer.heading) * wanderer.speed * step
        const dy = Math.sin(wanderer.heading) * wanderer.speed * step
        wanderer.vx = dx / Math.max(0.001, step)
        wanderer.vy = dy / Math.max(0.001, step)
        wanderer.x = clampSource01(wanderer.x + dx / Math.max(1, window.innerWidth))
        wanderer.y = clampSource01(wanderer.y + dy / Math.max(1, window.innerHeight))
      }
    },
    destroy() {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      listeners.clear()
      sources = []
    },
  }
}
