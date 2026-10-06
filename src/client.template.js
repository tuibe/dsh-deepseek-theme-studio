/**
 * dsh-deepseek-theme-studio — client bundle template.
 *
 * The build script (scripts/build.mjs) replaces the BUNDLE marker with the
 * concatenated src/ modules; do not edit lib/client.js by hand.
 *
 * Packaging contract (copied from the working plugins on this host — see
 * REUSE.md §0.4.2): the loader only ever calls
 * `window.__ModuleLoader__.load({ id, factory })`, every module-body side
 * effect lives inside the factory closure and runs at materialisation, and the
 * factory returns a CommonJS-style exports object carrying `inject` and
 * `apply`.
 */
window.__ModuleLoader__.load({
  // The id MUST be the package name: the loader matches
  // "<package>/client.js" against the id a bundle registers, and reports
  // "loaded without registering <package> via __ModuleLoader__.load" when they
  // differ.
  id: 'dsh-deepseek-theme-studio',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

/*__BUNDLE__*/

    /**
     * Client plugin body.
     *
     * `ctx.effect` owns the cleanup so a disposal (or a hot reload) removes the
     * canvases, style tags, observers, listeners and root attributes; without
     * cordis (a bare page) the body still starts and `window.dshThemeStudio`
     * is still published.
     */
    function apply(ctx) {
      if (typeof document === 'undefined' || typeof window === 'undefined') return
      var body = createPluginBody(ctx, { version: '__VERSION__' })
      if (ctx !== undefined && ctx !== null && typeof ctx.effect === 'function') {
        ctx.effect(() => {
          try {
            body.start()
          } catch (error) {
            console.error('[theme-studio] body.start() threw:', error)
            throw error
          }
          return () => body.stop()
        }, 'dsh-deepseek-theme-studio: glass / fluid / quantisation layers')
        return
      }
      try {
        body.start()
      } catch (error) {
        console.error('[theme-studio] body.start() threw (no cordis):', error)
        throw error
      }
      if (ctx !== undefined && ctx !== null && typeof ctx.on === 'function') {
        try {
          ctx.on('dispose', () => body.stop())
        } catch (error) {
          console.warn('[theme-studio] could not subscribe to dispose', error)
        }
      }
    }

    exports.apply = apply
    // Cordis service contract: the plugin needs the slots service to register
    // its row into Settings → General. Declared here AND in package.json's
    // dsh.client.inject, matching @deepseek-ai/dsh-client-ui-theme's own shape.
    exports.inject = ['slots']
    exports.PLUGIN_ID = 'dsh-deepseek-theme-studio'
    return module.exports
  },
})
