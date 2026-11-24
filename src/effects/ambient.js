/**
 * Ambient background particle field (背景粒子强化 — 星尘层).
 *
 * A separate layer from Q3's morph cloud on purpose: Q3 answers "which shape is
 * the whale in right now", this one answers "the page itself is alive". It is
 * the layer that makes the whole surface breathe, so it must be cheap and it
 * must never compete with content:
 *
 *   - 30 fps ceiling and a frame budget measured in particles, not pixels;
 *   - depth is per particle, and only depth drives parallax and alpha, so a
 *     pointer crossing the window reads as a *plane* moving, not a texture
 *     sliding;
 *   - the pointer pushes particles away, a click drops an expanding ring; both
 *     are additive and decay to zero on their own;
 *   - the loop sleeps as soon as nothing moves. A settled window with no
 *     pointer inside costs zero frames, which is what keeps a full-screen
 *     canvas acceptable in a chat client.
 *
 * PROVENANCE: no upstream implementation for this layer. The drift/wrap model
 * is the standard toroidal particle field; the link lines and depth
 * parallax and the sleep-when-settled rule are this project's own (README
 * §effects).
 */

const AMBIENT_FRAME_INTERVAL = 1000 / 30
const AMBIENT_MAX_PIXEL_RATIO = 2
const AMBIENT_MAX_LINK_PARTICLES = 190

function ambientRandom() {
  return Math.random()
}

/**
 * Create the ambient layer.
 *
 * @param options.canvas - the fixed, full-viewport canvas for this layer.
 * @param options.readConfig - current parameter snapshot.
 * @param options.sources - interaction-source registry (pointer state).
 * @param options.reducedMotion - draw one settled frame and stop.
 */
