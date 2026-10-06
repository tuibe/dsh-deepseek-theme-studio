# dsh-deepseek-theme-studio

DeepSeek 官网视觉语言的 **DSH Web 客户端主题插件**：毛玻璃 / 液化（流体）/ 量子化（Q1–Q4）三类效果，
全部参数可调、可持久化、可程序化调用。

- 宿主实测版本：**0.2.0-rc.2**
- 目标 profile：**web**（`$env:USERPROFILE\.dsh\profiles\web`）
- 安装后外观与 DSH 原生**完全一致**，直到你在设置里显式启用效果。
- 复用与许可台账见 [`REUSE.md`](REUSE.md)，第三方许可见 [`LICENSES/`](LICENSES/NOTICE.md)。

---

## 1. 交付物

| 路径 | 说明 |
|---|---|
| `package.json` | manifest（`dsh.bundle.patch` / `dsh.client` / `exports`）|
| `cordis.patch.yml` | loader 条目（`dsh.bundle.patch` 指向它）|
| `lib/index.js` | 宿主半（Node）：JSON 参数文件 + 围栏 HTTP 路由 + 热加载 |
| `lib/client.js` | 浏览器 bundle（`scripts/build.mjs` 由 `src/` 生成，勿手改）|
| `src/**` | 可读源码（参数表、存储、各效果引擎、设置行、程序化 API）|
| `scripts/build.mjs` | 零依赖构建（`--check` 做陈旧检查）|
| `scripts/smoke-factory.mjs` | 在 Node 里跑一遍 bundle 工厂，抓语法/导出错误 |
| `scripts/verify-tokens.mjs` | 令牌漂移自检（失败**非零退出**）|
| `scripts/png-diff.mjs` | 纯 Node PNG 双图差异报告（含 `--dump-region diff`）|
| `REUSE.md` | 复用与许可台账（Phase 0 闸门产物：逐行来源与许可判定）|
| `ACCEPTANCE.md` | 9 项验收的实测证据 |
| `icon.svg`, `LICENSE`, `LICENSES/` | 图标 / 许可证 / 第三方声明 |

---

## 2. 安装 / 升级 / 卸载 / 还原

`dsh` 不在 PATH 上，下面用绝对路径调用。

```powershell
# 本仓库克隆到哪，就填哪
$repo = "$env:USERPROFILE\src\dsh-deepseek-theme-studio"
$dsh  = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd"
```

### 2.1 安装（本地路径）

```powershell
$env:COREPACK_ENABLE_PROJECT_SPEC = "0"     # 见 §6 坑 1
& $dsh plugin --profile web add $repo
```

**换成别的 profile 只改 `--profile` 的值**，其余完全一样：

| profile | 你在哪用它 | 命令 |
|---|---|---|
| `desktop` | 桌面版 DSH（托盘常驻的那个，Web GUI 通常绑定随机端口）| `& $dsh plugin --profile desktop add $repo` |
| `web` | `dsh --profile web` 起的纯 Web 实例 | `& $dsh plugin --profile web add $repo` |

> 两者是**独立的两份 profile**（各自有自己的 `package.json` / `node_modules` / 设置），装一个不影响另一个；
> 想两边都有就各装一次。重启也只重启你要用的那个。
>
> 桌面版重启：**完全退出 DeepSeek Harness**（含托盘图标）再打开。这份 profile 没有 `patchReload: live`，
> 所以热更新不适用于"新增插件"这种改动。

预期输出（本次实测）：

```
dependencies:
+ dsh-deepseek-theme-studio link:$repo
Done in 3s using pnpm v11.7.0
```

安装做三件事，缺一不可：

1. `profiles/web/package.json` → `dependencies` 增加 `"dsh-deepseek-theme-studio": "link:$repo"`；
2. 同文件 `dsh.profile.bundles` 追加 `"dsh-deepseek-theme-studio"`；
3. `profiles/web/node_modules/dsh-deepseek-theme-studio` 建 Junction 指向源码目录。

**loader 条目**由本包自己的 `cordis.patch.yml` 提供（`dsh.bundle.patch` 机制），因此不需要手改
`profiles/web/cordis.patch.yml`。本包内容：

