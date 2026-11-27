# 自选股盯盘测试

用启用了 `sdk-js` 的岛仔，在本目录执行以下命令。`$daozai` 指向验收版 `daozai.exe`。

```powershell
& $daozai --plugin-test "$PWD\plugin.json"
Get-ChildItem .\fixtures\*.json | ForEach-Object {
    & $daozai --plugin-test "$PWD\plugin.json" --input $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "验收失败：$($_.Name)" }
}
```

| 用例 | 预期 |
| --- | --- |
| `mock` | 茅台现价 `1688.00`，`+13.00 · +0.78%`，持仓 `成本 1600.00 · 100 股`，盈亏 `+8,800.00`；平安银行 `11.85`，`-0.15 · -1.25%`，持仓 `成本 12.00 · 1000 股`，盈亏 `-150.00` |
| `offline` | 三路均离线，画布显示「还没有可用的股票」，常驻为空 |

在「设置 → 插件 → 已安装 → 开发者工具」选 `plugin.json` 试装。启用并授权 HTTPS 数据源后，切到自选股盯盘状态页。用页面「刷新」按钮手动取数；在插件设置调整代码、成本价、持股数量、配色和盈亏显示。离线时保留上一次成功取到的报价快照。
