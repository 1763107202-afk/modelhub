---
name: archify-system-diagrams
description: 用于 Archify 风格的系统架构图、数据流、时序图和组件关系分析，从代码证据区分事实与设计假设；上游渲染器需单独连接。
---

## Procedure
1. Obtain repository code, interfaces, deployed components and relationship evidence.
2. Separate observed nodes/edges from design assumptions.
3. Produce a versioned, reviewable diagram specification and a concise evidence map.
4. Validate node names, arrows, boundaries, authentication paths and failure routes.
5. If Archify renderer/CLI is unavailable, provide a diagram source or design sketch only, and mark upstream rendering/validation as not run.
6. Do not claim that standalone HTML or visual proof artifacts were generated without the renderer executing.

## Upstream
https://github.com/tt-a1i/archify
Original instruction adapter; rendering engine not bundled.
