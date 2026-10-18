# Engineering Five Skills

五份轻量指令适配组成的个人插件，包名 `engineering-five-skills`，版本 `0.1.1`。来源为 `1763107202-afk/modelhub` 的 `chatgpt-skills-integration` 分支。它们是本仓库独立编写的工作规约，不是五个上游项目的完整代码、二进制程序或已连接账号。

| 显示名称 | Skill 名称 | 当前可以做什么 | 上游运行状态 |
| --- | --- | --- | --- |
| Taste-Skill | `design-taste-frontend` | 界面审阅、组件规范、响应式设计和验收计划 | 上游脚本未连接 |
| Agent-Reach | `agent-reach-research` | 使用当前环境确实可用且有授权的检索工具整理证据 | Agent-Reach CLI 未连接 |
| Archify | `archify-system-diagrams` | 基于代码编写架构说明、图源与证据映射 | Archify 渲染器未连接 |
| VoiceStudio | `voicestudio-audio` | 旁白脚本、语音参数与接入计划 | 语音后端未连接，不会据此生成音频 |
| MiroFish | `mirofish-simulation` | 推演计划、假设、代理角色和复现规范 | MiroFish/LLM/Zep 未连接，不会据此运行仿真 |

Skill 可以结合宿主实际开放的工具工作。宿主原有 GitHub、搜索、Mermaid 或其他工具的成功使用，不代表同名上游程序已经安装。

## 清单与打包

- 根 `plugin.json` 使用 Agent Plugins 1.0，OpenAI 展示信息在 `extensions.com.openai.interface`。
- `.codex-plugin/plugin.json` 保留旧客户端兼容层，两份清单的名称、版本、展示信息和默认提示语一致。
- 五份 Skill 均放在 `skills/<声明名称>/SKILL.md`，各自带有 `agents/openai.yaml`。
- 发布包包含五份指令及元数据。没有 `mcp.json`、`.app.json`、后端地址、密钥或外部工具依赖。
- `gateway/` 仅为仓库中的实验性 REST 网关，未部署、不是 MCP，且从插件发布包排除。不能把 `/health` 或 `/v1/execute` 填成 MCP 地址。

在源码目录运行兼容性预检（需要 PyYAML）：

```bash
python scripts/build_plugin.py
```

在目录外生成内部安装归档：

```bash
python scripts/build_plugin.py --output /absolute/path/engineering-five-skills-0.1.1.zip
```

脚本解析 JSON/YAML，检查五个 Skill 的名称、目录、展示元数据、默认提示语和状态，随后检查归档层级、引用文件、软链接及排除项。预检通过不代表账号已创建或安装插件。

## 个人插件安装与验收

见 [PLUGIN_CREATOR_SETUP.md](PLUGIN_CREATOR_SETUP.md)。只有账号保存操作成功并返回插件身份后，才可称为“已创建”；只有账号侧启用并成功加载五份 Skill 后，才可称为“已安装”。GitHub 分支、marketplace 配置和 ZIP 文件本身都不是账号安装证明。

## 实验性网关

源码位于本目录的 `gateway/`。Node.js 20+ 可运行 `npm test`；单元测试使用本地 mock 适配器，不能视为真实上游验收。

网关直启监听 `127.0.0.1:8787`。执行接口要求至少 16 字符的 `INTEGRATION_KEY`，通过 `X-Integration-Key` 验证。每个提供方需要独立适配器，接受 `POST {"task":"...","input":{}}` 并返回 JSON；不能直接指向原项目首页。未配置提供方返回 `503 adapter_not_configured`。`GET /health` 只报告 URL 配置，不验证连通性。公网部署和 MCP 接入需另行实现和验证。

上游出处见 `registry.json`，未复制上游代码或模型。使用第三方程序时需另行核对其许可证与模型、语音使用权。禁止提交令牌、cookie、私密录音或其他秘密。
