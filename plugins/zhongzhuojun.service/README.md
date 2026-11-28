# 服务器监视

在岛仔状态页查看 Linux 和 macOS 设备的性能。

最多监控四台 SSH 设备。CPU、GPU、内存、显存、温度、系统盘和网速可以分别设为仅展开、仅常驻、两处显示或隐藏。展开页可查看按常驻内存、线程数和 CPU 排序的进程排行。

## 启用

1. 安装后在「设置 → 插件 → 已安装」启用。本地试装时，在「开发者工具 → 安装本地插件…」选择本目录的 `plugin.json`。已在岛仔 0.6.70 上验证。
2. Windows 端需要 [Node.js](https://nodejs.org/en/download) 和 OpenSSH 客户端。用 `ssh 用户@主机` 确认能登录并核对主机指纹。后台采样使用 SSH 密钥或 `ssh-agent`，需要能免交互登录。非默认端口可用 SSH 配置别名，或在插件设置中填 `用户@主机:端口`。
3. 在「设置 → 服务器监视」填写 SSH 地址和可选昵称，然后保存。打开「授权数据源」，授权 `http://127.0.0.1:17863/status`。
4. 取与已安装版本一致的 [main.js](main.js)（在 GitHub 文件页点 Raw 后保存），在 Windows PowerShell 切换到文件所在目录，运行 `node .\main.js --collect`。保持窗口开启，按 `Ctrl+C` 停止采集。展开岛仔切到「服务器监视」，第二次有效刷新后可计算网速。

## 数据来源与范围

- 岛仔使用 `source.read: loopback` 读取 Windows 上的只读回环接口。采集器读取本插件的本地设置记录，用系统 OpenSSH 采样，通过回环接口返回指标及排行中的进程名、PID 和数值。SSH 凭据由 OpenSSH 管理。
- Linux 读取系统统计，NVIDIA 指标依赖 `nvidia-smi`，AMD 指标依赖驱动暴露的 sysfs 项。macOS 使用系统命令及 I/O Registry 的可用 GPU 读数，Apple Silicon 显示 GPU 使用的统一内存。M4 系列尝试读取 CPU 和 GPU 温度，传感器缺测时显示「—」。[M4 温度传感器键参考](https://github.com/exelban/stats/blob/master/Modules/Sensors/values.swift)
- 许可证见 [LICENSE](LICENSE)。
