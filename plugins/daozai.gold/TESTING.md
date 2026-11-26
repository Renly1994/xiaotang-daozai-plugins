# 现货金价测试

用启用了 `sdk-js` 的岛仔，在本目录执行以下命令。`$daozai` 指向验收版 `daozai.exe`。

```powershell
& $daozai --plugin-test "$PWD\plugin.json"
Get-ChildItem .\fixtures\*.json | ForEach-Object {
    & $daozai --plugin-test "$PWD\plugin.json" --input $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "验收失败：$($_.Name)" }
}
node --test fixtures/test.cjs
```

| 用例 | 预期 |
| --- | --- |
| `cny` | 主读数为 `946.2`，涨跌为 `+2.90 · +0.31%`，常驻显示 `¥946.2` |
| `usd` | 主读数为 `4,118.6`，同时显示折合人民币和美元提醒线 |
| `usd` 悬停 | 在走势图 12:40 对应数据点附近悬停，读数为 `$4,106.2` |
| `fx-stale` | 人民币读数旁提示「汇率待更新」 |
| `offline` | 两个来源都离线，宿主显示数据源离线占位，常驻为空 |
| `active-offline` | 所选人民币来源离线，画布显示「数据源暂不可用」，可切换到美元 |
| `week` | 返回按小时采样的 1 周视图 |
| `month` | 返回按日采样的 1 月视图 |
| `crossing` | 人民币报价跨过 945 元，返回 `gold-cny-945-up` |
| `tencent` | XAUS 两路离线时显示「腾讯行情」，美元报价为 `3,565.5`，人民币折算为 `763.5` |

`fixtures/test.cjs` 覆盖单位和区间切换、历史点列容量、小时和日桶、提醒方向去重、双来源同时跨线、汇率告警、旧读数撤下、配色、走势图与常驻小画布。`--plugin-test` 只调 `refresh`，页面动作由测试脚本直接调用。

在「设置 → 插件 → 已安装 → 开发者工具」选 `plugin.json` 试装。启用并授权 HTTPS 数据源后，切到现货金价详情。用页面按钮切换单位和区间，在插件设置调整刷新间隔、默认单位和提醒价。历史从本机首次取数起积累。用模拟用例复核固定读数。由 1.0.0 更新后重新授权 HTTPS 数据源。

美元端点使用 `unit=oz`，返回单位为 `troy_oz`。人民币端点使用 `unit=gram`。两路均由 XAUS 提供换算和数据时效字段。 [XAUS API](https://xaus.com/api/)

XAUS 报价不可用时，腾讯行情的 UTF-8 接口一次返回伦敦现货金和美元兑人民币汇率，人民币报价由伦敦金折算。汇率超过 15 分钟提示待更新，超过 24 小时暂停人民币折算。换源后的首个报价仅用于建立提醒基准。 [腾讯行情接口](https://qt.gtimg.cn/utf8/q=hf_XAU,whUSDCNY)
