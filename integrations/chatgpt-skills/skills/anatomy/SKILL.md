---
name: anatomy
description: 交互式机械原理与工程概念可视化。基于 Anatomy 风格设计等轴测 SVG、可交互 HTML 和可选 WebGL/3D 演示；这是独立编写的 Skill 指令适配，不含上游绘图工具包及浏览器验收环境。
---

## Objective
Explain a real technical principle with a clear, interactive physical model rather than a decorative 3D picture.
Use for mechanical transmissions, cams, linkages, engineering stations, robot mechanisms, process sequences, signal flow and concept demonstrations.

## Procedure
1. Capture the engineering question, mechanism input/output, dimensions and constraints, target devices, audience and delivery format.
2. Distinguish verified source geometry from conceptual geometry. Never invent component dimensions, tolerances, motion clearances, load ratings or performance numbers as verified engineering facts.
3. Choose a representation grounded in available tooling: self-contained SVG/HTML for isometric and simple animation; canvas/WebGL only when actually implemented; a 3D renderer only if available. Prefer an explanatory schematic over photorealism without evidence.
4. Define a consistent camera, axes, individual parts, kinematic relationships, layering and labels. Give readable exploded states or key poses when useful. Keep dimensions, arrows and cutaway boundaries legible.
5. Connect interactive controls to real state: play/pause, step, speed, component selection and optional exploded view. If code or tooling is available, implement and test these behaviors, including keyboard and mobile access. Otherwise deliver a build specification or diagram source, not a claim that the controls already work.
6. Audit position continuity, collisions or obvious geometry intersections in every sampled pose where geometry is available. Mark any untested interference and any illustrative numerical output.
7. Report exact artifacts generated and checks actually executed. If upstream Anatomy scripts and headless Chrome are absent, state that upstream browser capture, mechanical geometry checks and native 3D/WebGL verification have NOT been run.
8. For manufacturability, CAD, strength or motion simulation, separately require dimensioned SolidWorks/STEP geometry, mechanical analysis and appropriate engineering validation. Anatomy illustrations are not manufacturing-ready CAD.

## Upstream and licensing
- Origin: https://github.com/wheresryan22/anatomy (MIT).
- Full upstream kit: standard Agent Skill, Node.js >=20.10; CLI installation may require newer Node.js. Original uses SVG, WebGL and experimental 3D as distinct output modes. Original script-based visual/browser tests require its repository and suitable browser.
- Upstream full installation in a supported Codex environment: `npx skills add wheresryan22/anatomy -g -a codex`. Installation on the user's computer is not implied by this adapter.
- This file is an independently authored instruction adapter. It does NOT bundle upstream JS, graphics, shaders, browser runner, models or a remote service.
