/**
 * Parameter schema — the single source of truth for the whole plugin.
 *
 * Every visual constant the plugin can produce is declared here exactly once,
 * and everything else is derived from this table:
 *   - the settings-row controls (src/settings-row.js)
 *   - the programmatic API surface (src/api.js)
 *   - the JSON parameter file keys (lib/index.js reads/writes the same names)
 *   - the localStorage seed keys (prefix + name)
 *
 * There is deliberately no value anywhere else in the plugin: if it is not in
 * this table it cannot be rendered. That is what "no locked-in boilerplate"
 * means here — see REUSE.md §0.4.3.
 *
 * Key naming: dotted, flat. Flat keeps hand-editing theme-studio.json and the
 * host's shallow JSON merge trivial, and keeps every persistence key stable
 * and greppable.
 */

/** localStorage prefix. The JSON file uses the bare dotted key. */
export const STORAGE_PREFIX = 'dsh-deepseek-theme-studio:'

/**
 * The shipped entry presets.
 *
 * `native` is the "exactly like DSH" state and is the escape hatch that keeps
 * the pixel-for-pixel restore guarantee intact. `blue-white` is the SHIPPED
 * DEFAULT look (user-directed design): blue-white fluid background, the whale
 * blended into that background, frosted-glass panels, and hover lift.
 */

/**
 * Easing choices. All three are "fast out, slow in" and none overshoot
 * (every y control point stays inside [0, 1]), per the animation spec.
 */
export const EASINGS = [
  { value: 'cubic-bezier(0.2, 0, 0, 1)', label: '快出慢收（默认）' },
  { value: 'cubic-bezier(0.4, 0, 0.2, 1)', label: '标准' },
  { value: 'cubic-bezier(0, 0, 0.2, 1)', label: '减速' },
  { value: 'linear', label: '线性' },
]

/**
 * The glass whitelist. Slots are targets, not a global override: nothing
 * outside this list ever receives backdrop-filter.
 *
 * Slot 4 honesty note: on host 0.2.0-rc.2 there is no "session log button" in
 * the chrome. The session-log surface is a Settings → General row rendered by
 * @deepseek-ai/dsh-client-ui-settings-session-log whose control is the Switch
 * primitive; the class `nL4_yW_sessionLogButton` that dsh-unknown-theme
 * targeted does not exist in this host build (verified by extracting the
 * CSS-module class map of all 51 host client bundles — see REUSE.md §0.5).
 * The default therefore points at the real control and stays user-editable.
 */
export const GLASS_SLOTS = [
  {
    key: 'glass.slot.composer',
    label: '输入卡',
    labelEn: 'Composer card',
    selector: '[data-composer-card]',
    defaultOn: true,
  },
  {
    key: 'glass.slot.bubble',
    label: '用户消息气泡',
    labelEn: 'User message bubble',
    selector: '[class*="_userStack"] [class*="_bubble"]',
    defaultOn: true,
  },
  {
    key: 'glass.slot.sidebar',
    label: '侧栏按钮',
    labelEn: 'Sidebar buttons',
    selector: 'button[class*="_newSession"]',
    defaultOn: true,
  },
  {
    key: 'glass.slot.sessionlog',
    label: '会话日志控件',
    labelEn: 'Session-log control',
    selector: '[data-slot="settings.general.item"] [role="switch"]',
    defaultOn: false,
  },
  {
    key: 'glass.slot.dialog',
    label: '设置/面板页',
    labelEn: 'Settings & panel pages',
    // The settings surface of host 0.2.0-rc.2 is [role="dialog"].<panel>
    // (measured: opaque rgb(44,44,46), no backdrop-filter), so the glass goes
    // on the dialog itself. Slot targets are the user's explicit choice, so
    // the containment guard only refuses the layout columns and body/html.
    selector: '[role="dialog"]',
    defaultOn: true,
  },
]

/** Hard cap on simultaneously glassed elements (spec: ≤ 6 on screen). */
export const GLASS_MAX_TARGETS = 6

/** Above this decoration opacity the settings row shows a "busy" hint. */
export const DECORATION_OPACITY_BUDGET = 0.6

function slotDefaults() {
  const out = {}
  for (const slot of GLASS_SLOTS) {
    out[slot.key] = slot.defaultOn
    out[`${slot.key}.selector`] = slot.selector
  }
  return out
}

/**
 * The parameter table.
 *
 * type:    'boolean' | 'number' | 'color' | 'enum' | 'text'
 * default: value used when nothing is stored (must equal the shipped default)
 * min/max/step: only for type 'number'
 * options: for type 'enum' — [{ value, label }]
 */
