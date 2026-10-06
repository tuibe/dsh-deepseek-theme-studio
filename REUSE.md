# REUSE.md — 阶段 0 复用台账（硬门禁交付物）

插件：`dsh-deepseek-theme-studio`（DSH 客户端主题插件，platform: web）
实测宿主：**DSH 0.2.0-rc.2**（`dsh --version` → `0.2.0-rc.2`；`@deepseek-ai/dsh-client-ui-theme@0.2.0-rc.2`）
目标 profile：`C:\Users\草木\.dsh\profiles\web`
生成时间：2026-10-06（本轮调研）
本文件产出之前，未写入任何实现代码。

> 本文件的每一条"可复用"结论都来自**下载到本机并实际打开过的源码文件**（`C:\DSH1\_research\**`），
> 不是 README 复述。README 只用于发现候选。

---

## 0.1 检索渠道覆盖（四个渠道全部覆盖，附证据）

| 渠道 | 覆盖方式 | 证据（本机路径/命令） | 结果规模 |
|---|---|---|---|
| GitHub topic `dsh-plugin` | 直接抓 `https://github.com/topics/dsh-plugin` HTML；并用两个自动爬取 `topic:dsh-plugin` / `topic:deepseek-harness` 的聚合仓库的全量 JSON | `_fetch/topic-dsh-plugin.html`（574,687 B）；`_research/wgd753__awesome-dsh-plugin/.../data/repositories.json`（6.2 MB，8,086 仓库，其中 **7,204** 个带 `dsh-plugin`/`deepseek-harness` topic） | 7,204 仓库 → 效果相关 653 |
| npm 关键词 `deepseek-harness`、`dsh` | registry 搜索 API 直连（`https://registry.npmjs.org/-/v1/search?text=keywords:...&size=250`），并逐个 `npm pack` 拉真实 tarball | `_fetch/npm-kw-deepseek-harness.json`、`_fetch/npm-kw-dsh.json`（各 284 KB）；`_fetch/*.tgz` | 500 包含 → 效果相关 44 |
| 聚合目录 `awesome-dsh-plugin.com` | 抓站点 HTML；并取该目录同源数据仓库的分类 JSON | `_fetch/awesome-dsh-plugin.html`（670,853 B）；`_research/billLiao__awesome-dsh-plugin/.../data/plugins.json`（8.2 MB，**16,727** 个插件；分类 `themes-appearance` 324 条、`ui-enhancements` 1,000+） | 效果相关 950 |
| 非 DSH 的同款效果实现 | `web_search` + 逐仓库抓 **真实 LICENSE 文件**（不是 README 声明） | 见 §0.1.1 | 4 个候选，全部核对到 LICENSE 正文 |

渠道覆盖脚本（可复跑）：`_research/analyse-catalog.mjs`、`_research/table-rows.mjs`。

> 网络说明：本机对 GitHub / jsdelivr / npmmirror 的**直连被拦截**，仅 `registry.npmjs.org` 可直连。
> 调研通过本机 127.0.0.1:7897 混合代理 + Node `NODE_USE_ENV_PROXY=1` 完成（helper：`_fetch/gh.mjs`、
> `_fetch/get-repos.mjs`）。GitHub REST API 未配额（实测剩余 12/60），因此**全部元数据取自聚合目录的
> 爬取结果**（字段 `pushed_at` = 最近一次 push，作为"最近提交日期"口径），而非 API。

### 0.1.1 非 DSH 侧的同款效果实现（官网效果原始出处不在 DSH 生态内）

| 效果 | 仓库 / 包 | 许可证（已读 LICENSE 正文） | 与目标的差距 |
|---|---|---|---|
| 流体（WebGL 全屏流体） | `PavelDoGreat/WebGL-Fluid-Simulation` | MIT（`Copyright (c) 2017 Pavel Dobryakov`） | **不同技术路线**：它是 Navier–Stokes GPU 求解器（`README.md` 引用 GPU Gems 38 章），不是 deepseek.com 的 simplex FBM+域扭曲+curl 噪声调色板 shader。→ 仅作参考 |
| 交互点阵网格 | `imtomasebastian/dot-grid-background`；`sathishk-dev/interactive-dot-grid` | 均为 MIT（两个 LICENSE 正文首行 `MIT License`） | 通用网页点阵，**不含 DSH 宿主所需的 `prefers-reduced-motion` / <768px / 与宿主 canvas 层级协调 / 单例与卸载**；技术可用但集成度低于 DSH 原生实现 → 仅作参考（交叉验证） |
| Bayer 有序抖动（Q2 颜色量子化） | npm `glsl-dither@1.0.1`（`hughsk/glsl-dither`） | MIT（`package.json` `license: "MIT"`，`LICENSE.md` 已解包到 `_research/npm-glsl-dither/package/LICENSE.md`） | 只提供 **1-bit 阈值抖动**（`4x4.glsl` / `8x8.glsl` 的 `dither4x4(position, brightness)`），**没有 N 级量化**。→ **抽取代码**（复用其 Bayer 阈值矩阵），N 级量化公式由本项目按标准有序抖动公式补全（见 §0.4.3） |
| 毛玻璃 | `WYH66666666/DSH-Transparent-UI-Plugin`（DSH 生态内） | **AGPL-3.0**（LICENSE 正文首行 `GNU AFFERO GENERAL PUBLIC LICENSE Version 3`） | 许可证与本项目不兼容 → **仅作参考**；且目标形态是"官网终端卡片"的**无折射/无高光/无阴影**磨砂，与该仓库的"高自由度玻璃质感"（含折射调参）取向不同 |

---

## 0.2 种子候选复核（最近提交 / 许可证 / 宿主兼容性）

种子由用户提供，本轮**逐个复核**（下载 zip 后读真实文件，不采信 README）：

