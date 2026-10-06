#!/usr/bin/env node
/**
 * Token drift check.
 *
 * Verifies that every design token this plugin reads or writes still exists in
 * the host build it is being installed into, and reports the drift explicitly.
 *
 * Deliberately stricter than the reference implementation this idea comes from
 * (mux9056-bot/dsh-theme scripts/build.mjs, Apache-2.0): there, a failed live
 * fetch is non-fatal and the script still prints "token verification passed"
 * (build.mjs:278-286). Here a miss — or an unreachable --live source — exits
 * non-zero, because a silently-missing token is exactly the failure this check
 * exists to catch.
 *
 * Usage:
 *   node scripts/verify-tokens.mjs
 *   node scripts/verify-tokens.mjs --host <extracted-asar-dir>
 *   node scripts/verify-tokens.mjs --live http://127.0.0.1:<port> [--cookie "<Cookie header>"]
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const args = process.argv.slice(2)
function argValue(flag) {
  const index = args.indexOf(flag)
  return index === -1 ? undefined : args[index + 1]
}

/**
 * Candidate locations for the host's own CSS, tried in order. The install root
 * differs per platform and per packaging, so this is a search list rather than
 * a fixed path — pass --host to skip it entirely.
 */
const DEFAULT_HOSTS = [
  join(process.env.LOCALAPPDATA ?? '', 'Programs/DeepSeek Harness/resources/app.asar.unpacked/node_modules/@deepseek-ai'),
  join(process.env.LOCALAPPDATA ?? '', 'Programs/DeepSeek Harness/resources/app.asar/node_modules/@deepseek-ai'),
  join(process.env.PROGRAMFILES ?? '', 'DeepSeek Harness/resources/app.asar.unpacked/node_modules/@deepseek-ai'),
  join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.dsh/host/node_modules/@deepseek-ai'),
]

/** Stock-install archives, tried when no unpacked host tree is present. */
const DEFAULT_ASARS = [
  join(process.env.LOCALAPPDATA ?? '', 'Programs/DeepSeek Harness/resources/app.asar'),
  join(process.env.PROGRAMFILES ?? '', 'DeepSeek Harness/resources/app.asar'),
  '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar',
  join(process.env.HOME ?? '', 'Applications/DeepSeek Harness.app/Contents/Resources/app.asar'),
]

const hostDir = argValue('--host')
const liveUrl = argValue('--live')
const liveCookie = argValue('--cookie')

/** Tokens the plugin depends on, read from the source of truth. */
function readTokensUsed() {
  const source = readFileSync(join(root, 'src', 'host-hooks.js'), 'utf8')
  const block = source.match(/export const TOKENS_USED = \[([\s\S]*?)\]/)
  if (block === null) throw new Error('TOKENS_USED not found in src/host-hooks.js')
  return [...block[1].matchAll(/'(--[a-z0-9-]+)'/g)].map((m) => m[1])
}

/** Collect every `--dsw-* / --dsh-* / --shiki-*` declaration in a CSS blob. */
function collectDeclared(text, into) {
  for (const match of text.matchAll(/(--(?:dsw|dsh|shiki)-[a-z0-9-]+)\s*:/gi)) into.add(match[1])
}

function scanHostTree(dir) {
  const found = new Set()
  const stack = [dir]
  let files = 0
  while (stack.length > 0) {
    const current = stack.pop()
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' && current !== dir) continue
        stack.push(path)
        continue
      }
      if (!/\.(js|css|mjs)$/i.test(entry.name)) continue
      try {
        if (statSync(path).size > 12_000_000) continue
        const text = readFileSync(path, 'utf8')
        if (!text.includes('--dsw-') && !text.includes('--dsh-') && !text.includes('--shiki-')) continue
        files += 1
        collectDeclared(text, found)
      } catch { /* unreadable file: skip */ }
    }
  }
  return { found, files }
}

/**
 * Read a file out of an asar archive.
 *
 * asar layout: a 16-byte pickle header, then a JSON directory, then the file
 * contents. Offsets in the directory are relative to the end of the header
 * pickle, which is what makes this readable without extracting anything.
 */
function readAsarEntry(buffer, baseOffset, entry) {
  const start = baseOffset + Number(entry.offset)
  return buffer.subarray(start, start + entry.size).toString('utf8')
}

function readAsarDirectory(buffer) {
  const headerPickleSize = buffer.readUInt32LE(4)
  const jsonLength = buffer.readUInt32LE(12)
  const json = buffer.subarray(16, 16 + jsonLength).toString('utf8')
  return { directory: JSON.parse(json), baseOffset: 8 + headerPickleSize }
}

/**
 * Scan the host's own CSS/JS for token declarations directly inside app.asar.
 * Only files that mention one of the token prefixes are decoded, so this stays
 * fast on a ~100 MB archive.
 */
