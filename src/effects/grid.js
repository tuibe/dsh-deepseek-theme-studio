/**
 * Elastic dot grid (量子化 Q1 — 空间量子化).
 *
 * PROVENANCE (MIT)
 *   `createElasticGridNodes`, `advanceElasticGrid` and the canvas renderer are
 *   ported from JohnnyTing/dsh-official-homepage-theme src/client/elastic-grid.js
 *   and elastic-grid-profile.js (MIT, Copyright (c) 2026 JohnnyTing) — itself a
 *   reconstruction of the DeepSeek home page HeroGrid. The shipped defaults
 *   (spacing 90, pointer radius 140, spring 0.05, damping 0.85,
 *   maxDisplacement 38, activePointRadius 2.2) are that file's measured
 *   constants, and they match the numbers this project was specified with.
 *
 * LOCAL ADDITIONS (this project, MIT)
 *   - every constant now comes from the parameter store;
 *   - Q4: the magnifier response can be snapped to N discrete steps;
 *   - the layer is CSS-masked to fade out towards the bottom (官网同款),
 *     the colour is a parameter, and `minWidth` (768) plus the reduced-motion
 *     flag gate the whole effect.
 */

import { quantizeStep } from './quantize.js'

const GRID_FRAME_INTERVAL = 1000 / 30
const GRID_MAX_PIXEL_RATIO = 2
const RESIZE_DELAY = 150
const GRID_MIN_WIDTH = 768
const SLEEP_VELOCITY = 0.01
const SLEEP_MOVEMENT = 0.01
const SLEEP_FRAMES = 4
const MAX_DISPLACEMENT = 38

function clampGrid01(value) {
  return Math.min(1, Math.max(0, value))
}

/** Build the lattice for one viewport size. */
export function createElasticGridNodes(width, height, spacing) {
  const columns = Math.max(2, Math.floor(width / spacing) + 1)
  const rows = Math.max(2, Math.floor(height / spacing) + 1)
  const offsetX = (width - (columns - 1) * spacing) / 2
  const offsetY = (height - (rows - 1) * spacing) / 2
  const nodes = new Array(columns * rows)
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = offsetX + column * spacing
      const y = offsetY + row * spacing
      nodes[row * columns + column] = { baseX: x, baseY: y, x, y, vx: 0, vy: 0 }
    }
  }
  return { columns, nodes, rows }
}

/**
 * Advance one frame of the spring/repulsion simulation.
 * @returns the largest displacement and velocity seen — the sleep detector.
 */
export function advanceElasticGrid(nodes, sources, width, height, state) {
  const { spring, damping } = state
  let maxMovement = 0
  let maxVelocity = 0
  for (const node of nodes) {
    let forceX = 0
    let forceY = 0
    for (const source of sources) {
      if (!source.active) continue
      const radius = source.gridRadius
      if (radius <= 0) continue
      const dx = node.x - source.x * width
      const dy = node.y - source.y * height
      const distance = Math.hypot(dx, dy)
      if (distance < radius) {
        const strength = source.gridStrength * (1 - distance / radius)
        if (distance > 0.001) {
          forceX += (dx / distance) * strength
          forceY += (dy / distance) * strength
        }
      }
    }
    node.vx = (node.vx + (node.baseX - node.x) * spring + forceX) * damping
    node.vy = (node.vy + (node.baseY - node.y) * spring + forceY) * damping
    const previousX = node.x
    const previousY = node.y
    node.x += node.vx
    node.y += node.vy

    const displacementX = node.x - node.baseX
    const displacementY = node.y - node.baseY
    const displacement = Math.hypot(displacementX, displacementY)
    if (displacement > MAX_DISPLACEMENT) {
      const scale = MAX_DISPLACEMENT / displacement
      node.x = node.baseX + displacementX * scale
      node.y = node.baseY + displacementY * scale
      node.vx *= 0.5
      node.vy *= 0.5
    }
    maxMovement = Math.max(maxMovement, Math.hypot(node.x - previousX, node.y - previousY))
    maxVelocity = Math.max(maxVelocity, Math.hypot(node.vx, node.vy))
  }
  return { maxMovement, maxVelocity }
}

/**
 * Create the grid layer.
 *
 * @param options.canvas - the layer's canvas element.
 * @param options.readConfig - current parameter snapshot.
 * @param options.sources - interaction-source registry.
 * @param options.reducedMotion - static-only when true.
 */