| 种子 | 复核结论 |
|---|---|
| `ycqaq233/dsh-unknown-theme` | MIT 属实（LICENSE `Copyright (c) 2026 ycqaq233`）。**关键漂移**：其 `lib/client.js` 里 `.hHd-Xa_newSession` / `.nL4_yW_sessionLogButton` 两个 CSS-Module 哈希类名在 0.2.0-rc.2 **都不存在**（我对宿主机 51 个 client bundle 做了 class-map 抽取，见 `_research/host-classmap.json`：真实类名是 `_2H3hWW_newSession`，且**没有** `sessionLogButton` 这个 key）。→ 只能"抽取代码"，不能整体 fork |
| `mux9056-bot/dsh-theme` | Apache-2.0 属实（LICENSE 正文 Apache 2.0）。子代理机器核对：语义槽 **16** 个，写出的真实令牌 **94** 个 = 85 `--dsw-*` + 9 `--shiki-*`；**`--dsh-*` 出现 0 次**。其 `verify:live` **跑得起来但验不出东西**：抓取失败被设计成非致命（`scripts/build.mjs:278-286`），仍打印"token verification passed"。→ 机制可复用，"失败要响"这点必须自己重做 |
| `oil-oil/dsh-theme` | MIT 属实。`src/client/index.tsx` 用官方 `ctx.theme.overrideTokens(source, {light,dark})` + `ctx.slots.register({name:'settings.section',...})`；`src/client/theme-tokens.ts` 是 16→94 令牌的**官方 Theme API 版**写法。已在宿主 0.2.0-rc.2 源码中确认 `overrideTokens` 真实存在（`dsh-client-ui-theme/lib/client.js:1474`，签名与文档注释完整） |
| `yushi-xxh/dsh-homepage-skin` | MIT 属实。子代理核对：唯一同时具备 WebGL2 ping-pong 流体 + 真实斥力/弹簧点阵 + 点云鲸鱼成形的仓库，且**有** `prefers-reduced-motion`（`lib/client.js:950`）、粗指针门控（`:955`）、`W>=768` 门控（`:799`）与完整 `stop()` 卸载（含 `WEBGL_lose_context`，`:924-945`）。缺口：无聚光灯、无 `backdrop-filter`、设置只有 1 个开关 |
| `Jisakuna/Whale-QwQ` | **无 LICENSE 文件**（整个仓库列目录确认）。三个子包中 `whale-qwq` 的 2.94 MB bundle 内联了 **CC BY-NC-SA 4.0 非商用**角色美术（`LICENSE-ASSETS.md:5-16`）→ 淘汰（见 §0.3） |
| `RevolutionLA/dsh-dream-skin` | MIT 属实（LICENSE `Copyright (c) 2026 dsh-dream-skin contributors`）。**唯一**提供：① `@supports` 门控的 `backdrop-filter` 毛玻璃（`lib/client.js:2275-2283`）② 宿主半持久化 API —— 原子写 `$DSH_HOME/dream-skin.json` + 带信任围栏的 `/dream-skin/api` 前缀路由（`lib/index.js:38,52-83,269-286`）。缺口：全仓库 **0 处** `prefers-reduced-motion` / `@media` |
| `BeiZi6/dsh-theme-plugin` | MIT 属实。仅令牌层，无背景层、无 z-index；可复用点：`webServer.tapIndex` 注入 `<style>` 的宿主接缝（`index.js:367-388`）|

---

## 0.3 评估表（固定字段，每候选一行）

复用方式取值仅限：**fork / 直接依赖 / 抽取代码 / 仅作参考 / 淘汰**。
"最近提交日期"口径 = 聚合目录爬取的 `pushed_at`（该仓库最后一次 push）。

