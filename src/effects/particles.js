/**
 * Particle decoration (量子化 Q3 — 形态量子化).
 *
 * A cloud of discrete particles that converges into the DeepSeek whale mark
 * (or a ring / wave), scatters under the pointer, and re-forms exponentially.
 *
 * PROVENANCE (MIT)
 *   The morph model is ported from ycqaq233/dsh-unknown-theme lib/client.js
 *   (MIT, Copyright (c) 2026 ycqaq233), lines ~619-790:
 *     - shape sampling with Path2D + isPointInPath over a 0.55 px lattice;
 *     - exponential convergence (their LERP_ENTRY = 0.08, i.e. ~1.2 s to
 *       assemble) and the slower coefficient after a scatter;
 *     - pointer repulsion that only engages once the shape has settled;
 *     - the single-instance guard (`querySelectorAll('.ds-fish-canvas')`),
 *       which is why a hot reload cannot stack two particle clouds;
 *     - the whale outline itself, from their FISH_PATH constant.
 *   The autonomous-wanderer idea (a second disturbance source) comes from
 *   JohnnyTing/dsh-official-homepage-theme (MIT).
 *
 * LOCAL ADDITIONS (this project, MIT)
 *   - particle count, particle radius, assemble time, re-form time, repel
 *     radius, colour and shape are all parameters;
 *   - `ring` and `wave` shapes are new;
 *   - the animation is frame-budgeted and sleeps when settled;
 *   - the lattice is a fixed particle *pool* resampled on shape change, so a
 *     slider drag never allocates a new array mid-frame.
 */

import { quantizeStep } from './quantize.js'

/** Whale outline (official FishLogo geometry), 23.16 x 17.04 user units. */
export const FISH_PATH = "M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z"
export const FISH_W = 23.16
export const FISH_H = 17.04

const PARTICLE_FRAME_INTERVAL = 1000 / 30
const PARTICLE_MAX_PIXEL_RATIO = 2
const SAMPLE_STEP = 0.55
const MAX_VELOCITY = 24
const DAMP_HOLD = 0.86
const DAMP_BRAKE = 0.5
const SETTLE_EPSILON = 0.5

/** Sample the whale outline into normalised offsets (-0.5..0.5 box). */
function sampleWhale(count, random) {
  let path = null
  try {
    path = new Path2D(FISH_PATH)
  } catch {
    path = null
  }
  const probe = document.createElement('canvas').getContext('2d')
  if (path === null || probe === null) return sampleRing(count, random)
  const found = []
  for (let y = 0; y < FISH_H; y += SAMPLE_STEP) {
    for (let x = 0; x < FISH_W; x += SAMPLE_STEP) {
      if (!probe.isPointInPath(path, x, y)) continue
      found.push([(x - FISH_W / 2) / FISH_W, (y - FISH_H / 2) / FISH_W])
    }
  }
  return resample(found, count, random)
}

function sampleRing(count, random) {
  const out = []
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2
    const wobble = 1 + (random() - 0.5) * 0.06
    out.push([Math.cos(angle) * 0.42 * wobble, Math.sin(angle) * 0.42 * wobble])
  }
  return out
}

function sampleWave(count, random) {
  const out = []
  for (let i = 0; i < count; i += 1) {
    const t = i / count
    const x = (t - 0.5) * 0.9
    const envelope = Math.sin(t * Math.PI)
    out.push([x, Math.sin(t * Math.PI * 4) * 0.12 * envelope + (random() - 0.5) * 0.01])
  }
  return out
}

/** Pick `count` offsets out of a sampled point set, preserving its outline. */
function resample(points, count, random) {
  if (points.length === 0) return sampleRing(count, random)
  const out = new Array(count)
  for (let i = 0; i < count; i += 1) {
    const source = points[Math.floor((i / count) * points.length) % points.length]
    out[i] = [source[0] + (random() - 0.5) * 0.002, source[1] + (random() - 0.5) * 0.002]
  }
  return out
}

function sampleShape(shape, count, random) {
  if (shape === 'ring') return sampleRing(count, random)
  if (shape === 'wave') return sampleWave(count, random)
  return sampleWhale(count, random)
}

/**
 * Create the particle layer.
 *
 * @param options.canvas - the layer's canvas (absolutely positioned, in the
 *   conversation scroll body, so the mark sits with the content).
 * @param options.readConfig - current parameter snapshot.
 * @param options.sources - interaction-source registry.
 * @param options.reducedMotion - draw one settled frame and stop.
 */