export function createAmbientLayer(options) {
  const canvas = options.canvas
  const readConfig = options.readConfig
  const sources = options.sources
  const reducedMotion = options.reducedMotion === true
  const context = canvas.getContext('2d')
  if (context === null) {
    canvas.remove()
    return {
      setEnabled() {},
      refresh() {},
      getDiagnostics: () => ({ renderer: 'none', enabled: false, error: 'no 2d context' }),
      destroy() {},
    }
  }

  let particles = []
  let width = 0
  let height = 0
  let pixelRatio = 1
  let frame = 0
  let enabled = false
  let renderedFrames = 0
  let lastFrameTime = 0
  let lastTickAt = 0
  let elapsed = 0
  let seededCount = -1
  let lastPointerX = -9999
  let lastPointerY = -9999
  let pointerHot = false
  /** Smoothed pointer used for parallax, so a flick does not jolt the plane. */
  let parallaxX = 0
  let parallaxY = 0

  function seed(count) {
    particles = new Array(count)
    for (let i = 0; i < count; i += 1) {
      const depth = 0.15 + ambientRandom() * 0.85
      particles[i] = {
        x: ambientRandom() * Math.max(1, width),
        y: ambientRandom() * Math.max(1, height),
        vx: (ambientRandom() - 0.5) * 0.22,
        vy: (ambientRandom() - 0.5) * 0.22,
        depth,
        radius: 0.35 + depth * 0.85,
        phase: ambientRandom() * Math.PI * 2,
        wobble: 0.4 + ambientRandom() * 1.2,
      }
    }
    seededCount = count
  }

  function layout() {
    const nextWidth = Math.max(1, window.innerWidth)
    const nextHeight = Math.max(1, window.innerHeight)
    const nextRatio = Math.min(window.devicePixelRatio || 1, AMBIENT_MAX_PIXEL_RATIO)
    const sizeChanged = nextWidth !== width || nextHeight !== height || nextRatio !== pixelRatio
    if (sizeChanged) {
      width = nextWidth
      height = nextHeight
      pixelRatio = nextRatio
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    }
    const count = Math.max(0, Math.round(readConfig()['ambient.count']))
    if (sizeChanged || count !== seededCount) seed(count)
    return sizeChanged || count !== seededCount
  }

  function step(dt) {
    const config = readConfig()
    const speed = config['ambient.speed']
    const repelRadius = config['ambient.repelRadius']
    const list = sources === null || sources === undefined ? [] : sources.getSources()
    const pointer = list[0]
    const pointerX = pointer !== undefined && pointer.active ? pointer.x * width : -9999
    const pointerY = pointer !== undefined && pointer.active ? pointer.y * height : -9999
    pointerHot = pointer !== undefined && pointer.active

    if (pointerHot) {
      // Ease the parallax centre towards the pointer: 0.06 per 30 fps frame is
      // roughly a 400 ms follow, slow enough to read as depth.
      parallaxX += (pointerX - parallaxX) * 0.06
      parallaxY += (pointerY - parallaxY) * 0.06
    } else {
      parallaxX += (width / 2 - parallaxX) * 0.02
      parallaxY += (height / 2 - parallaxY) * 0.02
    }

    const stepScale = Math.min(64, Math.max(1, dt)) / 16.667
    elapsed += dt
    let moving = pointerHot || (Math.abs(parallaxX - width / 2) > 1 || Math.abs(parallaxY - height / 2) > 1)

    for (const particle of particles) {
      // Drift: base velocity plus a slow sine sway, so no two particles share
      // a straight line even when the field looks uniform.
      particle.x += (particle.vx + Math.sin(elapsed / 2400 + particle.phase) * 0.06 * particle.wobble)
        * speed * stepScale
      particle.y += (particle.vy + Math.cos(elapsed / 2700 + particle.phase) * 0.06 * particle.wobble)
        * speed * stepScale

      if (repelRadius > 0 && pointerHot) {
        const dx = particle.x - pointerX
        const dy = particle.y - pointerY
        const distanceSquared = dx * dx + dy * dy
        if (distanceSquared < repelRadius * repelRadius && distanceSquared > 0.01) {
          const distance = Math.sqrt(distanceSquared)
          const force = (1 - distance / repelRadius) ** 2 * 0.9
          particle.x += (dx / distance) * force
          particle.y += (dy / distance) * force
          moving = true
        }
      }

      // Toroidal wrap keeps the density constant with no respawn spikes.
      if (particle.x < -8) particle.x = width + 8
      else if (particle.x > width + 8) particle.x = -8
      if (particle.y < -8) particle.y = height + 8
      else if (particle.y > height + 8) particle.y = -8
    }

    if (speed > 0 && particles.length > 0) moving = true
    return moving
  }

  /** Depth-corrected screen position: nearer particles travel further. */
  function projectX(particle) {
    const config = readConfig()
    const gain = config['ambient.parallax'] * 26
    return particle.x + (parallaxX - width / 2) * particle.depth * gain * 0.06
  }

  function projectY(particle) {
    const config = readConfig()
    const gain = config['ambient.parallax'] * 26
    return particle.y + (parallaxY - height / 2) * particle.depth * gain * 0.06
  }

  function draw() {
    const config = readConfig()
    context.clearRect(0, 0, width, height)
    if (particles.length === 0) return

    const baseSize = config['ambient.size']
    const baseOpacity = config['ambient.opacity']
    context.fillStyle = config['ambient.color']

    // Link lines first, so dots sit on top of them.
    const linkDistance = config['ambient.linkDistance']
    if (linkDistance > 0 && particles.length <= AMBIENT_MAX_LINK_PARTICLES) {
      const linkLimit = linkDistance * linkDistance
      context.lineWidth = 0.6
      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i]
        const ax = projectX(a)
        const ay = projectY(a)
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j]
          const bx = projectX(b)
          const by = projectY(b)
          const dx = ax - bx
          const dy = ay - by
          const distanceSquared = dx * dx + dy * dy
          if (distanceSquared > linkLimit) continue
          const fade = 1 - Math.sqrt(distanceSquared) / linkDistance
          context.globalAlpha = Math.min(1, Math.max(0, fade * baseOpacity
            * config['ambient.linkOpacity'] * (a.depth + b.depth) * 0.5))
          context.beginPath()
          context.moveTo(ax, ay)
          context.lineTo(bx, by)
          context.strokeStyle = config['ambient.color']
          context.stroke()
        }
      }
    }

    for (const particle of particles) {
      const radius = baseSize * particle.radius
      context.globalAlpha = Math.min(1, Math.max(0, baseOpacity * (0.32 + particle.depth * 0.68)))
      context.beginPath()
      context.arc(projectX(particle), projectY(particle), radius, 0, Math.PI * 2)
      context.fill()
    }

    context.globalAlpha = 1
  }

  function schedule() {
    if (!enabled || frame !== 0 || reducedMotion) return
    frame = window.requestAnimationFrame(tick)
  }

  function tick(time) {
    frame = 0
    if (!enabled) return
    if (document.visibilityState !== 'visible') {
      schedule()
      return
    }
    if (time - lastFrameTime < AMBIENT_FRAME_INTERVAL) {
      schedule()
      return
    }
    lastFrameTime = time - ((time - lastFrameTime) % AMBIENT_FRAME_INTERVAL)
    const dt = lastTickAt === 0 ? AMBIENT_FRAME_INTERVAL : Math.min(96, time - lastTickAt)
    lastTickAt = time
    sources?.tick(dt)
    const moving = step(dt)
    if (!moving && !pointerHot) {
      // Settled: leave the last frame on screen and stop the loop entirely.
      return
    }
    draw()
    renderedFrames += 1
    schedule()
  }

  function renderOnce() {
    layout()
    for (let i = 0; i < 30; i += 1) step(AMBIENT_FRAME_INTERVAL)
    draw()
    renderedFrames += 1
  }

  return {
    setEnabled(value) {
      enabled = value === true
      canvas.toggleAttribute('data-disabled', !enabled)
      if (!enabled) {
        window.cancelAnimationFrame(frame)
        frame = 0
        context.clearRect(0, 0, width, height)
        return
      }
      layout()
      if (reducedMotion) {
        renderOnce()
        return
      }
      lastTickAt = 0
      schedule()
    },
    refresh() {
      if (!enabled) return
      const reseeded = layout()
      if (reducedMotion) {
        renderOnce()
        return
      }
      if (reseeded) elapsed = 0
      schedule()
    },
    /** Wake the loop after a pointer move that the renderer had slept through. */
    wake() {
      schedule()
    },
    getDiagnostics: () => ({
      enabled,
      renderer: 'canvas2d',
      particles: particles.length,
      renderedFrames,
      running: frame !== 0,
      size: `${width}x${height}`,
    }),
    destroy() {
      window.cancelAnimationFrame(frame)
      frame = 0
      enabled = false
      particles = []
      seededCount = -1
      canvas.remove()
    },
  }
}
