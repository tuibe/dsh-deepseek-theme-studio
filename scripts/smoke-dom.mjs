#!/usr/bin/env node
/**
 * DOM smoke test.
 *
 * The browser only ever reports a client-plugin failure as "<id>: failed", so a
 * broken bundle costs a full app restart to diagnose. This harness stubs just
 * enough of the DOM to run the real bundle end to end — factory, apply(),
 * ctx.effect start, one synchronisation pass, a few animation frames — and then
 * asserts that every layer the parameters ask for actually mounted.
 *
 * It is deliberately dependency-free: no jsdom, no bundler, nothing to install.
 * The stub is a subset of the platform, so "passes here" means "does not throw
 * or silently skip a layer", not "is visually correct".
 */
import { readFileSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url)
const src = readFileSync(new URL('lib/client.js', ROOT), 'utf8')

// ── stub platform ──────────────────────────────────────────────────────────

class FakeStyle {
  constructor() { this.properties = new Map() }
  setProperty(name, value) { this.properties.set(name, String(value)) }
  removeProperty(name) { this.properties.delete(name) }
  getPropertyValue(name) { return this.properties.get(name) ?? '' }
  getPropertyPriority() { return '' }
  set cssText(value) { this.text = value }
  get cssText() { return this.text ?? '' }
}

class FakeClassList {
  constructor(element) { this.element = element }
  add(...names) { for (const name of names) this.element.classListSet.add(name) }
  remove(...names) { for (const name of names) this.element.classListSet.delete(name) }
  contains(name) { return this.element.classListSet.has(name) }
  toggle(name, force) {
    const next = force === undefined ? !this.contains(name) : force === true
    if (next) this.add(name)
    else this.remove(name)
    return next
  }
}

function matchesSimple(element, selector) {
  const text = selector.trim()
  if (text === '') return false
  if (text === '*') return true
  // `:not(...)` is the only pseudo-class the parameter selectors use, and it
  // decides whether a real button is a pop target at all (button:not(:disabled)).
  for (const not of text.matchAll(/:not\(([^)]*)\)/g)) {
    const inner = not[1].trim()
    if (inner === ':disabled') {
      if (element.attributes.disabled !== undefined) return false
      continue
    }
    if (inner === ':enabled') continue
    if (matchesSimple(element, inner)) return false
  }
  let rest = text.replace(/:not\([^)]*\)/g, '')
  const tagMatch = /^[a-zA-Z][\w-]*/.exec(rest)
  const tag = tagMatch === null ? null : tagMatch[0].toUpperCase()
  if (tagMatch !== null) rest = rest.slice(tagMatch[0].length)
  if (tag !== null && element.tagName !== tag) return false
  let ok = true
  const parts = rest.match(/[.#][\w-]+|\[[^\]]+\]/g) ?? []
  if (parts.join('') !== rest) return false
  for (const part of parts) {
    if (part.startsWith('.')) {
      if (!element.classListSet.has(part.slice(1))) ok = false
    } else if (part.startsWith('#')) {
      if (element.id !== part.slice(1)) ok = false
    } else {
      const inner = part.slice(1, -1)
      const contains = /^([\w-]+)\*="([^"]*)"$/.exec(inner)
      const equals = /^([\w-]+)="([^"]*)"$/.exec(inner)
      const present = /^([\w-]+)$/.exec(inner)
      if (contains !== null) {
        const actual = contains[1] === 'class'
          ? element.className
          : element.attributes[contains[1]]
        // A missing attribute must NOT match `[attr*=""]`: the empty substring
        // is inside everything, which would make `[contenteditable=""]` match
        // every element in the stub and misclassify the whole page.
        if (actual === undefined || !String(actual).includes(contains[2])) ok = false
      } else if (equals !== null) {
        const name = equals[1]
        const actual = name === 'class' ? element.className : element.attributes[name]
        const present = name === 'class' ? element.className !== '' : element.attributes[name] !== undefined
        if (!present || String(actual) !== equals[2]) ok = false
      } else if (present !== null) {
        const name = present[1]
        const has = name === 'class' ? element.className !== '' : element.attributes[name] !== undefined
        if (!has) ok = false
      } else ok = false
    }
  }
  return ok
}

