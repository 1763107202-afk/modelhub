# 小圣的手机 · Android 增强版

本分支为独立 Android 安装工程，**不修改原 modelhub 实验室网站**。

## 获取 APK

在 [GitHub Actions](https://github.com/1763107202-afk/modelhub/actions/workflows/xiaosheng-enhanced-apk.yml) 中选择分支 \`xiaosheng-phone-android\`、运行后下载 \`XiaoSheng-Enhanced-Android-APK\`，ZIP 内的 \`mobile-debug.apk\` 可安装。仅用于个人测试；debug 签名不是正式上架签名。

## 来源及增强

保留小圣的手机原版静态资源与交互，构建时从作者原仓库固定提交 \`4f6ce806f61f0d515c8467345feb3c28945aad62\` 获取代码和图像，方便可重复构建。原项目仓库：https://github.com/kai-da-wang/xiaosheng-phone 。

增加 Android 安全设置（DeepSeek Key、阿里云北京地域 API Key、Workspace ID、模型、五位女主音色）；在微信聊天中通过原生 HTTP 调用 DeepSeek，失败退回原角色离线回复；语音优先或混合模式支持阿里云 CosyVoice V3 Flash 语音消息。位置菜单提供 8 个虚构地点、角色主动分享模拟位置，以及 30 分钟虚构共享说明，**不申请真实 GPS 权限**。这是个人测试版，不代表全部设想中的自定义女友、完整朋友圈、钱包等功能均已完成。

## 数据与安全

API 密钥保存到 Android Keystore 加密的本机私有配置，既不在 GitHub 中也不编入 APK；聊天内容需要发送至你配置的云模型 API，产生 API 计费；APK 需要联网使用 AI。原版图片及手机 UI 均打包在 APK 内，可以离线进入手机。请不要公开分享装有真实 API Key 的设备备份。

**注意**：原作者仓库未标明宽泛的开源许可，本构建遵照用户表示已得到作者允许自行使用的情况；再发行图像或人物资产前仍应确认许可范围。

## 设置路径

安装 APK → 右上角「⚙ AI」→ 填写 DeepSeek API Key / 阿里云百炼 Key / 北京 Workspace ID → 保存。也可以从手机「设置 → AI 服务配置」打开。语音音色不应跨模型使用，支持用户在设置中覆盖音色 ID。
