# NOTICE — third-party code in dsh-deepseek-theme-studio

This package is MIT. It contains code ported from the projects below. Each
project's license text is included verbatim in this directory. See `REUSE.md`
at the workspace root for the full ledger (file → source → license → change).

| Direction | Upstream | License | Copyright |
|---|---|---|---|
| Ported (fluid shaders, elastic grid, pointer field, source record shape, 30 fps/budget discipline) | `JohnnyTing/dsh-official-homepage-theme` `src/client/{fluid-shaders,fluid-profile,elastic-grid,elastic-grid-profile,pointer-field,interaction-sources}.js` | MIT | Copyright (c) 2026 JohnnyTing |
| Ported (glass declaration values, spotlight ring + trigger rule, particle morph model, whale outline) | `ycqaq233/dsh-unknown-theme` `lib/client.js` | MIT | Copyright (c) 2026 ycqaq233 |
| Ported (host JSON-file + fenced prefix route + trust fence; `@supports` glass gate) | `RevolutionLA/dsh-dream-skin` `lib/index.js`, `lib/client.js` | MIT | Copyright (c) 2026 dsh-dream-skin contributors |
| Ported (settings-slot registration shape, `ctx.provide` + `window.*` double exposure, build-time token allow-list idea, PNG decoder in `scripts/png-diff.mjs`) | `mux9056-bot/dsh-theme` `src/client.template.js`, `scripts/build.mjs`, `scripts/pixelcheck.mjs` | **Apache-2.0** | Copyright (c) 2026 mux9056-bot |
| Ported (WebGL teardown discipline: delete programs + `WEBGL_lose_context`) | `yushi-xxh/dsh-homepage-skin` `lib/client.js` | MIT | Copyright (c) 2026 yushi-xxh |
| Ported (Bayer 4x4 threshold matrix, re-normalised for N-level use) | `glsl-dither@1.0.1` (`hughsk/glsl-dither`) `4x4.glsl` | MIT | Copyright (c) 2014 Hugh Kennedy |

## Apache-2.0 obligations

`mux9056-bot/dsh-theme` is licensed under the Apache License, Version 2.0. Its
full text is reproduced at `mux9056-bot-dsh-theme-APACHE-2.0.txt`. In
accordance with section 4:

- the portions taken are identified above and in `REUSE.md` §0.4.4;
- modified files carry a header naming the source and the copyright holder;
- this NOTICE is distributed with the package (it is listed in
  `package.json` → `files`).

No files from that project are redistributed verbatim; the reuse is limited to
structural patterns (the slot-registration call shape, the token allow-list
approach) and the PNG decoder in `scripts/png-diff.mjs`, which was extended
with a two-image comparison and a JSON report.

## Deliberately NOT used

The following were examined and **no code was copied** from them:

- `WYH66666666/DSH-Transparent-UI-Plugin` — **AGPL-3.0**, incompatible with this
  package's MIT distribution. Consulted only for the factual question of which
  host containers can safely take `backdrop-filter`.
- `Jisakuna/Whale-QwQ` — no LICENSE file at the repository root; one sub-package
  inlines CC BY-NC-SA 4.0 (non-commercial) character artwork.
- `Small-tailqwq/dsh-deep-whale`, `kingOfSoySauce/dsh-liang-skin`,
  `tholman/cursor-effects`, `stegu/psrdnoise`, `patriciogonzalezvivo/lygia` —
  license missing, unverifiable, or non-open-source (Prosperity Public License).

## Brand note

`src/effects/particles.js` embeds the DeepSeek whale outline (the `FISH_PATH`
geometry that the DeepSeek web properties use for their own mark) because the
default decoration is specified as the DeepSeek particle-whale. It is a brand
asset, not a software work: it is not covered by this package's MIT grant.
The shape is a parameter (`quantum.q3Shape` = `whale` | `ring` | `wave`), so a
deployment that should not display the mark can switch or disable it.