export function createGridLayer(options) {
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

  const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)')
  let grid = { columns: 0, nodes: [], rows: 0 }
  let width = 0
  let height = 0
  let pixelRatio = 1
  let enabled = false
  let pageVisible = document.visibilityState === 'visible'
  let frame = 0
  let resizeTimer = 0
  let lastFrameTime = 0
  let stableFrames = 0
  let renderedFrames = 0

  const canAnimate = () => enabled
    && pageVisible
    && !reducedMotion
    && width >= GRID_MIN_WIDTH
    && finePointer?.matches !== false

  /** Q4: snap the magnifier response to N steps when enabled. */
  function stepped(value) {
    const config = readConfig()
    if (!config['quantum.q4Enabled'] || config['quantum.q4Target'] !== 'pointer') return value
    return quantizeStep(value, config['quantum.q4Steps'])
  }

  function draw() {
    const config = readConfig()
    context.clearRect(0, 0, width, height)
    if (!enabled || width < GRID_MIN_WIDTH) return

    const rgb = config['quantum.q1Color']
    const lineOpacity = config['quantum.q1LineOpacity']
    const pointOpacity = config['quantum.q1PointOpacity']
    const activePointRadius = config['quantum.q1ActivePoint']
    const sourcesList = sources.getSources()

    context.save()
    context.lineWidth = 0.5
    context.strokeStyle = hexToRgba(rgb, lineOpacity)
    context.beginPath()
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.columns; column += 1) {
        const index = row * grid.columns + column
        const node = grid.nodes[index]
        if (column + 1 < grid.columns) {
          const right = grid.nodes[index + 1]
          context.moveTo(node.x, node.y)
          context.lineTo(right.x, right.y)
        }
        if (row + 1 < grid.rows) {
          const below = grid.nodes[index + grid.columns]
          context.moveTo(node.x, node.y)
          context.lineTo(below.x, below.y)
        }
      }
    }
    context.stroke()

    for (const node of grid.nodes) {
      let proximity = 0
      for (const source of sourcesList) {
        if (!source.active) continue
        const radius = source.gridRadius
        if (radius <= 0) continue
        proximity = Math.max(
          proximity,
          1 - clampGrid01(Math.hypot(node.x - source.x * width, node.y - source.y * height) / radius),
        )
      }
      const eased = stepped(proximity * proximity * (3 - 2 * proximity))
      const radius = 1 + (activePointRadius - 1) * eased
      const opacity = pointOpacity + (0.28 - pointOpacity) * eased
      context.fillStyle = hexToRgba(rgb, opacity)
      context.fillRect(node.x - radius, node.y - radius, radius * 2, radius * 2)
    }
    context.restore()
  }

  function rebuild() {
    const config = readConfig()
    const nextWidth = Math.max(1, window.innerWidth)
    const nextHeight = Math.max(1, window.innerHeight)
    const nextRatio = Math.min(window.devicePixelRatio || 1, GRID_MAX_PIXEL_RATIO)
    const spacing = config['quantum.q1Spacing']
    if (nextWidth === width && nextHeight === height && nextRatio === pixelRatio
      && grid.spacing === spacing) return false
    width = nextWidth
    height = nextHeight
    pixelRatio = nextRatio
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    grid = createElasticGridNodes(width, height, spacing)
    grid.spacing = spacing
    canvas.dataset.gridSize = `${grid.columns}x${grid.rows}`
    canvas.dataset.pixelRatio = String(pixelRatio)
    stableFrames = 0
    draw()
    return true
  }

  const state = () => {
    const config = readConfig()
    return { spring: config['quantum.q1Spring'], damping: config['quantum.q1Damping'] }
  }

  function schedule() {
    if (canAnimate() && frame === 0) frame = window.requestAnimationFrame(render)
  }

  function render(time) {
    frame = 0
    if (!canAnimate()) return
    if (time - lastFrameTime < GRID_FRAME_INTERVAL) {
      schedule()
      return
    }
    lastFrameTime = time - ((time - lastFrameTime) % GRID_FRAME_INTERVAL)
    const activity = advanceElasticGrid(grid.nodes, sources.getSources(), width, height, state())
    draw()
    renderedFrames += 1
    const isStill = activity.maxVelocity < SLEEP_VELOCITY && activity.maxMovement < SLEEP_MOVEMENT
    stableFrames = isStill ? stableFrames + 1 : 0
    if (stableFrames < SLEEP_FRAMES) schedule()
  }

  const onSourcesChanged = () => {
    stableFrames = 0
    schedule()
  }
  const onResize = () => {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      resizeTimer = 0
      if (rebuild()) schedule()
    }, RESIZE_DELAY)
  }
  const onVisibility = () => {
    pageVisible = document.visibilityState === 'visible'
    if (pageVisible) schedule()
  }

  const unsubscribe = sources.subscribe(onSourcesChanged)
  window.addEventListener('resize', onResize, { passive: true })
  document.addEventListener('visibilitychange', onVisibility, { passive: true })
  finePointer?.addEventListener?.('change', draw)
  rebuild()

  return {
    setEnabled(value) {
      enabled = value === true
      canvas.toggleAttribute('data-disabled', !enabled)
      if (enabled) {
        stableFrames = 0
        rebuild()
        draw()
        schedule()
      } else {
        window.cancelAnimationFrame(frame)
        frame = 0
        context.clearRect(0, 0, width, height)
      }
    },
    refresh() {
      if (!enabled) return
      rebuild()
      draw()
      schedule()
    },
    getDiagnostics: () => ({
      enabled,
      renderer: 'canvas2d',
      gridSize: canvas.dataset.gridSize || '',
      pixelRatio,
      renderedFrames,
      running: frame !== 0,
      reducedMotion,
    }),
    destroy() {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      finePointer?.removeEventListener?.('change', draw)
      unsubscribe()
      window.clearTimeout(resizeTimer)
      window.cancelAnimationFrame(frame)
      canvas.remove()
    },
  }
}

/** `#rrggbb` + alpha → `rgba(...)`, without allocating a canvas. */
export function hexToRgba(hex, alpha) {
  const value = String(hex || '#ffffff').replace('#', '')
  const normalized = value.length === 3
    ? value.split('').map((c) => c + c).join('')
    : value.padEnd(6, '0').slice(0, 6)
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`
}
