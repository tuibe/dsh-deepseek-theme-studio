/**
 * Fluid background (液化) — WebGL2 renderer + animation loop.
 *
 * PROVENANCE (MIT)
 *   Renderer structure, ping-pong flow targets, pointer smoothing, emitter
 *   upload and the 30 fps throttle are ported from
 *   JohnnyTing/dsh-official-homepage-theme src/client/pointer-field.js
 *   (MIT, Copyright (c) 2026 JohnnyTing). The shaders come from the same
 *   package (src/effects/fluid-shaders.js here).
 *
 * LOCAL ADDITIONS (this project, MIT)
 *   - every constant is read from the parameter store instead of a frozen
 *     profile object;
 *   - Q2 uniforms (u_levels / u_dither);
 *   - a static-gradient fallback when WebGL2 is unavailable, so the plugin
 *     degrades instead of showing a blank page;
 *   - document.hidden / reduced-motion pausing, and a `--dts-decoration-opacity`
 *     driven CSS opacity rather than baking opacity into the shader;
 *   - release of the GL context on dispose (WEBGL_lose_context), the teardown
 *     detail lifted from yushi-xxh/dsh-homepage-skin lib/client.js:924-945
 *     (MIT) — the ported original only deleted the programs.
 */

import {
  FLOW_FRAGMENT_SHADER, FLUID_FRAGMENT_SHADER, FLUID_VERTEX_SHADER,
  staticGradientCss,
} from './fluid-shaders.js'

/** Target frame interval — the spec's 30 fps ceiling for idle decoration. */
const FLUID_FRAME_INTERVAL = 1000 / 30
/** Two autonomous emitters + the pointer. */
const EMITTER_COUNT = 3
/** Flow-map resolution relative to the canvas (0.25 = 16x cheaper than full). */
const FLOW_SCALE = 0.25
/** Hard cap on the device pixel ratio for this layer. */
const FLUID_MAX_PIXEL_RATIO = 1.5

function hexToRgb(hex) {
  const value = String(hex || '#000000').replace('#', '')
  const normalized = value.length === 3
    ? value.split('').map((c) => c + c).join('')
    : value.padEnd(6, '0').slice(0, 6)
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255)
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'unknown shader compile error'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

function linkProgram(gl, fragmentSource) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, FLUID_VERTEX_SHADER)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'unknown program link error'
    gl.deleteProgram(program)
    throw new Error(message)
  }
  return program
}

function uniformsOf(gl, program, names) {
  const out = {}
  for (const name of names) out[name] = gl.getUniformLocation(program, name)
  return out
}

function createFlowTarget(gl, width, height) {
  const texture = gl.createTexture()
  const framebuffer = gl.createFramebuffer()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(framebuffer)
    gl.deleteTexture(texture)
    throw new Error('flow map framebuffer incomplete')
  }
  gl.clearColor(0, 0.5, 0.5, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { texture, framebuffer }
}

/**
 * Create the fluid layer.
 *
 * @param options.canvas - the layer's canvas element (already in the DOM).
 * @param options.readConfig - returns the current parameter snapshot.
 * @param options.sources - the interaction-source registry.
 * @param options.reducedMotion - static-only mode when true.
 * @param options.log - console-like logger.
 */