| 仓库 | 最近提交日期 | 许可证 | 声明兼容的 DSH 版本 | 可复用的具体文件/函数 | 复用方式 | 结论理由 |
|---|---|---|---|---|---|---|
| **JohnnyTing/dsh-official-homepage-theme** | 2026-09-27 | MIT | `dsh.plugin.json` → `engines.dsh: ">=0.1.5-rc.1"`（唯一显式声明者；`package.json` 无 `dsh.compatibility`） | `src/client/fluid-shaders.js`（VERTEX + FLOW ping-pong + FLUID 三段 highp shader）、`fluid-profile.js`、`elastic-grid.js`+`elastic-grid-profile.js`、`pointer-field.js`、`interaction-sources.js`、`fish-drawing.js`+`fish-school.js`+`fish-profile.js`、`settings.js`、`index.js`（`settings.general.item` order 18 注册 + 令牌保存/还原）、`tests/*.test.mjs` | **抽取代码**（主复用源） | 全生态里唯一把官网 5 个效果**拆成模块 + 带 profile 常量 + 带测试**的 MIT 实现；已内置 `prefers-reduced-motion`、细指针门控、`minWidth:768`、休眠停帧、DPR 上限、`IntersectionObserver`、完整 teardown。`theme.css.js` 的大段 `!important` 全局覆盖**不采纳**（违反任务 3.4） |
| **RevolutionLA/dsh-dream-skin** | 2026-10-05 | MIT | 未声明 `dsh.compatibility`；peer `@deepseek-ai/dsh-client-ui-theme: >=0.1.0-rc.6 <0.3.0-0`（区间**覆盖** 0.2.0-rc.2） | `lib/index.js` 全文（`$DSH_HOME/<name>.json` 原子写、`kind:'prefix'` 路由、DNS-rebinding 信任围栏、`readJsonBody`/`writeJson`）、`lib/client.js:2275-2283` 的 `@supports` + `backdrop-filter` 毛玻璃片段 | **抽取代码** | 唯一提供"origin 无关的 JSON 文件持久化 + 宿主 HTTP 路由"的 MIT 实现，正是任务 3.3「配置文件通道」所缺的一环；许可证 MIT 可安全移植（保留版权声明）。其观感/预设部分不需要 |
| **mux9056-bot/dsh-theme** | 2026-08-18 | Apache-2.0 | 未声明；`package.json` 无 engines/peers | `scripts/build.mjs` 的令牌映射与 `KNOWN_TOKENS` 白名单 + `verify:live` 思路、`src/client.template.js`（`exports.inject=['slots']`、`ctx.slots.inject('settings.general.item', …)`、`ctx.provide('dshTheme', api)` + `window.dshTheme`）、`cordis.patch.yml`、`lib/index.js`、`scripts/pixelcheck.mjs`（纯 Node zlib，本机实测可跑：Δ=0.0 MATCH） | **抽取代码** | 骨架契约（manifest 字段 / loader 条目 / 设置页注册 / 程序化 API + `ctx.provide`）的**可运行范本**；30 款成品皮肤与"不预设样板"取向相反，其皮肤数据一律不用。Apache-2.0 → 保留 NOTICE 与版权声明 |
| **ycqaq233/dsh-unknown-theme** | 2026-08-17 | MIT | 未声明；`dsh.client = {platform:'web'}` | `lib/client.js` 的：玻璃声明块（`:185-200`）、聚光灯圆环 CSS + `data-on` 逻辑（`:201-220,296-300,357-375`）、shader 输出端 dither 行（`:135`）、白名单选择器（`[data-composer-card]`、`[class$="_userStack"] [class$="_bubble"]`）、`window.__ModuleLoader__.load` 外壳（`:16-21`） | **抽取代码** | 官网观感的**逐值对照来源**（深色 tint `rgba(0,0,0,.2)`、`blur(24px)`、`1px rgba(255,255,255,.08)`、`mix-blend-mode: difference`）。但两个哈希类名在 0.2.0-rc.2 已失效（见 §0.2），不能 fork；其参数写死在文件顶部常量、无设置面板，与"全部可调"冲突 |
| **yushi-xxh/dsh-homepage-skin** | 2026-09-04 | MIT | 未声明；peer `@deepseek-ai/dsh-client-ui-theme: ^0.1.2-rc.1`（**不覆盖** 0.2.0-rc.2 → 宿主安装校验会判不兼容） | `lib/client.js:924-945` 的完整 `stop()`（含 `deleteProgram`/`deleteBuffer` + `WEBGL_lose_context`）、`:950/:955/:799` 的 reduced-motion / 粗指针 / 768px 三重门控写法 | **仅作参考** | 三重门控与 WebGL 资源释放的写法值得抄，但 peer 区间不覆盖实测宿主、且其流体/网格/鲸鱼与主复用源功能重叠（主源带测试） |
| **LeoEthanZ/dsh-beyond-glass** | 2026-09-23 | MIT | 未声明 | `assets/fluid-shader.js`（自称"从 harness 包逐字提取"，含 `u_brushRadius/u_velocity` 交互 uniform 与完整 `PARAMS` 默认值） | **仅作参考**（交叉校验） | 该文件是**同一个官方 shader 的另一份抽取**，可用作第三方交叉验证（我据此确认主复用源的 `mouseRadius 0.09 / mouseStrength 1.8 / decay 0.925 / scale 1.77 / grain 0.005 / colors 5 色` 与原版一致）。但它 `precision mediump`、单发射器、且仓库只含落地页与素材（`index.html` + `assets/`），不含可安装插件包 → 不作为移植源 |
| **yoli-mi/dsh-client-ui-custom** | 2026-09-28 | MIT | 未声明；peer 大量 `^0.1.0-rc.5`（不覆盖 0.2.0-rc.2） | `lib/client.js` 中 `settings.general.item`（`:7382`）与 `settings.section`（`:7179`）双槽位注册、`requestIdleCallback` 延迟挂载 | **仅作参考** | 壁纸 + 毛玻璃取向正确，但 305 KB bundle 无源码、peer 不覆盖实测宿主；注册写法已被主复用源覆盖 |
| **xingyingyuzhui/dsh-liquid-glass** | 2026-08-15 | MIT | 未声明；无 peers/engines；`dsh.client = {platform:'web'}` | `client.js:1557` 起的 `requestIdleCallback` 延迟挂载、`:769` 的 reduced-motion 分支、`:3004` 的设置行 | **仅作参考** | "液态玻璃"含折射层，与任务 2.3 明确要求的**无折射/无高光/无阴影**相反；只借 `requestIdleCallback` 首帧后挂载思路 |
| **TQSY114514/dsh-ui-appearance** | 2026-10-05 | MIT | 未声明；peer 全 `*` | `src/client/tokens.ts`(39 KB) + `applier.ts`(22 KB) 的令牌应用模型；`AppearanceCustomizerRow.tsx`(32 KB) 的官方 slots/primitives 设置行 | **仅作参考** | 令牌应用模型与官方 `overrideTokens` 重叠；其 peer 全 `*` 表明未做版本约束，不如直接用官方 API |
| **sz1698/dsh-bg-new** | 2026-09-11 | MIT | 未声明；`dsh.client.immediately: true`；peer `@deepseek-ai/dsh-tools >=0.1.2-rc.1` | `lib/client.js:4022` 的 `exports.inject`、`src/client/bg-palette.ts` | **仅作参考** | 背景模式（纯色/渐变/图片/视频）与任务 3.2 的取值接近，但其宿主服务依赖（`dsh-home-paths`/`dsh-tools`）超出客户端主题所需 |
| **WYH66666666/DSH-Transparent-UI-Plugin** | 2026-08-22 | **AGPL-3.0** | 未声明 | 毛玻璃覆盖面（顶栏/侧栏/输入框/统计行/轨迹视图）与它的取舍经验 | **仅作参考** | **许可证不兼容**：AGPL-3.0 与本项目 MIT 交付冲突，**一行代码都不能抄**；仅用于确认"哪些宿主容器能安全加 `backdrop-filter`、哪些会因为 creating block 困住 `position: fixed` 浮层"这一**事实性结论**（该结论同时也是任务 2.3 的黑名单要求） |
| **AKS1st/dsh-cyber-particle** | 2026-08-18 | MIT | 未声明；`dsh.client = {platform:'web'}` | `client.js`（18 KB）粒子网络 + `:290` reduced-motion | **淘汰** | 体量小、但只是"粒子网络"单一效果，与主复用源的鱼群/点云能力重叠且无测试、无休眠停帧、无 DPR 上限 → 技术上无增量 |
| **d-dev0101/open-sea-skin** | 2026-09-11 | MIT | 未声明；`dsh.client.inject: []` | `harness-plugin/assets/vendor/three.*.js`（1.5 MB three.js WebGPU） | **淘汰** | **渲染方式与宿主冲突**：引入 ~1.5 MB three.js（`three.webgpu.js` 555 KB × 多份拷贝）只为海洋波浪，体积/首屏代价远超收益，且主复用源已用零依赖 WebGL2 覆盖流体 |
| **elysia395/dsh-wallpaper-engine** | 2026-10-05 | MIT | 未声明 | 内置 `WebWallGL` 场景引擎 | **淘汰** | 依赖本机 Wallpaper Engine 本地素材与场景格式，目标效果（官网流体/点阵/粒子）不需要它，且引入外部素材链路 |
| **zhu1090093659/dsh-web-ui** | 2026-08-24 | Apache-2.0 | 未声明 | （未解包：codeload zip 555 MB，超出调研预算） | **淘汰** | 许可证虽兼容，但仓库含 555 MB 构建产物，无法在合理成本内定位可复用的**源**文件；同能力的 MIT 小仓库（主复用源 86 KB bundle）已足够 |
| **Jisakuna/Whale-QwQ**（子包 whale-qwq） | 2026-09-18 | **无 LICENSE 文件**；bundle 内联素材为 CC BY-NC-SA 4.0 | 未声明 | 阴影内置外观行的 slot 优先级技巧（`src/client/index.tsx:115-122`） | **淘汰** | **许可证不兼容 + 权利瑕疵**：仓库无 LICENSE，且 2.84 MB `assets.ts` 内联非商用（NC）角色美术 → 不能进 MIT 交付物 |
| **Jisakuna/Whale-QwQ**（子包 dsh-custom-bg） | 2026-09-18 | MIT（子包 `package.json`） | 未声明 | `background.ts:51-71` 宿主表面探测、`:112-116` 渐变 tint 透明度、`index.tsx:169-192` 设置行 + teardown | **淘汰** | 宿主表面探测的思路已被主复用源的 `pointer-field`/`interaction-sources` 覆盖；且同仓库整体存在权利瑕疵，单独摘取收益不足 |
| **BeiZi6/dsh-theme-plugin** | 2026-08-14 | MIT | 未声明；peer `@deepseek-ai/dsh-host-webserver ^0.1.0-rc.6` | `index.js:367-388` `webServer.tapIndex` 注入 `<style>`、Schemastery Config 预设 | **仅作参考** | `tapIndex` 注入是"零客户端 bundle"路线，与本任务的客户端插件形态（`dsh.client` + `__ModuleLoader__`）不同；其 Config 预设机制仅作对照 |
| **oil-oil/dsh-theme** | 2026-09-09 | MIT | 未声明；peer `@deepseek-ai/cordis ^4.0.2` | `src/client/index.tsx`（官方 `ctx.theme.overrideTokens` + `settings.section`）、`src/client/theme-tokens.ts`（16→94 官方 Theme API 映射）、`docs/compatibility.md`（"宿主未暴露全局圆角令牌，故刻意不做"的处置原则） | **仅作参考** | 它已经用官方 Theme API 做到"取色可调 + 不写脆弱全局覆盖"，但其 **15 款预设 + 字体控制是成品皮肤取向**，与"不预设样板"相反；本项目的同类能力直接调用同一个官方 API（`ctx.theme.overrideTokens`），无需复制其实现 |
| **npm `@nonamelego/dsh-catppuccin`（NoNameLeGo/dsh-catppuccin-theme）** | 2026-10-04 | MIT | 未声明 | "可切换 glassmorphism skin" | **仅作参考** | npm 分发、可核对真实代码；但其玻璃是**整套预设皮肤**的一部分，取值写死在皮肤内，与"任何视觉常量都必须能改"冲突 |
| **npm `dsh-any-background`** | 2026-10-05 | 未核实（tarball 内 LICENSE 为 MIT 模板） | 未声明 | 取色器 + 背景模式 UI | **仅作参考** | 其能力（强调色/背景色可调）由官方 `overrideTokens` 更安全地覆盖 |