function matches(element, selector) {
  // Only a small subset is needed; anything unsupported returns false, which is
  // what a real querySelector does for a selector nothing matches.
  try {
    return selector.split(',').some((part) => {
      // Descendant combinator: match on the last compound and ignore ancestors.
      const last = part.trim().split(/\s+/).pop()
      return matchesSimple(element, last)
    })
  } catch {
    return false
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase()
    this.children = []
    this.parentElement = null
    this.id = ''
    this.attributes = {}
    this.classListSet = new Set()
    this.classList = new FakeClassList(this)
    this.style = new FakeStyle()
    this.dataset = {}
    this.isConnected = true
    this.listeners = new Map()
    this.textContent = ''
    this.width = 0
    this.height = 0
    this.clientWidth = 1280
    this.clientHeight = 720
    this.innerHTML = ''
  }
  get className() { return [...this.classListSet].join(' ') }
  set className(value) {
    this.classListSet = new Set(String(value).split(/\s+/).filter(Boolean))
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value)
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value)
  }
  getAttribute(name) { return this.attributes[name] ?? null }
  hasAttribute(name) { return this.attributes[name] !== undefined }
  removeAttribute(name) { delete this.attributes[name] }
  toggleAttribute(name, force) {
    const next = force === undefined ? !this.hasAttribute(name) : force === true
    if (next) this.setAttribute(name, '')
    else this.removeAttribute(name)
    return next
  }
  appendChild(child) {
    child.parentElement = this
    this.children.push(child)
    return child
  }
  insertBefore(child, reference) {
    child.parentElement = this
    const index = reference === null || reference === undefined ? this.children.length : this.children.indexOf(reference)
    this.children.splice(index < 0 ? this.children.length : index, 0, child)
    return child
  }
  removeChild(child) {
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    child.parentElement = null
    return child
  }
  remove() {
    this.parentElement?.removeChild(this)
    this.isConnected = false
  }
  get firstChild() { return this.children[0] ?? null }
  walk(out = []) {
    for (const child of this.children) {
      out.push(child)
      child.walk(out)
    }
    return out
  }
  querySelector(selector) { return this.walk().find((el) => matches(el, selector)) ?? null }
  querySelectorAll(selector) { return this.walk().filter((el) => matches(el, selector)) }
  matches(selector) { return matches(this, selector) }
  closest(selector) {
    let node = this
    while (node !== null) {
      if (matches(node, selector)) return node
      node = node.parentElement
    }
    return null
  }
  getBoundingClientRect() { return { left: 0, top: 0, right: 120, bottom: 40, width: 120, height: 40 } }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(fn)
  }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn) }
  dispatchEvent(type, event) {
    for (const fn of this.listeners.get(type) ?? []) fn(event)
    return true
  }
  getContext(kind) {
    if (kind === '2d') return fake2dContext()
    // WebGL is reported absent on purpose: the fluid layer must degrade, not throw.
    return null
  }
  focus() {}
}

function fake2dContext() {
  const noop = () => {}
  return {
    canvas: null,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    setTransform: noop,
    clearRect: noop,
    fillRect: noop,
    beginPath: noop,
    closePath: noop,
    arc: noop,
    moveTo: noop,
    lineTo: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    drawImage: noop,
    isPointInPath: () => false,
    measureText: () => ({ width: 0 }),
  }
}

const document_ = new FakeElement('#document')
const html = new FakeElement('html')
const body = new FakeElement('body')
const head = new FakeElement('head')
document_.appendChild(html)
html.appendChild(head)
html.appendChild(body)

const rafQueue = []
let rafId = 0

const documentStub = {
  documentElement: html,
  body,
  head,
  visibilityState: 'visible',
  activeElement: body,
  createElement: (tag) => new FakeElement(tag),
  createDocumentFragment: () => new FakeElement('fragment'),
  querySelector: (selector) => body.querySelector(selector) ?? head.querySelector(selector),
  querySelectorAll: (selector) => [...head.walk(), ...body.walk()].filter((el) => matches(el, selector)),
  getElementById: (id) => [...head.walk(), ...body.walk()].find((el) => el.id === id) ?? null,
  addEventListener: () => {},
  removeEventListener: () => {},
}

