# 验收证据（阶段 5，逐条对应）

> 版本说明：§1–§10 是 **0.1.0 / 宿主 0.2.0-rc.2** 的历史实测证据，原样保留；
> 0.1.4 在 **0.2.1-rc.2** 上的复验、点击安全修复与 Codex 审查记录见 **§11**。

- 插件：`dsh-deepseek-theme-studio` v0.1.0
- 宿主：**DSH 0.2.0-rc.2**（`dsh --version`）
- profile：`C:\Users\草木\.dsh\profiles\web` → 服务 `http://127.0.0.1:19399/`
- 浏览器：Playwright Chromium，视口固定 **1440×900**，`devicePixelRatio = 1`
- 截图与报告：`C:\DSH1\_run\shots\`、`C:\DSH1\_run\shots\*.json`
- 全部数据为**本机实测**，命令与输出原样摘录。

---

## 1. 安装链：安装 → loader 条目 → 重启 → 硬刷新 → 设置行出现

**安装命令与输出**

```powershell
$env:COREPACK_ENABLE_PROJECT_SPEC = "0"
& "C:\Users\草木\AppData\Local\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" `
    plugin --profile web add C:\DSH1\dsh-deepseek-theme-studio
```
```
dependencies:
+ dsh-deepseek-theme-studio link:C:/DSH1/dsh-deepseek-theme-studio
Done in 3s using pnpm v11.7.0
```

**profile 侧三处落点（实测）**

| 位置 | 结果 |
|---|---|
| `profiles/web/package.json` → `dependencies` | `"dsh-deepseek-theme-studio": "link:C:/DSH1/dsh-deepseek-theme-studio"` |
| `profiles/web/package.json` → `dsh.profile.bundles` | 末尾追加 `"dsh-deepseek-theme-studio"` |
| `profiles/web/node_modules/dsh-deepseek-theme-studio` | Junction → `C:\DSH1\dsh-deepseek-theme-studio` |

**loader 条目**（由本包 `dsh.bundle.patch` 提供，无需手改 profile 补丁层）：

```yaml
- insert:
    - id: deepseek-theme-studio
      name: 'dsh-deepseek-theme-studio'
```

**boot manifest 中确实存在**（重启后，浏览器控制台实测）：

```js
window.__DSH_BOOT__.entries.find(e => e.id === 'dsh-deepseek-theme-studio')
// {
//   "id": "dsh-deepseek-theme-studio",
//   "url": "plugins/??dsh-deepseek-theme-studio/client.js&rev=<内容版本号>",
//   "rev": "…",
//   "inject": ["slots"],
//   "immediately": true
// }
```

**设置行出现**（Settings → 通用，紧随内置「外观」行之后，`order: 20`）：

![设置行](shots/C-settings-row.png)

行内文本（自动化读取）：`DeepSeek 官网主题工作台 / 68 项参数 / 原生 / 官网深色 / 官网浅色 / 一键还原原生 /
参数文件：C:\Users\草木\.dsh\theme-studio.json（手工编辑后自动热加载）` + 七个参数分组。

> 排障记录：首次安装后插件**未激活**，控制台报
> `loaded without registering "dsh-deepseek-theme-studio" via __ModuleLoader__.load`。
> 原因：bundle 内 `__ModuleLoader__.load({ id })` 的 `id` 必须等于**包名**（我最初写成 `deepseek-theme-studio`）。
> 修正后立即通过。这条已写进 README §6 坑 2 第 4 点。

---

## 2. 出厂一致：全部效果关闭 vs 卸载状态

**方法**：同一视口、同一机位、页面刚加载且**不做任何鼠标交互**，各截一张，然后逐像素比较。
比较工具 `scripts/png-diff.mjs`（纯 Node，zlib 解 PNG + 5 种行滤波还原）。

| 截图 | 状态 | 文件 |
|---|---|---|
| A4 | 插件已安装，**全部效果关闭**（原生态） | `shots/A4-native-later.png` |
| D2 | 插件**已卸载**（重启 profile 后） | `shots/D2-uninstalled-controlled.png` |

**结果**

```
差异像素       0 / 1296000  (0.0000%)
排除区域       228,276 40x100  （其中差异像素 100）
差异包围盒     （无）
结论           IDENTICAL ✔
```

