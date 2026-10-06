/**
 * Plugin body: owns the layers, their mount/unmount lifecycle, and the three
 * control channels.
 *
 * Mount policy (spec §4):
 *   - decoration layers are created lazily, after the first frame, through
 *     requestIdleCallback (fallback: setTimeout 0) so the first paint is never
 *     blocked;
 *   - the grid and the particle field are hidden below 768 px;
 *   - prefers-reduced-motion turns every continuous animation into a single
 *     static render;
 *   - at most two canvases exist at any moment (fluid + grid, or particles),
 *     one <style> per concern, and exactly one MutationObserver for the
 *     particle host plus the glass layer's own observer.
 */

import { createStore } from './store.js'
import { createThemeLayer } from './theme-layer.js'
import { createFluidLayer } from './effects/fluid.js'
import { createGridLayer } from './effects/grid.js'
import { createParticleLayer } from './effects/particles.js'
import { createSpotlightLayer } from './effects/spotlight.js'
import { createGlassLayer } from './effects/glass.js'
import { createLayerStyles } from './effects/layers.js'
import { createInteractionLayer } from './effects/interaction.js'
import { createSettingsRow, ensureRowCss, ROW_ID, ROW_ORDER } from './settings-row.js'
import { createApi } from './api.js'
import { createInteractionSources } from './effects/sources.js'

/** Below this viewport width the grid and the particle field stay off. */
export const MIN_DECORATION_WIDTH = 768

function idle(fn) {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(fn, { timeout: 400 })
  }
  return window.setTimeout(fn, 0)
}

function cancelIdle(handle) {
  if (handle === undefined || handle === null) return
  if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(handle)
  else window.clearTimeout(handle)
}

/**
 * @param ctx - client cordis context (may be undefined in a bare page).
 * @param options.version - package version, reported through the API.
 */
