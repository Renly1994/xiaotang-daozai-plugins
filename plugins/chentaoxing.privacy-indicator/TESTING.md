# 测试说明

插件 ID：`chentaoxing.privacy-indicator` · 版本 1.4.2

## 自动用例

在插件目录运行：

```powershell
node --test fixtures/test.cjs
```

共 22 条，覆盖以下行为：

| 用例 | 期望 |
|---|---|
| 清单字段 | `owner=status`，声明 `status.page`、`status.canvas`、`island.pinned`、独立设置项和 `source.read: file` |
| 无设备信息或来源不可用 | `state=offline`，不返回常驻位，不伪装成空闲 |
| 摄像头占用 | 常驻位红点 + 红色滚动文字，状态页红色 `pulse` 亮块，列出 Zoom |
| 麦克风占用 | 常驻位绿点 + 绿色滚动文字，状态页绿色 `pulse` 亮块，列出 Chrome |
| 双设备同时占用 | 胶囊左右两半各一个同色圆点和滚动文字；状态页上下两行同时 `pulse` |
| 分设备开关 | 关闭摄像头只影响摄像头；只开麦克风时只闪烁麦克风 |
| 无人占用 | `state=idle`，不返回常驻位或画布 |
| 数据损坏 | 退回未知态 |
| 宿主注入设备信息 | `input.devices` 路径同样可用 |
| 超长程序名 | 列表、摘要、跑马灯分别按上限截断 |
| 程序过多 | 每设备最多 3 条、总计不超过 8 条，摘要注明总数 |
| 新占用提醒 | 只在首次出现时提醒一次，释放后不提醒 |
| 存储损坏 | 按空存储处理，不影响当前读数 |
| 输出体积 | 展示输出不超过 16 KiB |

## 真机验收（Windows 10 / 11）

| 场景 | 期望 | 结果 |
|---|---|---|
| 打开相机或会议软件 | 常驻位出现摄像头颜色与程序名，状态页出现 `pulse` | 2026-11-27 本机通过 |
| 关闭相机或会议软件 | 读数归零，常驻位与状态页闪烁撤下 | 2026-11-27 本机通过 |
| 会议软件占用麦克风 | 常驻位出现麦克风颜色与程序名 | 2026-11-27 本机通过 |
| 同时占用两者 | 胶囊左右两半同屏告警，状态页两行同时闪烁 | 2026-11-27 本机通过 |
| 停止桥接程序 | 插件显示「未获得系统占用状态」 | 已按未知态分支验证 |
| 关闭插件或卸载 | 立即撤下常驻位与状态页 | 已在岛仔中验证 |
| 未授权／来源损坏 | 显示未知态，不显示「一切正常」 | 自动用例覆盖 |

## 宿主校验

```powershell
$island = Join-Path $env:LOCALAPPDATA 'Programs\Daozai\daozai.exe'
& $island --plugin-test (Resolve-Path './plugin.json').Path
$LASTEXITCODE
```

2026-11-27 在岛仔 v0.6.70 上执行，`chentaoxing.privacy-indicator v1.4.2 校验通过`，退出码 0；`status.page`、`status.canvas`、`island.pinned`、`notice`、`timer`、`storage`、`settings` 均被宿主识别，刷新耗时低于 30 ms 上限。

## 读数层与硬件无关自检

桥接源码位于 `fixtures/device-use/`，可用 Rust 直接编译并运行 7 条单元测试：

```powershell
Push-Location fixtures/device-use
rustc --edition 2021 --test main.rs -o device_use_tests.exe
.\device_use_tests.exe
rustc --edition 2021 main.rs -o device_use.exe
Pop-Location
```

另有自动枚举 DirectShow 设备的真机自检，不写死任何摄像头或麦克风名称：

```powershell
python fixtures/device-use/selftest.py --reader .\device_use.exe
```

需安装 `ffmpeg` 并至少有一个摄像头／麦克风。退出码 0 表示占用检测与释放归零全部通过，1 表示有未通过项，2 表示环境缺失。
