# Engineering Six Skills

版本 **0.2.0**：六份独立编写的轻量工作指令，新增 Anatomy 机械原理可视化。为保留已安装插件的升级路径，**内部包名继续沿用 `engineering-five-skills`**；展示名升级为 **Engineering Six Skills**。源码位于 `1763107202-afk/modelhub` 仓库 `chatgpt-skills-integration` 分支的本目录。

| 显示名称 | Skill | 指令层可执行工作 | 尚未连接的上游执行能力 |
| --- | --- | --- | --- |
| Taste-Skill | `design-taste-frontend` | UI 审阅、设计规范、响应式方案 | 原版设计与浏览器脚本 |
| Agent-Reach | `agent-reach-research` | 调用宿主已有授权检索工具并建立证据链 | Agent-Reach CLI 及额外账号渠道 |
| Archify | `archify-system-diagrams` | 系统架构、数据流、图源规范 | Archify 原版交互渲染器 |
| VoiceStudio | `voicestudio-audio` | 语音方案、参数、脚本 | 原版语音模型/服务 |
| MiroFish | `mirofish-simulation` | 多代理推演设计与复现规范 | MiroFish / LLM / Zep 仿真环境 |
| Anatomy | `anatomy` | 机械原理、等轴测、交互设计与可制造性边界 | 原版 SVG/WebGL/实验性 3D 工具包及 Chrome 校验 |

**状态说明**：六份指令已在源码仓库中提供；是否已经在 ChatGPT 账号安装/更新，需在账号侧实际确认。所有上游引擎的 `runtime_status` 仍为 `not_connected`；仓库检查成功不代表原版程序、账号授权或渲染后端已连接。

## 插件清单与验证

- 根 `plugin.json` 使用 Agent Plugins 1.0，OpenAI 展示元数据在 `extensions.com.openai.interface`。
- `.codex-plugin/plugin.json` 保持与根清单名称、版本和展示文案一致。
- 六份 Skill 均放在 `skills/<name>/SKILL.md`，并提供 `agents/openai.yaml`。
- ZIP 仍以原内部包名 `engineering-five-skills/` 为唯一顶层目录，兼容原有插件身份。
- 包内没有上游二进制、脚本、密钥、`mcp.json` 或远程服务连接。
- `gateway/` 为实验性本地 REST 网关，不是 MCP，不包含在 ZIP 中；包括 Anatomy 的 `ANATOMY_ADAPTER_URL` 在内均须部署独立真实适配器后才能配置。

在本目录运行（需要 Python 及 PyYAML）：

```bash
python scripts/build_plugin.py
python scripts/build_plugin.py --output /absolute/path/engineering-five-skills-0.2.0.zip
```

运行实验性网关的独立测试（Node.js 20+）：

```bash
cd gateway
npm test
```

## 安装/升级

具体步骤见 [PLUGIN_CREATOR_SETUP.md](PLUGIN_CREATOR_SETUP.md)。升级时应保留已有插件身份，不要把仅有 GitHub 更新或 ZIP 上传准备视为账号已安装。

## 原版 Anatomy

- 仓库：https://github.com/wheresryan22/anatomy （MIT）。
- 支持的原版客户端包括 Claude Code、Codex 等。Codex 本地安装示例：`npx skills add wheresryan22/anatomy -g -a codex`。
- 原版依赖 Node.js >=20.10 和浏览器进行验证，且 `skills` CLI 可能另有更高 Node.js 版本要求。
- Anatomy 原版可制作等轴测 SVG、可交互 HTML、SVG+WebGL 和实验性 3D。**可视化不等于实体 CAD、结构强度或制造校核。**
- 当前本包的 Anatomy 为独立指令适配，未复制原版源码或浏览器测试脚本。实际产物与能力以宿主可用工具为准。

所有上游出处列在 `registry.json`，使用第三方工具请核对许可证和合法授权，不要提交密钥、Cookie、隐私数据或声音样本。
