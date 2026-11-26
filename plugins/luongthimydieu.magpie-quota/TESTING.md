# magpie 额度测试

## 自动用例

在本插件目录执行：

```powershell
node --test .\fixtures\test.cjs
```

设置 `MAGPIE_LIVE=1` 可额外读取本机 magpie 的 `cards` 与旧端点 `quotas?kept=1`，核对真实响应的大小、耗时与画布输出：

```powershell
$env:MAGPIE_LIVE = '1'
node --test .\fixtures\test.cjs
Remove-Item Env:MAGPIE_LIVE
```

测试夹具使用合成数据。`fixtures/test.cjs` 用 `vm` 加载 `main.js`，用本地 HTTP 服务模拟宿主的回环读取（直连、2 秒、128 KiB、不跟随重定向），覆盖下列场景：

| 用例 | 预期 |
| --- | --- |
| `plugin.json` | 能力列表含 `storage`，`account` 设置的键、标签、默认值与 1.0.0 完全一致，`address` 默认值为完整地址 |
| `unconfigured` | `quota` 为 `null`，画布以「用默认地址授权？」提示完整地址并支持点击复制，发 `url-unauthorized` 提醒 |
| `offline` | `quota` 为 `null`，画布显示「magpie 未运行或地址不通」，不发提醒 |
| `normal.json` | `quota` 返回 Copilot 的 `Premium requests`（`remaining_pct` 92.75），`storage.account` 固定为 Copilot；按平台列出 Copilot、WorkBuddy、DeepSeek；ZCode 因无订阅无余额被舍弃；WorkBuddy 显示 `336 积分`，DeepSeek 显示 `¥12.50` |
| `multi-account.json` | 三个 WorkBuddy 账号合并为 `WorkBuddy ×3` 一行，积分累加为 `7232 积分`；圆环按剩余比例显示 Kimi、WorkBuddy、Copilot；柱状图 7 根柱（11-20 至 11-26） |
| `shared-balance.json` | 两个共享钱包的 DeepSeek 账号只显示一次 `¥66.30`，不重复累加 |
| 两个独立同额钱包 | 未声明 `sharedBalance` 时不按金额合并，显示 `¥5.00 等2个` |
| 同名不同单位窗口 | `credits` 与 `tokens` 的 `Quota` 窗口分别保留，`quota.windows` 有 3 条，不出现合并后的总量 |
| 跨单位趋势 | 只采用记录最多的 `credits` 系列，日期轴止于 11-21，柱子只落在 11-20、11-21 两个槽位 |
| 缺日期趋势 | 日期轴固定 15 个自然日（止于 11-26），只有 11-20、11-21、11-26 三根柱，缺日不补柱 |
| 单槽 / 零值 | 只有单天有值时画一根柱；当天读数为 0 时保留 1px 短柱，与缺日区分 |
| 槽位边界 | 窗口首尾日期落在第 1、15 个槽位，柱子不越过图表左右边界 |
| 日期轴锚点 | 给出 `today` 时轴止于当天，`2026-13-45` 与 `2099-01-01` 混入时真实数据仍落在 11-20、11-21、11-26；`today` 缺失或非法时退回最后一条有效数据的锚点 |
| `legacy-quotas.json`（旧端点形态） | 直接采用 `remaining`；带 `limit` 的 WorkBuddy 显示 `1497 积分`；旧 `readAt` 显示「较早缓存」 |
| 缓存时间行 | 新鲜 `readAt` 显示「缓存 HH:MM」；缺少或无法解析时不显示 |
| 零余额 | `¥0.00` 与数字 `0`（带币种）都正常显示，不当作未知 |
| `data` 数组格式不符 / 空 `data` | 前者显示「返回数据不是 magpie 额度格式，请核对地址」并发 `bad-url-shape`；后者显示「账号均无额度」，两者分开 |
| 账号设置 | 填登录名时优先选该账号并返回前 3 个窗口；大小写、别名可匹配；多个同名账号或找不到该账号时按未知处理（`quota` 为 `null`，不改写固定账号，状态页仍汇总全部平台）；`storage.account` 固定账号逻辑保留 |
| `constructor` 作平台/窗口/共享键 | 不报错，正常分组、合并窗口与去重钱包 |
| 文案自查 | `main.js`、`README.md`、`TESTING.md` 不含不带 `kept` 参数的旧端点路径，旧端点只写 `?kept=1` |
| `unlimited-only.json` | 只有无限额窗口，显示「无限」，`quota` 为 `null` |
| 条目报错但有余额 | 保留余额显示 |
| 12 / 24 / 40 / 50 个平台 | 12 个两列并保留图表；24 个三列、圆环让位；40 个只保留列表；50 个在底部提示未显示数量；全程不使用滚动 |
| `api-index.json` | 画布显示「授权地址不完整」和完整地址，发 `bad-url-index` |
| `malformed.txt`（HTTP 200 返回的 404 文本） | 画布显示「授权地址不存在」，发 `bad-url-missing` |
| `{}`、非 JSON、空文本 | 画布显示「数据源不是额度接口」，发 `bad-url-unknown` |
| 画布整体 | 高度 40 至 360，文字合计不超过 2000 字，字号 6 至 96；底部圆角背景，不使用滚动分组 |
| HTTP 404 / 302 / 超过 128 KiB / 超过 2 秒 / 连接拒绝 | 宿主按离线处理，插件显示离线引导（真实的 404 正文插件拿不到） |

