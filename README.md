# PV Producer Tool — Kinetic Typography & Post-Processing for Music Videos

>[!NOTE]
**This is a fork** of [DanteAlighieri13210914/pv-tool](https://github.com/DanteAlighieri13210914/pv-tool).  
It retains and inherits the original author's license in full:  
The project is distributed under the original **Non-Commercial License** (see [License](#license) below).  
All original code and assets remain © DanteAlighieri13210914.

A browser-based visual effects engine for creating PV (Promotional Video) / MAD (Music Anime Dōga) style kinetic typography and post-processing overlays, built with [PixiJS](https://pixijs.com/) and TypeScript.

Designed for the Japanese PV / music video community and anyone creating lyric videos, motion graphics, static-image flow videos, or real-time visual performances.

## What It Does

PV Producer Tool takes text (lyrics, titles, poetry) and renders it with layered visual effects in real time — no video editing software required. Think of it as a programmable, template-driven motion graphics compositor that runs entirely in the browser.

**Core capabilities:**

- **18 preset templates** — curated visual styles from clean typography to cyberpunk HUDs, each combining multiple effects into a cohesive look
- **77 configurable effects** — geometry, text layouts, overlays, textures, organic shapes, composition guides, glyph shattering, and more
- **Custom mode** — mix and match any effects from the catalog to build your own style
- **AI template generator** — describe the mood you want and let an LLM (any OpenAI-compatible API, your own key) compose a template for you
- **Template sharing** — export/import custom templates as compact share codes and shareable URLs
- **Media input** — load images or videos as background layers with automatic color extraction
- **Audio-reactive** — BPM-synced beat reactivity drives animations and camera effects
- **Lyrics timing** — LRC / SRT subtitle import for time-synced text
- **Motion detection** — real-time browser-based object tracking for interactive HUD overlays
- **Post-processing** — shake, zoom, tilt, glitch, hue shift, chromatic aberration
- **Custom fonts** — pick any locally installed font via the Local Font Access API
- **Performance controls** — preview FPS limit with live FPS readout; HiDPI rendering with automatic downscaling when many heavy effects are active
- **i18n** — Chinese, English, and Japanese UI

## Templates

| Template | Style |
|---|---|
| 蓝色冲击 | Bold blue geometric impact |
| 斩击 | Kinetic split with diagonal energy |
| 蓝色构成 | Deconstructed blueprint with physics formulas (best with video) |
| 赛博废墟 | Cyber grunge |
| 几何 | Pure geometric composition |
| 黑客帝国 | Matrix-style falling code rain |
| 夜之城监控 | Cyberpunk HUD with motion tracking (best with video) |
| 情绪电影 | Cinematic emotion overlay (best with video) |
| 歇斯底里之夜 | Radial rectangles with glowing text cards (photosensitivity warning) |
| 蛛网 | Spider-web tension lines |
| 错落文字 | Staggered rhythmic typography |
| 冷静的反派 | Calm villain noir |
| 少女云朵 | Girly clouds |
| 格子花边 | Sweet pink lattice |
| Fly Me to the Moon | Starry lunar romance |
| Kawaii像素 | Kawaii pixel / retro desktop |
| 案发现场 | Crime scene tape and evidence |
| 春日影 | Haruhikage-inspired mood |

## Effects Library

Effects are organized by layer and category:

- **Background** — texture fills, gradients, triangle grids, checkerboards, color blocks, pixel backgrounds
- **Decoration** — geometric shapes (circles, diamonds, lines, crosses), flowing lines, burst rays, perspective grids, composition guides (golden spiral, rule of thirds, phi grid), organic blobs, clouds, planets, star trails
- **Text** — hero text, scattered text, text strips, text cards, outline text, layered text, glow cards, vertical sub-text, formula overlays, falling text rain, wave text, staggered text, pixel typewriter, glyph shattering
- **Overlay** — vignette, color mask, chromatic aberration, glitch bars, scanlines, film grain, dot screen (halftone), HUD elements, crime tape, paper tear
- **Motion** — real-time motion detection brackets with target tracking

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

Open the browser and use the controls:

1. **Select a template** from the dropdown, or choose "Custom" to build your own
2. **Enter text** — use `/` to separate segments (e.g. `春を告げる/夜を越えて/踊れ踊れ`)
3. **Load media** — drag in an image or video as background
4. **Load audio** — add music for beat-reactive animations
5. **Adjust parameters** — animation speed, motion intensity, segment timing, post-FX
6. *(Optional)* **AI generate** — plug in an OpenAI-compatible endpoint and API key to generate templates from a text description

## Tech Stack

- **[PixiJS 8](https://pixijs.com/)** — WebGL/WebGPU 2D rendering
- **TypeScript** — full type safety
- **Vite** — development and build tooling
- **GSAP** — animation tweening
- **Canvas 2D** — motion detection, texture generation, media analysis

## License

This fork inherits the upstream **Non-Commercial License** unchanged.

- **Non-Commercial License** — see [LICENSE](LICENSE) for full terms
- **Commercial License** — see [COMMERCIAL.md](COMMERCIAL.md) for paid license terms; commercial licensing is handled by the original author

Free for personal use, educational research, and non-commercial community projects.
Any commercial use requires a paid commercial license from the original author.

## Credits

- Original project: [pv-tool](https://github.com/DanteAlighieri13210914/pv-tool) — Copyright (c) 2026 [DanteAlighieri13210914](https://github.com/DanteAlighieri13210914). All rights reserved.
- Fork maintenance and additional features: [Nigh](https://github.com/Nigh)
