# 江苏科技大学机械创新实验室交流平台 · Windows 客户端

这是现有 GitHub Pages + Supabase 平台的 Tauri 2 Windows 桌面壳。

## 特点

- 桌面独立窗口运行，无浏览器地址栏。
- 与网页版共用同一套 Supabase 账号、数据库和文件存储。
- 客户端直接加载线上站点，因此网站内容更新后，桌面端重新打开或刷新即可看到最新版本，通常不需要重新打包。
- 需要联网使用；断网时云端登录、资料读取与文件上传不可用。
- 桌面壳不向远程页面开放额外的本地系统权限。

## 本地构建

需要 Node.js、Rust 和 Windows WebView2 构建环境。

```powershell
cd desktop
npm install
npm run icons
npm run build:windows
```

安装包输出位置：

- `src-tauri/target/release/bundle/nsis/*.exe`
- `src-tauri/target/release/bundle/msi/*.msi`

## GitHub Actions

仓库中的 `Build Windows Desktop App` 工作流会在桌面客户端工程发生变更时自动构建，并上传 Windows 安装包 Artifact。也可以从 Actions 页面手动运行。