function scanAsar(archivePath) {
  const buffer = readFileSync(archivePath)
  const { directory, baseOffset } = readAsarDirectory(buffer)
  const found = new Set()
  let files = 0

  const walk = (node) => {
    for (const [name, entry] of Object.entries(node.files ?? {})) {
      if (entry.files !== undefined) { walk(entry); continue }
      if (typeof entry.offset !== 'string') continue
      if (!/\.(js|css|mjs)$/i.test(name)) continue
      if (entry.size > 12_000_000) continue
      let text
      try {
        text = readAsarEntry(buffer, baseOffset, entry)
      } catch { continue }
      if (!text.includes('--dsw-') && !text.includes('--dsh-') && !text.includes('--shiki-')) continue
      files += 1
      collectDeclared(text, found)
    }
  }
  walk(directory)
  return { found, files }
}

async function scanLive(url) {
  const found = new Set()
  // A `?token=…` URL is the app's own login link: the index response sets the
  // browser-auth cookie that every later request needs. Harvest it first,
  // otherwise a live check would just see HTTP 401 (and, worse, might be
  // tempted to treat "no CSS fetched" as success).
  let cookie = typeof liveCookie === 'string' ? liveCookie : ''
  const first = await fetch(url, { headers: { accept: 'text/html', ...(cookie === '' ? {} : { cookie }) } })
  if (first.status === 401) {
    throw new Error('index returned HTTP 401 — this instance authenticates in the page, not from a bare fetch.\n' +
      '     Use one of:\n' +
      '       • the authoritative runtime check, inside the authenticated page:\n' +
      '           window.dshThemeStudio.formatSelfCheck()\n' +
      '       • node scripts/verify-tokens.mjs --live <url> --cookie "<copy the Cookie header from DevTools>"\n' +
      '       • node scripts/verify-tokens.mjs --host <extracted asar tree>   (offline build check)')
  }
  if (!first.ok) throw new Error(`index fetch failed: HTTP ${first.status}`)
  try {
    const cookies = typeof first.headers.getSetCookie === 'function'
      ? first.headers.getSetCookie()
      : (first.headers.get('set-cookie') ? [first.headers.get('set-cookie')] : [])
    cookie = cookies.map((entry) => entry.split(';')[0]).join('; ')
  } catch { /* no cookie support: proceed without */ }
  const authHeaders = cookie === '' ? {} : { cookie }

  const html = await first.text()
  const hrefs = [...html.matchAll(/(?:href|src)="([^"]+\.css)"/g)].map((m) => m[1])
  let files = 0
  for (const href of hrefs) {
    const target = new URL(href, url).toString()
    const response = await fetch(target, { headers: authHeaders })
    if (!response.ok) continue
    files += 1
    collectDeclared(await response.text(), found)
  }
  if (files === 0) throw new Error('index loaded but no CSS assets could be fetched (still unauthenticated?)')
  return { found, files }
}

const tokensUsed = readTokensUsed()

let source
let mode
if (liveUrl !== undefined) {
  mode = `live ${liveUrl}`
  source = await scanLive(liveUrl).catch((error) => {
    console.error(`✘ --live ${liveUrl} unreachable: ${error.message}`)
    console.error('   (a check that cannot read the running instance must fail, not pass silently)')
    process.exit(2)
  })
} else {
  const dir = hostDir ?? DEFAULT_HOSTS.find((candidate) => candidate !== '' && existsSync(candidate))
  const asar = hostDir === undefined
    ? DEFAULT_ASARS.find((candidate) => candidate !== '' && existsSync(candidate))
    : undefined
  if (dir === undefined && asar === undefined) {
    console.error('✘ no host tree and no app.asar found. Pass --host <extracted node_modules/@deepseek-ai>,')
    console.error('  --live <url>, or point DSH_HOME at a stock install.')
    process.exit(2)
  }
  if (dir !== undefined) {
    mode = `host tree ${dir}`
    source = scanHostTree(dir)
    if (source.files === 0) {
      console.error(`✘ scanned 0 CSS-bearing files under ${dir} — wrong path?`)
      process.exit(2)
    }
  } else {
    mode = `app.asar ${asar}`
    source = scanAsar(asar)
    if (source.files === 0) {
      console.error(`✘ scanned 0 CSS-bearing entries inside ${asar} — archive layout changed?`)
      process.exit(2)
    }
  }
}

const missing = tokensUsed.filter((token) => !source.found.has(token))
console.log(`令牌自检（${mode}）`)
console.log(`  扫描文件：${source.files}    宿主已声明令牌：${source.found.size}`)
console.log(`  本插件使用令牌：${tokensUsed.length}`)
for (const token of tokensUsed) {
  console.log(`  ${source.found.has(token) ? '✔' : '✘'} ${token}`)
}
if (missing.length > 0) {
  console.error(`\n✘ ${missing.length}/${tokensUsed.length} 个令牌在宿主中不存在（漂移）：`)
  for (const token of missing) console.error(`   - ${token}`)
  process.exit(1)
}
console.log(`\n✔ 用到的 ${tokensUsed.length} 个令牌全部命中${liveUrl ? '运行实例真实 CSS' : '宿主构建的实际 CSS'}`)