export const PARAM_DEFS = {
  // ── 外观模式 ────────────────────────────────────────────────────────────
  'appearance.mode': {
    type: 'enum', group: 'appearance', default: 'light',
    options: [
      { value: 'system', label: '跟随系统' },
      { value: 'light', label: '浅色' },
      { value: 'dark', label: '深色' },
    ],
    zh: '外观模式', en: 'Appearance mode',
  },

  // ── 背景 ────────────────────────────────────────────────────────────────
  'appearance.backgroundMode': {
    type: 'enum', group: 'background', default: 'fluid',
    options: [
      { value: 'solid', label: '纯色' },
      { value: 'gradient', label: '渐变' },
      { value: 'fluid', label: '流体' },
    ],
    zh: '背景模式', en: 'Background mode',
  },
  'appearance.bgColor': { type: 'color', group: 'background', default: '#f2f7ff', zh: '底色', en: 'Base color' },
  'appearance.accentColor': { type: 'color', group: 'background', default: '#4176e6', zh: '强调色', en: 'Accent color' },
  'appearance.palette1': { type: 'color', group: 'background', default: '#dce9ff', zh: '流体色 1', en: 'Fluid color 1' },
  'appearance.palette2': { type: 'color', group: 'background', default: '#b4d2f2', zh: '流体色 2', en: 'Fluid color 2' },
  'appearance.palette3': { type: 'color', group: 'background', default: '#ffffff', zh: '流体色 3', en: 'Fluid color 3' },
  'appearance.palette4': { type: 'color', group: 'background', default: '#8ab2e2', zh: '流体色 4', en: 'Fluid color 4' },
  'appearance.palette5': { type: 'color', group: 'background', default: '#e6f0ff', zh: '流体色 5', en: 'Fluid color 5' },
  'appearance.opacity': {
    type: 'number', group: 'background', default: 0.68, min: 0, max: 1, step: 0.01, percent: true,
    zh: '装饰层不透明度', en: 'Decoration opacity',
  },
  'appearance.gradientAngle': {
    type: 'number', group: 'background', default: 180, min: 0, max: 360, step: 1, unit: 'deg',
    zh: '渐变角度', en: 'Gradient angle',
  },
  'appearance.surfaces': {
    type: 'boolean', group: 'background', default: true,
    zh: '宿主表面透明（让背景透出）', en: 'Translucent host surfaces',
  },

  // ── 液化（流体） ────────────────────────────────────────────────────────
  'fluid.enabled': { type: 'boolean', group: 'fluid', default: true, zh: '启用流体背景', en: 'Fluid background' },
  'fluid.speed': {
    type: 'number', group: 'fluid', default: 0.28, min: 0, max: 2, step: 0.05, unit: '×',
    zh: '流速', en: 'Flow speed',
  },
  'fluid.scale': {
    type: 'number', group: 'fluid', default: 1.46, min: 0.2, max: 4, step: 0.01,
    zh: '噪声波长（形状宽窄）', en: 'Noise scale (shape width)',
  },
  'fluid.radius': {
    type: 'number', group: 'fluid', default: 194, min: 0, max: 300, step: 1, unit: 'px',
    zh: '指针扰动半径', en: 'Pointer disturbance radius',
  },
  'fluid.distort': {
    type: 'number', group: 'fluid', default: 1.7, min: 0, max: 6, step: 0.05,
    zh: '域扭曲强度', en: 'Domain-warp strength',
  },
  'fluid.swirl': {
    type: 'number', group: 'fluid', default: 0.8, min: 0, max: 3, step: 0.05,
    zh: '卷曲强度', en: 'Swirl strength',
  },
  'fluid.grain': {
    type: 'number', group: 'fluid', default: 0.005, min: 0, max: 0.05, step: 0.001,
    zh: '颗粒噪点', en: 'Grain',
  },
  'fluid.glow': {
    type: 'number', group: 'fluid', default: 0.13, min: 0, max: 0.6, step: 0.01,
    zh: '指针光晕', en: 'Pointer glow',
  },
  'fluid.vignette': {
    type: 'number', group: 'fluid', default: 0.38, min: 0, max: 1, step: 0.01,
    zh: '暗角', en: 'Vignette',
  },
  'fluid.blur': {
    type: 'number', group: 'fluid', default: 3, min: 0, max: 24, step: 1, unit: 'px',
    zh: '流体柔化模糊', en: 'Fluid softening blur',
  },
  'fluid.flowmap': { type: 'boolean', group: 'fluid', default: true, zh: '指针流场扰动', en: 'Pointer flow map' },

  // ── 毛玻璃 ──────────────────────────────────────────────────────────────
  'glass.enabled': { type: 'boolean', group: 'glass', default: true, zh: '启用毛玻璃', en: 'Frosted glass' },
  'glass.blur': {
    type: 'number', group: 'glass', default: 20, min: 0, max: 40, step: 1, unit: 'px',
    zh: '模糊半径', en: 'Blur radius',
  },
  'glass.tintDark': { type: 'color', group: 'glass', default: '#000000', zh: '深色 tint', en: 'Dark tint' },
  'glass.tintDarkAlpha': {
    type: 'number', group: 'glass', default: 0.19, min: 0, max: 1, step: 0.01,
    zh: '深色 tint 浓度', en: 'Dark tint alpha',
  },
  'glass.tintLight': { type: 'color', group: 'glass', default: '#f7f7f7', zh: '浅色 tint', en: 'Light tint' },
  'glass.tintLightAlpha': {
    type: 'number', group: 'glass', default: 0.55, min: 0, max: 1, step: 0.01,
    zh: '浅色 tint 浓度', en: 'Light tint alpha',
  },
  'glass.borderAlpha': {
    type: 'number', group: 'glass', default: 0.08, min: 0, max: 1, step: 0.01,
    zh: '描边透明度（深色模式）', en: 'Border alpha (dark)',
  },
  'glass.borderColorLight': {
    type: 'color', group: 'glass', default: '#0f1115',
    zh: '描边颜色（浅色模式）', en: 'Border colour (light)',
  },
  'glass.borderAlphaLight': {
    type: 'number', group: 'glass', default: 0.31, min: 0, max: 1, step: 0.01,
    zh: '描边透明度（浅色模式）', en: 'Border alpha (light)',
  },
  'glass.saturation': {
    type: 'number', group: 'glass', default: 1, min: 0, max: 2, step: 0.05, unit: '×',
    zh: '饱和度', en: 'Saturation',
  },
  'glass.composerTintAlpha': {
    type: 'number', group: 'glass', default: 0.3, min: 0, max: 1, step: 0.01,
    zh: '输入卡 tint 浓度（最底层）', en: 'Composer tint alpha (bottom layer)',
  },
  'glass.panelTintAlpha': {
    type: 'number', group: 'glass', default: 1, min: 0, max: 1, step: 0.01,
    zh: '面板/设置页 tint 浓度', en: 'Panel tint alpha',
  },
  'glass.panelShadowY': {
    type: 'number', group: 'glass', default: 10, min: 0, max: 30, step: 1, unit: 'px',
    zh: '面板投影 Y 偏移', en: 'Panel shadow offset Y',
  },
  'glass.panelShadowBlur': {
    type: 'number', group: 'glass', default: 36, min: 0, max: 96, step: 2, unit: 'px',
    zh: '面板投影模糊', en: 'Panel shadow blur',
  },
  'glass.panelShadowAlpha': {
    type: 'number', group: 'glass', default: 0.57, min: 0, max: 1, step: 0.01,
    zh: '面板投影浓度（0 = 回到无阴影）', en: 'Panel shadow alpha (0 = flat)',
  },
  'glass.panelShadowColor': {
    type: 'color', group: 'glass', default: '#3b5887',
    zh: '面板投影颜色', en: 'Panel shadow colour',
  },
  'glass.panelHighlight': {
    type: 'number', group: 'glass', default: 0.58, min: 0, max: 1, step: 0.01,
    zh: '面板顶部内高光', en: 'Panel top inner highlight',
  },
  'glass.panelSaturation': {
    type: 'number', group: 'glass', default: 1.05, min: 0, max: 2, step: 0.05, unit: '×',
    zh: '面板饱和度', en: 'Panel saturation',
  },
  'glass.panelScrim': {
    type: 'number', group: 'glass', default: 0.04, min: 0, max: 0.9, step: 0.01,
    zh: '面板外遮罩浓度（0 = 主页面完全不变）', en: 'Scrim behind panels (0 = page untouched)',
  },
  'glass.panelBlur': {
    type: 'number', group: 'glass', default: 40, min: 0, max: 80, step: 1, unit: 'px',
    zh: '面板/设置页模糊半径', en: 'Panel blur radius',
  },

  // ── 量子化 Q1 空间 ──────────────────────────────────────────────────────
  'quantum.q1Enabled': { type: 'boolean', group: 'quantum', default: false, zh: 'Q1 空间量子化（点阵网格）', en: 'Q1 Spatial quantisation' },
  'quantum.q1Spacing': {
    type: 'number', group: 'quantum', default: 90, min: 24, max: 160, step: 1, unit: 'px',
    zh: '栅格间距', en: 'Grid spacing',
  },
  'quantum.q1Radius': {
    type: 'number', group: 'quantum', default: 140, min: 0, max: 300, step: 1, unit: 'px',
    zh: '斥力半径', en: 'Repulsion radius',
  },
  'quantum.q1Spring': {
    type: 'number', group: 'quantum', default: 0.05, min: 0.005, max: 0.3, step: 0.005,
    zh: '弹簧回弹', en: 'Spring return',
  },
  'quantum.q1Damping': {
    type: 'number', group: 'quantum', default: 0.85, min: 0.5, max: 0.99, step: 0.01,
    zh: '阻尼', en: 'Damping',
  },
  'quantum.q1LineOpacity': {
    type: 'number', group: 'quantum', default: 0.08, min: 0, max: 0.6, step: 0.01,
    zh: '网格线不透明度', en: 'Line opacity',
  },
  'quantum.q1PointOpacity': {
    type: 'number', group: 'quantum', default: 0.08, min: 0, max: 0.6, step: 0.01,
    zh: '节点不透明度', en: 'Node opacity',
  },
  'quantum.q1ActivePoint': {
    type: 'number', group: 'quantum', default: 2.2, min: 1, max: 8, step: 0.1, unit: 'px',
    zh: '命中节点半径', en: 'Active node radius',
  },
  'quantum.q1Color': { type: 'color', group: 'quantum', default: '#ffffff', zh: '点阵颜色', en: 'Grid color' },

  // ── 量子化 Q2 颜色 ──────────────────────────────────────────────────────
  'quantum.q2Enabled': { type: 'boolean', group: 'quantum', default: false, zh: 'Q2 颜色量子化（色阶）', en: 'Q2 Colour quantisation' },
  'quantum.q2Levels': {
    type: 'number', group: 'quantum', default: 8, min: 2, max: 16, step: 1, unit: '阶',
    zh: '色阶数', en: 'Levels',
  },
  'quantum.q2Dither': {
    type: 'number', group: 'quantum', default: 0.4, min: 0, max: 1, step: 0.05,
    zh: 'Bayer 抖动强度', en: 'Bayer dither strength',
  },

  // ── 量子化 Q3 形态 ──────────────────────────────────────────────────────
  'quantum.q3Enabled': { type: 'boolean', group: 'quantum', default: true, zh: 'Q3 形态量子化（粒子鲸鱼）', en: 'Q3 Morph quantisation' },
  'quantum.q3Placement': {
    type: 'enum', group: 'quantum', default: 'background',
    options: [
      { value: 'background', label: '融入背景（水印）' },
      { value: 'content', label: '会话区内浮动' },
    ],
    zh: '装饰图形位置', en: 'Decoration placement',
  },
  'quantum.q3WatermarkOpacity': {
    type: 'number', group: 'quantum', default: 0.28, min: 0.02, max: 0.9, step: 0.01,
    zh: '背景水印不透明度', en: 'Background watermark opacity',
  },
  'quantum.q3WatermarkAnchor': {
    type: 'enum', group: 'quantum', default: 'content',
    options: [
      { value: 'content', label: '内容区居中（避开侧栏）' },
      { value: 'viewport', label: '窗口居中' },
    ],
    zh: '背景水印居中基准', en: 'Watermark anchor',
  },
  'quantum.q3WatermarkOffsetX': {
    type: 'number', group: 'quantum', default: 0, min: -500, max: 500, step: 1, unit: 'px',
    zh: '水印水平微调', en: 'Watermark offset X',
  },
  'quantum.q3WatermarkOffsetY': {
    type: 'number', group: 'quantum', default: 0, min: -400, max: 400, step: 1, unit: 'px',
    zh: '水印垂直微调', en: 'Watermark offset Y',
  },
  'quantum.q3WatermarkColor': {
    type: 'color', group: 'quantum', default: '#5b8dd0',
    zh: '背景水印颜色', en: 'Background watermark colour',
  },
  'quantum.q3WatermarkBreath': {
    type: 'number', group: 'quantum', default: 0.45, min: 0, max: 1, step: 0.05,
    zh: '水印呼吸幅度（自动动画）', en: 'Watermark breathing (idle animation)',
  },
  'quantum.q3WatermarkBreathPeriod': {
    type: 'number', group: 'quantum', default: 11, min: 3, max: 40, step: 0.5, unit: 's',
    zh: '水印呼吸周期', en: 'Watermark breathing period',
  },
  'quantum.q3WatermarkScale': {
    type: 'number', group: 'quantum', default: 0.62, min: 0.2, max: 1.2, step: 0.01,
    zh: '背景水印大小', en: 'Background watermark size',
  },
  'quantum.q3Count': {
    type: 'number', group: 'quantum', default: 1400, min: 200, max: 6000, step: 50, unit: '粒',
    zh: '粒子总数', en: 'Particle count',
  },
  'quantum.q3Assemble': {
    type: 'number', group: 'quantum', default: 1200, min: 300, max: 4000, step: 50, unit: 'ms',
    zh: '成形时间', en: 'Assemble time',
  },
  'quantum.q3Scatter': {
    type: 'number', group: 'quantum', default: 22, min: 4, max: 60, step: 1, unit: 's',
    zh: '打散后回正时间', en: 'Re-form time after scatter',
  },
  'quantum.q3Size': {
    type: 'number', group: 'quantum', default: 1.4, min: 0.5, max: 4, step: 0.1, unit: 'px',
    zh: '粒子半径', en: 'Particle radius',
  },
  'quantum.q3Color': { type: 'color', group: 'quantum', default: '#ffffff', zh: '粒子颜色', en: 'Particle colour' },
  'quantum.q3Repel': {
    type: 'number', group: 'quantum', default: 19, min: 0, max: 120, step: 1, unit: 'px',
    zh: '指针斥力半径', en: 'Pointer repel radius',
  },
  'quantum.q3Shape': {
    type: 'enum', group: 'quantum', default: 'whale',
    options: [
      { value: 'whale', label: '鲸鱼' },
      { value: 'ring', label: '圆环' },
      { value: 'wave', label: '波纹' },
    ],
    zh: '装饰图形', en: 'Decoration shape',
  },

  // ── 量子化 Q4 状态 ──────────────────────────────────────────────────────
  'quantum.q4Enabled': { type: 'boolean', group: 'quantum', default: false, zh: 'Q4 状态量子化（阶梯强度）', en: 'Q4 State quantisation' },
  'quantum.q4Steps': {
    type: 'number', group: 'quantum', default: 8, min: 2, max: 16, step: 1, unit: '档',
    zh: '档位数', en: 'Steps',
  },
  'quantum.q4Target': {
    type: 'enum', group: 'quantum', default: 'pointer',
    options: [
      { value: 'pointer', label: '指针强度' },
      { value: 'ambient', label: '环境强度' },
      { value: 'scroll', label: '滚动进度' },
    ],
    zh: '量化对象', en: 'Quantised signal',
  },

  // ── 动画 ────────────────────────────────────────────────────────────────
  'motion.enabled': { type: 'boolean', group: 'motion', default: true, zh: '动画总开关', en: 'Animations' },
  'motion.duration': {
    type: 'number', group: 'motion', default: 160, min: 80, max: 400, step: 10, unit: 'ms',
    zh: '统一时长', en: 'Duration',
  },
  'motion.easing': {
    type: 'enum', group: 'motion', default: 'cubic-bezier(0.2, 0, 0, 1)',
    options: EASINGS,
    zh: '缓动曲线', en: 'Easing',
  },

  // ── 互动动画（悬停弹起 / 按压下沉 / 面板入场） ──────────────────────────
  'motion.hoverEnabled': {
    type: 'boolean', group: 'motion', default: true,
    zh: '悬停弹起放大', en: 'Hover lift & scale',
  },
  'motion.hoverLift': {
    type: 'number', group: 'motion', default: 5, min: 0, max: 14, step: 0.5, unit: 'px',
    zh: '悬停上浮距离', en: 'Hover lift',
  },
  'motion.hoverScale': {
    type: 'number', group: 'motion', default: 1.045, min: 1, max: 1.16, step: 0.005, unit: '×',
    zh: '悬停放大倍率', en: 'Hover scale',
  },
  'motion.pressScale': {
    type: 'number', group: 'motion', default: 0.985, min: 0.9, max: 1, step: 0.005, unit: '×',
    zh: '按压下沉倍率', en: 'Press scale',
  },
  'motion.panelEnter': {
    type: 'number', group: 'motion', default: 200, min: 0, max: 400, step: 10, unit: 'ms',
    zh: '面板入场时长', en: 'Panel enter duration',
  },
  'motion.composerScale': {
    type: 'number', group: 'motion', default: 1.04, min: 1, max: 1.2, step: 0.005, unit: '×',
    zh: '输入卡聚焦放大（更强）', en: 'Composer focus scale',
  },
  'motion.scopeToDialog': {
    type: 'boolean', group: 'motion', default: true,
    zh: '面板打开时动画只作用于该面板', en: 'Scope animations to an open panel',
  },
  'motion.hoverTargets': {
    type: 'text', group: 'motion',
    default: 'button:not(:disabled), [role="button"], [role="treeitem"], [role="menuitem"], [role="tab"], [role="option"], [role="switch"], [data-composer-card], [class*="_card"]:not([class*="dts-"]), [class*="_chip"], [class*="_tile"], [class*="_cell"], [class*="_navCell"], [class*="_entry"]:not([class*="dts-"]), [class*="_row"][role], [class*="_pill"]',
    zh: '悬停动画作用元素', en: 'Hover targets',
  },

  // ── 聚光灯 ──────────────────────────────────────────────────────────────
  'spotlight.enabled': { type: 'boolean', group: 'spotlight', default: false, zh: '标题聚光灯', en: 'Title spotlight' },
  'spotlight.size': {
    type: 'number', group: 'spotlight', default: 50, min: 16, max: 200, step: 2, unit: 'px',
    zh: '光斑直径', en: 'Spotlight size',
  },
  'spotlight.color': { type: 'color', group: 'spotlight', default: '#ffffff', zh: '光斑颜色', en: 'Spotlight colour' },
  'spotlight.selector': {
    type: 'text', group: 'spotlight', default: '[data-conversation-header] h1, [data-conversation-header] h2, [class*="_headline"]',
    zh: '触发元素选择器', en: 'Trigger selector',
  },
}

