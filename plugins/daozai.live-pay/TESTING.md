# 实时工资验收

在本插件目录运行以下命令。宿主复现时使用 Windows 北京时间（UTC+08:00），以和固定模拟时刻一致。

```powershell
$exe = '支持画布、绑定和常驻小画布的岛仔程序绝对路径'
$manifest = (Resolve-Path .\plugin.json).Path
$fixture = (Resolve-Path .\fixtures\working.json).Path
& $exe --plugin-test $manifest --input $fixture | Out-Host
node .\fixtures\test.mjs $exe
```

`fixtures/test.mjs` 检查业务状态与输出，并用 `--plugin-test` 逐个比对 28 份模拟数据。只传 `node .\fixtures\test.mjs` 时运行 JavaScript 验证。

| 模拟输入 | 预期结果 |
| --- | --- |
| `unset`、`before`、`start`、`working` | 提示设置月薪、倒数到上班、从零计薪。测试月份有 21 个工作日 |
| `unpaid-break`、`paid-break`、`break-ended`、`no-breaks` | 停止跳动、正常计薪、休息结束继续计薪、全天计薪 |
| `done`、`done-already-notified`、`done-late` | 金额封顶为日薪，刚到点且未提醒时发一次「下班啦」 |
| `day-off` | 展示下一工作日的上班倒计时 |
| `overnight-break`、`overnight-paid`、`overnight-done`、`midnight-done` | 跨午夜的休息和完工正确归属上班日，跨月沿用上班日所在月份 |
| `invalid-overlap`、`invalid-bounds`、`invalid-no-pay`、`invalid-no-days` | 显示设置校验提示，不输出工资或提醒 |
| `pinned-countdown`、`pinned-rotate-amount`、`pinned-rotate-countdown` | 常驻可只显示倒计时，也可交给宿主每 8 秒轮换金额和倒计时 |
| `custom-payday-working`、`custom-overnight-cutoff`、`custom-payroll-gap` | 自定义周期计薪、跨午夜归属与周期外不计薪 |
| `short-month-payday`、`short-month-payroll` | 短月月末发薪，未填月薪时仍显示发薪倒计时，计薪边界无重叠 |

月薪为零时提示填写设置。各段休息用开关选择计薪，时段冲突提示显示在状态页。金额、每小时收益、倒计时和进度由宿主绑定更新，班次状态按宿主刷新时机切换。

用 `start`、`working`、`unpaid-break` 核对计价器。每位数字各占一格，小数点单独显示，末位使用绿色。计薪时变化的数字按格翻动，跨过整数进位时留出新的一格。
