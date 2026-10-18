---
name: voicestudio-audio
description: 用于 VoiceStudio 语音设计、转写、配音和获授权的语音合成，检查真实后端及音频输出；未连接时只提供脚本、参数和接入方案。
---

## Procedure
1. Confirm the requested language, source audio, voice consent and output format.
2. Match the task to an actually deployed VoiceStudio Local API or MCP endpoint.
3. Only submit audio when the user is authorized to process or clone the voice.
4. Record engine/model, latency, sample rate, success/error state and final output location when real calls succeed.
5. Never claim audio generation or natural-sounding output succeeded without returned files and playback inspection.
6. If no backend is connected, offer a narration script and parameters when useful, then give explicit deployment steps and do not fabricate generated speech.

## Upstream
https://github.com/debpalash/VoiceStudio
VoiceStudio has its own software and API/MCP, which require separate installation. License is AGPL-3.0; review use and model rights.
