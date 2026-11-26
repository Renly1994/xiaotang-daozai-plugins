# 测试记录

## 环境

- 岛仔：v0.6.70（Windows x64 免安装版）
- 校验命令：`daozai.exe --plugin-test plugin.json --input fixtures/mock.json`
- 测试数据：`fixtures/mock.json`，三个来源的真实响应样本（微博热搜、36氪热榜、立创开源接口）

## 校验结果

```text
shuizhuzhu.hotboard v1.0.0 校验通过
能力自检
  status.page · 实验
  status.canvas · 实验
  settings · 可用
  action · 实验
  timer · 可用
  storage · 可用
  notice · 实验
refresh 用时 17.70 ms / 17.87 ms / 18.28 ms（连续三次）
```

退出码 `0`。返回 `共 24 条 · 第 1/3 页`，第一页 8 条，画布 14 个节点，通知为当日精选。

## 覆盖场景

| 场景 | 方法 | 结果 |
| --- | --- | --- |
| 三源正常解析 | `--plugin-test --input fixtures/mock.json` | 微博 8 条、36氪 8 条、立创 8 条，交错排列 |
| 两种榜单模板 | 微博为纯文本行，36氪为带缩略图行 | 两种 HTML 结构都能解析出标题与热度 |
| 翻页 | 本地以 node 调用 `action({action:{id:"next"}})` 三次 | 第 1 → 2 → 3 → 1 页循环，每页 8 条 |
| 每日推送 | `storage.noticeDay` 与 `today` 不同 | 返回 `notice`，内容为三条热点；同一天再次刷新不再返回 |
| 关闭立创 | 设置 `show_hw = "off"` | 列表只含两路榜单，概览画布变为两列 |
| 关闭推送 | 设置 `daily_notice = "off"` | 不返回 `notice` |
| 来源未授权 / 离线 | `sources.<key>.status` 为 `unconfigured` 或 `offline` | 该路返回 0 条，概览对应列显示「未授权 / 不可用」，其余来源正常 |
| 字段长度 | 标题与详情统一经 `cut()` 截断 | `label` ≤ 28 字、`detail` ≤ 80 字（含省略号），满足宿主校验 |

## 性能

解析前先定位第一个排名行，只处理其后约 90 KB，避免扫描榜单页面前的导航部分。三次连续校验的 refresh 耗时均在 18 ms 左右，低于 30 ms 上限。

## 已知限制

- 热榜条目点击打开的是对应榜单页，不是单条原文（SDK 只允许打开清单白名单域名）；立创条目可直接打开项目原文
- 列表每页最多 8 条，由宿主组件限制，因此用翻页承载 24 条
- 今日热榜为 HTML 页面，若站点改版导致解析失败，该路会显示 0 条，需要随版本更新解析规则