可读数据用例会同时断言 `quota` 有读数；只有未授权、离线、错址、无有效窗口、钱包类账号和手动选不到账号才断言 `quota` 为 `null`。

## 在岛仔里试装

用启用了 `sdk-js` 的岛仔，在本目录执行：

```powershell
$daozai = 'D:/你的目录/daozai.exe'
& $daozai --plugin-test "$PWD\plugin.json"
$LASTEXITCODE
```

`--plugin-test` 运行时数据源为 `unconfigured`，入口应返回 `{"quota":null,"storage":{},"status":{...},"canvas":{...}}` 且不报错。能力自检应列出 `quota.source`、`status.page`、`status.canvas`、`action`、`notice`、`settings`、`storage`、`timer`。未授权时输出应带 `notice.id = "url-unauthorized"`，画布里的完整地址节点带 `hit.copy`。

也可用 `--input` 喂入一份响应文本，核对画布与额度读数。下面取 `cards` 的实时响应：

```powershell
$text = (curl.exe -s --noproxy '*' 'http://127.0.0.1:3425/v1/magpie/quotas/cards') -join "`n"
$json = @{ sources = @{ default = @{ status = 'ready'; text = $text } } } | ConvertTo-Json -Depth 5 -Compress
[IO.File]::WriteAllText("$env:TEMP\magpie-input.json", $json)
& $daozai --plugin-test "$PWD\plugin.json" --input "$env:TEMP\magpie-input.json"
```

输出应包含 `canvas`，其中的 `text` 节点能看到平台名、余额或积分，右上角有「缓存 HH:MM」小字；`quota.windows` 不应为空（本机至少有一个带可换算窗口的账号）。把地址换成 `http://127.0.0.1:3425/v1` 的接口索引时，画布应显示「授权地址不完整」并带 `bad-url-index` 提醒。

旧版 magpie 的实时响应可用 `http://127.0.0.1:3425/v1/magpie/quotas?kept=1` 读取，该参数只返回缓存，不要使用不带参数的同一路径。

随后在「设置 → 插件 → 已安装 → 开发者工具」选择 `plugin.json` 试装，启用并授权 [README 中的本机地址](README.md#启用)，再到「页面管理 → 插件页面 → magpie 额度 → 打开」核对：

| 本机状态 | 预期 |
| --- | --- |
| magpie 正在运行 | 状态页直接出现「近 15 天用量」柱状图、圆环、平台列表和右上角缓存时间，没有「magpie 额度 · N 个账号」这类标题 |
| 同一平台多个账号 | 只出现一行并标 `×N`，积分是各账号累加值 |
| 余额账号 | 显示 `¥` 金额；同一 `sharedBalance` 只出现一次，独立钱包显示 `等N个` |
| 无订阅无余额的账号（ZCode） | 不出现 |
| 平台超过 6 个 | 自动换成两列或三列并压缩行高，仍在一页内显示 |
| 「AI 额度」面板 | 出现当前选中账号的窗口读数；没有可换算窗口时不显示读数 |
| 账号设置填具体账号 | 额度页签优先显示该账号；找不到或同名账号不止一个时不显示读数，不换选其他账号 |
| 首次启用、尚未授权 | 弹出一次「magpie 地址待授权」；状态页显示完整地址，点地址可复制 |
| 插件设置 | 显示「账号」与「授权地址」，后者默认值为完整地址，可直接复制；修改它不会改变已保存的授权 |
| 授权地址只填到 `/v1` | 状态页显示「授权地址不完整」，并弹出一次提醒 |
| 停用插件 | 状态页撤下，其他页面不变 |
