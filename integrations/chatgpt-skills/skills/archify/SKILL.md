---
name: archify-system-diagrams
description: 把代码和设计资料整理为可追溯、结构化的系统架构图与数据流。
---

## Use when
User requests system architecture, dataflow, sequence or component relationship diagrams.

## Procedure
1. Obtain repository code, interfaces, deployed components and relationship evidence.
2. Separate observed nodes/edges from design assumptions.
3. Produce a versioned, reviewable diagram specification and a concise evidence map.
4. Validate node names, arrows, boundaries, authentication paths and failure routes.
5. If Archify renderer/CLI is unavailable, provide a diagram source or design sketch only, and mark rendering/validation as not run.
6. Do not claim that standalone HTML or visual proof artifacts were generated without the renderer executing.

## Upstream
https://github.com/tt-a1i/archify
Original instruction adapter; rendering engine not bundled.