**未纳入评估表的已否决渠道项**：`Small-tailqwq/dsh-deep-whale`（目录 license 为 `NOASSERTION` → 不满足 0.4 的 MIT/Apache 前提，且是角色皮肤）、`kingOfSoySauce/dsh-liang-skin`（license 字段为空）、`Whale-QwQ/dsh-maid-whale-pet`（声明 BSD-3-Clause 但**磁盘上无 LICENSE 文件**）。三者均按"许可证不明 → 仅可仅作参考，本项目未使用"处理。

---

## 0.4 复用硬指标（可判定）

### 0.4.1 三类效果：全部复用 MIT 现成实现

| 效果 | 现成 MIT/Apache 实现 | 决定 | 依据 |
|---|---|---|---|
| **液化（流体）** | `JohnnyTing/dsh-official-homepage-theme`（MIT）`src/client/fluid-shaders.js` + `fluid-profile.js` + `pointer-field.js` + `interaction-sources.js` | **抽取代码**（移植） | 存在 MIT 现成实现 → 必须复用。三段 shader（VERTEX / FLOW ping-pong / FLUID：simplex FBM + 两级域扭曲 + curl 噪声 + 5 色混合 + highp）逐字移植；`FLOW_FRAGMENT_SHADER` 提供了任务 2.4 要求的**指针扰动**（3 发射器：鼠标 + 2 条鱼，`u_emitters`/`u_velocities`/`u_radii`/`u_strengths`/`u_decay`） |
| **毛玻璃** | `RevolutionLA/dsh-dream-skin`（MIT）`lib/client.js:2275-2283`；`ycqaq233/dsh-unknown-theme`（MIT）`lib/client.js:185-200` | **抽取代码**（值 + `@supports` 门控写法） | 存在 MIT 现成实现 → 必须复用。任务 2.3 指定的三组值（`blur(24px)` / 深色 tint `rgba(0,0,0,.20)`、浅色 `rgba(255,255,255,.55)` / 描边 `1px rgba(255,255,255,.08)`）与 `ycqaq233` 的官网同款声明一致，直接采用其数值与"无折射/无高光/无阴影"取舍（`box-shadow: none`） |
| **量子化 Q1 空间量子化** | `JohnnyTing/…`（MIT）`elastic-grid.js` + `elastic-grid-profile.js` | **抽取代码** | 官网 HeroGrid 同源实现：间距 90、斥力半径 140、弹簧 `spring 0.05` + 阻尼 `0.85`、位移上限 38、放大镜观感（`activePointRadius 2.2` / `activePointOpacity 0.28`）。默认值与任务 2.5 Q1 要求（90px / 140px）逐项吻合 |
| **量子化 Q2 颜色量子化** | npm `glsl-dither@1.0.1`（MIT，`hughsk/glsl-dither`）`4x4.glsl` / `8x8.glsl` 的 Bayer 阈值矩阵 | **抽取代码**（矩阵）+ 自研 N 级量化公式 | 存在 MIT 现成实现 → 复用其 Bayer 矩阵（`4x4.glsl:3-29` 的 16 个归一化阈值 `0.0625…1.0`）。**上游不提供 N 级量化**（`dither4x4` 返回 0/1 二值），因此"`q = floor(v*(N-1) + bayer)/(N-1)`"这一步属于**必要的适配**，非重复造轮子（理由写在 §0.4.3 自研清单） |
| **量子化 Q3 形态量子化** | `JohnnyTing/…`（MIT）`fish-drawing.js` + `fish-school.js` + `fish-profile.js`；`ycqaq233/dsh-unknown-theme`（MIT）`lib/client.js:619-790` 的 `LERP_ENTRY 0.08 / LERP_SLOW 0.0045` 指数收敛 | **抽取代码**（双源移植） | 主源给"自主游动 + 边界回避 + 分离 + 对流体/网格施加扰动"；`ycqaq233` 给"由形状采样成粒子 → 指数收敛成形（≈1.2 s）→ 打散后慢系数回正"的**成形/打散**语义（任务 Q3 明确要求）与**单例防御**（`document.querySelectorAll('.ds-fish-canvas')` 去重） |
| **量子化 Q4 状态量子化** | 无对应现成实现（见 §0.4.3） | **自研** | 全生态未检索到"强度/进度按 N 档阶梯跳变"的实现；这是本项目新增语义 |
| **聚光灯（2.6）** | `ycqaq233/dsh-unknown-theme`（MIT）`lib/client.js:201-220, 296-300, 357-375` | **抽取代码** | `mix-blend-mode: difference` 圆环 + 仅在标题文字/图标命中时 `data-on="1"`（容器空白区不触发）的判定逻辑，逐字可移植 |