export function createPluginBody(ctx, options = {}) {
  const log = console
  const version = options.version ?? '0.0.0'
  const doc = document
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

  let store = null
  let sources = null
  let themeLayer = null
  let layerStyles = null
  let interaction = null
  let fluid = null
  let grid = null
  let particles = null
  let spotlight = null
  let glass = null
  let api = null
  let idleHandle = null
  let resizeTimer = 0
  let domObserver = null
  let particleCanvas = null
  let unsubscribe = null

  const readConfig = () => (store === null ? {} : store.values())

  function wide() {
    return Math.max(1, window.innerWidth) >= MIN_DECORATION_WIDTH
  }

  // ── decoration canvases ──────────────────────────────────────────────────

  function ensureFluidCanvas() {
    let canvas = doc.querySelector('.dts-fluid-canvas')
    if (canvas === null) {
      canvas = doc.createElement('canvas')
      canvas.className = 'dts-fluid-canvas'
      canvas.setAttribute('aria-hidden', 'true')
      doc.body.appendChild(canvas)
    }
    // Single-instance guard (a hot reload must not stack layers).
    for (const stale of doc.querySelectorAll('.dts-fluid-canvas')) if (stale !== canvas) stale.remove()
    return canvas
  }

  function ensureGridCanvas() {
    let canvas = doc.querySelector('.dts-grid-canvas')
    if (canvas === null) {
      canvas = doc.createElement('canvas')
      canvas.className = 'dts-grid-canvas'
      canvas.setAttribute('aria-hidden', 'true')
      doc.body.appendChild(canvas)
    }
    for (const stale of doc.querySelectorAll('.dts-grid-canvas')) if (stale !== canvas) stale.remove()
    return canvas
  }

  /** The particle field rides inside the conversation scroll body. */
  function findParticleHost() {
    return doc.querySelector('[data-conversation-scroll]')
      ?? doc.querySelector('[data-conversation-region]')
      ?? null
  }

  function ensureParticleCanvas(host) {
    if (particleCanvas !== null && particleCanvas.parentElement === host) return particleCanvas
    if (particleCanvas === null) {
      particleCanvas = doc.createElement('canvas')
      particleCanvas.className = 'dts-particle-canvas'
      particleCanvas.setAttribute('aria-hidden', 'true')
    }
    for (const stale of doc.querySelectorAll('.dts-particle-canvas')) if (stale !== particleCanvas) stale.remove()
    if (particleCanvas.parentElement !== null && particleCanvas.parentElement !== host) {
      particleCanvas.parentElement.removeChild(particleCanvas)
    }
    host.appendChild(particleCanvas)
    return particleCanvas
  }

  // ── synchronisation ──────────────────────────────────────────────────────

  function sync() {
    if (store === null) return
    const config = readConfig()
    const width = window.innerWidth
    const allowDecoration = width >= MIN_DECORATION_WIDTH

    themeLayer.refresh()
    layerStyles.refresh()

    // Fluid — also drives 'gradient'/'solid' backgrounds only when asked.
    const wantFluid = config['fluid.enabled'] === true
    if (wantFluid && fluid === null) {
      fluid = createFluidLayer({ canvas: ensureFluidCanvas(), readConfig, sources, reducedMotion, log })
    }
    if (fluid !== null) {
      fluid.setEnabled(wantFluid)
      if (wantFluid) fluid.refresh()
      else {
        // Disabling must leave NO residue: a parked WebGL canvas still shows
        // its last presented frame, which would break "all effects off ⇒
        // pixel diff = 0". Destroy the layer (which removes the element and
        // releases the context) and recreate it on the next enable.
        fluid.destroy()
        fluid = null
      }
    }

    // Q1 grid.
    const wantGrid = config['quantum.q1Enabled'] === true && allowDecoration
    if (wantGrid && grid === null) {
      grid = createGridLayer({ canvas: ensureGridCanvas(), readConfig, sources, reducedMotion })
    }
    if (grid !== null) {
      if (wantGrid) {
        grid.setEnabled(true)
        grid.refresh()
      } else {
        grid.destroy()
        grid = null
      }
    }

    // Q3 particles — 'background' makes the whale a full-screen watermark
    // behind the UI (blended into the background); 'content' keeps it inside
    // the conversation area.
    const wantParticles = config['quantum.q3Enabled'] === true && allowDecoration
    const wantWatermark = config['quantum.q3Placement'] === 'background'
    if (wantParticles) {
      const host = wantWatermark ? doc.body : findParticleHost()
      if (host !== null) {
        if (particles === null || particleCanvas === null || particleCanvas.parentElement !== host) {
          if (particles !== null) {
            particles.destroy()
            particles = null
          }
          if (particleCanvas !== null) {
            particleCanvas.remove()
            particleCanvas = null
          }
          particleCanvas = doc.createElement('canvas')
          particleCanvas.setAttribute('aria-hidden', 'true')
          host.appendChild(particleCanvas)
          particles = createParticleLayer({
            canvas: particleCanvas, readConfig, sources, reducedMotion,
          })
        }
        particles.setEnabled(true)
        particles.refresh()
      }
    } else if (particles !== null) {
      particles.destroy()
      particles = null
      if (particleCanvas !== null) {
        particleCanvas.remove()
        particleCanvas = null
      }
    }

    // Spotlight.
    const wantSpotlight = config['spotlight.enabled'] === true
    if (spotlight === null) {
      spotlight = createSpotlightLayer({ readConfig, reducedMotion, document: doc })
    }
    spotlight.setEnabled(wantSpotlight)
    if (wantSpotlight) spotlight.refresh()

    // Glass.
    const wantGlass = config['glass.enabled'] === true
    if (glass === null) glass = createGlassLayer({ readConfig, document: doc })
    glass.setEnabled(wantGlass)
    if (wantGlass) glass.refresh()

    // Hover lift / press / panel entrance.
    interaction.refresh()

    // Wanderers follow the fluid/grid demand.
    sources.setWanderersEnabled(wantFluid || wantGrid || wantParticles)
    sources.setPointerRadius(config['fluid.radius'])
    sources.setGridRadius(config['quantum.q1Radius'])
  }

  /**
   * ONE observer for everything that needs to notice DOM changes.
   *
   * The spec caps the plugin at a single MutationObserver, so the particle host
   * re-attachment and the hover-target marking share this one instead of
   * registering one each.
   */
  function observeDom() {
    if (typeof MutationObserver !== 'function') return
    let scheduled = false
    domObserver = new MutationObserver(() => {
      if (scheduled) return
      scheduled = true
      window.requestAnimationFrame(() => {
        scheduled = false
        interaction?.onDomChanged()
        const config = readConfig()
        if (config['quantum.q3Enabled'] !== true || !wide()) return
        if (config['quantum.q3Placement'] === 'background') return
        const host = findParticleHost()
        if (host === null) return
        if (particleCanvas === null || particleCanvas.parentElement !== host) {
          ensureParticleCanvas(host)
          particles?.refresh()
        }
      })
    })
    domObserver.observe(doc.body, { childList: true, subtree: true })
  }

  function onResize() {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      resizeTimer = 0
      sync()
    }, 180)
  }

  function onThemeChange() {
    themeLayer?.onThemeChange()
    glass?.refresh()
  }

  // ── lifecycle ────────────────────────────────────────────────────────────

  function start() {
    store = createStore({ log })
    sources = createInteractionSources({
      reducedMotion,
      onPointer: () => {
        // Wake sleeping renderers on the first movement after a pause.
        grid?.refresh()
      },
    })

    // The official Theme service is injected OPTIONALLY: reading `ctx.theme`
    // without declaring it throws ('cannot get property "theme" without
    // inject'), and declaring it in the manifest would make the whole plugin
    // wait for a service it can perfectly well live without — the CSS-variable
    // fallback in theme-layer.js covers the no-service case.
    let themeService = null
    if (ctx !== undefined && typeof ctx.inject === 'function') {
      try {
        ctx.inject(['theme'], (child) => {
          themeService = child.theme
          themeLayer?.refresh()
        })
      } catch (error) {
        log.warn('[theme-studio] theme service unavailable, using CSS variables', error)
      }
    }

    layerStyles = createLayerStyles({ readConfig, document: doc })
    interaction = createInteractionLayer({ readConfig, document: doc })
    themeLayer = createThemeLayer({
      readConfig,
      document: doc,
      themeService,
      log,
    })
    api = createApi(store, {
      version,
      diagnose: () => ({
        fluid: fluid?.getDiagnostics?.() ?? { enabled: false },
        grid: grid?.getDiagnostics?.() ?? { enabled: false },
        particles: particles?.getDiagnostics?.() ?? { enabled: false },
        spotlight: spotlight?.getDiagnostics?.() ?? { enabled: false },
        glass: glass?.getDiagnostics?.() ?? { enabled: false },
        interaction: interaction?.getDiagnostics?.() ?? {},
        theme: themeLayer?.getDiagnostics?.() ?? {},
        reducedMotion,
        viewportWidth: window.innerWidth,
        decorationAllowed: wide(),
        canvases: doc.querySelectorAll('canvas.dts-fluid-canvas, canvas.dts-grid-canvas, canvas.dts-particle-canvas, canvas.dts-logo-canvas').length,
        layers: [...doc.querySelectorAll('.dts-background, canvas.dts-fluid-canvas, canvas.dts-grid-canvas, canvas.dts-particle-canvas, canvas.dts-logo-canvas')]
          .map((el) => ({ cls: el.className, position: getComputedStyle(el).position, zIndex: getComputedStyle(el).zIndex })),
        styleTags: doc.querySelectorAll('style[data-plugin="dsh-deepseek-theme-studio"]').length,
        observers: (domObserver === null ? 0 : 1),
      }),
    })

    unsubscribe = store.subscribe(() => sync())

    // Channel 2: window + ctx.provide.
    window.dshThemeStudio = api
    if (ctx !== undefined && typeof ctx.provide === 'function') {
      try {
        ctx.provide('themeStudio', api)
      } catch (error) {
        log.warn('[theme-studio] ctx.provide("themeStudio") failed', error)
      }
    }

    // Channel 1: the settings row, in the host's own slot.
    ensureRowCss(doc)
    const React = (() => {
      try {
        const mod = ctx?.require?.('react')
        if (mod !== undefined) return mod.default ?? mod
      } catch { /* fall through to the platform seed */ }
      try {
        // eslint-disable-next-line no-undef
        const mod = typeof require === 'function' ? require('react') : undefined
        return mod?.default ?? mod ?? null
      } catch {
        return null
      }
    })()
    if (React !== null && ctx?.slots !== undefined && typeof ctx.slots.inject === 'function') {
      try {
        ctx.slots.inject('settings.general.item', () => ctx.slots.register({
          name: 'settings.general.item',
          id: ROW_ID,
          order: ROW_ORDER,
        }, createSettingsRow(React, {
          getSnapshot: () => store.snapshot(),
          subscribe: (fn) => store.subscribe(fn),
          set: (key, value) => store.set(key, value),
          applyPreset: (id) => store.applyPreset(id),
          reset: () => store.reset(),
          exportPreset: () => store.exportPreset(),
          importPreset: (text) => store.importPreset(text),
          presets: () => store.presets(),
          diagnosticsText: () => api.diagnosticsText(),
        })))
      } catch (error) {
        log.error('[theme-studio] settings row registration failed', error)
      }
    } else if (ctx !== undefined) {
      log.warn('[theme-studio] slots service unavailable — the row was not registered; window.dshThemeStudio still works')
    }

    // Store → host file, then the first decoration pass after the first frame.
    store.start()
    idleHandle = idle(() => {
      idleHandle = null
      sync()
      observeDom()
    })

    if (ctx !== undefined && typeof ctx.on === 'function') {
      ctx.on('theme/change', onThemeChange)
    }
    window.addEventListener('resize', onResize, { passive: true })
  }

  function stop() {
    window.removeEventListener('resize', onResize)
    window.clearTimeout(resizeTimer)
    cancelIdle(idleHandle)
    idleHandle = null
    domObserver?.disconnect()
    domObserver = null
    unsubscribe?.()
    unsubscribe = null
    fluid?.destroy()
    grid?.destroy()
    particles?.destroy()
    spotlight?.destroy()
    glass?.destroy()
    interaction?.destroy()
    layerStyles?.destroy()
    sources?.destroy()
    themeLayer?.destroy()
    store?.stop()
    if (particleCanvas !== null) {
      particleCanvas.remove()
      particleCanvas = null
    }
    for (const stale of doc.querySelectorAll('canvas.dts-fluid-canvas, canvas.dts-grid-canvas, canvas.dts-particle-canvas, .dts-background')) {
      stale.remove()
    }
    for (const style of doc.querySelectorAll('style[data-plugin="dsh-deepseek-theme-studio"]')) style.remove()
    const rowStyle = doc.getElementById('dts-settings-style')
    if (rowStyle !== null) rowStyle.remove()
    for (const node of doc.querySelectorAll('[data-dts-glass-skip]')) node.removeAttribute('data-dts-glass-skip')
    doc.documentElement.removeAttribute('data-dts')
    doc.documentElement.removeAttribute('data-dts-glass-root')
    doc.documentElement.removeAttribute('data-dts-glass-mode')
    if (window.dshThemeStudio === api) delete window.dshThemeStudio
    fluid = null
    grid = null
    particles = null
    spotlight = null
    glass = null
    interaction = null
    layerStyles = null
    themeLayer = null
    sources = null
    store = null
    api = null
  }

  return { start, stop, getApi: () => api, sync }
}
