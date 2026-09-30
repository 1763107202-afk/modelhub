# 循迹与机械臂仿真实验台

当前为 GitHub 兼容版 v5，基于已发布第 4 版扩展代码支持。原始模型来源提交 `39dca7e5f42c393bbf9c7def946031bb78f4db7c`。保留同一套三维模型、Arduino 解释器、运动学、赛道、代码编辑器与参数面板。采用静态入口、资源相对路径及独立构建方式，无需原 Sites 服务、iframe、后端或第三方 CDN。

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


## 兼容版 v5（2026-09-30）

保留原来的模型、赛道、空白初始编辑器及用户草稿。本次扩展的是代码解释器，不预置自动循迹策略。

- 全局 `struct`、结构体数组、嵌套结构体、成员读写、值复制与初始化列表。
- 一维至四维数组、数组参数、函数引用参数、默认参数和具名/匿名参数的前置声明。
- `typedef`、`using`、非 scoped `enum`、局部 `static`、`volatile` 声明。
- `switch/case/default`，保留贯穿、`break`、`continue` 的实际控制流程。
- 常量宏、函数宏、多行宏、`#ifdef/#ifndef/#else/#endif`，二进制与十六进制数、常见整数转换及位操作。
- `Servo` 数组，`Serial.print/println/printf` 的常用数字格式。
- ESP32 2.x 的 `ledcSetup/ledcAttachPin/ledcWrite`；3.x 的 `ledcAttach/ledcAttachChannel/ledcWrite/ledcWriteChannel`，不允许同一程序混用两代语义。
- PWM 分辨率换算为模型电机的占空比；未接通电机 EN 的 PWM 引脚会给出接线提示。

**引脚修改：**程序中的引脚定义与「校准参数 → GPIO 接线」必须一致。修改代码不自动修改接线，完成后重新编译运行。

**明确的边界：**这不是完整 Arduino 编译器。暂不支持指针、类/模板、结构体成员函数、函数重载、64 位整数、`#if/#elif` 表达式、任意第三方库、Wi-Fi、蓝牙、FreeRTOS 和中断。`sizeof` 仅支持部分基础类型与数组/简单结构体，不提供完整 C++ ABI。浮点使用 JavaScript 数值，并非 ESP32 的逐位浮点/整数提升或指令周期仿真；普通 loop 约每 1 ms 调度。串口是输出日志，不模拟物理串口输入。PWM 仅建模占空比，不模拟脉冲、定时器竞争或电气限制。

新增兼容性用例与原有程序、三维连杆模型用例一同运行；错误仍保留原始代码行号，未支持的接口不会被当作成功执行。
