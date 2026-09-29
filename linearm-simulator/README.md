# 循迹与机械臂仿真实验台

本目录完整导出已发布的第 4 版，来源提交 `39dca7e5f42c393bbf9c7def946031bb78f4db7c`。保留同一套三维模型、Arduino 解释器、运动学、赛道、代码编辑器与参数面板。适配仅涉及静态入口、资源相对路径及构建方式，无需原 Sites 服务、iframe、后端或第三方 CDN。

访问：https://1763107202-afk.github.io/modelhub/linearm-simulator/

## 使用
打开后在循迹、机械臂或融合页输入 / 导入自己的 Arduino 代码，点击「编译并运行」。首次打开三页均为空白，之后保存当前浏览器的草稿。模型不会预设自动巡线，实际动作由当前程序的引脚与舵机输出决定。红色物块已移除。

## 目录
- `index.html`、`assets/`：可直接发布的静态网站。
- `references/`、`examples/`、`favicon.svg`：全部本地资源；示例文件不自动载入编辑器。
- `source/`：完整应用源码、依赖锁文件和测试。
- `version.json`：版本与源提交记录。

## 重新构建
需要 Node.js >= 22.13 和 pnpm 11.25.0。在此目录执行：

```sh
cd source
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

构建仅写入本目录的 index.html、assets 和静态资源，不修改仓库根目录或实验室网站其他文件。提交本目录到 main 后沿用已有的 GitHub Pages 发布流程。开发预览运行 `pnpm dev`。

## 仿真范围
Arduino C++ 子集解释器和近似运动学模型，并非完整 ESP32 芯片仿真。不支持的库或接口会报错，详细范围见网页帮助。舵机零位、尺寸和接线应按实物校准。三维界面依赖 WebGL，仿真在访问者的浏览器内运行。