```yaml
- insert:
    - id: deepseek-theme-studio
      name: 'dsh-deepseek-theme-studio'
```

### 2.2 生效：重启 profile

客户端插件**没有自动发现机制** —— 只把包装进 `node_modules` 不会生效，必须重启 profile 让 boot manifest 重新组合。
重启前可先跑 `node scripts/preflight-profile.mjs` 体检（见 §7）。

**web profile：**

```powershell
# 停掉当前实例后：
$exe = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\DeepSeek Harness.exe"
$bin = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js"
$env:ELECTRON_RUN_AS_NODE = "1"
Remove-Item Env:DSH_PROFILE, Env:DSH_PROFILE_DIR, Env:DSH_SHELL -ErrorAction SilentlyContinue
& $exe --expose-internals $bin --profile web --port 19399 --no-open
# 输出形如： dsh web: http://127.0.0.1:19399/?token=<TOKEN>
```

然后浏览器打开该 URL 并 **Ctrl+Shift+R 硬刷新**。

> **为什么必须清那几个环境变量**：`dsh.cmd` 走的是 desktop host CLI（`manageDesktopProfile: true`），
> 会强行注入 `--profile desktop`，于是 `--profile web` 变成"profile 指定了两次"而报错；
> 且 `DSH_PROFILE_DIR` 会把 profile 目录钉死在 desktop。直连内层 `bin.js` 并清掉这三个变量即可。

**desktop profile：** 完全退出 DeepSeek Harness（**含托盘图标**）再打开即可 —— 桌面版由它自己拉起，
不需要手敲命令。重启后到设置 → 通用 看那一行在不在；不在就按 §6 坑 2 逐条查，
或先跑 `node scripts/preflight-profile.mjs --profile desktop`。

### 2.3 升级

本地 link 安装：改完 `src/` 后 `node scripts/build.mjs`（或用 `pnpm run build`），再重启 profile 即可；
不需要重新 `add`。npm 安装：`& $dsh plugin --profile web add dsh-deepseek-theme-studio@<新版本>` 后重启。

### 2.4 卸载

```powershell
& $dsh plugin --profile web remove dsh-deepseek-theme-studio
```

实测会把 `dependencies` 与 `dsh.profile.bundles` 中的条目一并移除（**刷新页面不够，必须重启 profile**）。
`node_modules` 下可能残留一个失效 Junction，可手动删除：

```powershell
Remove-Item "$env:USERPROFILE\.dsh\profiles\web\node_modules\dsh-deepseek-theme-studio" -Force -Recurse
```

### 2.5 还原原生外观（不卸载）

设置 → 通用 → **DeepSeek 官网主题工作台** → 点 **一键还原原生**；或：

```js
window.dshThemeStudio.reset()
```

还原后本插件不写任何令牌、不挂任何 canvas、不设 `data-dts` 根属性，只剩设置行本身（关掉设置即不可见）。

---

## 3. 三条控制通道

### 3.1 设置页 UI

注册进宿主自己的 `settings.general.item` 槽位（`order: 20`，紧随内置「外观」行 `order: 10` 与字号行 `order: 11`），
**不是**独立悬浮面板。分组折叠、每组控件由参数表自动生成。

### 3.2 程序化 API

同一个对象挂两处：`window.dshThemeStudio` 与 `ctx.provide('themeStudio', api)`。

| 方法 | 签名 | 说明 |
|---|---|---|
| `list()` | `() => ParamInfo[]` | 每个参数的 key / 标签 / 分组 / 类型 / 范围 / 步长 / 默认值 / 当前值 |
| `get(key)` | `(string) => any` | 取一个参数（未知 key 抛错）|
| `getAll()` | `() => object` | 取全部当前值 |
| `set(key, value)` | `(string, any) => any` | 设一个参数，按参数表强制类型与范围 |
| `setMany(patch)` | `(object) => object` | 批量设置 |
| `reset()` | `() => object` | 还原原生 |
| `exportPreset()` | `() => string` | 导出 JSON（含 `$schema`）|
| `importPreset(text\|object)` | `(any) => {applied, unknown}` | 导入 |
| `presets()` / `applyPreset(id)` | | 内置预设：`native` / `official-dark` / `official-light` |
| `subscribe(fn)` | `(fn) => () => void` | 订阅变更 |
| `selfCheck()` / `formatSelfCheck()` | | 令牌 + DOM 钩子漂移报告 |
| `diagnostics()` / `diagnosticsText()` | | 全量诊断（含每个效果的运行状态）|

