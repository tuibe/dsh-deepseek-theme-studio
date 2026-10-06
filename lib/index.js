/**
 * dsh-deepseek-theme-studio — host (Node) half.
 *
 * The plugin is a *client* plugin: everything the user sees is in ./client.
 * This half exists for three reasons:
 *
 *   1. The DSH loader imports the whole package and constructs a Cordis fiber
 *      for every loader entry, so the package must export an importable host
 *      plugin (`exports["."]`). Without it the loader fails with
 *      ERR_PACKAGE_PATH_NOT_EXPORTED / ERR_MODULE_NOT_FOUND.
 *   2. Control channel #3 of the spec: an editable JSON parameter file with
 *      hot reload. A browser page cannot touch the filesystem, so the file
 *      lives here (`$DSH_HOME/theme-studio.json`) behind a fenced HTTP route.
 *   3. It gives the client a persistence channel that is independent of the
 *      page origin (DSH Desktop binds its web server to an OS-assigned port,
 *      so localStorage is forgotten across restarts).
 *
 * Provenance (MIT):
 *   The route/persistence shape is ported from
 *   RevolutionLA/dsh-dream-skin lib/index.js (MIT, Copyright (c) 2026
 *   dsh-dream-skin contributors) — atomic write, `kind: "prefix"` route,
 *   DNS-rebinding trust fence, JSON body helpers. Extended here with:
 *     - a file watcher so hand edits hot-reload into every open page,
 *     - GET as well as POST for humans poking at it with curl,
 *     - optional `webServer`/`webRuntime` services (the plugin still mounts
 *       on a host without a web server instead of blocking the fiber).
 */

import { homedir } from 'node:os'
import { readFileSync, writeFileSync, renameSync, mkdirSync, watch, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

/** Plugin identity used by the loader entry and by ctx.provide. */
export const name = 'dsh-deepseek-theme-studio'

/** State file name inside the DSH home directory. */
const STATE_FILENAME = 'theme-studio.json'
/** Max accepted request body. The parameter file is tiny; this is generous. */
const MAX_BODY_BYTES = 4 * 1024 * 1024
/** Route prefix owned by this plugin. */
const API_PREFIX = '/deepseek-theme-studio/api'

// ── state file ─────────────────────────────────────────────────────────────

/** Absolute path of the parameter file under the DSH home directory. */
export function statePath() {
  const home = process.env.DSH_HOME && process.env.DSH_HOME.length > 0
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
  return join(home, STATE_FILENAME)
}

/**
 * Read the state object.
 *
 * A hand-edited file is a first-class use case, so a malformed one must be
 * REPORTED (the browser shows it in the settings row) rather than silently
 * treated as empty — a silent `{}` is how a typo turns into "my settings
 * vanished" with no explanation. A UTF-8 BOM is tolerated because several
 * Windows editors add one.
 *
 * @returns {{ value: object, error: string }} the parsed state, or `{}` plus a
 *   human-readable reason when the file is absent/corrupt.
 */
function readState() {
  let text
  try {
    text = readFileSync(statePath(), 'utf8')
  } catch {
    return { value: {}, error: '' } // absent is normal, not an error
  }
  const withoutBom = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  if (withoutBom.trim() === '') return { value: {}, error: '' }
  try {
    const parsed = JSON.parse(withoutBom)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: {}, error: 'parameter file must contain a JSON object' }
    }
    return { value: parsed, error: '' }
  } catch (error) {
    return { value: {}, error: `parameter file is not valid JSON: ${error.message}` }
  }
}

/** Persist the state object atomically (tmp + rename, direct-write fallback). */
function writeState(state) {
  const file = statePath()
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  const body = `${JSON.stringify(state, null, 2)}\n`
  writeFileSync(tmp, body, { encoding: 'utf8', mode: 0o600 })
  try {
    renameSync(tmp, file)
  } catch {
    // rename can fail on Windows if the target is transiently locked; a
    // direct write is safe for this single-process case.
    writeFileSync(file, body, { encoding: 'utf8', mode: 0o600 })
  }
}

// ── trust fence (mirror of dsh-dream-skin, itself mirroring dsh-better-sidebar) ──

