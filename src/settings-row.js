/**
 * The settings surface.
 *
 * Registered into the host's own Settings → General item slot
 * (`settings.general.item`, the same slot the stock Appearance row uses at
 * order 10), so it is a first-class settings row and never a floating panel.
 *
 * PROVENANCE
 *   The registration call shape, the `window.<ns>` + `ctx.provide` double
 *   exposure and the React-from-platform-seed pattern follow
 *   mux9056-bot/dsh-theme src/client.template.js (Apache-2.0, Copyright (c)
 *   2026 mux9056-bot) and JohnnyTing/dsh-official-homepage-theme
 *   src/client/index.js (MIT). The control set here is generated from
 *   src/params.js, so adding a parameter adds a control with no extra code.
 */

import { PARAM_DEFS, GROUP_ORDER, PARAM_NAMES } from './params.js'

export const ROW_ID = 'deepseek-theme-studio'
export const ROW_ORDER = 20

/** Row styles — host tokens only; no new radius / spacing / type scale. */
export const ROW_CSS = `
.dts-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
  font-size: var(--dsw-font-s-14);
}
.dts-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.dts-title { display: flex; align-items: baseline; gap: 8px; font-size: var(--dsw-font-s-14); font-weight: 500; }
.dts-sub { color: var(--dsw-alias-label-tertiary); font-size: var(--dsw-font-xxs-12); }
.dts-presets { display: flex; gap: 6px; flex-wrap: wrap; }
.dts-btn {
  font: inherit;
  font-size: var(--dsw-font-xxs-12);
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-sm);
  padding: 3px 10px;
  cursor: pointer;
  transition: background-color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1)),
              color var(--dts-motion-duration, 160ms) var(--dts-motion-easing, cubic-bezier(0.2,0,0,1));
}
.dts-btn:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dts-btn[data-on="true"] { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary); }
.dts-groups { display: flex; flex-direction: column; gap: 4px; }
.dts-group > summary {
  cursor: pointer;
  list-style: none;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--dsw-font-xs-13);
  padding: 6px 0;
}
.dts-group > summary::-webkit-details-marker { display: none; }
.dts-group > summary::before { content: '\\25B8  '; color: var(--dsw-alias-label-tertiary); }
.dts-group[open] > summary::before { content: '\\25BE  '; }
.dts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px 16px; padding: 4px 0 10px; }
.dts-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dts-field > label { color: var(--dsw-alias-label-secondary); font-size: var(--dsw-font-xxs-12); display: flex; justify-content: space-between; gap: 8px; }
.dts-value { color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.dts-field input[type="range"] { width: 100%; accent-color: var(--dsw-alias-brand-primary); }
.dts-field input[type="text"], .dts-field select, .dts-field textarea {
  font: inherit;
  font-size: var(--dsw-font-xxs-12);
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-sm);
  padding: 3px 6px;
  width: 100%;
  box-sizing: border-box;
}
.dts-field textarea { min-height: 72px; font-family: ui-monospace, monospace; resize: vertical; }
.dts-color { display: flex; align-items: center; gap: 6px; }
.dts-color input[type="color"] { width: 30px; height: 22px; padding: 0; border: 1px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-sm); background: transparent; }
.dts-color input[type="text"] { flex: 1; }
.dts-switch { display: flex; align-items: center; gap: 6px; padding-top: 14px; }
.dts-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.dts-hint { color: var(--dsw-alias-label-tertiary); font-size: var(--dsw-font-xxs-12); }
.dts-warn { color: var(--dsw-alias-label-secondary); font-size: var(--dsw-font-xxs-12); }
.dts-diag { margin: 0; white-space: pre-wrap; word-break: break-all; color: var(--dsw-alias-label-tertiary); font-size: var(--dsw-font-xxs-12); font-family: ui-monospace, monospace; max-height: 180px; overflow: auto; }
`