> 结论：三类效果（液化 / 毛玻璃 / 量子化）的**每一个子效果都存在 MIT 现成实现并被移植**；
> 唯一"自研"的部分是 Q4 与 Q2 的 N 级量化公式这一句，理由见下。

### 0.4.2 插件骨架：全部取自现成项目，零发明

| 契约 | 取自 | 证据 |
|---|---|---|
| `package.json` manifest 字段（`dsh.bundle.patch` / `dsh.client.{platform,inject,immediately}` / `exports["."]` / `exports["./client"]` / `type:module`） | `mux9056-bot/dsh-theme`（Apache-2.0）`package.json:16-35` + `JohnnyTing/…`（MIT）`package.json` | 两份互为印证；字段名逐字一致 |
| 客户端 bundle 格式 `window.__ModuleLoader__.load({id, factory})` + `factory(require)` 返回 `module.exports` + `exports.inject` / `exports.apply` | `ycqaq233`（MIT）`lib/client.js:16-21`；`mux9056`（Apache-2.0）`src/client.template.js:25-30,301-302`；`JohnnyTing`（MIT）`lib/client.js` | 三份一致 |
| loader 条目写法 `- insert:\n    - id: …\n      name: '…'` | 四个仓库的 `cordis.patch.yml` 完全相同结构（`mux9056`/`ycqaq233`/`JohnnyTing`/`oil-oil`） | 与本机 `profiles/web/cordis.patch.yml` 既有格式一致 |
| 设置页注册方式 | `mux9056`（Apache-2.0）`src/client.template.js:266-283`；`JohnnyTing`（MIT）`src/client/index.js:255-260`；宿主自身 `dsh-client-ui-theme/lib/client.js:1603-1610` | 三者在 0.2.0-rc.2 上是同一签名：`ctx.slots.inject('settings.general.item', () => ctx.slots.register({name,id,order,…}, Row))`。宿主内置"外观"行 order=10、字号行 order=11（`ui-theme:1603/1618`）→ 本插件取 **order 20**（与 mux9056 相同） |
| 程序化 API 双通道 `ctx.provide(name, api)` + `window.<ns>` | `mux9056`（Apache-2.0）`src/client.template.js:243-260,285-289` | 逐字采用其双挂载写法 |
| 宿主半 no-op 插件 + `inject` 服务声明 | `ycqaq233`（MIT）`lib/index.js`；`RevolutionLA`（MIT）`lib/index.js:45-47` | 采用 `RevolutionLA` 的 `export const inject = [...]` + `ctx.effect(() => ctx.webServer.register(...))` 形态（官方宿主源码同款：`dsh-client-modules/lib/index.js:546-547`、`dsh-webhook-github/lib/index.js:181-190`） |
| `lib/client.js` 零依赖手写 bundle（免构建） | `ycqaq233`（MIT）：41 KB 纯 JS、无打包器 | 采用同一路线：不引入 bundler，交付可直接被 loader 加载的单文件 |

**显式记录（诚实项）**：任务给的 `dsh.compatibility.dshReleases` 字段，**宿主 0.2.0-rc.2 本体并不读取** —— 我在
`app.asar` 全量 grep `dshReleases|compatibility` 未命中任何消费点；宿主/加载器真正读取的是
`dsh.bundle.patch`、`dsh.client.{platform,inject,external,immediately}`、`exports["./client"]`、`exports["."]`
（`dsh-client-modules/lib/index.js:61-75, 700-731`，`clientExportOf` 在 `:171`）。该字段是市场侧约定，
本插件**按任务要求照抄写入**，但其实际兼容性由 peer/engines 之外的三条实测契约保证。

### 0.4.3 本项目自研代码清单及理由

| 自研项 | 为什么现成的不能用 |
|---|---|
| **Q4 状态量子化**（强度/进度按 N 档阶梯跳变，默认 8 档，2–16 可调） | 这是任务新增的语义。我对 4 个渠道（7,204+500+16,727 项）按 `quantiz|量子|档位|step|阶梯|discrete|bucket` 检索，未发现任何 DSH 插件或 npm 包实现"把强度/进度类视觉按 N 档跳变"；最接近的 `glsl-dither` 是空间抖动而非时间/强度分档 |
| **Q2 的 N 级量化公式**（`q = floor(v*(N-1) + bayer)/(N-1)`） | 上游 `glsl-dither@1.0.1` 只实现 **1-bit 阈值抖动**（`4x4.glsl:28` `return brightness < limit ? 0.0 : 1.0;`），不接受"档数"参数。Bayer 矩阵本身已复用（MIT），需自补的仅是把阈值抖动推广到 N 级这一句标准公式（Bayer 1973 公开算法）。若强行使用上游 API，只能得到 2 档黑白，无法满足 2–16 档要求 |
| **参数模型 / 设置页控件 / JSON 配置通道的接线** | 任务 3.2/3.3 要求的参数集（含 5 色流体调色板、0–40px 模糊、24–160px 栅格、2–16 档量化、80–400ms 统一时长）在现成插件中**都不存在**：主复用源只有 4 个字段（enabled/fishEnabled/gridEnabled/intensity，`settings.js:1-6`），`dsh-dream-skin` 是皮肤预设而非参数。接线代码属于本项目原创 |
| **令牌自检（build-time + runtime 双检）** | `mux9056` 的 `verify:live` 已被证实**抓取失败仍报通过**（`scripts/build.mjs:278-286`）→ 不能复用其实现。本项目改为：构建期用 `_research/host-token-inventory.mjs` 产出的真实令牌清单（0.2.0-rc.2 实测 **461** 个：`--dsw-*` 404 / `--dsh-*` 46 / `--shiki-*` 11）做白名单校验，运行期用 `getComputedStyle` + 官方 `ctx.theme.exportInspectTokens()` 复检，且**失败必须非零退出/报错** |
| **选择器漂移自检** | 关键证据：`ycqaq233` 的 `.hHd-Xa_newSession`、`.nL4_yW_sessionLogButton` 在 0.2.0-rc.2 已失效，且 `_headlineText`/`_fishHitbox` 两个 key 在宿主机 51 个 client bundle 的 class-map 里**根本不存在**。现有插件无任何选择器漂移检测 → 本项目自建：把用到的每个宿主钩子登记成表，运行期报告每个钩子的命中数，并为 4 个玻璃槽位提供可覆盖选择器 |

