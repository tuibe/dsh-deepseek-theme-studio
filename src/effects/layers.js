/**
 * Layer geometry + host surface translucency.
 *
 * This module exists because of a real defect: the effect canvases were created
 * and driven correctly but had NO positioning CSS at all, so they landed in
 * normal document flow *below* the app instead of behind it (measured rects:
 * y=895 / y=1799 with `position: static`). Numeric diagnostics all looked
 * healthy — the renderers were running, just off-screen. The lesson is baked in
 * here: every class the JS creates is declared in exactly one stylesheet, and
 * `selfCheck()` reports the resolved `position`/`z-index` of each layer so the
 * mistake cannot come back silently.
 *
 * Two concerns:
 *   1. GEOMETRY — where the decoration layers sit (`fixed`, `inset: 0`, a
 *      negative z-index for backgrounds, `absolute` for in-content layers).
 *   2. SURFACES — the host paints `_frame` / `_centerCol` / `_sidebarCol` with
 *      an opaque `--dsw-alias-bg-base`, which would hide a background layer
 *      entirely. While a background layer is active those surfaces are made
 *      translucent, scoped to `html[data-dts-surfaces]` so removing one
 *      attribute restores the host exactly.
 */

export const LAYER_CSS = `
/* ── 1. geometry ───────────────────────────────────────────────────────── */
html[data-dts] .dts-background,
html[data-dts] .dts-fluid-canvas {
  position: fixed; inset: 0; width: 100%; height: 100%;
  z-index: -2; pointer-events: none; display: block;
}
html[data-dts] .dts-logo-canvas {
  position: fixed; inset: 0; width: 100%; height: 100%;
  z-index: -1; pointer-events: none; display: block;
}
html[data-dts] .dts-grid-canvas {
  position: fixed; inset: 0; width: 100%; height: 100%;
  z-index: -1; pointer-events: none; display: block;
  -webkit-mask-image: linear-gradient(rgba(0,0,0,1) 0%, rgba(0,0,0,.9) 20%, rgba(0,0,0,.4) 55%, rgba(0,0,0,0) 100%);
  mask-image: linear-gradient(rgba(0,0,0,1) 0%, rgba(0,0,0,.9) 20%, rgba(0,0,0,.4) 55%, rgba(0,0,0,0) 100%);
}
/* in-content placement (quantum.q3Placement = content) */
html[data-dts] .dts-particle-canvas {
  position: absolute; inset: 0; width: 100%; height: 100%;
  z-index: 0; pointer-events: none; display: block;
}
html[data-dts] .dts-spotlight-ring {
  position: fixed; left: 0; top: 0; border-radius: 50%;
  mix-blend-mode: difference; pointer-events: none; z-index: 9999;
  opacity: 0;
}
html[data-dts] .dts-spotlight-ring[data-on="1"] { opacity: 1; }

/* ── 2. translucent host surfaces (background must be able to show) ──────
   Measured on host 0.2.0-rc.2, three elements paint an opaque base and would
   hide the background layer entirely:
     body                      rgb(255,255,255)
     [data-slot] > ._root      rgb(249,250,251)  (the sidebar, via
                               --dsw-specific-sidebar-fill, which is declared
                               ON BODY, so the override has to be on body too)
     [data-phase]              rgb(255,255,255)  (the conversation root)
   Everything is scoped to html[data-dts-surfaces], which only exists while a
   background layer is actually active. */
html[data-dts-surfaces] body {
  background: transparent !important;
  --dsw-specific-sidebar-fill: transparent;
}
html[data-dts-surfaces] [data-phase],
html[data-dts-surfaces] [data-slot] > [class*="_root"] {
  background: transparent !important;
}
html[data-dts-surfaces] [class*="_frame"],
html[data-dts-surfaces] [class*="_centerCol"],
html[data-dts-surfaces] [class*="_sidebarCol"],
html[data-dts-surfaces] [class*="_composerSeat"],
html[data-dts-surfaces] [data-composer-seat] {
  background: transparent !important;
}
html[data-dts-surfaces] [class*="_sidebarCol"] { border-right-color: transparent !important; }
`

/**
 * Install / refresh / remove the layer stylesheet.
 *
 * @param options.readConfig - current parameter snapshot.
 * @param options.document - target document.
 */
export function createLayerStyles(options) {
  const readConfig = options.readConfig
  const doc = options.document ?? document
  let style = null

  function wanted() {
    const config = readConfig()
    return config['fluid.enabled'] === true
      || config['quantum.q1Enabled'] === true
      || config['quantum.q3Enabled'] === true
      || config['spotlight.enabled'] === true
      || config['appearance.backgroundMode'] !== 'solid'
  }

  return {
    refresh() {
      if (!wanted()) {
        if (style !== null) {
          style.remove()
          style = null
        }
        doc.documentElement.removeAttribute('data-dts-surfaces')
        return
      }
      if (style === null) {
        style = doc.createElement('style')
        style.dataset.plugin = 'dsh-deepseek-theme-studio'
        style.dataset.pluginCss = 'layers'
        style.textContent = LAYER_CSS
        doc.head.appendChild(style)
      }
      doc.documentElement.toggleAttribute('data-dts-surfaces', readConfig()['appearance.surfaces'] === true)
    },
    destroy() {
      if (style !== null) {
        style.remove()
        style = null
      }
      doc.documentElement.removeAttribute('data-dts-surfaces')
    },
  }
}