```js
window.dshThemeStudio.applyPreset('official-dark')
window.dshThemeStudio.set('glass.blur', 32)
window.dshThemeStudio.formatSelfCheck()
```

### 3.3 JSON 参数文件（可手工编辑 + 热加载）

```jsonc
// $env:USERPROFILE\.dsh\theme-studio.json
{
  "appearance.mode": "dark",
  "appearance.backgroundMode": "fluid",
  "glass.enabled": true,
  "glass.blur": 24,
  "quantum.q1Spacing": 90,
  "quantum.q2Levels": 6
}
```

- 文件名/路径：`$DSH_HOME/theme-studio.json`（默认 `$env:USERPROFILE\.dsh\theme-studio.json`），原子写（tmp+rename）。
- HTTP 接口（前缀路由，带 loopback + 同源信任围栏）：
  - `GET  /deepseek-theme-studio/api` → `{ ok, value, fileError, revision, path }`
  - `POST /deepseek-theme-studio/api` `{ "method": "get" }`
  - `POST /deepseek-theme-studio/api` `{ "method": "set", "patch": { "glass.blur": 30 } }`（浅合并，`null` 删键）
  - `POST /deepseek-theme-studio/api` `{ "method": "replace", "value": { ... } }`
- 客户端每 **3 秒**（页面可见时）检查一次 revision，文件被手工改动即热加载；`fileError` 会在设置行显示，
  **不会**被当成空配置静默吞掉。
- 文件必须是 **UTF-8 无 BOM** 的 JSON 对象；带 BOM 会被容忍，语法错误会被报告。

> 安全说明：该路由只做 DNS-rebinding / 跨站防护（Host 必须是 loopback 或 `webRuntime.trustedHosts`，
> 且 `sec-fetch-site` 不是 `cross-site`），**不是鉴权**。本机任意进程都能读写，与生态内同类插件的取舍一致。

---

## 4. 参数完整说明

持久化 key = 参数名本身（JSON 文件里的键；localStorage 里加前缀 `dsh-deepseek-theme-studio:`）。
「默认」列是安装后的初始值 —— 全部等于"什么都不做"。

### 4.1 外观模式 / 背景

| 设置项 | 键 | 控件 | 范围 / 步长 | 默认 |
|---|---|---|---|---|
| 外观模式 | `appearance.mode` | 三态 | `system`/`light`/`dark` | `system` |
| 背景模式 | `appearance.backgroundMode` | 分段 | `solid`/`gradient`/`fluid` | `solid` |
| 底色 | `appearance.bgColor` | 取色器 + 文本 | HEX（空 = 跟随宿主）| `""` |
| 强调色 | `appearance.accentColor` | 取色器 + 文本 | HEX（空 = 跟随宿主）| `""` |
| 流体调色板 1–5 | `appearance.palette1..5` | 取色器 ×5 | HEX | `#000000/#1a3870/#204a7e/#eed8aa/#000000` |
| 装饰层不透明度 | `appearance.opacity` | 滑杆 | 0–100%，步长 1% | 60% |
| 渐变角度 | `appearance.gradientAngle` | 滑杆 | 0–360°，步长 1 | 180 |

### 4.2 液化（流体）

