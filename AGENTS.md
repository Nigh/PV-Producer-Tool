# AGENTS.md — PV Tool

## 1) What This Project Is

Browser-based kinetic typography / post-processing engine for PV (music video) style visuals. This repo (`Nigh/PV-Producer-Tool`) is a fork of `DanteAlighieri13210914/pv-tool` and inherits its Non-Commercial License unchanged. Pure frontend SPA — no backend, no server, no Docker. Renders lyrics/text with layered real-time effects on PixiJS, optionally over user-loaded image/video with audio beat reactivity and motion detection.

## 2) Tech Stack & Commands

- **Runtime**: PixiJS 8 (WebGL/WebGPU), GSAP, JSZip; Canvas 2D for texture generation, color extraction, motion detection.
- **UI**: Svelte 5 (runes) + Tailwind CSS v4 + daisyUI v5, themed by `@xianii/design-system` (imported in `src/app.css`).
- **Build**: Vite 7 (`@sveltejs/vite-plugin-svelte` v6, `@tailwindcss/vite`) + TypeScript 5.9 (`strict`, `verbatimModuleSyntax`, `noEmit`). Type checking via `svelte-check` (covers .ts and .svelte).
- **Commands**: `npm run dev` (Vite dev + HMR), `npm run check` (svelte-check), `npm run build` (`svelte-check && vite build`), `npm run preview`.
- No test framework. `npm run build` is the CI-grade check; `npm run check:shots` runs the assert-based shot-math self-check (node, no framework); `tests/shotCamera.smoke.html` is a browser integration smoke for the shot camera (open via dev server).
- Vite `base` is `/pv-tool/` (override with `VITE_BASE` env var). Deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`. Working branch is `dev`.

## 3) Repo Layout

- `src/main.ts` — slim entry: mounts the Svelte `App` (UI lives in `src/ui/`).
- `src/ui/` — Svelte UI layer:
  - `store.svelte.ts` — runes state (`ui`), the `PVEngine` instance, and all template-management actions (select/save/delete/share-code/AI-generate/URL-param init). The single source of truth for UI↔engine sync.
  - `App.svelte` — left-sidebar navigation shell (nav rail + active section), engine mount, H-key hide-all, AI loader overlay, footer. Mobile: sidebar becomes an overlay drawer.
  - `sections/` — one component per nav section (Settings first): Settings (aspect 16:9|9:16, BPM + beat offset 0–1, beat react, canvas color/font/FPS/theme/NP-listen), Assets/素材 (timestamped LRC only, audio, 曲绘/illustration), Shots (per-lyric-line shot editor: aspect-locked framing, per-line template pick + speed/motion/opacity overrides, collapsed Template Manager at the bottom — Template is no longer a nav item), PostFx, Effects (grid; toggling while a preset is active auto-switches to Custom), Ai, Export. Player bar (seek/prev/play/next/clock) sits directly under the preview frame (`PlayerBar.svelte`).
  - `theme.svelte.ts` — xianii / xianii-light theme switch persisted in localStorage; aspect ratio and beat offset also persist there.
  - `recorder.svelte.ts` — MediaRecorder + PNG-sequence (alpha) export. `copyUrl.ts` — copy-URL modal.
  - `Slider.svelte` — labeled range control.
- `src/app.css` — Tailwind + design-system import + residual global styles (panel layout, toast/modal, AI loader).
- `src/core/` — engine and services (framework-free):
  - `engine.ts` — `PVEngine`: PixiJS app, layer stack, effect lifecycle, post-FX (shake/zoom/glitch/chromatic aberration), HiDPI with auto-downscale when many heavy effects are active.
  - `types.ts` — `TemplateConfig`, `ColorPalette`, `UpdateContext`, `resolveColor()`.
  - `effectCatalog.ts` — UI-facing catalog of all effects (labels, default configs, categories).
  - `aiService.ts` — AI template generation via OpenAI-compatible `/v1/chat/completions`; user supplies base URL + API key at runtime (never hardcode keys). `EFFECT_SKILLS` maps effect ids to Chinese semantic descriptions for the LLM.
  - `templateStore.ts` — custom templates in `localStorage` + share-code encode/decode (JSON+deflate — new optional `TemplateConfig` fields like `shots` pass through automatically, backward compatible).
  - `shotMath.ts` — pure, time-parametric shot-view math (cover framing, Ken Burns motion, in/out transitions); seek-safe by construction, covered by `tests/shotMath.check.ts`.
  - `shotAspect.ts` — canvas aspect ↔ normalized shot-rect helpers (locked framing for 16:9 / 9:16).
  - `shotCamera.ts` — `ShotCamera`: crops per-shot textures from the full-resolution source image (lazy + cached, margin-expanded), dual-sprite crossfade between shots. Engine keeps `sourceImage` at full resolution; the base media texture is downscaled to the queried GPU max texture size (capped 8192).
  - `beatProvider.ts` — BPM metronome + beatOffset (0–1 beats) drives `beatIntensity` from playback time (not audio-energy onset); also owns optional audio element clock. Also: `motionDetector.ts`, `nowPlayingProvider.ts`, `colorExtractor.ts`, `lrc.ts`, `srtParser.ts`, `ccl.ts` (connected-component labeling for glyph shattering).
- `src/effects/` — one file per effect (~100 files). All extend `BaseEffect` (`base.ts`): `init() → setup()`, `update(ctx)`, `destroy()`; set `heavy = true` for GPU/CPU-costly effects so the engine can frame-skip. Effects are registered by string id in `src/effects/index.ts` (`register()` / `createEffect()`).
- `src/templates/` — preset `TemplateConfig`s (effect id + config lists), aggregated in `src/templates/index.ts`.
- `src/i18n/` — `zh.ts` (source of truth for `LocaleKey`), `en.ts`, `ja.ts`, `t()` helper. New UI strings need all three locales.
- `public/` — static assets; `index.html` is just the mount point.

## 4) Conventions

- New effect = new file in `src/effects/` extending `BaseEffect` + `register()` in `src/effects/index.ts` + entry in `effectCatalog.ts` (+ `EFFECT_SKILLS` in `aiService.ts` and i18n labels if user-facing).
- Source files carry the license header comment (`PV Tool — Copyright (c) 2026 DanteAlighieri13210914`); keep it on new files.
- **License is Non-Commercial** (relicensed from AGPL-3.0 on 2026/3/24, see `LICENSE` / `COMMERCIAL.md`). Do not vendor in code with incompatible license expectations.
- UI copy is primarily Chinese; code comments are mixed Chinese/English — either is fine.

## 5) Known Facts / Gotchas

- Preview stage letterboxes into a fixed 16:9 or 9:16 `#pv-container` frame; PIXI `resizeTo` that frame so export matches the chosen aspect. On canvas resize the engine debounces 200ms then **schedules** a template reload for the next ticker tick (never destroy the scene graph inside a resize/render callback — Pixi v8 will crash on null `TextureSource.alphaMode`). Same deferral applies to per-shot template switches. Destroy paths clear `filters` before `destroy()`. Lyrics require timestamped LRC (no `/` text split).
- Templates are per-shot effect sets: `Shot.template` selects the template for that lyric line (inherits forward like the framing rect); `Shot.animationSpeed/motionIntensity/bgOpacity` override globals for that line only. Engine switches templates at segment boundaries via `templateResolver` injected from the UI store.
- `src/core/` must stay framework-free (no Svelte imports); UI state belongs in `src/ui/store.svelte.ts`.
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