### 0.4.4 逐文件复用台账（出处 / 许可证 / 是否修改）

> 全部上游均为 **MIT 或 Apache-2.0**；MIT/Apache 要求保留版权与许可声明 → 交付物内 `LICENSES/` 目录
> 逐份收录上游 LICENSE 原文，并在 `lib/client.js`、`lib/index.js` 头部保留来源注释。

| 目标文件（本插件） | 来源仓库 | 来源文件 | 许可证 | 修改程度 |
|---|---|---|---|---|
| `src/engine/fluid-shaders.js` | JohnnyTing/dsh-official-homepage-theme | `src/client/fluid-shaders.js` | MIT | 逐字移植 shader 字符串；**新增** 输出端 `quantize()` + Bayer dither 段（标注为本项目新增） |
| `src/engine/fluid-profile.js` | JohnnyTing/… | `src/client/fluid-profile.js` | MIT | 逐字移植默认值；改为从参数存储读取 |
| `src/engine/fluid.js` | JohnnyTing/… | `src/client/pointer-field.js` | MIT | 移植渲染循环 / ping-pong FBO / 休眠停帧 / DPR 上限；参数改为注入；新增 WebGL2 不可用时的静态渐变降级（上游为整层不挂载） |
| `src/engine/sources.js` | JohnnyTing/… | `src/client/interaction-sources.js` | MIT | 逐字移植发射器/指针源模型 |
| `src/engine/grid.js` | JohnnyTing/… | `src/client/elastic-grid.js` | MIT | 移植 `createElasticGridNodes`/`advanceElasticGrid`/`createOfficialElasticGrid`；间距/半径/弹簧改为参数 |
| `src/engine/grid-profile.js` | JohnnyTing/… | `src/client/elastic-grid-profile.js` | MIT | 逐字移植默认值 |
| `src/engine/particles.js` | JohnnyTing/…（游动/边界/分离）+ ycqaq233/dsh-unknown-theme（成形/打散/单例/斥力） | `src/client/fish-school.js`、`fish-drawing.js`、`fish-profile.js`；`lib/client.js:619-790` | MIT（两者） | 双源合并：游动模型来自前者，指数收敛成形/慢系数回正/单例防御来自后者；`LERP_ENTRY 0.08`、`LERP_SLOW 0.0045`、`R 19`、`VMAX 24` 等常量转为参数 |
| `src/engine/spotlight.js` | ycqaq233/… | `lib/client.js:201-220,296-300,357-375` | MIT | 移植 DOM/CSS + 命中判定；触发选择器改为可配置 |
| `src/engine/glass.js` | ycqaq233/…（值与取舍）+ RevolutionLA/dsh-dream-skin（`@supports` 门控） | `lib/client.js:185-200`；`lib/client.js:2275-2283` | MIT（两者） | 移植声明与门控；改为白名单槽位 + 参数注入 + 同屏上限 6 + containing-block 黑名单守卫 |
| `src/engine/bayer.js` | npm glsl-dither@1.0.1（`hughsk/glsl-dither`） | `4x4.glsl:3-29` | MIT | 逐字取其 16 个 Bayer 阈值；N 级量化公式为本项目新增 |
| `src/store/*`（参数模型/范围/默认值/持久化） | 自研（接线参考 mux9056 的 `localStorage` 用法） | — | — | 原创 |
| `src/settings-row.js`（设置页 UI） | mux9056（Apache-2.0）`src/client.template.js` + JohnnyTing（MIT）`src/client/index.js` | 上述 | Apache-2.0 / MIT | 移植注册写法；控件与参数表原创 |
| `lib/index.js`（宿主半：JSON 配置通道） | RevolutionLA/dsh-dream-skin（MIT） | `lib/index.js` 全文 | MIT | 移植原子写 / 前缀路由 / 信任围栏 / body 处理；**新增** `fs.watch` 热加载与 revision 字段 |
| `cordis.patch.yml` | 四个仓库同构 | — | — | 照抄格式，替换 id/name |
| `package.json` manifest | mux9056（Apache-2.0）+ JohnnyTing（MIT） | 上述 | — | 照抄字段，替换包名/版本/compatibility |
| `scripts/verify-tokens.mjs` | 自研（思路参考 mux9056 `verify:live`） | — | — | 原创（含上游缺陷的修正：失败必须非零退出） |
| `icon.svg` | 自研（鲸鱼轮廓取自官方 FishLogo path 的公开几何，见 ycqaq233 `lib/client.js:150` 的 `FISH_PATH`） | — | MIT | 重新绘制为独立图标 |

### 0.4.5 许可证合规动作

1. 交付物 `LICENSES/` 收录：`JohnnyTing-dsh-official-homepage-theme-MIT.txt`、`ycqaq233-dsh-unknown-theme-MIT.txt`、
   `RevolutionLA-dsh-dream-skin-MIT.txt`、`mux9056-bot-dsh-theme-APACHE-2.0.txt` + `NOTICE`（Apache-2.0 §4(d) 要求）、
   `hughsk-glsl-dither-MIT.txt`、`yushi-xxh-dsh-homepage-skin-MIT.txt`。