| 设置项 | 键 | 范围 / 步长 | 默认 |
|---|---|---|---|
| 启用流体背景 | `fluid.enabled` | 开关 | 关 |
| 流速 | `fluid.speed` | 0–2×，步长 0.05 | 0.28 |
| 噪声波长（形状宽窄）| `fluid.scale` | 0.2–4，步长 0.01 | 1.77 |
| 指针扰动半径 | `fluid.radius` | 0–300 px，步长 1 | 140 |
| 域扭曲强度 | `fluid.distort` | 0–6，步长 0.05 | 2.2 |
| 卷曲强度 | `fluid.swirl` | 0–3，步长 0.05 | 0.8 |
| 颗粒噪点 | `fluid.grain` | 0–0.05，步长 0.001 | 0.005 |
| 指针光晕 | `fluid.glow` | 0–0.6，步长 0.01 | 0.13 |
| 暗角 | `fluid.vignette` | 0–1，步长 0.01 | 0.38 |
| 流体柔化模糊 | `fluid.blur` | 0–24 px，步长 1 | 0 |
| 指针流场扰动 | `fluid.flowmap` | 开关 | 开 |

### 4.3 毛玻璃

| 设置项 | 键 | 范围 / 步长 | 默认 |
|---|---|---|---|
| 启用毛玻璃 | `glass.enabled` | 开关 | 关 |
| 模糊半径 | `glass.blur` | 0–40 px，步长 1 | 24 |
| 深色 tint / 浓度 | `glass.tintDark` / `glass.tintDarkAlpha` | HEX / 0–1 步长 0.01 | `#000000` / 0.20 |
| 浅色 tint / 浓度 | `glass.tintLight` / `glass.tintLightAlpha` | HEX / 0–1 步长 0.01 | `#ffffff` / 0.55 |
| 描边透明度 | `glass.borderAlpha` | 0–1，步长 0.01 | 0.08 |
| 饱和度 | `glass.saturation` | 0–2×，步长 0.05 | 1 |
| 四个白名单槽位 | `glass.slot.composer` / `.bubble` / `.sidebar` / `.sessionlog` | 开关 | 前三开、第四关 |
| 槽位选择器（可改） | `glass.slot.<名>.selector` | 文本 | 见 §4.3.1 |

#### 4.3.1 白名单默认选择器与漂移说明

| 槽位 | 默认选择器 | 0.2.0-rc.2 实测命中 |
|---|---|---|
| 输入卡 | `[data-composer-card]` | 1 |
| 用户消息气泡 | `[class*="_userStack"] [class*="_bubble"]` | 有消息时命中 |
| 侧栏按钮 | `[class*="_newSession"]` | 3 |
| 会话日志控件 | `[data-slot="settings.general.item"] [role="switch"]` | 仅设置页打开时命中 |

> 任务书里的第四项"会话日志按钮"在 0.2.0-rc.2 **不存在为按钮**：该版本把 session log 做成设置页 General 区的一行
> （`@deepseek-ai/dsh-client-ui-settings-session-log`），行内是 `Switch` 原语；`dsh-unknown-theme` 针对的
> `.nL4_yW_sessionLogButton` 在本版宿主中查无此类（已抽取全部 51 个宿主 client bundle 的 class-map 佐证）。
> 因此默认指向真实控件，且**随时可在设置里改选择器**。

同屏 `backdrop-filter` 元素硬上限 **6**（`GLASS_MAX_TARGETS`），超出者被标记跳过；
会形成 containing block 而困住 `position: fixed` 浮层的祖先（`_frame`、`_sidebarCol`、`[data-slot]` 列、
`role=dialog/menu` 等）永不加滤镜。

### 4.4 量子化

