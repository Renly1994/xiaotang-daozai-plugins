# 拓竹打印进度 · 校验记录

## 环境

- 岛仔 v0.6.71（Windows x64，含 `sdk-js`）
- 数据源：拓竹打印监控 **v1.0.1**（内置只读状态桥 `/status`，`source.read: "loopback"`）
- 打印机：A1 mini（本机经云端连接）
- 授权地址：`http://127.0.0.1:39778/status`

## 静态校验

```powershell
$island = '<你的目录>\daozai.exe'
& $island --plugin-test "$PWD\plugin.json"
$LASTEXITCODE   # 0
```

`--plugin-test` 默认以 `unconfigured` 试跑：返回授权引导，退出码 0，`refresh` 用时约 15 ms（限时 30 ms）。

> 监控版本要求：**v1.0.1 起**才有 `/status` 状态桥（v1.0.0 没有，会在授权那一步失败）。

## 用例矩阵

每个用例把一份本机接口响应喂给插件，核对输出状态与文案：

```powershell
Get-ChildItem .\fixtures\*.json | ForEach-Object {
    & $island --plugin-test "$PWD\plugin.json" --input $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "校验失败：$($_.Name)" }
}
```

| 用例 | 模拟情况 | 期望输出 |
| --- | --- | --- |
| `running` | 正常打印，37% | `running` · `打印中 · benchy.3mf` |
| `paused-hms` | 断料暂停 + 2 项 HMS | `paused` · `已暂停 · benchy.3mf`，出现告警 |
| `finish` | 已完成 100% | `succeeded` · `已完成 · benchy.3mf` |
| `no-progress` | 字段缺失（无百分比/层数/剩余） | `running`，不报错、不出现空指标 |
| `printer-offline` | 桥在、`online:false` | `offline` · **打印机离线** |
| `stale` | 桥在、`age:45` | `offline` · **监控没有新数据** |
| `bridge-down` | 来源 `offline` | `offline` · **监控没在运行** |
| `bad-api` | `api:2` | `error` · 状态格式不符 |
| `unconfigured` | 尚未授权 | `idle` · 请授权本机状态桥 |

画布检查：用例共 12 个，覆盖机型映射——

| 用例 | 机型 | 期望图片 |
| --- | --- | --- |
| running / paused-hms / finish / no-progress / printer-offline / stale | A1 mini | `printer-a1-mini.png` |
| p1p | P1P | `printer-p1p.png` |
| x1e-by-code | `C13`（原始代号） | `printer-x1e.png` |
| h2d-pro | H2D Pro（带 HMS） | `printer-h2d-pro.png` |
| bridge-down / bad-api / unconfigured | — | 不画机型图 |

包内图片：13 张，单张最长边 220 px，合计 356 KiB（上限 512 KiB），全部为官方透明底正视图。

三个「离线类」状态分属三张不同画面：数据源没开、设备离线、数据停更。

其中 `bridge-down` 在命令行校验里是插件自己的 `监控没在运行`；装进岛仔后，宿主会接管取数失败的页面、
显示它自己的「数据源失联」占位，插件文案不出现。其余两个由插件提供。

## 手动试装

1. 「设置 → 插件 → 已安装 → 开发者工具 → 安装本地插件…」选 `plugin.json`，启用。
2. 插件详情 → 授权数据源，填 `http://127.0.0.1:39778/status`。
3. 打开状态详情页，依次核对：
   - 监控没启动 → 「监控没在运行」
   - 启动监控、但不连打印机 → 「打印机离线」
   - 开始打印 → 「打印中 · 文件名」、进度环、层数 / 剩余 / 喷嘴 / 热床、剩余时间按秒跳动
   - 暂停 → 「已暂停」，剩余时间停止跳动
   - 恢复 → 回到「打印中」
4. 「页面管理 → 状态详情」关闭该页后，后台停止读取；重新打开按当前授权恢复。

## 结果

- 静态校验：通过（9/9，退出码 0）
- 渲染：由宿主 `shoot_feature` 导出三种来源状态截图（见投稿说明）