// ── derived helpers ────────────────────────────────────────────────────────

/** Every glass slot toggle + its selector, folded into the table. */
for (const slot of GLASS_SLOTS) {
  PARAM_DEFS[slot.key] = {
    type: 'boolean', group: 'glass', default: slot.defaultOn, zh: slot.label, en: slot.labelEn,
    slot: true,
  }
  PARAM_DEFS[`${slot.key}.selector`] = {
    type: 'text', group: 'glass', default: slot.selector, zh: `${slot.label} 选择器`, en: `${slot.labelEn} selector`,
    slotSelector: true,
  }
}

/** All parameter names, in table order. */
export const PARAM_NAMES = Object.keys(PARAM_DEFS)
/**
 * The genuinely-native state, DEFINED EXPLICITLY rather than derived from the
 * defaults.
 *
 * These are different things once the shipped defaults are a styled look: the
 * defaults describe how the plugin should look on first run, while this
 * describes how the host looks with the plugin doing nothing at all. Keeping
 * them apart is what preserves "restore native ⇒ pixel diff = 0".
 */
export const NATIVE_VALUES = (() => {
  const out = {}
  for (const [key, def] of Object.entries(PARAM_DEFS)) {
    if (def.type === 'boolean') out[key] = false
    else if (def.type === 'color') out[key] = ''
    else out[key] = def.default
  }
  out['appearance.mode'] = 'system'
  out['appearance.backgroundMode'] = 'solid'
  out['appearance.bgColor'] = ''
  out['appearance.accentColor'] = ''
  out['motion.hoverEnabled'] = false
  return out
})()