| 编号 | 设置项 | 键 | 范围 / 步长 | 默认 |
|---|---|---|---|---|
| Q1 | 空间量子化（点阵）| `quantum.q1Enabled` | 开关 | 关 |
| Q1 | 栅格间距 | `quantum.q1Spacing` | 24–160 px，步长 1 | 90 |
| Q1 | 斥力半径 | `quantum.q1Radius` | 0–300 px，步长 1 | 140 |
| Q1 | 弹簧回弹 / 阻尼 | `quantum.q1Spring` / `quantum.q1Damping` | 0.005–0.3 / 0.5–0.99 | 0.05 / 0.85 |
| Q1 | 网格线 / 节点不透明度 | `quantum.q1LineOpacity` / `quantum.q1PointOpacity` | 0–0.6 | 0.08 / 0.08 |
| Q1 | 命中节点半径 | `quantum.q1ActivePoint` | 1–8 px，步长 0.1 | 2.2 |
| Q1 | 点阵颜色 | `quantum.q1Color` | HEX | `#ffffff` |
| Q2 | 颜色量子化 | `quantum.q2Enabled` | 开关 | 关 |
| Q2 | 色阶数 | `quantum.q2Levels` | 2–16 阶，步长 1 | 6 |
| Q2 | Bayer 抖动强度 | `quantum.q2Dither` | 0–1，步长 0.05 | 1 |
| Q3 | 形态量子化（粒子）| `quantum.q3Enabled` | 开关 | 关 |
| Q3 | 粒子总数 | `quantum.q3Count` | 200–6000，步长 50 | 1400 |
| Q3 | 成形时间 | `quantum.q3Assemble` | 300–4000 ms，步长 50 | 1200 |
| Q3 | 打散后回正时间 | `quantum.q3Scatter` | 4–60 s，步长 1 | 22 |
| Q3 | 粒子半径 / 颜色 | `quantum.q3Size` / `quantum.q3Color` | 0.5–4 px / HEX | 1.4 / `#ffffff` |
| Q3 | 指针斥力半径 | `quantum.q3Repel` | 0–120 px，步长 1 | 19 |
| Q3 | 装饰图形 | `quantum.q3Shape` | `whale`/`ring`/`wave` | `whale` |
| Q4 | 状态量子化 | `quantum.q4Enabled` | 开关 | 关 |
| Q4 | 档位数 | `quantum.q4Steps` | 2–16 档，步长 1 | 8 |
| Q4 | 量化对象 | `quantum.q4Target` | `pointer`/`ambient`/`scroll` | `pointer` |

### 4.5 聚光灯 / 动画

| 设置项 | 键 | 范围 / 步长 | 默认 |
|---|---|---|---|
| 标题聚光灯 | `spotlight.enabled` | 开关 | 关 |
| 光斑直径 / 颜色 | `spotlight.size` / `spotlight.color` | 16–200 px / HEX | 64 / `#ffffff` |
| 触发元素选择器 | `spotlight.selector` | 文本 | 见下 |
| 动画总开关 | `motion.enabled` | 开关 | 开 |
| 统一时长 | `motion.duration` | 80–400 ms，步长 10 | 160 |
| 缓动曲线 | `motion.easing` | 4 条（均无过冲）| `cubic-bezier(0.2, 0, 0, 1)` |

聚光灯默认触发选择器：`[data-conversation-header] h1, [data-conversation-header] h2, [class*="_headline"]`
（只在标题文字/图标上触发，容器空白区不触发）。

---

## 5. 已知取舍（明说，不静默）

1. **`motion.duration` 只作用于本插件自己的表面**（效果层、玻璃过渡、设置行）。宿主组件动画不受影响 ——
   任务 §3.4 禁止大段全局覆盖宿主样式，两者冲突时以此为准。
2. **`appearance.opacity` 允许 0–100%**（任务 §3.2 的范围要求），但**内置预设与默认值都不超过 60%**
   （任务 §2.1 的简洁预算）；超过 60% 时设置行会给出提示。
3. **单元数据里 `dsh.compatibility.dshReleases` 宿主不读取**（`app.asar` 全量 grep 无消费点）；
   字段按要求照写，实际兼容性由 `dsh.bundle.patch` / `dsh.client` / `exports` 三条契约保证。
4. 鲸鱼轮廓是 DeepSeek 品牌资产，不属于本包 MIT 授权范围；`quantum.q3Shape` 可切换为 `ring`/`wave` 或直接关闭 Q3。

---

## 6. 排障（含三个已知坑）

### 坑 1：`corepack EPERM ... package.json`

```
Error: EPERM: operation not permitted, open '...\profiles\web\package.json.lock'
```

先设环境变量再重试：

```powershell
$env:COREPACK_ENABLE_PROJECT_SPEC = "0"
```

若仍失败：确认目标 profile 没有被另一个 dsh 实例占用（关闭正在运行的 web 实例），并把整个命令放在**同一个** shell 会话里执行。

### 坑 2：插件装了但页面上什么都没有

按顺序查这四件事：