报告：`_run/shots/diff-factory-consistency.json`。

**那 100 个像素是什么（已定位到元素）**

`document.elementFromPoint(236, 292)` → `<span class="hIlkoa_time">`（会话行 `hIlkoa_sessionRow` 的
**相对时间**文本）。同一区域在卸载态的实际文本是：`32分钟 / 38分钟 / 59分钟 / 3小时 / 9天` ——
**这些字符串由 `Date.now()` 在渲染时算出，两次页面加载之间本来就会变**（"59分钟"下一秒就成"1小时"）。

**三个对照实验（证明与插件无关）**

| 对照 | 差异像素 |
|---|---|
| 同一页面、同一状态、前后两张（D vs D-uninstalled2） | **0** |
| 同一状态、两次独立加载（A2 vs A3） | **0** |
| 同一页面 6 分钟后（A3 vs A4） | **0**（值只在重新渲染时变，不会自己跳动） |
| 鼠标移到侧栏会话行上（同一页面） | **26,290**（该区域本身就是高度动态的宿主 UI） |

**插件在原生态的 DOM 足迹（实测）**：`0` 个 canvas、`0` 个 `.dts-*` 元素、无 `data-dts` 根属性、
`0` 个被写入的令牌；仅剩一个只含 `.dts-*` 选择器的设置行样式表（设置页关闭时不匹配任何元素）。

> 结论口径：**排除宿主自身随时间变化的相对时间文本后，像素差 = 0**；未排除时为 100/1,296,000 = 0.0077%，
> 且已定位到具体宿主元素。此处如实说明，不四舍五入成"0"。

---

## 3. 效果逐项可用（同机位、同窗口尺寸）

自动化读取的各效果运行态（官方深色预设，1440×900）：

| 效果 | 关键读数 | 结论 |
|---|---|---|
| 液化（流体） | `renderer: "webgl2"`、`flowSize: "360x225"`、`renderedFrames: 185`、`running: true`、`fallback: false` | 生效（WebGL2 路径） |
| 毛玻璃 | `matched: 6`、`applied: 6`、`skipped: 0`（上限 6） | 生效 |
| Q1 空间量子化 | `renderer: "canvas2d"`、`gridSize: "17x11"`（90px 间距）、`renderedFrames: 185` | 生效 |
| Q2 颜色量子化 | 传入 `u_levels` / `u_dither` uniform；色阶 2–16 可调 | 生效（GPU 内） |
| Q3 形态量子化 | `particles: 1400`、`settled: true`（成形后休眠） | 生效 |
| Q4 状态量子化 | `quantizeStep()` 已接入 Q1 放大镜响应 / Q3 亮度 / 背景不透明度 | 生效 |
| 聚光灯 | `spotlight.enabled` 时按需挂载 `.dts-spotlight-ring`，`mix-blend-mode: difference` | 生效 |

**毛玻璃实际计算值**（`getComputedStyle`，输入卡与侧栏按钮各取样）：

```
backdrop-filter : blur(24px) saturate(1)
border          : 1px rgba(255, 255, 255, 0.08)
box-shadow      : none
background      : rgba(0, 0, 0, 0.2)
```

与任务 2.3 的三组规定值逐项一致，且无折射层、无高光、无阴影。

![官方深色预设](shots/B-official-dark.png)

---

## 4. 参数实时性：拖动即生效，无需刷新

一次 evaluate 内连改三项，随后立刻读计算样式（无 reload、无 HMR）：

| 改动 | 观测量 | 结果 |
|---|---|---|
| `glass.blur` 24 → 8 | `getComputedStyle(composerCard).backdropFilter` | `blur(8px) saturate(1)` ✔ |
| `quantum.q1Spacing` 90 → 40 | `grid.gridSize` | `17x11` → **`37x23`** ✔ |
| `appearance.opacity` → 0.35 | `--dts-decoration-opacity` 与 `.dts-background` 的 `style.opacity` | 均为 `0.35` ✔ |

---

## 5. 持久化：改参数 → 刷新 → 保持；导出 → 还原 → 导入 → 复现

**JSON 参数文件**（`C:\Users\草木\.dsh\theme-studio.json`）：实测 **68 个键**，与参数表一一对应。

**手工编辑 → 热加载**（控制 3）：

