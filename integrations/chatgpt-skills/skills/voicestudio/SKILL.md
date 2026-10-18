---
name: voicestudio-audio
description: 规划和调用有权限的语音合成、转写或配音工作流。
---

## Use when
User asks for voice design, transcription, dubbing or authorized voice synthesis.

## Procedure
1. Confirm the requested language, source audio, voice consent and output format.
2. Match the task to an actually deployed VoiceStudio Local API or MCP endpoint.
3. Only submit audio when the user is authorized to process or clone the voice.
4. Record engine/model, latency, sample rate, success/error state and final output location when real calls succeed.
5. Never claim audio generation or natural-sounding output succeeded without returned files and playback inspection.
6. If no backend is connected, give explicit deployment steps and do not fabricate generated speech.

## Upstream
https://github.com/debpalash/VoiceStudio
VoiceStudio has its own software and API/MCP, which require separate installation. License is AGPL-3.0; review use and model rights.