const windowStub = {
  innerWidth: 1280,
  innerHeight: 800,
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  requestAnimationFrame: (fn) => {
    rafId += 1
    rafQueue.push(fn)
    return rafId
  },
  cancelAnimationFrame: () => {},
  requestIdleCallback: (fn) => {
    fn({ timeRemaining: () => 8 })
    return 0
  },
  cancelIdleCallback: () => {},
  setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms ?? 0, 1)),
  clearTimeout,
  setInterval: () => 0,
  clearInterval: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  getComputedStyle: (el) => ({
    position: el?.style?.getPropertyValue?.('position') || 'static',
    zIndex: 'auto',
    getPropertyValue: (name) => el?.style?.getPropertyValue?.(name) ?? '',
  }),
  localStorage: {
    store: new Map(),
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null },
    setItem(key, value) { this.store.set(key, String(value)) },
    removeItem(key) { this.store.delete(key) },
  },
  require: undefined,
}

globalThis.document = documentStub
globalThis.window = windowStub
windowStub.document = documentStub
globalThis.Element = FakeElement
globalThis.HTMLElement = FakeElement
globalThis.CanvasElementClass = FakeElement
globalThis.getComputedStyle = windowStub.getComputedStyle
globalThis.matchMedia = windowStub.matchMedia
globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
}
globalThis.requestAnimationFrame = windowStub.requestAnimationFrame
globalThis.cancelAnimationFrame = windowStub.cancelAnimationFrame
globalThis.performance = { now: () => Date.now() }
globalThis.fetch = () => Promise.reject(new Error('offline smoke harness'))
globalThis.localStorage = windowStub.localStorage
globalThis.__ModuleLoader__ = {
  load(definition) { globalThis.__captured = definition },
}
// The bundle calls `window.__ModuleLoader__.load(...)`, so the stub has to hang
// off the window object, not only off globalThis.
windowStub.__ModuleLoader__ = globalThis.__ModuleLoader__

// ── run the bundle ─────────────────────────────────────────────────────────

// eslint-disable-next-line no-new-func
new Function(src)()
const definition = globalThis.__captured
if (definition === undefined) {
  console.error('✘ bundle never registered a factory')
  process.exit(1)
}
console.log('registered id:', definition.id)

const mod = definition.factory((name) => { throw new Error(`unexpected require: ${name}`) })
if (typeof mod.apply !== 'function') {
  console.error('✘ apply is not a function')
  process.exit(1)
}

const cleanups = []
const ctx = {
  effect(fn) { cleanups.push(fn()) },
  on() {},
  inject(_names, fn) {
    if (typeof fn === 'function') fn({})
  },
  provide() {},
  require() { return undefined },
  slots: undefined,
}

// A real button and a real text field, so the pop classification has something
// to classify: the button must get the spring class, the field must stay frozen.
const probeButton = new FakeElement('button')
probeButton.className = '_newSession'
body.appendChild(probeButton)
const probeField = new FakeElement('textarea')
body.appendChild(probeField)
// A long session puts hundreds of matches ahead of the composer in document
// order. The old 400-item budget therefore ran out before reaching it, and the
// card was never marked — the exact "对话框没有动画" defect.
for (let index = 0; index < 300; index += 1) {
  const filler = new FakeElement('button')
  filler.className = '_chip'
  body.appendChild(filler)
}
// The composer card is the element the user calls "对话框": it must land in the
// large-surface bucket rather than the ordinary pop bucket, and it must survive
// being the LAST match on the page.
const probeCard = new FakeElement('div')
probeCard.setAttribute('data-composer-card', '')
body.appendChild(probeCard)

// Read-only output: a code-block card inside the transcript must stay perfectly
// still (its copy button cannot move away from the pointer), while the copy
// button itself still answers.
const transcript = new FakeElement('div')
transcript.setAttribute('data-conversation-scroll', '')
body.appendChild(transcript)
const outputCard = new FakeElement('div')
outputCard.className = '_card'
transcript.appendChild(outputCard)
const snippet = new FakeElement('pre')
outputCard.appendChild(snippet)
const copyButton = new FakeElement('button')
outputCard.appendChild(copyButton)

