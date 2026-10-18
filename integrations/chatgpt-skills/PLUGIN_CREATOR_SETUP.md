# Engineering Five Skills — 个人插件安装

本目录首先提供五份可复用指令，不包含已连接的上游服务。不要把指令验证、归档验证、账号创建、账号启用和后端验收混为同一状态。

## 支持账号保存工具的 Plugin Creator 会话

1. 从本分支 `integrations/chatgpt-skills/` 读取并核验源码，执行 `python scripts/build_plugin.py`。
2. 在目录外生成单个插件 ZIP。包内只有一个 `engineering-five-skills/` 顶层目录，包含根清单、兼容清单、五份 Skill 及其展示元数据。
3. 使用 Plugin Creator 的 `create_plugin` 账号保存工具，将归档的绝对本地路径传给 `archive`。这是个人私有创建，不是公开目录提交，也不部署后端。
4. 保留工具返回的确切插件 URL、插件 ID、release ID 和组件诊断。成功返回后打开该插件，按账号界面实际提供的操作安装或启用；不要猜测未出现的 UI 菜单。
5. 在新会话中选择 **Engineering Five Skills**，确认下面五个 Skill 可发现，并逐个执行试用任务。

如果当前会话没有 `create_plugin`，应报告“账号保存待完成”，保留验证后的源码和归档。重新读取 GitHub、导入 OpenAPI 或仅安装 Plugin Creator 本身，都不能证明目标插件已经创建。若使用网页登录路径，必须在登录后的真实个人插件管理界面核对创建/上传能力；没有出现该功能时，不能编造安装入口。

## 五项安装后试用

| Skill | 示例任务 | 验收信号 |
| --- | --- | --- |
| `design-taste-frontend` | 改进工程工作站首页，适配 390px 手机和 1440px 桌面 | 组件、断点、键盘交互和验收细节，不声称运行上游脚本 |
| `agent-reach-research` | 从 GitHub 核对本仓库网关的接口与鉴权 | 真实读取、来源链接、证据，不声称 CLI 已安装 |
| `archify-system-diagrams` | 分析本仓库网关的架构、鉴权及失败路径 | 区分事实与设计，提供图源及证据，明确上游渲染器状态 |
| `voicestudio-audio` | 制作约 30 秒船舶 VR 导览女声，目标为 48kHz WAV | 无真实服务时明确未生成音频，给脚本、参数和接入步骤 |
| `mirofish-simulation` | 设计 8 周实验室汇报频率变更推演 | 无真实服务时只交付计划，不编造运行 ID、迭代数或结果 |

当前源码支持直接审阅或在兼容 Skill 的执行环境中加载。账号保存与安装状态仍须以各自实际返回及会话发现结果确认。

## 后续连接真实运行能力

分别部署有授权的 Agent-Reach CLI 适配器、Archify 渲染器、VoiceStudio 服务和 MiroFish/LLM/Zep 环境，核验真实功能响应后再接入插件。仓库 `gateway/` 是 REST 实验代码，不是 MCP。需要远程 MCP 时，必须实现真实 Streamable HTTP 协议、部署到已验证 HTTPS 域名并完成鉴权；若绑定现有 App，使用平台实际返回、格式符合规范的 App ID，不可用插件 ID 代替。

每个后端应单独记录状态：未部署、已部署未验证、已连接并通过功能验收。`/health` 中 `configured:true` 仅表示配置了 URL，不能标为已连接。