export function ensureRowCss(doc = document) {
  if (doc.getElementById('dts-settings-style') !== null) return
  const style = doc.createElement('style')
  style.id = 'dts-settings-style'
  style.dataset.plugin = 'dsh-deepseek-theme-studio'
  doc.head.appendChild(style)
  style.textContent = ROW_CSS
}

/** One control, chosen by the parameter's declared type. */
function control(h, key, def, value, onChange, zh) {
  const label = zh ? (def.zh ?? key) : (def.en ?? key)
  if (def.type === 'boolean') {
    return h('div', { className: 'dts-switch', key },
      h('input', {
        type: 'checkbox',
        id: `dts-${key}`,
        checked: value === true,
        onChange: (event) => onChange(key, event.target.checked),
      }),
      h('label', { htmlFor: `dts-${key}` }, label),
    )
  }
  if (def.type === 'number') {
    const display = def.percent
      ? `${Math.round(value * 100)}%`
      : `${value}${def.unit ? ` ${def.unit}` : ''}`
    return h('div', { className: 'dts-field', key },
      h('label', { htmlFor: `dts-${key}` }, h('span', null, label), h('span', { className: 'dts-value' }, display)),
      h('input', {
        id: `dts-${key}`,
        type: 'range',
        min: String(def.min),
        max: String(def.max),
        step: String(def.step),
        value: String(value),
        onChange: (event) => onChange(key, Number(event.target.value)),
      }),
    )
  }
  if (def.type === 'color') {
    return h('div', { className: 'dts-field', key },
      h('label', { htmlFor: `dts-${key}` }, h('span', null, label), h('span', { className: 'dts-value' }, value === '' ? '未设置' : '')),
      h('div', { className: 'dts-color' },
        h('input', {
          id: `dts-${key}`,
          type: 'color',
          value: value === '' ? '#000000' : value,
          onChange: (event) => onChange(key, event.target.value),
        }),
        h('input', {
          type: 'text',
          value,
          placeholder: '留空 = 跟随宿主',
          onChange: (event) => onChange(key, event.target.value),
        }),
        h('button', { type: 'button', className: 'dts-btn', onClick: () => onChange(key, '') }, '清除'),
      ),
    )
  }
  if (def.type === 'enum') {
    return h('div', { className: 'dts-field', key },
      h('label', { htmlFor: `dts-${key}` }, h('span', null, label)),
      h('select', {
        id: `dts-${key}`,
        value: String(value),
        onChange: (event) => onChange(key, event.target.value),
      }, def.options.map((option) => h('option', { key: option.value, value: option.value }, option.label))),
    )
  }
  return h('div', { className: 'dts-field', key },
    h('label', { htmlFor: `dts-${key}` }, h('span', null, label)),
    h('input', {
      id: `dts-${key}`,
      type: 'text',
      value: String(value),
      onChange: (event) => onChange(key, event.target.value),
    }),
  )
}

/**
 * Build the row component.
 *
 * @param React - the platform-seeded React.
 * @param controller - { getSnapshot, subscribe, set, applyPreset, reset,
 *   exportPreset, importPreset, presets, diagnosticsText }
 */
