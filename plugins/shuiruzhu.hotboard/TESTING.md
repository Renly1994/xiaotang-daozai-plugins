# 测试记录

测试环境：Windows 11，岛仔 v0.6.70 免安装版。

## 命令

```powershell
& daozai.exe --plugin-test ./plugin.json
& daozai.exe --plugin-test ./plugin.json --input ./fixtures/mock.json
```

## 结果

不带输入（验证未授权 / 空数据分支）：

```text
shuizhuzhu.hotboard v1.0.0 校验通过
能力自检
  status.page · 实验
  status.canvas · 实验
  action · 实验
  notice · 实验
  storage · 可用
  settings · 可用
  timer · 可用
refresh 用时 16.26 ms
```

返回 `state: offline`、三个来源均显示「未授权」，并渲染空态提示与刷新按钮。

带真实样本输入：

```text
shuizhuzhu.hotboard v1.0.0 校验通过
refresh 用时 16.84 ms
```

返回 `共 32 条`：百度热搜 12、B站热门 12、立创开源 8。三路交错排列，每行包含
`hit.open` 链接，B站为 `www.bilibili.com/video/BV…`，立创为 `oshwhub.com/<作者>/<项目>`，
百度为 `top.baidu.com/board?tab=realtime`。

## 覆盖场景

- 三路全部正常：32 条，状态 `succeeded`
- 未授权：全部显示「未授权」，状态 `offline`
- 单源失败：其余两路正常显示，失败源在概览行显示「不可用」
- 关闭立创：只剩两路，列表约 24 条
- 关闭每日精选：不返回 `notice`
- 长标题：`cut()` 截断并加省略号，节点另设 `max_width` 防溢出
- 热度为空：不渲染右侧热度文本

## 样本

`fixtures/mock.json` 为三个接口的真实响应（百度热搜、B站热门、立创开源前 8 条），
可直接复现上面的输出。

## 已知限制

- B站排行接口 `ranking/v2` 对无 Cookie 请求返回 `-352` 风控，因此改用稳定的全站热门
  接口 `popular`，B站这一路不支持自选分区
- 百度条目统一打开对应榜单页，不直接打开新闻原站（原站域名不在白名单内）
- 数据来自公开接口，源站结构变化时需要同步更新解析
