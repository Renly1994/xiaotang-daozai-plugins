# 足球比分牌

## 用途

在「状态」页查看关注球队的实时比分和下一场比赛。没有进行中的比赛时，显示下一场时间、对手与联赛轮次；有直播时显示比分和比赛进程。

首次打开点「点岛选球队」，按联赛点选队徽，可跨联赛多选，最多 12 支。岛上常驻条只显示两队队徽和比分。

## 启用

安装后在「设置 → 插件 → 已安装」启用。停用或卸载后，状态页和常驻条不再显示比分；重新启用会沿用之前保存的关注球队。

需要联网获取比分。支持英超、西甲、意甲、德甲、法甲、中超；中超暂时没有未来赛程时，页面显示「下一场待公布」。

## 来源与范围

比分与赛程来自 ESPN 公开接口 `site.api.espn.com`，每 60 秒刷新一次。插件只读取公开比赛数据，不收集账号或其他个人数据。只有在接口异常时才短时使用最近一次成功取到的比分，并在页面上标明「比分缓存」；超过 20 分钟或无法确认来源的数据会直接撤下，不会继续标成直播。

「下一场」只从当前时间起未来 7 天内选择；没有符合条件的场次时显示「下一场待公布」。进行中的比赛不按开球日期筛选，跨午夜的比赛仍会保留。

## 素材与许可

`crests/` 下的 112 张俱乐部队徽和 `cover.png` 中的队徽，均来自 GitHub 仓库 [`JoseArroyave/football-logos`](https://github.com/JoseArroyave/football-logos)。该仓库以 MIT License 发布，版权声明为 `Copyright (c) 2026 Jose Arroyave`。原始素材为 SVG，本插件将其等比缩放、透明裁边并居中为 44×44 PNG，用于状态页和常驻条；封面使用同一来源。完整 MIT 许可文本见下方。

俱乐部名称与徽标是各自俱乐部的商标；上述 MIT License 只覆盖素材仓库的版权授权，不授予商标权。本插件仅在识别参赛球队的目的下使用这些队徽，不代表与任何俱乐部存在合作、赞助或背书关系。

插件代码与封面排版按 MIT License 随插件分发，见 `LICENSE`。ESPN 名称及相关数据版权归其权利人，本插件仅展示当前比赛所需的队名、比分、时间等公开比赛事实。

## 赛季名单维护

当前内置 2026-27 赛季六大联赛名单（112 队）。新赛季名单公布后，在开赛前一个月用同一 `football-logos` 映射替换 `LEAGUE_TEAMS` 和对应的 `crests/` 队徽，再随新版本发布；插件不在运行时抓取尚未公布的名单。

适用于 Windows 版岛仔。赛程覆盖 2026-27 赛季，包含六大联赛及主要杯赛。

### 队徽素材 MIT License 原文

```text
MIT License

Copyright (c) 2026 Jose Arroyave

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