export function createSettingsRow(React, controller) {
  const h = React.createElement
  return function ThemeStudioRow() {
    const [snap, setSnap] = React.useState(controller.getSnapshot())
    const [importText, setImportText] = React.useState('')
    const [exportText, setExportText] = React.useState('')
    const [diag, setDiag] = React.useState('')
    const [note, setNote] = React.useState('')

    React.useEffect(() => controller.subscribe(() => setSnap(controller.getSnapshot())), [])

    const zh = (document.documentElement.lang || 'en').toLowerCase().startsWith('zh')
    const values = snap.values
    const onChange = (key, value) => {
      controller.set(key, value)
      setNote('')
    }

    const presets = controller.presets()
    const decorationBusy = values['appearance.opacity'] > 0.6

    const groups = GROUP_ORDER.map((group) => {
      const keys = Object.keys(PARAM_DEFS).filter((key) => PARAM_DEFS[key].group === group.id)
      if (keys.length === 0) return null
      const enabledKey = keys.find((key) => PARAM_DEFS[key].type === 'boolean' && key.endsWith('Enabled'))
      const open = enabledKey === undefined ? true : values[enabledKey] === true
      return h('details', { className: 'dts-group', key: group.id, open },
        h('summary', null, `${zh ? group.zh : group.en} · ${keys.length}`),
        h('div', { className: 'dts-grid' }, keys.map((key) => control(h, key, PARAM_DEFS[key], values[key], onChange, zh))),
      )
    })

    return h('section', { className: 'dts-settings', 'data-dts-settings': '' },
      h('div', { className: 'dts-head' },
        h('div', { className: 'dts-title' },
          h('span', null, zh ? 'DeepSeek 官网主题工作台' : 'DeepSeek official theme studio'),
          h('span', { className: 'dts-sub' }, `${PARAM_NAMES.length} ${zh ? '项参数' : 'parameters'}`),
        ),
        h('div', { className: 'dts-presets' },
          presets.map((preset) => h('button', {
            key: preset.id,
            type: 'button',
            className: 'dts-btn',
            'data-on': String(snap.preset === preset.id),
            onClick: () => { controller.applyPreset(preset.id); setNote('') },
          }, zh ? preset.label : preset.labelEn)),
          h('button', {
            type: 'button',
            className: 'dts-btn',
            onClick: () => { controller.reset(); setNote(zh ? '已还原出厂默认（当前默认即你保存的样式）' : 'Restored shipped defaults') },
          }, zh ? '还原默认' : 'Restore defaults'),
        ),
      ),
      snap.error ? h('div', { className: 'dts-warn' }, snap.error) : null,
      h('div', { className: 'dts-hint' },
        snap.hostAvailable
          ? (zh ? `参数文件：${snap.hostPath || '(已连接)'}（手工编辑后自动热加载）` : `Parameter file: ${snap.hostPath || 'connected'}`)
          : (zh ? '未连接参数文件，当前仅使用浏览器本地存储' : 'Parameter file unavailable; using browser storage only'),
      ),
      decorationBusy
        ? h('div', { className: 'dts-warn' }, zh ? '装饰层不透明度超过 60%，观感会变吵（简洁预算建议 ≤ 60%）' : 'Decoration opacity is above 60%')
        : null,
      h('div', { className: 'dts-groups' }, groups),
      h('div', { className: 'dts-field' },
        h('label', null, h('span', null, zh ? '导出 / 导入预设' : 'Export / import preset')),
        h('textarea', {
          value: exportText || importText,
          placeholder: zh ? '点击“导出”填入当前参数；粘贴 JSON 后点“导入”' : 'Click Export, or paste a preset JSON',
          onChange: (event) => { setImportText(event.target.value); setExportText('') },
        }),
        h('div', { className: 'dts-presets' },
          h('button', {
            type: 'button',
            className: 'dts-btn',
            onClick: () => { setExportText(controller.exportPreset()); setImportText(''); setNote('') },
          }, zh ? '导出' : 'Export'),
          h('button', {
            type: 'button',
            className: 'dts-btn',
            onClick: () => {
              try {
                const result = controller.importPreset(importText)
                setNote(zh
                  ? `已导入 ${result.applied} 项${result.unknown.length > 0 ? `，忽略未知项 ${result.unknown.length} 个` : ''}`
                  : `Imported ${result.applied} values`)
                setImportText('')
              } catch (error) {
                setNote(String(error.message ?? error))
              }
            },
          }, zh ? '导入' : 'Import'),
          h('button', {
            type: 'button',
            className: 'dts-btn',
            onClick: () => { setDiag(controller.diagnosticsText()) },
          }, zh ? '自检 / 诊断' : 'Self-check'),
        ),
      ),
      note ? h('div', { className: 'dts-hint' }, note) : null,
      diag ? h('pre', { className: 'dts-diag' }, diag) : null,
    )
  }
}
