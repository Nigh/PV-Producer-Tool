# PV Producer Tool

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Create music-video typography and layered visual effects in a browser, using timestamped lyrics, optional artwork/video and audio. The current workflow is selecting a lyric shot, framing it, editing its effect instances and post-processing, then previewing and exporting.

## Capabilities and Constraints

- Pure frontend: Svelte 5, PixiJS 8, existing design system. No backend or AI generator.
- Camera geometry, effect groups and post-processing inherit forward independently; explicit checkpoints stop the corresponding inheritance.
- Multiple instances of one effect have independent parameters and colors. Nested configurations remain editable.
- Editing selection is independent of playback. Projects retain lyrics and visual settings; media files remain local.
- Fixed design resolution, aspect-locked camera framing, seek-safe camera motion, no background flash between adjacent shots.
- Chinese, English and Japanese UI; existing non-commercial license and deployment retained.

## Product Principles

- Show the editing target, inherited source and change range together.
- Keep framing, effects and post-processing separate within one persistent workbench.
- Reuse existing controls and storage, keep the preview prominent, and expose complex properties progressively.
