---
name: mirofish-simulation
description: 用于 MiroFish 多智能体情景推演、利益相关者交互和 what-if 分析，定义种子材料、假设和指标；未连接后端时只提供推演计划。
---

## Procedure
1. Define the problem, seed documents, assumptions, agents, timeline and evaluation metrics.
2. Obtain user-approved data. Never publish sensitive seed documents into public repositories.
3. Check that a MiroFish backend, LLM credentials and Zep service are configured before requesting a run.
4. Track scenario ID, parameters, completed iterations and artifacts from actual service responses.
5. State uncertainty, model limitations and reproducibility constraints. A simulation is not a real-world forecast.
6. Without a running backend, offer a simulation plan only, never invented simulation results.

## Upstream
https://github.com/666ghj/MiroFish
Original instruction adapter, not the simulation engine.
