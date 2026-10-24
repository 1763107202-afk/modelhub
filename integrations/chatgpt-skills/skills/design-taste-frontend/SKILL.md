---
name: design-taste-frontend
description: 用于 Taste-Skill 风格的前端设计、UI 审核、响应式布局和图片转界面任务，给出可实施的组件规范；这是指令适配，不包含上游脚本。
---

## Procedure
1. Gather the functional goal, existing UI constraints, brand references, target devices and accessibility needs.
2. Identify one specific art direction based on actual product content; do not default to generic gradients and cards.
3. Define information hierarchy, responsive spacing, type scale, semantic interactions and motion constraints.
4. Give implementation-ready component specifications, not aesthetic adjectives alone.
5. Review output at narrow/mobile, tablet and desktop widths; test keyboard navigation and contrast.
6. If the original Taste-Skill scripts/browser tooling are not installed, never claim you executed them.

## Upstream
https://github.com/Leonxlnx/taste-skill
This file is a lightweight original instruction adapter, NOT a copy of the upstream skill, its assets, or browser automation.

## Optional Galaxy / Uiverse UI reference
Only for real UI implementation or review tasks where the project's own components are insufficient: consult `references/galaxy.md`. Use a small number of suitable components as design/implementation references, not the entire library. Keep this subordinate to the design system, semantics, accessibility and performance checks. Preserve provenance and check licensing on actual incorporated code. Galaxy is not a connected runtime, scraper, independent agent or a mandatory dependency. Do not invoke it for unrelated engineering work.
