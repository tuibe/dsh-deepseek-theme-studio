/**
 * Host contract registry + drift self-check.
 *
 * Two classes of host fact this plugin depends on, both of which the host may
 * change without warning:
 *
 *   1. design tokens (`--dsw-*` / `--dsh-*` / `--shiki-*`)
 *   2. DOM hooks (the stable data-attributes and CSS-module local-name
 *      suffixes the plugin anchors to)
 *
 * Both are registered here exactly once and verified at runtime, because this
 * host build already broke a published plugin: dsh-unknown-theme anchors on
 * `.hHd-Xa_newSession` and `.nL4_yW_sessionLogButton`, neither of which exists
 * in 0.2.0-rc.2 (see REUSE.md §0.2). A typo or a host upgrade must be
 * *reported*, never silently ignored.
 */

/**
 * Every token the plugin reads or writes.
 * Verified against host 0.2.0-rc.2 by scripts/verify-tokens.mjs.
 */
export const TOKENS_USED = [
  // surface / text — the settings row and the effects' fallback colours
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-layer-3',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary',
  '--dsw-alias-label-tertiary',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-interactive-bg-hover',
  '--dsw-alias-brand-primary',
  '--dsw-alias-bg-multi-select',
  '--dsw-alias-scrollbar-bg-l1',
  '--dsw-alias-scrollbar-hover-l1',
  '--dsw-specific-sidebar-fill',
  // geometry / typography — reused instead of inventing a second scale
  '--dsw-radius-sm',
  '--dsw-radius-md',
  '--dsw-radius-lg',
  '--dsw-font-s-14',
  '--dsw-font-xs-13',
  '--dsw-font-xxs-12',
  '--dsw-font-family',
]

/** Tokens the plugin *writes* (all removed again on dispose). */
export const TOKENS_WRITTEN = [
  '--dsw-alias-bg-base',
  '--dsw-alias-brand-primary',
  '--dts-decoration-opacity',
  '--dts-motion-duration',
  '--dts-motion-easing',
]

/**
 * DOM hooks, with the reason each one is believed stable.
 * `optional: true` means a zero match is acceptable (the surface may simply
 * not be mounted), but it is still reported.
 */
export const DOM_HOOKS = [
  { selector: '[data-composer-card]', what: '输入卡 / composer card', optional: false },
  { selector: '[class*="_userStack"] [class*="_bubble"]', what: '用户消息气泡', optional: true },
  { selector: '[class*="_newSession"]', what: '侧栏新会话按钮', optional: true },
  { selector: '[data-slot="settings.general.item"]', what: '设置页 General 槽位容器（仅设置页打开时存在）', optional: true },
  { selector: '[data-conversation-scroll]', what: '会话滚动容器（粒子挂载点）', optional: true },
  { selector: '[data-composer-seat]', what: '输入卡座位（流体叠层基准）', optional: true },
]

/** Read one token's live value from the running document. */
export function readToken(name, element = document.documentElement) {
  const value = getComputedStyle(element).getPropertyValue(name)
  return value === null ? '' : value.trim()
}

/**
 * Run the runtime contract check.
 *
 * @param options.tokens - token names to verify (defaults to TOKENS_USED).
 * @param options.hooks - DOM hooks to verify (defaults to DOM_HOOKS).
 * @returns a report object; `ok` is false when anything required is missing.
 */
export function selfCheck(options = {}) {
  const tokens = options.tokens ?? TOKENS_USED
  const hooks = options.hooks ?? DOM_HOOKS
  const root = document.documentElement
  const body = document.body

  const tokenReport = tokens.map((name) => {
    const onRoot = readToken(name, root)
    const onBody = readToken(name, body)
    const value = onRoot || onBody
    return { name, found: value !== '', value: value.slice(0, 60) }
  })

  const hookReport = hooks.map((hook) => {
    let count = 0
    try {
      count = document.querySelectorAll(hook.selector).length
    } catch {
      count = -1 // invalid selector — a hard failure, not a zero match
    }
    return { ...hook, count, ok: count > 0 || hook.optional === true }
  })

  const missingTokens = tokenReport.filter((t) => !t.found).map((t) => t.name)
  const invalidSelectors = hookReport.filter((h) => h.count === -1).map((h) => h.selector)
  const missingHooks = hookReport.filter((h) => h.count === 0 && h.optional !== true).map((h) => h.selector)

  return {
    ok: missingTokens.length === 0 && invalidSelectors.length === 0 && missingHooks.length === 0,
    tokens: tokenReport,
    tokensFound: tokenReport.filter((t) => t.found).length,
    tokensTotal: tokenReport.length,
    hooks: hookReport,
    missingTokens,
    invalidSelectors,
    missingHooks,
  }
}

/** One-line human summary of a self-check report. */
export function formatSelfCheck(report) {
  const lines = []
  lines.push(`令牌自检：${report.tokensFound}/${report.tokensTotal} 命中运行实例真实 CSS`)
  if (report.missingTokens.length > 0) lines.push(`  缺失令牌：${report.missingTokens.join(', ')}`)
  for (const hook of report.hooks) {
    const flag = hook.count > 0 ? '✔' : hook.optional ? '·' : '✘'
    lines.push(`  ${flag} ${hook.selector} → ${hook.count < 0 ? '选择器非法' : `${hook.count} 个`}  (${hook.what})`)
  }
  if (report.invalidSelectors.length > 0) lines.push(`  非法选择器：${report.invalidSelectors.join(', ')}`)
  if (report.missingHooks.length > 0) lines.push(`  必需钩子未命中：${report.missingHooks.join(', ')}`)
  return lines.join('\n')
}
