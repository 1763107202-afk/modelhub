# PROJECT NEXUS · Windows 原生工作站

这是 PROJECT NEXUS 独立桌面应用的专用目录，**不会修改仓库中其他工程或网页项目**。

## 当前阶段

PROJECT NEXUS 1.3 已生成 Windows x64 原生窗口程序（以 PowerShell/WPF 实现 UI，Go 负责单 EXE 启动封装）。由于此环境无法运行 Windows GUI，尚待 Windows 10/11 实机验证。完整程序与源码以当前 ChatGPT 对话中的 ZIP 交付；本仓库目前是项目发布说明，**不是完整源码镜像**。

## 已纳入功能

- 简体中文沉浸式全屏 UI（F11 切换）和原生 AI 悬浮聊天
- OpenAI、DeepSeek、通义千问、硅基流动、Ollama、自定义 OpenAI 兼容接口
- 主动导入 ChatGPT 官方聊天记录（ZIP/conversations.json），本地索引项目摘要；不能直接监听实时聊天
- AI 项目文件夹归属建议、学习与工程软件推荐，均需人工确认
- 悬浮聊天中截图当前显示器或粘贴 Win + Shift + S 区域截图，预览并明确确认后再调用支持图片的模型
- 自动索引只涉及桌面和已授权的工程目录，不复制、移动或删除源工程
- 本地数据保存；密钥由 Windows DPAPI 以当前用户身份加密

## 使用与隐私

1. 解压本对话交付的 Windows 免安装包，运行 `PROJECT_NEXUS_1.3.exe`。
2. 在「NEXUS AI」设置模型接口、模型 ID 和平台 API Key。
3. 需要历史上下文时，主动导入 ChatGPT 官方数据导出；发送历史摘录前需要单独勾选授权。
4. 悬浮聊天可以截图，但图片**不会自动发送**；必须先预览并确认上传。文本模型未必支持图像输入。

**仓库中不存放 API Key、个人聊天记录、截图或本地项目路径。**