```
# 用编辑器把 glass.blur 改成 30、quantum.q1Color 改成 #ff3b30，等 5 秒
clientBlur      : 30
clientGridColor : "#ff3b30"
liveBlur        : "blur(30px) saturate(1)"
revision        : 11
```

（轮询周期 3 秒，仅在页面可见时轮询。）

**刷新 / 重启后保持**：重启 web profile 并重新加载页面后，`glass.blur = 30`、`quantum.q1Color = "#ff3b30"`、
`appearance.mode = "dark"` 全部保持（权威来源即该 JSON 文件）。

**导出 / 还原 / 导入**：

```
exportPreset()  → 2498 字节，$schema = "dsh-deepseek-theme-studio/preset@1"，68 个键
reset()         → fluid=false, glass=false, 根属性移除（回到原生态）
importPreset()  → { applied: 68, unknown: [] }
导入后          → blur=30, gridColor=#ff3b30, mode=dark, fluid/glass=on  —— 与导出前逐项一致 ✔
```

**解析失败不再静默**（对参考实现缺陷的修正）：若 JSON 非法（例如编辑器写入了 BOM 或尾逗号），
宿主 API 返回 `fileError`，设置行显示"参数文件解析失败：…"；修好后 3 秒内自动恢复。

---

## 6. 令牌自检：用到的 N 个令牌全部命中运行实例真实 CSS

**构建期（离线，扫已解包的宿主树）**

```
令牌自检（host tree C:/DSH1/_dbg/asar/dsh/node_modules/@deepseek-ai）
  扫描文件：89    宿主已声明令牌：461
  本插件使用令牌：22
  ✔ --dsw-alias-bg-base … ✔ --dsw-font-family
✔ 用到的 22 个令牌全部命中宿主构建的实际 CSS
```

**运行期（浏览器内，对真实计算样式复检）**

```js
window.dshThemeStudio.selfCheck()
```
```
ok: true
tokensFound / tokensTotal: 22 / 22
missingTokens: []
missingHooks: []
hooks:
  ✔ [data-composer-card]                      → 1
  ✔ [class*="_userStack"] [class*="_bubble"]  → 0（首页无消息，标记为可选）
  ✔ [class*="_newSession"]                    → 3
  ✔ [data-conversation-scroll]                → 1
  ✔ [data-composer-seat]                      → 1
  ✔ [data-slot="settings.general.item"]       → 0（设置页关闭时为可选）
```

**负向对照（证明"失败不会静默通过"）**

```
$ node scripts/verify-tokens.mjs --live http://127.0.0.1:19999
✘ --live http://127.0.0.1:19999 unreachable: fetch failed
   (a check that cannot read the running instance must fail, not pass silently)
EXIT=2
```
这一点是对照 `mux9056-bot/dsh-theme` 的 `verify:live` 刻意修正的：它的抓取失败被设计成非致命，
仍会打印"token verification passed"（`scripts/build.mjs:278-286`）。

> 说明：对**已登录**的实例做 `--live` 需要带 cookie（实例在页面内完成鉴权，裸 fetch 得 401）；
> 脚本在这种情况下会打印三条可选做法并**非零退出**，而不是假装通过。

---

## 7. 性能：空闲态与动画态实测

**动画态**（流体 + 网格同开，粒子已成形休眠），120 帧采样：

| 指标 | 实测 | 预算 | 判定 |
|---|---|---|---|
| 平均帧间隔 | **16.61 ms**（≈60.2 fps） | 60 fps（16.67 ms） | ✔ |
| p50 / p95 | 16.7 / 16.8 ms | — | ✔ |
| 最大帧间隔 | **17.7 ms** | — | ✔ |
| 超过 20 ms 的帧 | **0** | — | ✔ |
| long task（>50 ms） | **0** | — | ✔ |

**空闲态**：Q3 粒子成形完成后 `running: false`（`settled: true`，渲染循环整体停掉，靠指针移动/参数变更唤醒）；
网格在速度低于阈值 4 帧后同样停帧；流体与网格均按 **30 fps 上限**节流；标签页不可见时循环停摆。

**资源上限实测**：canvas **3** 个（流体 + 网格 + 粒子；粒子与网格在 <768px 时被移除）、
插件自有 `<style>` **≤ 3** 个（设置行 / 运动变量 / 毛玻璃，且原生态只剩 1 个）、
MutationObserver **2** 个（粒子宿主 + 毛玻璃目标标记）。

