# Engineering Six Skills — 私人插件升级与校验

> 兼容说明：展示名从 Engineering Five Skills 升级到 Engineering Six Skills；**内部插件 ID/包名仍为 `engineering-five-skills`**，保持已有 Marketplace 和用户安装引用兼容。

## 源码和归档检查

1. 从仓库 `1763107202-afk/modelhub` 的 `chatgpt-skills-integration` 分支读取 `integrations/chatgpt-skills/`。
2. 在该目录执行 `python scripts/build_plugin.py`（需 PyYAML），预期检查六个 Skill 的 Front Matter、路径、元数据和 `registry.json` 状态。
3. 在目录外用 `--output` 生成 `engineering-five-skills-0.2.0.zip`；压缩包唯一顶层仍为 `engineering-five-skills/`。
4. 在 `gateway/` 执行 `npm test`（Node.js 20+），该测试只含 mock 提供方；Anatomy 未配置适配器时应返回 `503 adapter_not_configured`。

## 在 ChatGPT 账号内升级

- 如果可用账号工具提供插件编辑或新版本发布，将 ZIP 交给**现有插件**的升级/发布入口，并保存工具实际返回的插件 ID 和版本信息。
- 若账号工具仅提供 `create_plugin` 且无法指明目标现有插件，**不要贸然创建第二个同名插件**；先在账号中核实原插件的更新方法。
- 若本会话无账号插件更新操作，只能确认 GitHub 源码/归档，不能声称用户账号已切换到六技能版本。
- 在新的会话或插件重新加载后查找 `anatomy`，测试其设计流程，同时确认原五项仍可发现。

## Anatomy 安装后试用

提出任务：“使用 Anatomy 为圆柱式大葱去皮机构提供 SVG/HTML 等轴测交互原理图，表现上料、旋转、气体去皮、下料的状态，区分尺寸假设与已确认参数。”

通过信号：机械状态与标注可追溯；若生成了 HTML/SVG，需验证实际文件存在和交互；若未部署上游 Node 工具和 Chrome，则明确原版渲染与运动/穿模校核 **未执行**。不能以可视化代替 SolidWorks/ANSYS 结构验证。

## 后端边界

六项 `instruction_status=available` 只表示指令文件提供，六项 `runtime_status=not_connected` 表示未连通对应原版程序。`gateway/` 是 REST 试验代码，不是 ChatGPT MCP。即使 `/health` 报告 `configured:true`，也仅表示配置了 URL，不说明其可用。真实 MCP 接入须实现合法协议、服务端部署、鉴权和端到端验收，不得填写项目首页代替 MCP 地址。
