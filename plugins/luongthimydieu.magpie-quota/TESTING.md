# magpie 额度测试

## 自动用例

在本插件目录执行：

```powershell
node --test .\fixtures\test.cjs
```

设置 `MAGPIE_LIVE=1` 可额外读取本机 magpie，核对真实响应的大小与耗时：

```powershell
$env:MAGPIE_LIVE = '1'
node --test .\fixtures\test.cjs
Remove-Item Env:MAGPIE_LIVE
```

测试夹具使用合成数据。`fixtures/test.cjs` 用 `vm` 加载 `main.js`，用本地 HTTP 服务模拟宿主的回环读取（直连、2 秒、128 KiB、不跟随重定向），覆盖下列场景：

| 用例 | 预期 |
| --- | --- |
| `unconfigured` / `offline` | `quota` 为 `null`，不产生读数 |
| `normal.json` | 选中 Copilot 的 `Premium requests`，`remaining_pct` 为 `92.75`，`reset_at` 与 `resetsAt` 一致 |
| 返回顺序、套餐或显示名称变化 | 继续读取已固定的同一账号 |
| 多个账号使用同一厂商名或固定身份不明确 | 额度按未知处理，保持原固定账号 |
| 仍有不足 1% 的额度 | 返回正的小数，岛仔显示 <1% |
| `pinned-error.json` | 已固定的账号报错时返回 `null`，不改选其他账号 |
| `no-copilot.json` | 固定账号消失后改选第一个可用账号（Kimi Code），保留存储中的其他字段 |
| `unlimited-only.json` | 只有无限额窗口，返回 `null` |
| `text-and-unlimited.json` | 跳过 text、unlimited 和钱包窗口；`used` 为 130 时剩余按 0 |
| `long-label.json` | 名称截断到 40 字，控制字符被替换 |
| `empty.json` / `malformed.txt` / 非数组 `data` | 返回 `null` |
| 设置填写 `workbuddy` | 取 WorkBuddy 的前三个窗口，剩余为 `0`、`83.875`、`52.421875` |
| 设置填写不存在的账号 | 返回 `null` |
| HTTP 404 / 302 / 超过 128 KiB / 超过 2 秒 / 连接拒绝 | 宿主按离线处理，插件返回 `null` |

## 在岛仔里试装

用启用了 `sdk-js` 的岛仔，在本目录执行：

```powershell
$daozai = 'D:/你的目录/daozai.exe'
& $daozai --plugin-test "$PWD\plugin.json"
$LASTEXITCODE
```

`--plugin-test` 运行时数据源为 `unconfigured`，入口应返回 `{"quota":null,...}` 且不报错。随后在「设置 → 插件 → 已安装 → 开发者工具」选择 `plugin.json` 试装，启用并授权 [README 中的本机地址](README.md#启用)，再到「AI 额度」核对：

| 本机状态 | 预期 |
| --- | --- |
| magpie 正在运行 | 出现「magpie 额度」页签，显示自动选中账号的一个到三个窗口 |
| magpie 未运行 | 来源页签隐藏 |
| 旧版 magpie（无 `/quotas/cards`） | 宿主收到 404，来源页签隐藏 |
| 设置填写 `WorkBuddy` | 换成 WorkBuddy 的前三个窗口 |
| 停用插件 | 页签撤下，其他来源不变 |
