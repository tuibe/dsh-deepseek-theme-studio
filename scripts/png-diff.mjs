#!/usr/bin/env node
/**
 * Pixel-difference report for two PNG screenshots (zero dependencies).
 *
 * The PNG decoder is ported from mux9056-bot/dsh-theme scripts/pixelcheck.mjs
 * (Apache-2.0, Copyright (c) 2026 mux9056-bot) — chunks, zlib inflate and the
 * five PNG row filters. The two-image comparison, the bounding box of the
 * differing region and the JSON report are added here.
 *
 * Usage:
 *   node scripts/png-diff.mjs <a.png> <b.png> [--json <out.json>] [--threshold 8]
 * Exit code is 0 when the images are byte-identical, 1 when they differ (so it
 * can gate the "restore native ⇒ diff = 0" acceptance check), 2 on error.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const args = process.argv.slice(2)
const files = args.filter((a) => !a.startsWith('--'))
const flag = (name, fallback) => {
  const index = args.indexOf(name)
  return index === -1 ? fallback : args[index + 1]
}
const threshold = Number(flag('--threshold', '8'))
const jsonOut = flag('--json', undefined)
/**
 * --exclude x,y,w,h (repeatable, comma-separated list also accepted): ignore
 * regions that the host repaints by design between page loads — in this app
 * the session list's relative timestamps ("32分钟" … "9天"), which are
 * rendered from Date.now() and therefore differ between two captures taken
 * minutes apart. Excluded pixels are counted and reported, never silently
 * dropped.
 */
const excludeRaw = args.reduce((acc, a, i) => (a === '--exclude' ? [...acc, args[i + 1]] : acc), [])
const excluded = excludeRaw.flatMap(String).flatMap((s) => s.split(';')).filter(Boolean).map((s) => {
  const [x, y, width, height] = s.split(',').map(Number)
  return { x, y, width, height }
})

if (files.length < 2) {
  console.error('usage: node scripts/png-diff.mjs <a.png> <b.png> [--json out.json] [--threshold 8]')
  process.exit(2)
}

function decodePng(file) {
  const buf = readFileSync(file)
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: not a PNG`)
  let off = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') idat.push(data)
    off += 12 + len
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`${file}: unsupported PNG (depth=${bitDepth} colorType=${colorType})`)
  }
  const raw = inflateSync(Buffer.concat(idat))
  const bpp = colorType === 6 ? 4 : 3
  const stride = width * bpp
  const out = Buffer.alloc(height * stride)
  let p = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[p]
    p += 1
    const row = raw.subarray(p, p + stride)
    p += stride
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0
      const b = prev ? prev[x] : 0
      const c = x >= bpp && prev ? prev[x - bpp] : 0
      let v = row[x]
      switch (filter) {
        case 0: break
        case 1: v = (v + a) & 255; break
        case 2: v = (v + b) & 255; break
        case 3: v = (v + ((a + b) >> 1)) & 255; break
        case 4: {
          const pa = Math.abs(b - c)
          const pb = Math.abs(a - c)
          const pc = Math.abs(a + b - 2 * c)
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          v = (v + pr) & 255
          break
        }
        default: throw new Error(`${file}: bad PNG filter ${filter}`)
      }
      out[y * stride + x] = v
    }
  }
  return { width, height, bpp, stride, pixels: out }
}

let a
let b
try {
  a = decodePng(files[0])
  b = decodePng(files[1])
} catch (error) {
  console.error(`✘ ${error.message}`)
  process.exit(2)
}

if (a.width !== b.width || a.height !== b.height) {
  console.error(`✘ size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`)
  process.exit(1)
}

let differing = 0
let excludedDiffering = 0
let maxDelta = 0
let sumDelta = 0
let minX = a.width
let minY = a.height
let maxX = -1
let maxY = -1
const total = a.width * a.height

const isExcluded = (x, y) => excluded.some((box) => x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height)

for (let y = 0; y < a.height; y += 1) {
  for (let x = 0; x < a.width; x += 1) {
    const ia = y * a.stride + x * a.bpp
    const ib = y * b.stride + x * b.bpp
    const delta = Math.max(
      Math.abs(a.pixels[ia] - b.pixels[ib]),
      Math.abs(a.pixels[ia + 1] - b.pixels[ib + 1]),
      Math.abs(a.pixels[ia + 2] - b.pixels[ib + 2]),
    )
    if (delta <= threshold) continue
    if (isExcluded(x, y)) {
      excludedDiffering += 1
      continue
    }
    differing += 1
    sumDelta += delta
    if (delta > maxDelta) maxDelta = delta
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
}

const ratio = differing / total
const report = {
  a: files[0],
  b: files[1],
  size: `${a.width}x${a.height}`,
  threshold,
  differingPixels: differing,
  totalPixels: total,
  ratio,
  ratioPercent: `${(ratio * 100).toFixed(4)}%`,
  maxChannelDelta: maxDelta,
  meanChannelDelta: differing === 0 ? 0 : Number((sumDelta / differing).toFixed(3)),
  boundingBox: maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  excludedRegions: excluded,
  excludedDifferingPixels: excludedDiffering,
}

console.log(`${files[0]}  vs  ${files[1]}`)
console.log(`  尺寸           ${report.size}`)
console.log(`  通道阈值       ${threshold}`)
console.log(`  差异像素       ${differing} / ${total}  (${report.ratioPercent})`)
console.log(`  最大通道差     ${maxDelta}`)
console.log(`  平均通道差     ${report.meanChannelDelta}`)
console.log(`  排除区域       ${excluded.length === 0 ? '（无）' : excluded.map((b) => `${b.x},${b.y} ${b.width}x${b.height}`).join('  ')}  （其中差异像素 ${excludedDiffering}，已计入上方总数、不计入下方结论）`)
console.log(`  差异包围盒     ${report.boundingBox === null ? '（无）' : JSON.stringify(report.boundingBox)}`)
console.log(differing === 0 ? '  结论           IDENTICAL ✔' : '  结论           DIFFERENT')

if (jsonOut !== undefined) {
  writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`  报告已写入     ${jsonOut}`)
}

// --dump-region x,y,w,h : print the actual pixel values in a region of both
// images, so a small difference can be identified without opening an editor.
const dumpRegion = flag('--dump-region', undefined)
if (dumpRegion !== undefined && report.boundingBox !== null) {
  const box = dumpRegion === 'diff'
    ? report.boundingBox
    : (() => {
      const [x, y, w, h] = dumpRegion.split(',').map(Number)
      return { x, y, width: w, height: h }
    })()
  console.log(`\n  区域像素明细 (${box.x},${box.y} ${box.width}x${box.height})`)
  for (let y = box.y; y < box.y + box.height; y += 1) {
    const rowA = []
    const rowB = []
    for (let x = box.x; x < box.x + box.width; x += 1) {
      const ia = y * a.stride + x * a.bpp
      const ib = y * b.stride + x * b.bpp
      rowA.push(`${a.pixels[ia]},${a.pixels[ia + 1]},${a.pixels[ia + 2]}`)
      rowB.push(`${b.pixels[ib]},${b.pixels[ib + 1]},${b.pixels[ib + 2]}`)
    }
    if (rowA.join('|') !== rowB.join('|')) {
      console.log(`   y=${y}`)
      console.log(`     A: ${rowA.join('  ')}`)
      console.log(`     B: ${rowB.join('  ')}`)
    }
  }
}

process.exit(differing === 0 ? 0 : 1)