/** The default value of every parameter (the shipped, pristine state). */
export function defaults() {
  const out = {}
  for (const [key, def] of Object.entries(PARAM_DEFS)) out[key] = def.default
  return out
}

/** Clamp / coerce one raw value against its definition. Returns default when invalid. */
export function coerce(key, raw) {
  const def = PARAM_DEFS[key]
  if (def === undefined) return undefined
  if (raw === undefined || raw === null || raw === '') {
    // Empty string is the documented "unset" marker for colours: keep it so
    // "native base colour" stays distinguishable from an explicit value.
    return def.type === 'color' ? '' : def.default
  }
  switch (def.type) {
    case 'boolean':
      return raw === true || raw === 'true' || raw === 1 || raw === '1'
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw))
      if (!Number.isFinite(n)) return def.default
      return Math.min(def.max, Math.max(def.min, n))
    }
    case 'enum': {
      const values = def.options.map((o) => o.value)
      return values.includes(raw) ? raw : def.default
    }
    case 'color': {
      const s = String(raw).trim()
      // Accept #rgb / #rrggbb / #rrggbbaa; anything else is rejected rather
      // than silently stored, so the JSON file stays honest.
      return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s) ? s.toLowerCase() : def.default
    }
    default:
      return typeof raw === 'string' ? raw : String(raw)
  }
}