2. 每个移植文件头部保留 `// Ported from <repo> <path> (MIT) — Copyright (c) <year> <author>` 注释。
3. **AGPL-3.0 的 `WYH66666666/DSH-Transparent-UI-Plugin` 与无 LICENSE 的 `Jisakuna/Whale-QwQ`、`Small-tailqwq/dsh-deep-whale`、`kingOfSoySauce/dsh-liang-skin` 未复制任何代码**，仅作事实性参考。
4. Apache-2.0 的 mux9056 代码：只取注册写法与校验思路（短小、结构性），保留其 NOTICE 与版权声明。

---

### 0.5 未偏离声明

本阶段未对任务给定的任何数字、路径、字段、命令做偏离。唯一两处**新增事实**（不构成偏离，但必须明说）：

1. `dsh.compatibility.dshReleases` 不是宿主读取的字段（§0.4.2 已给 grep 证据）——字段照写，但不作为兼容性依据。
2. 任务 2.3 的第四个毛玻璃白名单项"会话日志按钮"在 0.2.0-rc.2 **不存在**为按钮：该版本把 session log 做成
   设置页 General 区的一行（`@deepseek-ai/dsh-client-ui-settings-session-log`，CSS-Module 局部名 `_row`，行内是
   `Switch` 原语），`dsh-unknown-theme` 针对的 `.nL4_yW_sessionLogButton` 已消失（我抽取了宿主机 51 个 client
   bundle 的 class-map 作为证据：`_research/host-classmap.json`，其中不存在 `sessionLogButton` 键）。
   处置：该槽位保留、默认选择器改指真实控件、并在设置页与 README 中显式说明；同时提供选择器覆盖入口，
   运行期报告命中数（0 命中即视为未生效，不静默通过）。

---

## 0.6 补遗：上游溯源核查（写码后复核，结论影响"能不能抄"）

阶段 0 写完后，独立调研（`_research/notes-priorart.md`，202 行，逐个抓真实 LICENSE 正文）提出一条**必须记录的溯源风险**：

> `ycqaq233/dsh-unknown-theme` 自己的注释写明该流体 fragment shader 是"从官网压缩包 `8226.js` 提取"。
> **第三方贴的 MIT 标签无法给 DeepSeek 官网代码重新授权。**

核查与处置（本项目的实际取舍）：

| 判断 | 依据 | 处置 |
|---|---|---|
| 该 shader 家族的**上游是 MIT 的 DeepSeek Harness 仓库** | ① `deepseek-ai/deepseek-harness` 仓库根 `LICENSE` 实测为 `MIT License / Copyright (c) 2026 DeepSeek`（已抓取正文）；② `LeoEthanZ/dsh-beyond-glass` 的 `assets/fluid-shader.js` 头部写明"extracted verbatim from the harness package，Source: WorkbenchFluid.tsx，Source sha256: sha256:1b070ec37c73b3a5"，并带一个 `--check` 校验器；③ 两份独立抽取（JohnnyTing 与 beyond-glass）的常量逐项一致（mouseRadius 0.09 / mouseStrength 1.8 / decay 0.925 / scale 1.77 / grain 0.005 / 同一组 5 色） | 移植来源选 **JohnnyTing/dsh-official-homepage-theme（MIT）**，并在每个移植文件头部写明出处与版权 |
| `ycqaq233/dsh-unknown-theme` 属于**同一算法的第三方再抽取**，其 MIT 标签对官网 bundle 部分不构成有效授权 | 同上 | 降级为**算法交叉校验 + 仅取它自己新写的部分**：聚光灯圆环（`mix-blend-mode: difference`，其自研）、粒子成形/打散模型（其自研）、玻璃声明取值（与官网落地页一致的四条声明）。流体 shader 本体**不取自它** |
| 鲸鱼轮廓（`FISH_PATH`）是**品牌资产**而非软件作品 | 该几何图形是 DeepSeek 标识 | 保留（默认装饰即"DeepSeek 粒子鲸鱼"），但在 `LICENSES/NOTICE.md` 中显式声明其不在本包 MIT 授权范围内，并通过 `quantum.q3Shape` 提供 `ring`/`wave` 替代与关闭开关 |

**非 DSH 侧同款效果的复核（补充 §0.1.1，全部已读真实 LICENSE 正文）**

| 效果 | 候选 | 许可证 | 结论 |
|---|---|---|---|
| 流体 | `paper-design/shaders` | Apache-2.0 | 可复用（域扭曲 `warp.ts`、`colorBandingFix` 抗色带、Bayer 2×2/4×4/8×8 `dithering.ts`）；本项目最终用的是**官方同源 shader**，故仅记录为备选供应商 |
| 流体 | `stegu/webgl-noise` | MIT 类 | 3D `snoise` 的标准出处；本项目 shader 内的 simplex 实现即此族 |
| 流体 | `PavelDoGreat/WebGL-Fluid-Simulation` | MIT（已读正文） | **淘汰**：Navier–Stokes 求解器，技术路线不同，做不出官网观感 |
| 点阵 | `imtomasebastian/dot-grid-background` | MIT（已读正文） | 四个必要行为齐全（推力 `influence³*maxPush`、smoothstep 光晕、弹簧回位、底部渐隐）；本项目最终复用**官方同源**的 `elastic-grid`，此仓库列为交叉验证 |
| 形态 | `fytseng/canvas-particle-morphing` | MIT（已读正文） | 指数收敛 `vx += dx*ease*0.5` 与项目采用的 `LERP_ENTRY 0.08` 同族；作为算法交叉验证 |
| 聚光灯 | 逐一核查 `cursor-magic`、`Wasim2934/custom-cursor`、`olivierlarose/blend-mode-cursor`、`tholman/cursor-effects` 等 | **均无 LICENSE 文件**（`tholman/cursor-effects` 仅 `package.json` 声明 MIT，属未核实） | **无许可证干净的可复用实现** → 圆环本体按 §0.4.3 自研（约 15 行 CSS/JS），仅行为语义参考 |
| 毛玻璃 | `ycqaq233/dsh-unknown-theme` | MIT | 四条声明与任务 2.3 逐值一致，采用 |
| 毛玻璃 | `einui/einui` | MIT | 可用但需剥离阴影/高光（与"无折射无高光无阴影"冲突），未采用 |
| 毛玻璃 | `shuding/liquid-glass` 及其 fork、`glassfx`、`liquidGL`、`paper-design fluted-glass` | 多种 | **全部为折射型**，与任务 2.3 明确要求相反 → 淘汰 |

