# 热点速览

把百度热搜、哔哩哔哩全站热门和立创开源硬件项目收进同一个岛仔状态页。

## 界面与交互

- 顶部显示三个来源的彩色标记与各自条数
- 中间是可滚动的热点列表，滚轮即可翻看全部条目
- 每行显示来源色点、标题和热度（播放量 / 浏览量 / 热度值）
- **点击任意一行直接打开对应页面**：B站视频与立创项目打开原文，百度条目打开对应榜单页
- 右下角「刷新」按钮立即重新取数
- 全部颜色使用岛仔皮肤令牌（`$text` / `$muted` / `$dim` / `$card` / `$track`），换皮肤自动跟随

## 设置项

| 设置 | 说明 | 默认 |
| --- | --- | --- |
| 百度频道 | 实时热点 / 汽车 / 游戏 / 电影 / 电视剧 / 小说 | 实时热点 |
| 立创开源 | 显示或隐藏立创硬件这一路 | 显示 |
| 每日热点精选 | 每天首次刷新推送一条前三条摘要 | 开启 |

## 数据与权限

- 权限：`source.read: https`
- 域名：`top.baidu.com`、`api.bilibili.com`、`www.bilibili.com`、`oshwhub.com`
- 数据源：
  - `https://top.baidu.com/api/board?platform=wise&tab={频道}`
  - `https://api.bilibili.com/x/web-interface/popular?ps=12&pn=1`
  - `https://oshwhub.com/api/project?pageNo=1&pageSize=20`
- 每路最多取 12 条，三路交错排列，共约 32–36 条
- 刷新周期 30 分钟，手动刷新最小间隔 5 分钟
- 不读取本机文件，不收集或上传任何个人信息

## 试装

1. 岛仔 v0.6.70 或更新版本，打开「设置 → 插件 → 我的插件 → 开发者模式」
2. 点「安装本地插件…」，选择本目录的 `plugin.json`
3. 回到「已安装」启用「热点速览」
4. 在「设置 → 页面管理 → 状态详情」中开启该页面

## 本地校验

```powershell
& daozai.exe --plugin-test ./plugin.json
& daozai.exe --plugin-test ./plugin.json --input ./fixtures/mock.json
```

两种方式均返回码 0，refresh 用时约 17 ms。

## 许可

MIT。数据版权归各来源站点所有，本插件只做展示与跳转。