1. **profile 里有没有 bundle 条目** —— `profiles/web/package.json` 的 `dsh.profile.bundles` 必须含
   `dsh-deepseek-theme-studio`；只有 `node_modules` 里有个包是**不够的**（客户端插件没有自动发现）。
2. **重启过 profile 没有** —— 刷新页面不够，boot manifest 在 profile 启动时组合。
3. **boot manifest 里有没有你的条目** —— 浏览器控制台执行：
   ```js
   window.__DSH_BOOT__.entries.find(e => e.id === 'dsh-deepseek-theme-studio')
   ```
   有条目但页面报 `1 entry did not activate` → 打开控制台看 `[theme-studio]` 前缀的错误。
4. **bundle 的 id 是否等于包名** —— `window.__ModuleLoader__.load({ id })` 的 `id` **必须**是包名
   （`dsh-deepseek-theme-studio`），否则报
   `loaded without registering "<包名>" via __ModuleLoader__.load`。

### 坑 3：重启时机

- 改了 `cordis.patch.yml` / `package.json` / `lib/index.js` → **必须重启 profile**。
- 只改了 `lib/client.js`（由 `src/` 构建）→ 刷新页面即可，宿主按内容版本号重新拉取 bundle；
  必要时 Ctrl+Shift+R 硬刷新。
- 改完源码记得 `node scripts/build.mjs`，否则跑的还是旧 bundle：`node scripts/build.mjs --check` 会告诉你是否陈旧。

### 其他常见问题

| 症状 | 原因 / 处理 |
|---|---|
| 设置行里显示"参数文件解析失败" | `theme-studio.json` 不是合法 JSON（常见：编辑器写了 BOM、尾逗号）。修好后 3 秒内自动恢复 |
| 设置行显示"未连接参数文件" | 宿主半没挂载（`webServer` 服务不可用）或 URL 前缀被改。此时仍可用，只是仅存 localStorage |
| 重启后参数"丢了" | 桌面端每次启动换端口 → localStorage 按 origin 隔离；正是为此把 JSON 文件做成权威来源。检查 `$DSH_HOME/theme-studio.json` |
| 流体效果变成静态渐变 | 当前环境没有 WebGL2（控制台会有 `[theme-studio] WebGL2 unavailable` 警告）。这是设计好的降级，不会白屏 |
| 粒子/网格在小窗口不见了 | 视口宽度 < 768 px 时刻意关闭（任务 §4.2），属预期 |
| `dsh plugin` 命令报"profile 指定了两次" | 你用的是 `dsh.cmd`（desktop host CLI，会强行注入 `--profile desktop`）。见 §2.2 直连 `bin.js` 的做法 |

---

## 7. 自检与验证脚本

```powershell
cd $repo
node scripts/preflight-profile.mjs      # 重启前体检：loader 到底会不会收这个包（全部 profile）
node scripts/preflight-profile.mjs --profile desktop
node scripts/build.mjs --check          # bundle 是否与 src 同步（非零退出 = 陈旧）
node scripts/smoke-factory.mjs          # 在 Node 里跑 bundle 工厂，抓语法/导出错误
node scripts/verify-tokens.mjs          # 令牌漂移自检（默认扫已解包的宿主树）
node scripts/verify-tokens.mjs --live http://127.0.0.1:19399   # 对运行实例复检
node scripts/png-diff.mjs a.png b.png --json out.json --dump-region diff
```

`preflight-profile.mjs` 复刻了宿主 `@deepseek-ai/dsh-client-modules` 在 profile 启动时做的每一项检查
（bundles 条目 / 包可解析 / `dsh.client.platform` / `exports["./client"]` 与文件存在 / `exports["."]` 与
服务端入口存在 / 补丁层含 `insert` 且 `name` 指向本包），这样配置错误在**重启之前**就能发现，
而不是重启后对着一个空白设置页猜。

运行时自检（浏览器）：

```js
window.dshThemeStudio.formatSelfCheck()
```

`verify-tokens.mjs` 刻意比参考实现更严格：抓不到宿主 CSS 或运行实例时**非零退出**，
不会像 `mux9056-bot/dsh-theme` 的 `verify:live` 那样在抓取失败后仍然打印"校验通过"。