/** Coerce a whole patch, dropping unknown keys. */
export function coercePatch(patch) {
  const out = {}
  if (patch === null || typeof patch !== 'object') return out
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(PARAM_DEFS, key)) continue
    out[key] = coerce(key, value)
  }
  return out
}

/** Human label for one parameter. */
export function labelOf(key) {
  const def = PARAM_DEFS[key]
  if (def === undefined) return key
  return def.zh ?? def.en ?? key
}

/** Group order used by the settings row. */
export const GROUP_ORDER = [
  { id: 'appearance', zh: '外观模式', en: 'Appearance' },
  { id: 'background', zh: '背景', en: 'Background' },
  { id: 'fluid', zh: '液化（流体）', en: 'Fluid' },
  { id: 'glass', zh: '毛玻璃', en: 'Frosted glass' },
  { id: 'quantum', zh: '量子化', en: 'Quantisation' },
  { id: 'spotlight', zh: '聚光灯', en: 'Spotlight' },
  { id: 'motion', zh: '动画', en: 'Motion' },
]

/** Parameters whose value counts as a "decoration colour" (for the ≤3 budget). */
export const DECORATION_COLOR_KEYS = [
  'appearance.palette1', 'appearance.palette2', 'appearance.palette3',
  'appearance.palette4', 'appearance.palette5',
  'quantum.q1Color', 'quantum.q3Color', 'spotlight.color',
]

