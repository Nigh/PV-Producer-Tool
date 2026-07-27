# AGENTS.md — PV Tool

## 1) What This Project Is

Browser-based kinetic typography / post-processing engine for PV (music video) style visuals. This repo (`Nigh/PV-Producer-Tool`) is a fork of `DanteAlighieri13210914/pv-tool` and inherits its Non-Commercial License unchanged. Pure frontend SPA — no backend, no server, no Docker. Renders lyrics/text with layered real-time effects on PixiJS, optionally over user-loaded image/video with audio beat reactivity and motion detection.

## 2) Tech Stack & Commands

- **Runtime**: PixiJS 8 (WebGL/WebGPU), GSAP, JSZip; Canvas 2D for texture generation, color extraction, motion detection.
- **Build**: Vite 7 + TypeScript 5.9 (`strict`, `verbatimModuleSyntax`, `noEmit` — tsc is type-check only). ES modules, target ES2022.
- **Commands**: `npm run dev` (Vite dev server, full-reload on `src/**`), `npm run build` (`tsc && vite build`), `npm run preview`.
- No test framework, no linter config beyond tsc. `npm run build` is the only CI-grade check.
- Vite `base` is `/pv-tool/` (override with `VITE_BASE` env var). Deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`. Working branch is `dev`.

## 3) Repo Layout

- `src/main.ts` — single large entry point (~60KB): all DOM/UI wiring, control panel, media/audio loading, save/export.
- `src/core/` — engine and services:
  - `engine.ts` — `PVEngine`: PixiJS app, layer stack, effect lifecycle, post-FX (shake/zoom/glitch/chromatic aberration), HiDPI with auto-downscale when many heavy effects are active.
  - `types.ts` — `TemplateConfig`, `ColorPalette`, `UpdateContext`, `resolveColor()`.
  - `effectCatalog.ts` — UI-facing catalog of all effects (labels, default configs, categories).
  - `aiService.ts` — AI template generation via OpenAI-compatible `/v1/chat/completions`; user supplies base URL + API key at runtime (never hardcode keys). `EFFECT_SKILLS` maps effect ids to Chinese semantic descriptions for the LLM.
  - `templateStore.ts` — custom templates in `localStorage` + share-code encode/decode.
  - `beatProvider.ts`, `motionDetector.ts`, `nowPlayingProvider.ts`, `colorExtractor.ts`, `lrc.ts`, `srtParser.ts`, `ccl.ts` (connected-component labeling for glyph shattering).
- `src/effects/` — one file per effect (~100 files). All extend `BaseEffect` (`base.ts`): `init() → setup()`, `update(ctx)`, `destroy()`; set `heavy = true` for GPU/CPU-costly effects so the engine can frame-skip. Effects are registered by string id in `src/effects/index.ts` (`register()` / `createEffect()`).
- `src/templates/` — preset `TemplateConfig`s (effect id + config lists), aggregated in `src/templates/index.ts`.
- `src/i18n/` — `zh.ts` (source of truth for `LocaleKey`), `en.ts`, `ja.ts`, `t()` helper. New UI strings need all three locales.
- `public/` — static assets; `index.html` + `src/style.css` — the entire UI shell.

## 4) Conventions

- New effect = new file in `src/effects/` extending `BaseEffect` + `register()` in `src/effects/index.ts` + entry in `effectCatalog.ts` (+ `EFFECT_SKILLS` in `aiService.ts` and i18n labels if user-facing).
- Source files carry the license header comment (`PV Tool — Copyright (c) 2026 DanteAlighieri13210914`); keep it on new files.
- **License is Non-Commercial** (relicensed from AGPL-3.0 on 2026/3/24, see `LICENSE` / `COMMERCIAL.md`). Do not vendor in code with incompatible license expectations.
- UI copy is primarily Chinese; code comments are mixed Chinese/English — either is fine.

## 5) Known Facts / Gotchas

- `main.ts` is intentionally monolithic; prefer small additions over refactoring it unless asked.
- `tsconfig` has `noUnusedLocals`/`noUnusedParameters` — dead code fails the build.
- Effects must clean up in `destroy()`; `BaseEffect.destroy()` handles the container tree, but external resources (video elements, intervals, canvases) are the effect's responsibility.
- No environment secrets exist in the repo; the only key (AI API key) is user-provided in the browser.

## 6) Rules For Future Agents (must follow)

- Always read `AGENTS.md` first, then only open files needed for the task.
- Use the **graphify knowledge graph** before raw file exploration (see §6.5).
- Keep changes minimal and consistent with the current single-page, no-backend model.
- If you change architecture, module layout, build commands, deployment, or status assumptions, you MUST update this file in the same change.

## 6.5) Code Exploration: graphify (mandatory)

- This repo has a code knowledge graph at `graphify-out/` (`graph.json` + manifest). Before exploring the codebase with Read/grep/glob, query the graph first — it surfaces cross-file dependencies that grep cannot:
 - `graphify query "<question>"` — scoped subgraph for any code/architecture question
 - `graphify path "<A>" "<B>"` — dependency path between two symbols
 - `graphify explain "<concept>"` — a node and its neighbors in plain language
- After modifying code files, run `graphify update .` to keep the graph current (AST-only, no LLM/API cost).
- **Availability is a hard requirement**: check `command -v graphify` and that `graphify-out/graph.json` exists. If either is missing, STOP and ask the user to install it — `pipx install graphifyy` (CLI name `graphify`), then `graphify update .` to (re)build the graph. Do not silently fall back to grep-only exploration.
- Include this rule in every subagent prompt that involves code exploration.
