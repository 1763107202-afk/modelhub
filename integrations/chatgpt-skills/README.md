# ChatGPT 五项目接入工作区（独立开发分支）

位置：integrations/chatgpt-skills/ 。这个目录与现有 modelhub 网站功能隔离。
当前阶段：**已提交适配设计、5 份轻量指导 Skill、独立 API 网关源码和单元测试；没有把 5 个第三方程序安装到 ChatGPT 网页版或部署为线上服务。**

## 上游原项目

| Skill | 上游 | 本目录内容 | 仍待完成 |
| --- | --- | --- | --- |
| Taste-Skill | https://github.com/Leonxlnx/taste-skill | design guidance | 原生浏览器工作流、运行验证 |
| Agent-Reach | https://github.com/Panniantong/Agent-Reach | search guidance | CLI + 第三方认证、适配服务 |
| Archify | https://github.com/tt-a1i/archify | architecture guidance | 真实渲染器、schema/导出适配 |
| VoiceStudio | https://github.com/debpalash/VoiceStudio | audio guidance | 本地语音服务、API/MCP、模型 |
| MiroFish | https://github.com/666ghj/MiroFish | simulation guidance | LLM/Zep 和独立运行环境 |

本目录 SKILL.md 是新写的简化工作规约，不是五个原版仓库的完整代码。调用需满足真实权限、API、平台条款及上游许可证；不得上传密钥、cookie 或人物敏感音频。特别注意 VoiceStudio 源代码 AGPL-3.0 和模型的独立权利约束。

## 网关运行（Node.js 20+）

在 gateway 目录运行：

1. 设置环境变量 INTEGRATION_KEY（随机强密钥，至少 16 位，绝不提交到仓库）。
2. 按 .env.example 配置专用适配器 URL。网关**不会直接兼容**五款原始应用 API；每个适配器须独立实现下述请求/响应契约。
3. 运行 npm test；运行 npm start。本地默认监听 127.0.0.1:8787。
4. GET http://127.0.0.1:8787/health 查看网关和适配器 URL 配置状态。

POST /v1/execute 的请求体为：

    { "provider": "taste", "task": "audit website navigation", "input": {"site": "example"} }

鉴权请求头：

    X-Integration-Key: <your-secret>

适配器服务器必须接受 POST JSON：

    { "task": "audit website navigation", "input": {"site": "example"} }

并返回 HTTP 2xx + 有效 JSON。网关返回包装后的 result。未配置提供方时返回 HTTP 503，绝不生成假结果。只允许环境变量中预配置 HTTPS 地址或本机回环 HTTP 地址，不能由用户动态指定上游 URL。

## 在 ChatGPT 网页版使用

A. **技能指导路径**：本目录五个 SKILL.md 可用于兼容的开发代理/Skill 环境作为自定义工作规约；它们不会自动注入普通聊天，也不代表成功安装了原生 Skill。

B. **自定义 GPT Action 路径（需要账号支持）**：把 gateway/openapi.yaml 中 servers.url 替换为自己的公网 HTTPS 域名，使用可信的反向代理 / 托管服务将请求转发至本地网关，设置 API key 鉴权（X-Integration-Key；以产品界面当下支持的认证配置为准），再在 GPT Actions 中导入 OpenAPI schema 并单独逐项测试。不支持该认证方式时应调整兼容的认证实现，而不是关闭认证。仅有 GitHub 仓库不能替代部署。

C. **插件路径**：如 ChatGPT Plugin Creator 允许创建自定义插件，可把相同网关作为后端，按插件开发规范建立 manifest/权限并在网页端明确启用。是否支持当前账号中的个人插件发布、配置和生效，必须在 UI 实测。

## 当前状态和验收标准

- 已完成：独立分支、上游项目链接核对、工作流说明、五份适配 Skill、网关代码、OpenAPI、mock 适配器自动化测试代码。
- 待执行：在有 Node 环境的 runner 跑 npm test；部署真实网关和 HTTPS；逐个部署五个不同上游服务/指令运行器；配置环境变量；执行各平台健康检查和实际功能用例。
- 可验证的交付条件：实际服务成功返回内容/音频/架构图/仿真报告；对每个功能保存真实测试证据；普通网页版是否原生调用须在登录后的 ChatGPT 环境进行测试。
- 安全约束：公开仓库不放 token，认证和 HTTPS 必须开启。真实部署建议实施最小权限、请求限流、任务级审计和数据保留政策。/health 仅表示配置了 URL，不是已连通。

禁止声称“已在 ChatGPT 全局安装五个 Skill”或“已部署五个后端”，除非有账号侧启用、真实运行结果和功能验收证据。

