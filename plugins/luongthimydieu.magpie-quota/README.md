# magpie 额度

在「AI 额度」面板查看本机 magpie 中一个账号的剩余额度。

插件只读 magpie 的额度缓存，展示一个账号、最多三个能明确换算成百分比的窗口。默认自动选择第一个身份可区分且有可用窗口的账号，并在私有存储中固定该账号。固定账号读取失败或身份无法区分时，额度按未知处理。确认该账号已从返回结果中消失后，插件会重新选择。

## 启用

需要使用支持 `GET /v1/magpie/quotas/cards` 的 Magpie 版本。安装插件后，在「设置 → 插件 → 已安装」启用，再选择「授权数据源」并填写本机地址：

```text
http://127.0.0.1:3425/v1/magpie/quotas/cards
```

授权后打开「AI 额度」面板，按插件名称「magpie 额度」找到来源页签。插件设置中的「账号」默认为「自动选择」，也可填写 magpie 里的厂商、显示名或登录名。匹配到多个账号时额度按未知处理，请填写能唯一匹配的登录名或自定义显示名。

Magpie 未运行、数据源未授权、接口不可用或额度未知时，岛仔会隐藏这个来源页签。停用或卸载插件也会隐藏页签。

## 来源与范围

- 数据来自 [magpie](https://github.com/yetone/magpie)（MIT）的本机只读接口 `GET /v1/magpie/quotas/cards`。该接口只返回 magpie 上次读到的缓存，一次刷新只请求一次，不读取 magpie 保存的任何凭据，也不触发 magpie 向上游刷新。插件不接触 API Key、Cookie 或登录文件。
- 插件走 SDK 的本机回环数据源，由宿主直连 `127.0.0.1`，不经过系统代理，不带转发头；读取上限沿用宿主的 128 KiB / 2 秒。
- `windows[].used` 是已用量百分比，插件换算为 `remaining_pct = 100 - used`（取值范围 0 到 100）。`resetsAt` 换算为 Unix 秒的 `reset_at`。
- 首版只展示一个账号、最多三个窗口。`unlimited` 窗口没有上限，`text` 窗口只有厂商文字，`balance` 是钱包余额（`used` 不是读数），这三类都不换算、不显示；因此只有无限额窗口的账号会显示为未知。
- 条目级 `error`、`pluginError` 或 `readError` 非空时，该账号本次数据不可信，按未知处理。旧版 magpie 没有 `/quotas/cards` 时，宿主读到 404，同样按未知处理。
- 窗口名称原样展示，按宿主上限截断到 40 字并去掉控制字符；不猜测或改写 magpie 的窗口名与重置时间。

接口协议和数据结构属于 [yetone/magpie](https://github.com/yetone/magpie) 项目；岛仔由 [Renly1994](https://github.com/Renly1994) 维护。本插件为社区投稿，与上述两个项目没有隶属关系。