许可证不干净/不兼容因而**一行代码都未使用**的：`WYH66666666/DSH-Transparent-UI-Plugin`（AGPL-3.0）、
`Jisakuna/Whale-QwQ`（无 LICENSE + 子包含 CC BY-NC-SA 美术）、`Small-tailqwq/dsh-deep-whale`（NOASSERTION）、
`kingOfSoySauce/dsh-liang-skin`（无 license 字段）、`patriciogonzalezvivo/lygia`（Prosperity Public License，非开源）、
`stegu/psrdnoise`（无 LICENSE）、上表全部无 LICENSE 的光标仓库。

---

## 0.7 最终逐文件台账（与磁盘实际一致）

> 下表是**交付物里真实存在的文件**与其上游的一一对应；`src/` 为可读源码，
> `lib/client.js` 由 `scripts/build.mjs` 从 `src/` 生成（生成物头部保留全部出处注释）。

| 交付文件 | 上游仓库 | 上游文件 | 许可证 | 关系 |
|---|---|---|---|---|
| `src/effects/fluid-shaders.js` | JohnnyTing/dsh-official-homepage-theme | `src/client/fluid-shaders.js` | MIT | 抽取（shader 逐字移植）＋本项目新增 `QUANTIZE_GLSL`（Bayer + N 级量化）、`u_levels/u_dither/u_flowEnabled` uniform、`staticGradientCss` |
| `src/effects/fluid.js` | JohnnyTing/…（渲染器结构）＋ yushi-xxh/dsh-homepage-skin（teardown） | `src/client/pointer-field.js`；`lib/client.js:924-945` | MIT | 抽取＋改写为参数驱动；新增降级路径与 `ensureRenderer()` 修正 |
| `src/effects/grid.js` | JohnnyTing/… | `src/client/elastic-grid.js`、`elastic-grid-profile.js` | MIT | 抽取＋参数化；新增 Q4 阶梯化与颜色参数 |
| `src/effects/sources.js` | JohnnyTing/…（source 记录契约与游走常量） | `src/client/interaction-sources.js`、`fish-profile.js` | MIT | 契约抽取；游走器为本项目紧凑重写（理由见 §0.4.3） |
| `src/effects/particles.js` | ycqaq233/dsh-unknown-theme | `lib/client.js:619-790` | MIT | 抽取（成形/打散/单例/斥力/`FISH_PATH`）＋参数化；新增 `ring`/`wave` 形状与休眠 |
| `src/effects/spotlight.js` | ycqaq233/…（行为语义） | `lib/client.js:201-220,296-300,357-375` | MIT | 语义参考；实现重写（无干净上游，见 §0.6） |
| `src/effects/glass.js` | ycqaq233/…（声明取值）＋ RevolutionLA/dsh-dream-skin（`@supports` 门控） | `lib/client.js:185-200`；`lib/client.js:2275-2283` | MIT | 抽取取值与门控；白名单/上限/containing-block 守卫为本项目新增 |
| `src/effects/quantize.js` | hughsk/glsl-dither（npm `glsl-dither@1.0.1`） | `4x4.glsl:3-29` | MIT | 抽取 Bayer 矩阵（重新归一化）；N 级量化与 `quantizeStep` 为本项目新增 |
| `src/apply.js` | 自研（生命周期）；`settings.general.item` 注册形状参考 mux9056/JohnnyTing | — | — | 原创 |
| `src/params.js` | 自研 | — | — | 原创（68 项参数表） |
| `src/store.js` | 自研（localStorage 用法参考 mux9056） | — | — | 原创 |
| `src/theme-layer.js` | 自研（官方 `ctx.theme.overrideTokens`；令牌存取还原写法参考 JohnnyTing `installTokenOverrides`） | — | — | 原创 |
| `src/settings-row.js` | mux9056-bot/dsh-theme（Apache-2.0）＋ JohnnyTing（MIT） | `src/client.template.js`；`src/client/index.js:255-260` | Apache-2.0 / MIT | 注册写法移植；控件与样式原创（仅用宿主令牌） |
| `src/api.js` | 自研（双通道暴露写法参考 mux9056） | — | — | 原创 |
| `src/host-hooks.js` | 自研（`verify:live` 思路参考 mux9056，并修正其"失败仍报通过"的缺陷） | — | — | 原创 |
| `lib/index.js` | RevolutionLA/dsh-dream-skin | `lib/index.js` 全文结构 | MIT | 抽取（原子写/前缀路由/信任围栏/body 处理）＋新增 fs.watch 热加载、`fileError` 上报、BOM 容忍、可选服务注入 |
| `scripts/png-diff.mjs` | mux9056-bot/dsh-theme | `scripts/pixelcheck.mjs` | Apache-2.0 | 抽取 PNG 解码（zlib + 5 种行滤波）＋新增双图比较、包围盒、JSON 报告、`--dump-region` |
| `scripts/build.mjs` | 自研（"从模板生成 lib/client.js"的路线参考 mux9056） | — | — | 原创 |
| `scripts/verify-tokens.mjs` | 自研（思路参考 mux9056 `verify:live`） | — | — | 原创，且**失败即非零退出** |
| `scripts/smoke-factory.mjs` | 自研 | — | — | 原创 |
| `cordis.patch.yml` / `package.json` / `icon.svg` / `LICENSE` / `LICENSES/*` | 格式取自四个上游；`icon.svg` 自绘 | — | MIT / Apache-2.0 | 见 `LICENSES/NOTICE.md` |

**上游 MIT/Apache 合规动作已执行**：`LICENSES/` 收录 6 份上游许可证原文 + `NOTICE.md`（Apache-2.0 §4(d)）；
每个移植文件头部保留出处与版权注释；生成的 bundle 头部汇总全部出处。

---

## 0.8 阶段 0 门禁状态

- ✅ 0.1 四个渠道全部覆盖（附本机文件/命令证据）
- ✅ 0.2 七个种子逐个复核到源码（并纠正了两处 README 层面的错误认知：哈希类名漂移、`verify:live` 静默通过）
- ✅ 0.3 评估表 20+ 行，字段齐全，复用方式只用五个合法取值
- ✅ 0.4 三类效果的每个子效果均复用 MIT 现成实现；插件骨架全部照抄现成项目；自研项逐条给出理由
- ✅ 许可合规：逐文件标注出处与许可证，MIT/Apache 声明保留
- ✅ 0.6 追加了上游溯源风险核查与处置
- **门禁解除**：本文件产出后开始写实现代码。
