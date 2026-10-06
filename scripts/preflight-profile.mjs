#!/usr/bin/env node
/**
 * Pre-flight: will the client-modules loader actually pick this package up in
 * a given profile?
 *
 * This mirrors the checks @deepseek-ai/dsh-client-modules performs at profile
 * start (lib/index.js `resolveMeta()` / `clientExportOf()`), so a misconfigured
 * install is caught BEFORE a restart instead of after:
 *
 *   1. the profile lists the package in `dsh.profile.bundles` (or the package
 *      is otherwise reachable from the profile's node_modules);
 *   2. the package resolves from the profile;
 *   3. `dsh.client.platform === "web"`   (anything else is silently skipped);
 *   4. `exports["./client"]` exists and the file it points at exists;
 *   5. `dsh.client.inject` is a string array, `immediately` a boolean;
 *   6. `dsh.bundle.patch` exists and contains an `insert` row whose `name`
 *      matches the package name (the loader entry);
 *   7. `exports["."]` exists and the host half exists — without it the loader
 *      fails with ERR_PACKAGE_PATH_NOT_EXPORTED.
 *
 * Usage:
 *   node scripts/preflight-profile.mjs                      # both known profiles
 *   node scripts/preflight-profile.mjs --profile desktop
 *   node scripts/preflight-profile.mjs --profile-dir <path>
 * Exit code 0 = every check passed, 1 = at least one failed, 2 = usage/host error.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve as pathResolve } from 'node:path'
import { homedir } from 'node:os'

const args = process.argv.slice(2)
const argValue = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

const PACKAGE_NAME = 'dsh-deepseek-theme-studio'
const dshHome = process.env.DSH_HOME && process.env.DSH_HOME.length > 0
  ? process.env.DSH_HOME
  : join(homedir(), '.dsh')

const profilesDir = join(dshHome, 'profiles')
const only = argValue('--profile')
const explicitDir = argValue('--profile-dir')

let profiles = []
if (explicitDir !== undefined) {
  profiles = [{ name: pathResolve(explicitDir), dir: pathResolve(explicitDir) }]
} else {
  if (!existsSync(profilesDir)) {
    console.error(`✘ no profiles directory at ${profilesDir}`)
    process.exit(2)
  }
  profiles = readdirSync(profilesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, dir: join(profilesDir, e.name) }))
    .filter((p) => only === undefined || p.name === only)
}

if (profiles.length === 0) {
  console.error(`✘ no profile matched${only === undefined ? '' : ` "${only}"`}`)
  process.exit(2)
}

let failures = 0
const line = (ok, text) => {
  if (!ok) failures += 1
  console.log(`   ${ok ? '✔' : '✘'} ${text}`)
}

for (const profile of profiles) {
  console.log(`\n=== profile: ${profile.name}`)
  const pkgJsonPath = join(profile.dir, 'package.json')
  if (!existsSync(pkgJsonPath)) {
    console.log('   (no package.json — not an initialised profile)')
    continue
  }
  const profilePkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  const bundles = profilePkg.dsh?.profile?.bundles ?? []
  const inBundles = bundles.includes(PACKAGE_NAME)
  const inDeps = Object.hasOwn(profilePkg.dependencies ?? {}, PACKAGE_NAME)

  // Not installed at all is a normal, healthy state — not a failure.
  if (!inBundles && !inDeps) {
    console.log(`   · ${PACKAGE_NAME} 未安装（无需检查）`)
    continue
  }

  line(inBundles, `dsh.profile.bundles 含 ${PACKAGE_NAME}${inBundles ? ` (第 ${bundles.indexOf(PACKAGE_NAME) + 1}/${bundles.length} 项)` : ''}`)
  line(inDeps, `dependencies 含 ${PACKAGE_NAME}`)
  if (!inBundles) {
    console.log('   → 半安装状态：已在 dependencies 但未列入 bundles，客户端插件不会被 boot manifest 收集')
    continue
  }

  const packageDir = join(profile.dir, 'node_modules', PACKAGE_NAME)
  const linked = existsSync(packageDir) && statSync(packageDir).isDirectory()
  line(linked, `node_modules/${PACKAGE_NAME} 可解析`)
  if (!linked) continue

  const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
  line(pkg.name === PACKAGE_NAME, `包名一致 (${pkg.name}@${pkg.version})`)

  const client = pkg.dsh?.client
  line(client !== undefined, 'dsh.client 已声明')
  if (client !== undefined) {
    line(client.platform === 'web', `dsh.client.platform === "web" (实际 ${JSON.stringify(client.platform)})`)
    line(client.inject === undefined || (Array.isArray(client.inject) && client.inject.every((s) => typeof s === 'string')),
      `dsh.client.inject 是字符串数组 ${JSON.stringify(client.inject ?? [])}`)
    line(client.immediately === undefined || typeof client.immediately === 'boolean',
      `dsh.client.immediately 是布尔 ${JSON.stringify(client.immediately)}`)
  }

  const clientExport = pkg.exports?.['./client']
  const clientRel = typeof clientExport === 'string' ? clientExport : clientExport?.default
  line(typeof clientRel === 'string', `exports["./client"] 已声明 (${JSON.stringify(clientRel)})`)
  if (typeof clientRel === 'string') {
    line(existsSync(join(packageDir, clientRel)), `客户端 bundle 文件存在 (${clientRel})`)
  }

  const hostExport = pkg.exports?.['.']
  const hostRel = typeof hostExport === 'string' ? hostExport : hostExport?.default
  line(typeof hostRel === 'string', `exports["."] 已声明 (${JSON.stringify(hostRel)})`)
  if (typeof hostRel === 'string') {
    line(existsSync(join(packageDir, hostRel)),
      `服务端入口文件存在 (${hostRel}) —— 缺失会让 loader 报 ERR_PACKAGE_PATH_NOT_EXPORTED`)
  }

  const patchRel = pkg.dsh?.bundle?.patch
  line(typeof patchRel === 'string', `dsh.bundle.patch 已声明 (${JSON.stringify(patchRel)})`)
  if (typeof patchRel === 'string') {
    const patchPath = join(packageDir, patchRel)
    const hasPatch = existsSync(patchPath)
    line(hasPatch, `补丁层文件存在 (${patchRel})`)
    if (hasPatch) {
      const text = readFileSync(patchPath, 'utf8')
      const insertOk = /-\s*insert:/.test(text) && text.includes(PACKAGE_NAME)
      line(insertOk, `补丁层含 insert 条目且 name 指向本包`)
      if (!insertOk) {
        console.log('   → loader 条目缺失：插件不会被挂载')
      }
    }
  }
}

console.log(`\n${failures === 0 ? '✔ 全部检查通过：重启该 profile 后插件会进入 boot manifest' : `✘ ${failures} 项检查未通过（见上）`}`)
process.exit(failures === 0 ? 0 : 1)