export const PRESETS = {
  native: {
    label: '原生',
    labelEn: 'Native',
    // The explicit all-off state: restores the host pixel-for-pixel.
    values: NATIVE_VALUES,
  },
  'blue-white': {
    label: '蓝白（默认）',
    labelEn: 'Blue-white (default)',
    values: {
      'appearance.mode': 'light',
      'appearance.backgroundMode': 'fluid',
      'appearance.opacity': 0.68,
      'appearance.bgColor': '#f2f7ff',
      'appearance.accentColor': '#4176e6',
      'appearance.palette1': '#dce9ff',
      'appearance.palette2': '#b4d2f2',
      'appearance.palette3': '#ffffff',
      'appearance.palette4': '#8ab2e2',
      'appearance.palette5': '#e6f0ff',
      'fluid.enabled': true,
      'fluid.speed': 0.28,
      'fluid.scale': 1.77,
      'fluid.radius': 140,
      'glass.enabled': true,
      'glass.blur': 24,
      'glass.tintLight': '#ffffff',
      'glass.tintLightAlpha': 0.55,
      'glass.tintDark': '#000000',
      'glass.tintDarkAlpha': 0.2,
      'glass.borderAlpha': 0.08,
      'glass.slot.dialog': true,
      // The bottom grid is deliberately OFF: it was the "meaningless
      // interactive texture" users saw and did not want on screen.
      'quantum.q1Enabled': false,
      'quantum.q2Enabled': true,
      'quantum.q2Levels': 8,
      'quantum.q2Dither': 0.4,
      'quantum.q3Enabled': true,
      'quantum.q3Placement': 'background',
      'quantum.q3WatermarkOpacity': 0.28,
      'quantum.q3WatermarkColor': '#5b8dd0',
      'quantum.q3WatermarkAnchor': 'content',
      'fluid.scale': 1.46,
      'fluid.radius': 194,
      'fluid.distort': 1.7,
      'fluid.blur': 3,
      'glass.blur': 20,
      'glass.tintDarkAlpha': 0.19,
      'glass.tintLight': '#f7f7f7',
      'glass.borderAlphaLight': 0.31,
      'glass.composerTintAlpha': 0.3,
      'glass.panelTintAlpha': 1,
      'glass.panelShadowAlpha': 0.57,
      'glass.panelShadowColor': '#3b5887',
      'glass.panelHighlight': 0.58,
      'glass.panelSaturation': 1.05,
      'glass.panelScrim': 0.04,
      'spotlight.size': 50,

      'quantum.q4Enabled': false,
      'motion.enabled': true,
      'motion.duration': 160,
      'motion.easing': 'cubic-bezier(0.2, 0, 0, 1)',
      'motion.hoverEnabled': true,
      'motion.hoverLift': 5,
      'motion.hoverScale': 1.045,
      'motion.composerScale': 1.04,
      'motion.scopeToDialog': true,
      'quantum.q3WatermarkBreath': 0.45,
      'quantum.q3WatermarkBreathPeriod': 11,
      'glass.panelTintAlpha': 0.16,
      'glass.panelBlur': 40,
      'glass.panelScrim': 0,
      'glass.panelShadowAlpha': 0.14,
      'glass.panelHighlight': 0.55,
      'glass.panelSaturation': 1.15,
    },
  },
  'official-dark': {
    label: '官网深色',
    labelEn: 'Official dark',
    values: {
      'appearance.mode': 'dark',
      'appearance.backgroundMode': 'fluid',
      'appearance.opacity': 0.6,
      'glass.panelTintAlpha': 0.16,
      'glass.panelBlur': 40,
      'glass.panelScrim': 0,
      'glass.panelShadowAlpha': 0.14,
      'glass.panelHighlight': 0.55,
      'glass.panelSaturation': 1.15,
      'appearance.bgColor': '#071323',
      'appearance.accentColor': '#79a9ed',
      'appearance.palette1': '#000000',
      'appearance.palette2': '#1a3870',
      'appearance.palette3': '#204a7e',
      'appearance.palette4': '#eed8aa',
      'appearance.palette5': '#000000',
      'fluid.enabled': true,
      'fluid.speed': 0.28,
      'fluid.scale': 1.77,
      'fluid.radius': 140,
      'glass.enabled': true,
      'glass.blur': 24,
      'glass.tintDark': '#000000',
      'glass.tintDarkAlpha': 0.2,
      'glass.tintLight': '#ffffff',
      'glass.tintLightAlpha': 0.55,
      'glass.borderAlpha': 0.08,
      'glass.slot.dialog': true,
      'quantum.q1Enabled': false,
      'quantum.q2Enabled': true,
      'quantum.q2Levels': 8,
      'quantum.q2Dither': 0.4,
      'quantum.q3Enabled': true,
      'quantum.q3Placement': 'background',
      'quantum.q3WatermarkOpacity': 0.3,
      'quantum.q3WatermarkColor': '#dbe9ff',
      'quantum.q4Enabled': false,
      'motion.enabled': true,
      'motion.duration': 160,
      'motion.easing': 'cubic-bezier(0.2, 0, 0, 1)',
      'motion.hoverEnabled': true,
      'motion.hoverLift': 5,
      'motion.hoverScale': 1.045,
    },
  },
  'official-light': {
    label: '官网浅色',
    labelEn: 'Official light',
    values: {
      'appearance.mode': 'light',
      'appearance.backgroundMode': 'fluid',
      'appearance.opacity': 0.6,
      'glass.panelTintAlpha': 0.16,
      'glass.panelBlur': 40,
      'glass.panelScrim': 0,
      'glass.panelShadowAlpha': 0.14,
      'glass.panelHighlight': 0.55,
      'glass.panelSaturation': 1.15,
      'appearance.bgColor': '#f9f8f8',
      'appearance.accentColor': '#4176e6',
      'appearance.palette1': '#7fa8d8',
      'appearance.palette2': '#c6dff5',
      'appearance.palette3': '#ffffff',
      'appearance.palette4': '#a8c8e8',
      'appearance.palette5': '#f8fbfe',
      'fluid.enabled': true,
      'fluid.speed': 0.28,
      'fluid.scale': 1.77,
      'fluid.radius': 140,
      'glass.enabled': true,
      'glass.blur': 24,
      'glass.tintDark': '#000000',
      'glass.tintDarkAlpha': 0.2,
      'glass.tintLight': '#ffffff',
      'glass.tintLightAlpha': 0.55,
      'glass.borderAlpha': 0.08,
      'glass.slot.dialog': true,
      'quantum.q1Enabled': false,
      'quantum.q2Enabled': true,
      'quantum.q2Levels': 8,
      'quantum.q2Dither': 0.4,
      'quantum.q3Enabled': true,
      'quantum.q3Placement': 'background',
      'quantum.q3WatermarkOpacity': 0.3,
      'quantum.q3WatermarkColor': '#6f9fd8',
      'quantum.q4Enabled': false,
      'motion.enabled': true,
      'motion.duration': 160,
      'motion.easing': 'cubic-bezier(0.2, 0, 0, 1)',
      'motion.hoverEnabled': true,
      'motion.hoverLift': 5,
      'motion.hoverScale': 1.045,
    },
  },
}