export function createParticleLayer(options) {
  const { canvas, readConfig, sources, reducedMotion } = options
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
  let offsets = []
  let enabled = false
  let frame = 0
  let width = 0
  let height = 0
  let pixelRatio = 1
  let settled = false
  let entered = false
  let dirty = true
  let renderedFrames = 0
  let lastFrameTime = 0
  let lastRepelFrame = -99
  let lastTickAt = 0
  let sampleKey = ''
  /** 0.5 = centred watermark; 0.34 = the original in-content position. */
  let centerFactor = 0.34
  let watermark = false
  /**
   * Idle breathing for the watermark: a slow, small scale + opacity cycle so
   * the mark reads as alive without pulling attention. Applied at draw time as
   * a canvas transform, so the particle simulation itself is never disturbed.
   */
  let breathPhase = 0
  let breathScale = 1
  let breathAlpha = 1

  const random = Math.random

  /**
   * Horizontal anchor for the watermark, evaluated live so collapsing the
   * sidebar moves the mark with the content column instead of stranding it.
   */
  function anchorX() {
    if (!watermark) return width / 2
    const config = readConfig()
    let x = width / 2
    if (config['quantum.q3WatermarkAnchor'] === 'content') {
      const column = document.querySelector('[class*="_sidebarCol"]')
      const left = column === null ? 0 : Math.max(0, column.getBoundingClientRect().right)
      x = left + (width - left) / 2
    }
    return x + (Number(config['quantum.q3WatermarkOffsetX']) || 0)
  }

  /** Vertical anchor; the base is the watermark/content centre factor. */
  function anchorY() {
    const config = readConfig()
    const base = height * centerFactor
    return watermark ? base + (Number(config['quantum.q3WatermarkOffsetY']) || 0) : base
  }

  function q4(value) {
    const config = readConfig()
    if (!config['quantum.q4Enabled'] || config['quantum.q4Target'] !== 'ambient') return value
    return quantizeStep(value, config['quantum.q4Steps'])
  }

  function layout() {
    const config = readConfig()
    // 'background' turns the cloud into a full-screen watermark behind the UI
    // (the whale "blended into the background"); 'content' keeps the original
    // behaviour of floating it inside the conversation area.
    watermark = config['quantum.q3Placement'] === 'background'
    centerFactor = watermark ? 0.5 : 0.34
    const wantedClass = watermark ? 'dts-logo-canvas' : 'dts-particle-canvas'
    if (canvas.className !== wantedClass) canvas.className = wantedClass

    const nextWidth = watermark
      ? Math.max(1, window.innerWidth)
      : Math.max(320, canvas.clientWidth || window.innerWidth)
    const nextHeight = watermark
      ? Math.max(1, window.innerHeight)
      : Math.max(240, canvas.clientHeight || 400)
    const nextRatio = Math.min(window.devicePixelRatio || 1, PARTICLE_MAX_PIXEL_RATIO)
    const count = Math.round(config['quantum.q3Count'])
    const key = `${config['quantum.q3Shape']}|${count}|${watermark ? 'bg' : 'content'}|${config['quantum.q3WatermarkAnchor']}`
    const sizeChanged = nextWidth !== width || nextHeight !== height || nextRatio !== pixelRatio
    if (sizeChanged) {
      width = nextWidth
      height = nextHeight
      pixelRatio = nextRatio
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    }
    if (!sizeChanged && key === sampleKey && particles.length === count) return false
    sampleKey = key
    offsets = sampleShape(config['quantum.q3Shape'], count, random)
    const scale = watermark
      ? Math.min(width, height) * config['quantum.q3WatermarkScale']
      : Math.min(width * 0.62, 420)
    const centerX = anchorX()
    const centerY = anchorY()
    particles = offsets.map(([ox, oy]) => {
      const tx = centerX + ox * scale
      const ty = centerY + oy * scale
      return {
        rx: tx - centerX,
        ry: ty - centerY,
        x: tx + (random() - 0.5) * 380,
        y: ty + (random() - 0.5) * 380,
        vx: 0,
        vy: 0,
      }
    })
    entered = false
    settled = false
    dirty = true
    return true
  }

  function draw() {
    const config = readConfig()
    context.clearRect(0, 0, width, height)
    // The watermark gets its own colour: the content placement's default white
    // would be invisible on the shipped blue-white background.
    context.fillStyle = watermark
      ? config['quantum.q3WatermarkColor']
      : config['quantum.q3Color']
    const radius = watermark
      ? config['quantum.q3Size'] * 1.25
      : config['quantum.q3Size']
    const baseAlpha = watermark
      ? config['quantum.q3WatermarkOpacity']
      : q4(config['appearance.opacity'])

    context.save()
    if (watermark && breathScale !== 1) {
      // Breathe around the watermark's own centre so the cloud grows in place.
      const cx = anchorX()
      const cy = anchorY()
      context.translate(cx, cy)
      context.scale(breathScale, breathScale)
      context.translate(-cx, -cy)
    }
    context.globalAlpha = Math.min(1, Math.max(0, baseAlpha * breathAlpha))
    for (const particle of particles) {
      context.beginPath()
      context.arc(particle.x, particle.y, radius, 0, Math.PI * 2)
      context.fill()
    }
    context.restore()
    context.globalAlpha = 1
  }

  function step(dt) {
    const config = readConfig()
    const centerX = anchorX()
    const centerY = anchorY()
    const list = sources.getSources()
    const pointer = list[0]
    const repelRadius = config['quantum.q3Repel']
    const assembleFrames = Math.max(1, (config['quantum.q3Assemble'] / 1000) * 60)
    const reformFrames = Math.max(1, config['quantum.q3Scatter'] * 60)
    // Exponential convergence coefficient: distance * k per frame. The ported
    // original used 0.08 for entry (~1.2 s at 60 fps) — here the assemble time
    // parameter produces the equivalent coefficient.
    const lerpEntry = 1 - Math.pow(1 - 0.08, 72 / assembleFrames)
    const lerpSlow = 1 / reformFrames
    const lerp = entered ? lerpSlow : lerpEntry

    const pointerX = pointer !== undefined && pointer.active ? pointer.x * window.innerWidth : -9999
    const pointerY = pointer !== undefined && pointer.active ? pointer.y * window.innerHeight : -9999

    let anyMoving = false
    for (const particle of particles) {
      const tx = centerX + particle.rx
      const ty = centerY + particle.ry
      const dx = particle.x - pointerX
      const dy = particle.y - pointerY
      const distanceSquared = dx * dx + dy * dy
      if (entered && repelRadius > 0 && distanceSquared < repelRadius * repelRadius && distanceSquared > 0.01) {
        const distance = Math.sqrt(distanceSquared)
        const force = (1 - distance / repelRadius) ** 2 * 30
        particle.vx += (dx / distance) * force
        particle.vy += (dy / distance) * force
        lastRepelFrame = renderedFrames
        anyMoving = true
      }
      const speed = Math.hypot(particle.vx, particle.vy)
      if (speed > MAX_VELOCITY) {
        particle.vx *= MAX_VELOCITY / speed
        particle.vy *= MAX_VELOCITY / speed
      }
      const damp = renderedFrames - lastRepelFrame > 3 ? DAMP_BRAKE : DAMP_HOLD
      particle.vx *= damp
      particle.vy *= damp
      particle.x += particle.vx
      particle.y += particle.vy
      particle.x += (tx - particle.x) * lerp
      particle.y += (ty - particle.y) * lerp
      if (Math.abs(particle.x - tx) > SETTLE_EPSILON
        || Math.abs(particle.y - ty) > SETTLE_EPSILON
        || Math.abs(particle.vx) > 0.05
        || Math.abs(particle.vy) > 0.05) anyMoving = true
    }

    // Idle breathing keeps the loop alive on purpose (spec: "静止即停" applies
    // to the settled content placement; the watermark is an ambient animation
    // and the user asked for it). Amplitude stays tiny so it never draws the
    // eye, and it is fully off at amplitude 0 or under reduced motion.
    const breath = config['quantum.q3WatermarkBreath']
    const period = Math.max(0.5, config['quantum.q3WatermarkBreathPeriod'])
    if (watermark && !reducedMotion && breath > 0) {
      breathPhase = (breathPhase + dt / 1000 / period) % 1
      const wave = Math.sin(breathPhase * Math.PI * 2)
      breathScale = 1 + wave * breath * 0.035
      breathAlpha = 1 + wave * breath * 0.28
      anyMoving = true
    } else {
      breathScale = 1
      breathAlpha = 1
    }
    void dt
    return anyMoving
  }

  function schedule() {
    if (enabled && frame === 0 && !reducedMotion) frame = window.requestAnimationFrame(tick)
  }

  function tick(time) {
    frame = 0
    if (!enabled) return
    if (document.visibilityState !== 'visible') {
      frame = window.requestAnimationFrame(tick)
      return
    }
    if (time - lastFrameTime < PARTICLE_FRAME_INTERVAL) {
      frame = window.requestAnimationFrame(tick)
      return
    }
    lastFrameTime = time - ((time - lastFrameTime) % PARTICLE_FRAME_INTERVAL)
    const dt = lastTickAt === 0 ? PARTICLE_FRAME_INTERVAL : Math.min(64, time - lastTickAt)
    lastTickAt = time
    sources.tick(dt)
    const anyMoving = step(dt)
    if (!anyMoving && settled && !dirty) {
      // Fully at rest: stop the loop entirely; any pointer move or parameter
      // change re-schedules it through refresh()/sources.subscribe.
      return
    }
    draw()
    renderedFrames += 1
    settled = !anyMoving
    if (settled) entered = true
    dirty = false
    frame = window.requestAnimationFrame(tick)
  }

  function renderOnce() {
    layout()
    draw()
    renderedFrames += 1
    // Settle the cloud into shape for the static (reduced-motion) view.
    for (let i = 0; i < 90; i += 1) step(PARTICLE_FRAME_INTERVAL)
    draw()
    settled = true
    entered = true
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
      settled = false
      dirty = true
      schedule()
    },
    refresh() {
      if (!enabled) return
      const resampled = layout()
      if (reducedMotion) {
        renderOnce()
        return
      }
      if (resampled) entered = false
      settled = false
      dirty = true
      schedule()
    },
    getDiagnostics: () => ({
      enabled,
      renderer: 'canvas2d',
      particles: particles.length,
      renderedFrames,
      running: frame !== 0,
      settled,
      size: `${width}x${height}`,
    }),
    destroy() {
      window.cancelAnimationFrame(frame)
      frame = 0
      enabled = false
      particles = []
      offsets = []
      canvas.remove()
    },
  }
}