function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4 && parts[0] === '127'
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function canonicalAuthority(entry, entryUrl) {
  const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port
  return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`
}

function isTrustedAuthority(hostUrl, trustedHosts) {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    if (canonicalAuthority(entry, entryUrl) !== entry.toLowerCase()) return false
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

/**
 * Decide whether one request may reach the plugin routes: loopback (or a
 * configured trusted authority) Host header and same-origin browser markers.
 * This is a DNS-rebinding / cross-site defence, not authentication.
 */
function isTrustedApiRequest(req, trustedHosts) {
  const host = typeof req.headers.host === 'string' ? req.headers.host : undefined
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

// ── body / response helpers ────────────────────────────────────────────────

const PAYLOAD_TOO_LARGE = Symbol('payload-too-large')

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    let aborted = false
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES && !aborted) {
        aborted = true
        req.destroy()
        resolve(PAYLOAD_TOO_LARGE)
        return
      }
      if (!aborted) chunks.push(chunk)
    })
    req.on('end', () => {
      if (aborted) return
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        resolve(null)
      }
    })
    req.on('error', () => {
      if (!aborted) resolve(null)
    })
  })
}

function writeJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

// ── revision counter (hot reload signal for the browser) ───────────────────

let revision = 0
const revisionListeners = new Set()

function bumpRevision() {
  revision += 1
  for (const fn of revisionListeners) {
    try {
      fn(revision)
    } catch { /* a bad listener must not break the others */ }
  }
}

/** Watch the parameter file so a hand edit hot-reloads into every open page. */
function watchState(onChange) {
  let watcher = null
  let timer = null
  const start = () => {
    try {
      // Watch the directory, not the file: editors that write-then-rename
      // replace the inode and would silently detach a file watcher.
      watcher = watch(dirname(statePath()), { persistent: false }, (_event, filename) => {
        if (filename !== null && String(filename) !== STATE_FILENAME) return
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = null
          onChange()
        }, 120)
      })
    } catch {
      watcher = null
    }
  }
  start()
  return () => {
    if (timer) clearTimeout(timer)
    try { watcher?.close() } catch { /* already closed */ }
  }
}

// ── request handling ───────────────────────────────────────────────────────

/** Only flat JSON scalars are accepted, so a page cannot smuggle types in. */
function sanitizeValue(value) {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) {
    const out = value.filter((v) => typeof v === 'string')
    return out.length === value.length ? out : undefined
  }
  return undefined
}

async function handleApi(req, res, trustedHosts) {
  if (!isTrustedApiRequest(req, trustedHosts)) {
    writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
    return
  }

  // GET is a convenience for humans and for `curl`; the client uses POST.
  if (req.method === 'GET') {
    const current = readState()
    writeJson(res, 200, { ok: true, value: current.value, fileError: current.error, revision, path: statePath() })
    return
  }
  if (req.method !== 'POST') {
    writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
    return
  }
  const contentType = typeof req.headers['content-type'] === 'string'
    ? req.headers['content-type'].toLowerCase()
    : ''
  if (!contentType.startsWith('application/json')) {
    writeJson(res, 415, { ok: false, error: { code: 'unsupported-media-type', message: 'content-type must be application/json' } })
    return
  }
  const payload = await readJsonBody(req)
  if (payload === PAYLOAD_TOO_LARGE) {
    writeJson(res, 413, { ok: false, error: { code: 'payload-too-large', message: 'request body too large' } })
    return
  }
  if (payload === null || typeof payload !== 'object' || typeof payload.method !== 'string') {
    writeJson(res, 400, { ok: false, error: { code: 'bad-request', message: 'bad request' } })
    return
  }

  if (payload.method === 'get') {
    const current = readState()
    writeJson(res, 200, { ok: true, value: current.value, fileError: current.error, revision, path: statePath() })
    return
  }

  if (payload.method === 'set') {
    const patch = payload.patch
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
      writeJson(res, 400, { ok: false, error: { code: 'bad-request', message: 'patch must be a plain object' } })
      return
    }
    // Merge only the keys present in `patch`: a value sets it, null removes
    // it, everything else is left alone — so two tabs editing different
    // parameters never clobber each other.
    const current = readState()
    const next = { ...current.value }
    for (const [key, raw] of Object.entries(patch)) {
      const value = sanitizeValue(raw)
      if (value === undefined) {
        writeJson(res, 400, { ok: false, error: { code: 'bad-request', message: `unsupported value for "${key}"` } })
        return
      }
      if (value === null) delete next[key]
      else next[key] = value
    }
    writeState(next)
    bumpRevision()
    writeJson(res, 200, { ok: true, revision, value: next })
    return
  }

  if (payload.method === 'replace') {
    const value = payload.value
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      writeJson(res, 400, { ok: false, error: { code: 'bad-request', message: 'value must be a plain object' } })
      return
    }
    writeState(value)
    bumpRevision()
    writeJson(res, 200, { ok: true, revision, value })
    return
  }

  writeJson(res, 404, { ok: false, error: { code: 'not-found', message: `unknown method "${payload.method}"` } })
}

// ── plugin ─────────────────────────────────────────────────────────────────

/**
 * Host loader entry: mount the fenced parameter-file API.
 *
 * `webServer` / `webRuntime` are injected optionally through `ctx.inject`, so
 * a host without a web server still mounts this plugin (the loader entry then
 * simply has nothing to serve) instead of parking the fiber forever.
 *
 * @param ctx - host cordis context.
 */
export function apply(ctx) {
  ctx.inject(['webServer'], (webCtx) => {
    let trustedHosts = []
    webCtx.inject(['webRuntime'], (runtimeCtx) => {
      const hosts = runtimeCtx.webRuntime?.trustedHosts
      trustedHosts = Array.isArray(hosts) ? hosts : []
    })

    const stopWatching = watchState(() => bumpRevision())
    webCtx.effect(() => stopWatching, 'deepseek-theme-studio: parameter file watcher')

    webCtx.effect(() => webCtx.webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: async (req, res) => {
        try {
          await handleApi(req, res, trustedHosts)
        } catch (error) {
          // Never echo internals (filesystem paths) back to the page.
          console.error('[dsh-deepseek-theme-studio] parameter API error:', error)
          writeJson(res, 500, { ok: false, error: { code: 'internal', message: 'internal error' } })
        }
      },
    }), 'dsh-deepseek-theme-studio: parameter API route')

    // Seed the file on first run so users have something to edit by hand.
    if (!existsSync(statePath())) writeState({})
  })
}