---

## 8. 无障碍与窄屏：两个分支各自验证

**`prefers-reduced-motion: reduce`**（Playwright 模拟媒体特性后重新加载）：

| 观测 | 结果 |
|---|---|
| `diagnostics().reducedMotion` | `true` |
| 三个渲染器的 `running` | 全部 `false` |
| 1.5 秒内新增帧数 | **0** |
| 静态效果是否仍在 | 在：网格画布 11,900 个非透明像素；粒子画布 551 个非透明像素（已成形并静止）；毛玻璃 6 处仍生效 |

**视口 < 768 px**（600×800）：

| 观测 | 结果 |
|---|---|
| `decorationAllowed` | `false` |
| canvas 数量 | **1**（只剩流体；网格与粒子画布被移除） |
| `grid.enabled` / `particles.enabled` | `false` / `false` |
| 毛玻璃 | 仍生效（命中数随窄版布局降为 4） |

---

## 9. 卸载还原：卸载 → 重启 → 硬刷新 → 与出厂完全一致，无残留

```powershell
& $dsh plugin --profile web remove dsh-deepseek-theme-studio
```
```
- dsh-deepseek-theme-studio link:C:/DSH1/dsh-deepseek-theme-studio
Done in 301ms using pnpm v11.7.0
bundles contains plugin: False
```

重启 profile 后加载页面，实测：

| 观测 | 结果 |
|---|---|
| 宿主路由 `GET /deepseek-theme-studio/api` | **HTTP 404**（宿主半已卸载） |
| `typeof window.dshThemeStudio` | `undefined` |
| `.dts-*` 元素 | **0** |
| `style[data-plugin="dsh-deepseek-theme-studio"]` | **0** |
| `data-dts` / `data-dts-glass-root` / `data-dts-glass-mode` 根属性 | 全部不存在 |
| 与安装前的像素差 | 见 §2（排除宿主时间文本后 **0**） |

**已知残留（如实记录）**：`pnpm remove` 不会删除 `node_modules` 下那个已失效的 Junction；
它不参与 boot manifest（`dsh.profile.bundles` 已无该条目），手动删除即可（README §2.4 已写）。

---

## 10. 未达成 / 未验证事项（如实列出）

1. **§2 的像素差不是字面 0**：未排除宿主自身相对时间文本时为 100/1,296,000 = 0.0077%，
   已定位到 `hIlkoa_time` 元素并给出四项对照实验；排除该列后为 0。
2. **截图未经视觉复核**：本轮视觉模型后端限流（`VISION_RATE_LIMITED`），
   B/C 两张截图的观感未经模型确认；上表所有结论均来自 `getComputedStyle` / 诊断 API 的**数值读数**，
   不依赖人眼判断。
3. **未在 macOS / Linux 或桌面 profile 上实测**：仅在本机 Windows + web profile + 0.2.0-rc.2 验证。
4. **流体 shader 的降级路径已实测**（早期一次运行命中 `static-gradient` 降级，页面无白屏、无报错），
   但**没有**在真实"无 WebGL2"环境（禁用 GPU 的浏览器）下复测。
5. **`--live` 令牌复检**在已登录实例上需要手工提供 cookie，本轮以页面内 `formatSelfCheck()` 作为运行期复检。

---

## 11. 0.2.1-rc.2 复验 + 点击稳定性（0.1.4）

**环境**：宿主 **DSH 0.2.1-rc.2**；隔离测试 profile
`C:\DSH1\_testhome\profiles\test`（`DSH_HOME=C:\DSH1\_testhome`，不碰用户的 desktop/web profile）；
浏览器视口 1384×797；插件以本地 `link:` 安装；`theme-studio.json` 为空，即出厂默认蓝白主题。

### 11.1 兼容

| 观测 | 结果 |
|---|---|
| `dsh --version`（内层 `bin.js`） | `0.2.1-rc.2` |
| boot manifest 含本插件 | `dsh-deepseek-theme-studio` ✔ |
| 设置行 | 出现在「通用设置」，100 项参数可用 ✔ |
| `window.dshThemeStudio.selfCheck()` | `ok: true`，tokens **22/22**，6 个 DOM 钩子全 ok ✔ |
| `node scripts/verify-tokens.mjs`（扫 0.2.1 `app.asar`） | 68 个文件、宿主已声明 **465** 个令牌，本插件 22 个全部命中，exit 0 ✔ |
| `package.json` `dsh.compatibility.dshReleases` | 同时声明 `0.2.0-rc.2` 与 `0.2.1-rc.2` ✔ |
| `package.json` / bundle 版本 | `0.1.4` ✔ |

