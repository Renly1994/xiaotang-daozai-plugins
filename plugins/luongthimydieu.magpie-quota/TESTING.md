# magpie 额度测试

## 自动用例

在本插件目录执行：

```powershell
node --test .\fixtures\test.cjs
```

设置 `MAGPIE_LIVE=1` 可额外读取本机 magpie 的 `cards` 与旧端点 `quotas`，核对真实响应的大小、耗时与画布输出：

```powershell
$env:MAGPIE_LIVE = '1'
node --test .\fixtures\test.cjs
Remove-Item Env:MAGPIE_LIVE
```

测试夹具使用合成数据。`fixtures/test.cjs` 用 `vm` 加载 `main.js`，用本地 HTTP 服务模拟宿主的回环读取（直连、2 秒、128 KiB、不跟随重定向），覆盖下列场景：

| 用例 | 预期 |
| --- | --- |
| `unconfigured` | `quota` 为 `null`，画布以「用默认地址授权？」提示完整地址并支持点击复制，发 `url-unauthorized` 提醒 |
| `offline` | `quota` 为 `null`，画布显示「magpie 未运行或地址不通」，不发提醒 |
| `normal.json` | 按平台列出 Copilot、WorkBuddy、DeepSeek；ZCode 因无订阅无余额被舍弃；Copilot 显示 `剩 92.8%`，WorkBuddy 显示 `336 积分`，DeepSeek 显示 `¥12.50` |
| `multi-account.json` | 三个 WorkBuddy 账号合并为 `WorkBuddy ×3` 一行，积分累加为 `7232 积分`；圆环按剩余比例显示 Kimi、WorkBuddy、Copilot |
| `multi-account.json` 的折线 | 三个账号的 `daily.days` 按日期相加，取最近 7 天，`points` 有 7 个点 |
| `shared-balance.json` | 两个共享钱包的 DeepSeek 账号只显示一次 `¥66.30`，不重复累加 |
| `legacy-quotas.json`（旧端点形态） | 直接采用 `remaining`；带 `limit` 的 WorkBuddy 显示 `1497 积分` |
| `unlimited-only.json` | 只有无限额窗口，显示「无限」 |
| 条目报错但有余额 | 保留余额显示 |
| 12 / 24 / 40 / 50 个平台 | 12 个两列并保留图表；24 个三列、圆环让位；40 个只保留列表；50 个在底部提示未显示数量；全程不使用滚动 |
| `api-index.json` | 画布显示「授权地址不完整」和完整地址，发 `bad-url-index` |
| `malformed.txt`（200 返回的 404 文本） | 画布显示「授权地址不存在」，发 `bad-url-missing` |
| `{}`、非 JSON、空文本 | 画布显示「数据源不是额度接口」，发 `bad-url-unknown` |
| 画布整体 | 高度 40 至 360，文字合计不超过 2000 字，字号 6 至 96；底部圆角背景，不使用滚动分组 |
| HTTP 404 / 302 / 超过 128 KiB / 超过 2 秒 / 连接拒绝 | 宿主按离线处理，插件显示离线引导 |

所有用例都断言 `quota` 为 `null`：1.2.0 起额度页签不再显示读数，只保留状态页画布。

## 在岛仔里试装

用启用了 `sdk-js` 的岛仔，在本目录执行：

```powershell
$daozai = 'D:/你的目录/daozai.exe'
& $daozai --plugin-test "$PWD\plugin.json"
$LASTEXITCODE
```

`--plugin-test` 运行时数据源为 `unconfigured`，入口应返回 `{"quota":null,"status":{...},"canvas":{...}}` 且不报错。能力自检应列出 `quota.source`、`status.page`、`status.canvas`、`action`、`notice`、`settings`、`timer`。未授权时输出应带 `notice.id = "url-unauthorized"`，画布里的完整地址节点带 `hit.copy`。

也可用 `--input` 喂入一份响应文本，核对画布输出。下面取旧端点 `http://127.0.0.1:3425/v1/magpie/quotas?kept=1` 的实时响应并包装成宿主输入：

```powershell
$text = (curl.exe -s --noproxy '*' 'http://127.0.0.1:3425/v1/magpie/quotas?kept=1') -join "`n"
$json = @{ sources = @{ default = @{ status = 'ready'; text = $text } } } | ConvertTo-Json -Depth 5 -Compress
[IO.File]::WriteAllText("$env:TEMP\magpie-input.json", $json)
& $daozai --plugin-test "$PWD\plugin.json" --input "$env:TEMP\magpie-input.json"
```

输出应包含 `canvas`，其中的 `text` 节点能看到平台名、余额或积分；`quota` 应为 `null`。把地址换成 `http://127.0.0.1:3425/v1` 的接口索引时，画布应显示「授权地址不完整」并带 `bad-url-index` 提醒。

随后在「设置 → 插件 → 已安装 → 开发者工具」选择 `plugin.json` 试装，启用并授权 [README 中的本机地址](README.md#启用)，再到「页面管理 → 插件页面 → magpie 额度 → 打开」核对：

| 本机状态 | 预期 |
| --- | --- |
| magpie 正在运行 | 状态页直接出现折线、圆环和平台列表，没有「magpie 额度 · N 个账号」这类标题 |
| 同一平台多个账号 | 只出现一行并标 `×N`，积分是各账号累加值 |
| 余额账号 | 显示 `¥` 金额；共享钱包只出现一次 |
| 无订阅无余额的账号（ZCode） | 不出现 |
| 平台超过 6 个 | 自动换成两列或三列并压缩行高，仍在一页内显示 |
| 「AI 额度」面板 | 不再出现 magpie 额度页签 |
| 首次启用、尚未授权 | 弹出一次「magpie 地址待授权」；状态页显示完整地址，点地址可复制 |
| 插件设置 | 显示「授权地址」，默认值为完整地址，可直接复制；修改它不会改变已保存的授权 |
| 授权地址只填到 `/v1` | 状态页显示「授权地址不完整」，并弹出一次提醒 |
| 停用插件 | 状态页撤下，其他页面不变 |
