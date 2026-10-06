// Reproduce the bundle's factory in Node with a stub loader, to surface any
// error the browser reports only as "<id>: failed".
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

// Leftover module syntax is the first thing to rule out.
const leftovers = src.split('\n')
  .map((line, index) => ({ line: line.trim(), number: index + 1 }))
  .filter(({ line }) => /^(import|export)\s/.test(line))
console.log('leftover import/export lines:', leftovers.length)
for (const item of leftovers.slice(0, 10)) console.log(`  L${item.number}: ${item.line.slice(0, 100)}`)

let captured = null
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      captured = definition
    },
  },
}

// eslint-disable-next-line no-new-func
new Function(src)()

if (captured === null) {
  console.error('✘ the bundle never registered a factory')
  process.exit(1)
}
console.log('registered id:', captured.id)

const required = []
let mod
try {
  mod = captured.factory((name) => {
    required.push(name)
    throw new Error(`no such module in this harness: ${name}`)
  })
} catch (error) {
  console.error('✘ factory threw:', error && error.stack ? error.stack : error)
  process.exit(1)
}

console.log('required at factory time:', required.length === 0 ? '(none)' : required.join(', '))
console.log('exports keys:', Object.keys(mod).join(', '))
console.log('exports.inject:', JSON.stringify(mod.inject))
console.log('typeof apply:', typeof mod.apply)
if (typeof mod.apply !== 'function') {
  console.error('✘ apply is not a function')
  process.exit(1)
}
console.log('✔ factory materialises cleanly')