### 11.2 点击安全（修复前后对比）

同一个宿主开关（36×20 px，`[role="switch"]`）：

| 观测 | 0.1.3 修复前 | 0.1.4 修复后 |
|---|---|---|
| hover 计算样式 `transform` | `matrix(1.045, 0, 0, 1.045, 0, -5)` | `none` |
| hover 时 `transform-origin` | 被插件改成 `center` | 保持宿主值 `18px 10px` |
| 鼠标放在底边（rect `x=1027,y=647,w=36,h=20`，点击 `(1045,666)`，距底边 1px） | 元素抬起 5px，指针可能脱离 hover；边缘点击会抖 | 点击命中并切换；点击前后 rect 完全一致 `1027,647,36,20`；`transform: none`，`hover: true` |
| 设置面板入场 keyframes | `opacity + translateY(6px) scale(0.994)` | `0% { opacity: 0 } / 100% { opacity: 1 }`，计算 `transform: none` |
| 打开设置页时 `[role="dialog"]` 的 transform | 200ms 内位移 + 缩放 | 全程 `none` |
| 设置分组「量子化」手动展开后，切换组内 Q1 开关 | `<details open>` 被 React 重渲染改写，组会在指针下收起 | `open` 保持 `true`，组高度不变（960px），只有滚动位置随点击变化 |
| 设置页 21 个被标记目标 | 开关/按钮全部带 `dts-hover-target`，hover 位移 | **21 个 stable，0 个 motion**；诊断 `clickSafe:true, stableTargets:21, motionTargets:0` |
| 主页面 12 个被标记目标 | 按钮 hover 位移 | **12 个 stable，0 个 motion** |
| 纯装饰卡片（注入 `<div class="_card">` 验证） | 会被标记后位移 | 分类为 `dts-motion-target`，装饰上浮路径仍在 ✔ |

**结论**：默认 `motion.clickSafe = true` 时，开关/按钮/可点击行/输入卡在 hover、按压、active 下都不改变几何属性；
只有“本身不可点、且不含可交互后代”的纯装饰卡片保留上浮/缩放。把 `motion.clickSafe` 关掉可回到旧行为。

### 11.3 性能

修复后同一实例、设置页打开、流体 + 毛玻璃 + 鲸鱼水印默认开启，180 帧采样：

```
平均帧间隔 16.64 ms（≈60 fps）
p95          16.8 ms
最大         17.2 ms
> 20 ms 帧   0
long task     0
```

交互层没有新增 MutationObserver、没有新增 pointermove 监听；分类复用宿主每帧已有的 `mark()`，
点击目标 Set 每次 `mark()` 只构建一次，候选的“祖先是否可点击”用缓存 Set 向上走并在 scope 处停止。

### 11.4 GPT / Codex 协作记录

用本机 Codex CLI（`codex-cli 0.163.0-alpha.10.2`，模型 `gpt-6.1-sol`）对最终 diff 做只读审查。
Codex 报告了 4 点，Lead 逐条处理：

1. `markPanels()` 漏删 `dts-focus-target` → 已补删（并统一清理四个插件类）。
2. `.dts-hover-target` 无条件写 `transform-origin: center`，稳定目标仍被改几何相关样式 → 已把
   `transform-origin` 只放到 `.dts-motion-target`；实测稳定开关保持宿主 `18px 10px`。
3. 候选逐个 `closest()` 的最坏复杂度 → 改为用已缓存的 `clickSet` 向上走，命中即停，到 scope 终止。
4. 指出 `src/settings-row.js` 超出 Codex 的 brief 硬范围 → 该文件由 Lead 负责（本任务明确要求修复
   “设置组在指针下收起”），因此保留，并在本文件 11.2 给出实测证据。

Codex 的两条验证命令（`node --check src/effects/interaction.js`、`git diff --check`）均通过；
最终构建、冒烟和运行期复验由 Lead 在本机完成。
