# PROJECT NEXUS｜全中文工程工作站

> 当前状态：**Electron Windows 版工程源码已提交，自动编译流程已配置；Windows 完整功能验收尚未完成。** 不应将“已提交源码”视为“已成功构建正式版”。

## 为什么改造

旧版本 Go + PowerShell/WPF 在 Windows 上反复出现 `ShowDialog()` 空引用异常，并且主工程文件入口不明显、聊天响应失败无法正确反馈。新版本采用 Electron 原生 Windows 桌面应用窗口，不再通过 PowerShell 显示 UI，也无需用户配置 Python。

## 已实现源码模块

- 高对比简体中文桌面界面，可全屏显示，支持单独置顶 AI 聊天悬浮窗口
- 新建工程项目与**明确的工程源文件/文件夹抽屉**，一键打开和定位真实磁盘文件，取消映射不删除文件
- 用户明确创建的验收任务与进度统计；**聊天记录不会被自动当成已完成任务**
- 软件启动台：扫描 Windows 桌面与开始菜单快捷方式，根据关键词进行类别推荐、搜索、收藏后启动
- 工作任务看板
- OpenAI / DeepSeek / 通义千问 / 硅基流动 / Ollama / 自定义兼容接口的模型配置和聊天请求；HTTP 错误展示具体原因
- 截取显示器图像，或者粘贴 Win+Shift+S 截图；先预览再主动发送到有视觉能力的模型
- 人工导入 ChatGPT 官方 `conversations.json`，本地存储摘录；**无法在后台读取用户当前 ChatGPT 实时聊天**
- API Key 在 Windows 安全存储加密；工程数据写入本机 Electron 用户数据目录

## 尚需完善和验收

- GitHub Actions 实际 Windows 编译成功状态、安装包启动及签名
- 原生 Windows 真机截图、AI 连续对话、设置持久化的端到端测试
- AI 自动映射：当前优先使用人工映射和授权目录，云端 AI 归属判断尚不是完整自动流水线
- 全局快捷键、系统级桌面 Dock、后台文件增量监测
- DeepSeek 等纯文本模型不具备通用截图理解能力；截图必须切换支持图片的模型

## Windows 构建

本目录源文件：`main.js`、`preload.js`、`renderer.js`、`index.html`、`package.json`。

GitHub 工作流：[NEXUS Windows 构建](https://github.com/1763107202-afk/modelhub/actions/workflows/nexus-windows.yml)。

在 Windows 环境本地构建：

```powershell
cd project-nexus
npm install
npm test
npm run build
```

构建成功后在 `project-nexus/dist` 下生成安装包和便携版。无需 Python；构建需要 Node.js，运行已编译软件不需要 Node.js。

## 隐私原则

用户的聊天记录、API 密钥、Windows 私有路径和屏幕截图**不进入公开 GitHub 仓库**。截图只有用户主动发送才发往模型服务商；本地映射仅保存引用，不复制、移动或删除原工程。
