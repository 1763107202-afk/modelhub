---
name: mirofish-simulation
description: 用于可解释的多智能体情景推演，明确区分模拟假设和现实预测。
---

## Use when
User requests multi-agent what-if scenarios, stakeholder interactions or simulated developments.

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