const errors = []
const originalError = console.error
console.error = (...args) => { errors.push(args.join(' ')); originalError(...args) }

mod.apply(ctx)
console.log('apply(): ok')

// Drain a handful of animation frames so each layer's tick() runs at least once.
for (let round = 0; round < 3; round += 1) {
  const batch = rafQueue.splice(0, rafQueue.length)
  for (const fn of batch) fn(round * 40 + 16)
}

const api = windowStub.dshThemeStudio
if (api === undefined) {
  console.error('✘ window.dshThemeStudio was never published')
  process.exit(1)
}

const diagnostics = api.diagnostics()
console.log('\nparameter count:', diagnostics.parameterCount)
console.log('canvases:', diagnostics.canvases)
console.log('style tags:', diagnostics.styleTags)
console.log('layers:', JSON.stringify(diagnostics.layers))
for (const key of ['fluid', 'grid', 'particles', 'ambient', 'cursor', 'spotlight', 'glass', 'interaction', 'theme']) {
  console.log(`${key}:`, JSON.stringify(diagnostics[key]))
}

const problems = []
console.log(`probe classification: button=${[...probeButton.classListSet].join(' ') || '(none)'} · field=${[...probeField.classListSet].join(' ') || '(none)'} · card=${[...probeCard.classListSet].join(' ') || '(none)'}`)
if (diagnostics.ambient?.enabled !== true) problems.push('ambient layer did not start')
if (diagnostics.interaction?.enabled !== true) problems.push('interaction layer did not start')
if (html.hasAttribute('data-dts') !== true) problems.push('root data-dts attribute missing')
if (html.hasAttribute('data-dts-pop') !== true) problems.push('root data-dts-pop attribute missing')
if (body.querySelector('.dts-ambient-canvas') === null) problems.push('ambient canvas missing from body')
if (!probeButton.classList.contains('dts-pop')) problems.push('button was not classified as a pop target')
if (!probeCard.classList.contains('dts-pop-lg')) problems.push('composer card was not classified as a large surface')
if (!probeField.classList.contains('dts-textsafe')) problems.push('textarea was not classified as text-safe')
if (outputCard.classList.contains('dts-pop') || outputCard.classList.contains('dts-pop-lg')) {
  problems.push('a code block inside the transcript must not animate')
}
if (!copyButton.classList.contains('dts-pop')) {
  problems.push('the copy button inside a frozen code block lost its feedback')
}
// The cursor halo was removed in 0.3.0; it must not come back through a stale module.
if (body.querySelector('.dts-cursor-halo') !== null) problems.push('cursor halo should not exist any more')
if (body.querySelector('.dts-cursor-ripple') !== null) problems.push('cursor ripple should not exist any more')
if (errors.length > 0) problems.push(`console.error was called: ${errors.slice(0, 3).join(' | ')}`)

// Disposal must leave nothing behind.
for (const cleanup of cleanups) if (typeof cleanup === 'function') cleanup()
const residue = ['data-dts', 'data-dts-pop', 'data-dts-cursor', 'data-dts-modifier']
  .filter((name) => html.hasAttribute(name))
const leftovers = ['.dts-ambient-canvas', '.dts-cursor-halo', '.dts-cursor-ripple', '.dts-key-ripple']
  .filter((selector) => body.querySelector(selector) !== null)
if (residue.length > 0) problems.push(`dispose left root attributes: ${residue.join(', ')}`)
if (leftovers.length > 0) problems.push(`dispose left nodes: ${leftovers.join(', ')}`)
if (probeButton.classList.contains('dts-pop') || probeField.classList.contains('dts-textsafe')) {
  problems.push('dispose left pop classes on host elements')
}

if (problems.length > 0) {
  console.error('\n✘ DOM smoke failed:')
  for (const problem of problems) console.error('   -', problem)
  process.exit(1)
}
console.log('\n✔ DOM smoke passed: every requested layer mounted, and dispose left no residue')