export function createFluidLayer(options) {
  const { canvas, readConfig, sources, reducedMotion } = options
  const log = options.log ?? console

  let gl = null
  let flowProgram = null
  let fluidProgram = null
  let flowUniforms = {}
  let fluidUniforms = {}
  let targets = []
  let readIndex = 0
  let width = 0
  let height = 0
  let pixelRatio = 1
  let flowWidth = 0
  let flowHeight = 0
  let frame = 0
  let enabled = false
  let lastFrameTime = 0
  let renderedFrames = 0
  let lastTickAt = 0
  let fallbackActive = false
  let failed = ''

  const emitterPositions = new Float32Array(EMITTER_COUNT * 2)
  const emitterVelocities = new Float32Array(EMITTER_COUNT * 2)
  const emitterRadii = new Float32Array(EMITTER_COUNT)
  const emitterStrengths = new Float32Array(EMITTER_COUNT)

  const motion = { x: 0.5, y: 0.5, vx: 0, vy: 0, interaction: 0 }

  function deleteTargets() {
    for (const target of targets) {
      gl.deleteFramebuffer(target.framebuffer)
      gl.deleteTexture(target.texture)
    }
    targets = []
  }

  /** Static-gradient fallback: a CSS background on the same element. */
  function activateFallback(reason) {
    failed = reason
    fallbackActive = true
    const config = readConfig()
    const colors = [config['appearance.palette1'], config['appearance.palette2'],
      config['appearance.palette3'], config['appearance.palette4'], config['appearance.palette5']]
    canvas.style.background = staticGradientCss(colors, config['appearance.gradientAngle'])
    canvas.dataset.renderer = 'static-gradient'
    log.warn('[theme-studio] WebGL2 unavailable, falling back to a static gradient:', reason)
  }

  /**
   * Bring the WebGL renderer up, once.
   *
   * Returns true only when a usable renderer exists; calling it again after a
   * successful init is a no-op that returns true. An earlier version returned
   * false in that case, which made every second `setEnabled(true)` look like a
   * failure and silently downgraded a working WebGL layer to the static
   * gradient.
   */
  function ensureRenderer() {
    if (gl !== null) return true
    if (fallbackActive) return false
    try {
      gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: 'low-power',
        preserveDrawingBuffer: false,
      })
    } catch (error) {
      gl = null
      activateFallback(error?.message ?? 'getContext threw')
      return false
    }
    if (gl === null) {
      activateFallback('no webgl2 context')
      return false
    }
    try {
      flowProgram = linkProgram(gl, FLOW_FRAGMENT_SHADER)
      fluidProgram = linkProgram(gl, FLUID_FRAGMENT_SHADER)
    } catch (error) {
      activateFallback(error?.message ?? 'shader compilation failed')
      return false
    }
    flowUniforms = uniformsOf(gl, flowProgram, ['u_previous', 'u_decay'])
    flowUniforms.u_emitters = gl.getUniformLocation(flowProgram, 'u_emitters[0]')
    flowUniforms.u_velocities = gl.getUniformLocation(flowProgram, 'u_velocities[0]')
    flowUniforms.u_radii = gl.getUniformLocation(flowProgram, 'u_radii[0]')
    flowUniforms.u_strengths = gl.getUniformLocation(flowProgram, 'u_strengths[0]')
    fluidUniforms = uniformsOf(gl, fluidProgram, [
      'u_flow', 'u_time', 'u_resolution', 'u_scale', 'u_offset', 'u_grain',
      'u_distortBoost', 'u_swirlBoost', 'u_glowIntensity', 'u_glowColor1',
      'u_glowColor2', 'u_glowColor3', 'u_color1', 'u_color2', 'u_color3',
      'u_color4', 'u_color5', 'u_lightPos', 'u_lightCore', 'u_lightHalo',
      'u_vignette', 'u_bloomThreshold', 'u_bloomRange', 'u_bloomStrength',
      'u_intensity', 'u_levels', 'u_dither', 'u_flowEnabled',
    ])
    canvas.dataset.renderer = 'webgl2'
    // A successful init also clears any earlier fallback state.
    fallbackActive = false
    failed = ''
    canvas.style.background = ''
    return true
  }

  function resize() {
    const nextWidth = Math.max(1, window.innerWidth)
    const nextHeight = Math.max(1, window.innerHeight)
    const nextRatio = Math.min(window.devicePixelRatio || 1, FLUID_MAX_PIXEL_RATIO)
    const canvasWidth = Math.round(nextWidth * nextRatio)
    const canvasHeight = Math.round(nextHeight * nextRatio)
    const nextFlowWidth = Math.max(1, Math.round(canvasWidth * FLOW_SCALE))
    const nextFlowHeight = Math.max(1, Math.round(canvasHeight * FLOW_SCALE))
    if (nextWidth === width && nextHeight === height && nextRatio === pixelRatio
      && nextFlowWidth === flowWidth && nextFlowHeight === flowHeight) return
    width = nextWidth
    height = nextHeight
    pixelRatio = nextRatio
    flowWidth = nextFlowWidth
    flowHeight = nextFlowHeight
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    deleteTargets()
    targets = [
      createFlowTarget(gl, flowWidth, flowHeight),
      createFlowTarget(gl, flowWidth, flowHeight),
    ]
    readIndex = 0
    canvas.dataset.flowSize = `${flowWidth}x${flowHeight}`
    canvas.dataset.pixelRatio = String(pixelRatio)
  }

  function draw(time) {
    const config = readConfig()
    resize()

    const pointer = sources.getSources()[0]
    const interaction = motion.interaction
    const radiusScale = config['fluid.radius'] / 140

    emitterPositions[0] = motion.x
    emitterPositions[1] = motion.y
    emitterVelocities[0] = motion.vx
    emitterVelocities[1] = motion.vy
    emitterRadii[0] = 0.09 * radiusScale
    emitterStrengths[0] = 1.8 * interaction

    const list = sources.getSources()
    for (let index = 1; index < EMITTER_COUNT; index += 1) {
      const source = list[index]
      const offset = index * 2
      if (source === undefined) {
        emitterStrengths[index] = 0
        continue
      }
      emitterPositions[offset] = source.x
      emitterPositions[offset + 1] = 1 - source.y
      emitterVelocities[offset] = source.vx
      emitterVelocities[offset + 1] = -source.vy
      emitterRadii[index] = source.fluidRadius * radiusScale
      emitterStrengths[index] = source.active ? source.fluidStrength : 0
    }
    void pointer

    // ── flow map pass ──
    const writeIndex = 1 - readIndex
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[writeIndex].framebuffer)
    gl.viewport(0, 0, flowWidth, flowHeight)
    gl.useProgram(flowProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, targets[readIndex].texture)
    gl.uniform1i(flowUniforms.u_previous, 0)
    gl.uniform2fv(flowUniforms.u_emitters, emitterPositions)
    gl.uniform2fv(flowUniforms.u_velocities, emitterVelocities)
    gl.uniform1fv(flowUniforms.u_radii, emitterRadii)
    gl.uniform1fv(flowUniforms.u_strengths, emitterStrengths)
    gl.uniform1f(flowUniforms.u_decay, 0.925)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    readIndex = writeIndex

    // ── visible pass ──
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(fluidProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, targets[readIndex].texture)
    gl.uniform1i(fluidUniforms.u_flow, 0)
    gl.uniform1f(fluidUniforms.u_time, time * 0.001 * config['fluid.speed'])
    gl.uniform2f(fluidUniforms.u_resolution, canvas.width, canvas.height)
    gl.uniform1f(fluidUniforms.u_scale, config['fluid.scale'])

    const [c1, c2, c3, c4, c5] = [
      config['appearance.palette1'], config['appearance.palette2'], config['appearance.palette3'],
      config['appearance.palette4'], config['appearance.palette5'],
    ].map(hexToRgb)
    gl.uniform3fv(fluidUniforms.u_color1, c1)
    gl.uniform3fv(fluidUniforms.u_color2, c2)
    gl.uniform3fv(fluidUniforms.u_color3, c3)
    gl.uniform3fv(fluidUniforms.u_color4, c4)
    gl.uniform3fv(fluidUniforms.u_color5, c5)

    const glow = [[1, 0.968, 0.819], [0.325, 0.553, 0.792], [0.176, 0.267, 0.545]]
    gl.uniform3fv(fluidUniforms.u_glowColor1, glow[0])
    gl.uniform3fv(fluidUniforms.u_glowColor2, glow[1])
    gl.uniform3fv(fluidUniforms.u_glowColor3, glow[2])

    gl.uniform1f(fluidUniforms.u_grain, config['fluid.grain'])
    gl.uniform1f(fluidUniforms.u_distortBoost, config['fluid.distort'])
    gl.uniform1f(fluidUniforms.u_swirlBoost, config['fluid.swirl'])
    gl.uniform1f(fluidUniforms.u_glowIntensity, config['fluid.glow'])

    const lightX = 0.89 + (motion.x - 0.89) * 0.63 * motion.interaction
    gl.uniform2f(fluidUniforms.u_lightPos, lightX, 0.46)
    gl.uniform1f(fluidUniforms.u_lightCore, 0.14)
    gl.uniform1f(fluidUniforms.u_lightHalo, 0.2)
    gl.uniform1f(fluidUniforms.u_vignette, config['fluid.vignette'])
    gl.uniform1f(fluidUniforms.u_bloomThreshold, 0.61)
    gl.uniform1f(fluidUniforms.u_bloomRange, 0.18)
    gl.uniform1f(fluidUniforms.u_bloomStrength, 0.4)
    gl.uniform1f(fluidUniforms.u_intensity, 0.86)
    gl.uniform1f(fluidUniforms.u_levels, config['quantum.q2Enabled'] ? config['quantum.q2Levels'] : 0)
    gl.uniform1f(fluidUniforms.u_dither, config['quantum.q2Dither'])
    gl.uniform1f(fluidUniforms.u_flowEnabled, config['fluid.flowmap'] ? 1 : 0)

    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function advanceMotion() {
    const pointer = sources.getSources()[0]
    if (pointer === undefined) return
    const targetX = pointer.x
    const targetY = 1 - pointer.y
    motion.x += (targetX - motion.x) * 0.1
    motion.y += (targetY - motion.y) * 0.1
    motion.vx += ((targetX - motion.x) * 0.5 - motion.vx) * 0.2
    motion.vy += ((targetY - motion.y) * 0.5 - motion.vy) * 0.2
    const interactionTarget = pointer.active ? 1 : 0
    motion.interaction += (interactionTarget - motion.interaction) * 0.16
    if (!pointer.active && motion.interaction < 0.0005) motion.interaction = 0
  }

  function schedule() {
    if (enabled && frame === 0 && !reducedMotion) frame = window.requestAnimationFrame(tick)
  }

  function tick(time) {
    frame = 0
    if (!enabled) return
    if (document.visibilityState !== 'visible') {
      // Park the loop entirely until the tab is visible again.
      frame = window.requestAnimationFrame(tick)
      return
    }
    if (time - lastFrameTime < FLUID_FRAME_INTERVAL) {
      frame = window.requestAnimationFrame(tick)
      return
    }
    lastFrameTime = time - ((time - lastFrameTime) % FLUID_FRAME_INTERVAL)
    const dt = lastTickAt === 0 ? FLUID_FRAME_INTERVAL : Math.min(64, time - lastTickAt)
    lastTickAt = time
    sources.tick(dt)
    advanceMotion()
    draw(time)
    renderedFrames += 1
    frame = window.requestAnimationFrame(tick)
  }

  function renderOnce() {
    if (gl === null) return
    sources.tick(FLUID_FRAME_INTERVAL)
    advanceMotion()
    draw(performance.now())
    renderedFrames += 1
  }

  return {
    setEnabled(value) {
      enabled = value === true
      canvas.toggleAttribute('data-disabled', !enabled)
      if (!enabled) {
        window.cancelAnimationFrame(frame)
        frame = 0
        return
      }
      if (!ensureRenderer()) {
        // Static gradient stands in (activateFallback already ran, and set the
        // canvas background); still visible, still no white page.
        return
      }
      if (reducedMotion) {
        renderOnce()
        return
      }
      lastTickAt = 0
      schedule()
    },
    /** Re-render immediately (parameter change while paused / reduced motion). */
    refresh() {
      if (!enabled) return
      if (!ensureRenderer()) return
      if (reducedMotion) {
        renderOnce()
        return
      }
      schedule()
    },
    getDiagnostics: () => ({
      enabled,
      renderer: canvas.dataset.renderer || 'none',
      flowSize: canvas.dataset.flowSize || '',
      pixelRatio,
      renderedFrames,
      running: frame !== 0,
      fallback: fallbackActive,
      error: failed,
    }),
    destroy() {
      window.cancelAnimationFrame(frame)
      frame = 0
      enabled = false
      if (gl !== null) {
        deleteTargets()
        if (flowProgram) gl.deleteProgram(flowProgram)
        if (fluidProgram) gl.deleteProgram(fluidProgram)
        // Release the context so a long-lived page does not accumulate them
        // (spec: uninstall must leave nothing behind).
        const lose = gl.getExtension('WEBGL_lose_context')
        try { lose?.loseContext() } catch { /* already gone */ }
        gl = null
      }
      canvas.remove()
    },
  }
}
