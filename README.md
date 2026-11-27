# 岛仔插件仓库

本仓库是岛仔插件集市的官方投稿与发布入口，提供插件开发模板、投稿指南、版本审核与发布说明。

## 插件投稿

在 GitHub 上复刻（Fork）本仓库，参考开发模板制作插件。使用岛仔作者测试版完成试装和校验后，向本仓库的 `main` 分支提交拉取请求（PR）。[作者投稿指南](docs/author-submission.md) · [插件开发模板](templates/date-countdown/) · [使用 AI 辅助投稿](docs/author-submission.md#让-ai-帮忙准备投稿)

## 问题反馈

从插件详情或「我的插件」打开「插件反馈」。普通问题单会按插件 ID 通知登记的维护者，安装和更新问题由仓库维护者跟进。上架前，由仓库维护者核对并在主分支的 `.github/plugin-maintainers.json` 登记作者或接手维护的 GitHub 账号。安全或隐私问题通过 GitHub 私密报告提交。[普通问题](https://github.com/Renly1994/xiaotang-daozai-plugins/issues) · [私密报告](https://github.com/Renly1994/xiaotang-daozai-plugins/security/advisories/new)

处理完成后，登记维护者可在对应的插件反馈下单独评论 `/close`，机器人核对插件归属和 GitHub 账号后关闭问题单。旧反馈的正文须从未编辑，且机器人的原通知账号与当前登记一致。仓库负责人可以手动运行「插件反馈分流」，为符合条件的未关闭旧反馈补发一次操作说明。

## 版本发布

审核并合并后，发布脚本核对插件已登记维护者，再用启用了插件作者命令的岛仔构建安装包。镜像仓须已初始化默认分支，Git 使用维护者现有的 Gitee 凭据。先发布到 `preview` 频道验收，正式上架使用 `stable` 频道。「官方」标识按同一审定提交中的 `.github/official-plugins.json` 登记。

将下例中的 `your.plugin-id` 替换为待发布的插件 ID。

```powershell
python scripts/publish.py your.plugin-id --island 'D:/路径/daozai.exe' --mirror 'https://gitee.com/xiaotangtoken/xiaotang-daozai-plugins.git' --channel preview
```

发布从 GitHub `main` 读取已合并源文件，检查并上传不可覆盖的版本 ZIP。通过 Gitee 的公开 Contents API 确认 ZIP 字节一致后，再推送 `catalog.json`。同一次发布中断后可用同一版本包重试。岛仔读取同一 API 提供的索引和版本包，再核对大小与 SHA-256。[Gitee 镜像](https://gitee.com/xiaotangtoken/xiaotang-daozai-plugins) · [预览索引](https://gitee.com/api/v5/repos/xiaotangtoken/xiaotang-daozai-plugins/contents/preview/catalog.json?ref=master)

通过 Gitee 网页发布时，在命令末尾加 `--prepare 'D:/待发布/插件版本'`，读取当前线上索引并导出 ZIP 和待更新索引。按输出中的 SHA-256 核对 Gitee 上可公开下载的 ZIP，再提交同目录的 `catalog.json`。

插件维护者可以先在投稿 PR 或对应反馈中提交建议简介，由仓库维护者审阅后在主分支的 `.github/plugin-descriptions.json` 为已审阅的官方或社区插件按插件 ID 登记；这不改变插件的官方标识或原始包。简介更新不需要提升版本：发布命令会在本地重新打包作校验，只要当前版本的 ZIP 与线上已发布的 ZIP 字节完全一致，就只更新 `catalog.json`。网页发布的 `--prepare` 模式请使用新的空目录；此时不导出新的 ZIP，核对已有公开 ZIP 后只上传新索引。

统计服务上线后，预览和正式频道的发布命令都加 `--metrics`，在 ZIP 公开可下载后登记统计版本，再更新索引。使用网页发布时，运行导出的 `metrics.sql` 完成登记后再提交索引。[集市统计部署和上架登记](services/market-metrics/README.md)
