# 拓竹打印进度

在岛仔里看拓竹（Bambu Lab）打印机的实时进度：百分比、层数、剩余时间、喷嘴 / 热床温度和告警。

数据来自**本机**的「拓竹打印监控」，插件自己不上网、不连接打印机、不保存访问码。

![封面](cover.png)

## 需要什么

| 部分 | 要求 |
| --- | --- |
| 岛仔 | v0.6.70 或更新（带「设置 → 插件」） |
| 数据源 | [拓竹打印监控](https://github.com/ou0826/bambu-monitor/releases/latest) **v1.0.1 或更新** |

> ⚠️ **必须是 v1.0.1 及以上**。v1.0.0 的下载包里没有本插件依赖的只读状态桥 `/status`，装 v1.0.0 会在「授权数据源」这一步卡住。

下载：**[`BambuMonitor-v1.0.1.zip`](https://github.com/ou0826/bambu-monitor/releases/download/v1.0.1/BambuMonitor-v1.0.1.zip)**（20 MB，解压即用，不用装 Python）
· [发布说明](https://github.com/ou0826/bambu-monitor/releases/tag/v1.0.1) · [全部版本](https://github.com/ou0826/bambu-monitor/releases)

## 安装

1. 下载并解压拓竹打印监控 v1.0.1，双击 `拓竹打印监控.exe`，按它自己的引导连上打印机（局域网或云端都行）。
2. 确认状态桥在跑（默认开启）：

   ```powershell
   curl http://127.0.0.1:39778/status
   ```

   返回一段以 `{"api": 1, ...` 开头的 JSON 就说明桥正常。

3. 岛仔 →「设置 → 插件 → 已安装 → 开发者工具 → 安装本地插件…」，选择本目录的 `plugin.json`。
4. 回到「已安装」打开插件开关，在插件详情的**授权数据源**里填写：

   ```
   http://127.0.0.1:39778/status
   ```

5. 打开岛上的状态详情页（也可在「设置 → 页面管理 → 状态详情」里控制开关）。

监测页只在授权后才读取；撤销授权或停用插件会立即停止读取。

## 状态桥怎么开、怎么关、端口怎么查

桥是监控程序的一部分，**默认开启**：

- 只监听 `127.0.0.1`，只有 `GET /status` 和 `GET /health`，没有写接口，也不向外部网络发送数据。
- **关闭**：退出监控程序即停止；或编辑 `%APPDATA%\BambuMonitor\config.json`，把 `app.bridge` 改成 `false` 后重启监控。
- **改端口**：同一个文件里改 `app.bridge_port`（默认 `39778`）。

### 端口被占用时怎么确认实际地址

桥默认用 `39778`。如果这个端口被别的程序占用，监控会自动往后顺延（最多 8 个），并把**实际端口**写进：

```
%APPDATA%\BambuMonitor\rt\bridge.json
```

打开这个文件看 `"port"` 的值，把授权地址改成 `http://127.0.0.1:<那个端口>/status`。PowerShell 一行：

```powershell
Get-Content "$env:APPDATA\BambuMonitor\rt\bridge.json"
```

排查顺序：① 托盘里监控是否还在运行 → ② 上面这个文件里的端口 → ③ `curl http://127.0.0.1:<端口>/status` 是否有 JSON。

## 读取了什么

插件只申请 `source.read: "loopback"`：对**你授权的完整回环地址**做 GET，读取上限 128 KiB，请求预算 2 秒，不跟随重定向。桥的响应示例：

```json
{ "api": 1, "source": "bambumon", "updated": 1763300000.0, "age": 1.2,
  "printer": { "name": "A1 mini", "model": "A1 mini" },
  "status": { "online": true, "gcode_state": "RUNNING", "state_text": "打印中",
              "stage_text": "打印中", "percent": 37, "remaining": 42,
              "layer": 118, "total_layer": 320, "file": "benchy.3mf",
              "nozzle": 214.5, "nozzle_target": 215, "bed": 59.8, "bed_target": 60,
              "hms": [], "print_error": 0, "ams_text": "空闲" } }
```

插件使用的字段：`age`（新鲜度）、`printer.model` / `printer.name`（机型）、`status.online`、
`gcode_state`、`state_text`、`stage_text`、`percent`、`remaining`（分钟）、`layer`、
`total_layer`、`file`、`nozzle` / `nozzle_target`、`bed` / `bed_target`、`hms`、`print_error`、`ams_text`。

**上游版本**：拓竹打印监控 v1.0.0（2026-11 版）配合 `bridge.py` 验证过；桥的 `/status` 是 1.0 版契约。


## 机型图

`images/printer-*.png` 是按官方机型准备的立绘（透明底正视图，最长边 220 px，13 张合计约 356 KiB，低于画布图片 512 KiB 上限）。
插件按状态桥返回的 `printer.model` 自动匹配，**同时认显示名和官方代号**（手动填机型、或原始上报是 `C11`/`O1E` 这种代号时也能认出来）：

| 官方代号 | 显示名 | 使用图片 |
| --- | --- | --- |
| `N1` | A1 mini | `printer-a1-mini.png` |
| `N2S` | A1 | `printer-a1.png` |
| `C11` | P1P | `printer-p1p.png` |
| `C12` | P1S | `printer-p1s.png` |
| `N7` | P2S | `printer-p2s.png` |
| `BL-P001` | X1 Carbon | `printer-x1c.png` |
| `BL-P002` | X1 | `printer-x1c.png`（与 X1 Carbon 共用外观） |
| `C13` | X1E | `printer-x1e.png` |
| `O1D` | H2D | `printer-h2d.png` |
| `O1E` | H2D Pro | `printer-h2d-pro.png` |
| `O1C` / `O1C2` | H2C | `printer-h2c.png` |
| `O1S` | H2S | `printer-h2s.png` |
| — | A2L | `printer-a2l.png` |
| — | X2D | `printer-x2d.png` |

打印机离线时这条会压到 42% 透明度并显示「当前没有新数据」，用来区分「认得这台机器，只是没连上」。

> 图片来源：全部取自 Bambu Lab 官网导航的透明底机型图（同一套正视图，风格一致），
> 按插件画布尺寸裁切并压缩。这些是拓竹硬件的外观，仅用于在页面上标识机型；
> 转发本插件请自行确认素材授权，或替换成你自己的图。

## 状态怎么区分

四种情况在页面上是**分开的**，不会混成一个「出错」：

| 情况 | 页面显示 | 由谁决定 |
| --- | --- | --- |
| 还没授权 | `请授权本机状态桥` + 授权地址 | 插件 |
| 监控没在运行（桥连不上） | 宿主占位页：`数据源失联` / 检查已授权的文件或本机接口 | **宿主** |
| 桥在、打印机离线 | `打印机离线` + 上次读数 | 插件 |
| 桥在、打印机在线但 20 秒没有新数据 | `监控没有新数据` | 插件 |

> 说明：回环地址读不到时（监控没启动），岛仔会接管这一页并显示它自己的「数据源失联」占位，
> 插件的文案不会出现。这是宿主对「取数失败」的统一处理。所以三种情况仍然是三张不同的画面，
> 只是第一张的措辞由岛仔给。

正常打印时：状态标题按 `打印中 / 已暂停 / 已完成 / 失败 / 空闲` 切换，进度环显示百分比，
剩余时间由**岛仔按秒跳动**（插件每 60 秒重新对准一次，避免累计漂移；暂停时不再倒计时），
并根据 `hms` / `print_error` 显示告警行。停更或离线时保留上次读数，并用相对时间注明新鲜度
（「12 秒前」——沙箱里的时钟是 UTC，所以不用绝对时刻，避免差时区）。

## 插件输出与刷新

- `refreshSeconds: 60`，宿主每 60 秒取一次；每次执行限时 30 毫秒，输出上限 16 KiB。
- 跨次保留的内容放在 `storage`：喷嘴温度折线（最近 40 点，约 40 分钟）与上次读数。
- 卸载时选择「保留数据」会保留这些内容；选择删除则回到初始状态。

## 桥从哪来、怎么启停

桥是监控程序的一部分，源码在 [ou0826/bambu-monitor](https://github.com/ou0826/bambu-monitor)：

```
bambu_monitor/bridge.py     # 只绑 127.0.0.1、只有 GET /status 与 /health
bambu_monitor/ui.py         # 建桥、每次重绘发布快照、关窗停桥
```

- **启动**：正常运行监控即可（`python main.py` 或打包好的 exe）。桥随界面启动，默认开启。
- **停止**：退出监控，或在 `config.json` 里把 `app.bridge` 设为 `false`。
- 桥只监听回环地址、没有写接口，也不会向外部网络发送任何数据。

## 许可

MIT，见 [LICENSE](LICENSE)。
