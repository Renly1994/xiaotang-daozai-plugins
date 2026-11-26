# 无线设备兼容包

补充岛仔的无线设备识别。安装并启用后，已适配的设备会显示在「无线设备」页。

## 当前兼容范围

- 罗技 M185 Nano 接收器（USB `046D:C542`）。[罗技 M185 技术规格](https://support.logi.com/hc/en-ca/articles/360023302074-M185-Technical-Specifications)

- VXE 蜻蜓 R1 无线接收器（USB `373B:10C9`）。
- VGN V87 Pro 2.4G 接收器（USB `391D:2A06`）。

同系列其他版本可能使用不同接收器，请按 USB ID 核对。兼容包仅补充接收器识别，不增加电量或充电状态读取；最早新增的两个 ID 的来源为[岛仔 #267 的用户反馈](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7160973342)，待真机复测。

## 1.0.1 补充的其他接收器

以下是已核对的接收器硬件 ID，不是整款设备的电量兼容表。共用 ID 只显示接收器名称或类别，不会推断具体型号。

| USB VID:PID | 证据和范围 |
| --- | --- |
| `04F3:026F` | [X23 Pro 的一个接收器版本](https://github.com/wushuai0802/myfinder-device-battery/issues/397) |
| `1532:00A6` | [仅标准版接收器，不含 HyperPolling](https://github.com/OpenMouse-Project/mouse-protocol/blob/main/docs/razer-testing.md) |
| `24AE:1411` | [不含 VT3S MAX](https://github.com/wushuai0802/myfinder-device-battery/issues/1073) |
| `291D:385D` | [实物反馈 V9 PRO；同 ID 有其他产品](https://github.com/wushuai0802/myfinder-device-battery/issues/606) |
| `320F:5088` | [实物反馈 VGN S99；同 ID 有其他产品](https://github.com/wushuai0802/myfinder-device-battery/issues/351) |
| `3554:F58A` | [实物反馈 R1 Pro Max，和普通 R1 的星闪版不同](https://github.com/wushuai0802/myfinder-device-battery/issues/89) |
| `373B:11FE` | [实物确认接收器 ID；是否为当前 ATK A9 Ultra Max 2.0 反馈中的版本待核实](https://github.com/qu1ncky/BatteryTray/issues/30) |
| `41E4:2001` | [实物反馈 G87；同 ID 有不同版本](https://github.com/wushuai0802/myfinder-device-battery/issues/379) |
| `5253:1021` | [MCHOSE A7/A7 Pro 的已报告接收器版本](https://github.com/wushuai0802/myfinder-device-battery/issues/698) |
| `A8A5:2255` | [狼途 M8 Max 的 2.4G 接收器实测](https://github.com/WXH666-bit/DeskPerch/blob/main/docs/LANGTU-M8.md)；[亦见于前行者 X23SE](https://github.com/wushuai0802/myfinder-device-battery/issues/564) 等型号，显示为通用鼠标接收器。 |

## 1.0.2 补充的接收器

| USB VID:PID | 设备与范围 |
| --- | --- |
| `1532:009C` | 雷蛇 DeathAdder V2 X HyperSpeed（RZ01-0413），[接收器 ID](https://github.com/openrazer/openrazer/issues/2045) |
| `1532:00B7` | 雷蛇 DeathAdder V3 Pro，[标准 2.4G 接收器](https://github.com/OpenMouse-Project/mouse-protocol/blob/main/docs/razer-testing.md)，不含有线模式或 Viper V3 Pro |
| `1532:00C1` | 雷蛇 Viper V3 Pro，[标准 2.4G 接收器](https://github.com/OpenMouse-Project/mouse-protocol/blob/main/docs/razer-testing.md)，不含有线模式；反馈者的具体型号仍待复测 |
| `2717:50FC` | 小米鼠标 4 Pro，[用户提交的 2.4G 接收器 ID](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7167730742) |
| `2717:507B` | 小米便携键盘，[用户提交的 2.4G 接收器 ID](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7167730742) |
| `373B:12D6` | ATK N9 V2 Ultra 耳机，[用户提交的 2.4G 接收器 ID](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7172067514) |
| `374A:A272` | VK 87 MAX V2 键盘，[用户提交的 2.4G 接收器 ID](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7179736780) |
| `374A:A329` | VK M5 PRO 鼠标，[用户提交的 2.4G 接收器 ID](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7179736780) |
| `3151:1020` | [YICHIP 2.4G 无线接收器](https://community.nxp.com/t5/i-MX-Processors/IMX95-Kernel-crash-after-connecting-USB3-0-device/m-p/2419771)，[宏碁 OMR218 有用户反馈](https://github.com/Renly1994/xiaotang-daozai/issues/324)，具体型号待真机复测 |
| `369B:0184` | IQUNIX Q101 星闪，[官方 Q101 驱动](https://q101.iqunix.com/)的接收器筛选项 |
| `369B:0044` | 机械师 L8 Max 星闪版，[2.4G 接收器，不含有线模式](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7179894023) |
| `3837:1018` | [迈从 A7 V3 系列接收器](https://github.com/wushuai0802/myfinder-device-battery/issues/535)，不区分同系列具体版本 |
| `3837:4245` | 迈从 G3 V2，[2.4G 接收器](https://github.com/Jstdi001/MCHOSE-Monitor/blob/main/docs/HID_PROTOCOL.md)，不含有线模式 |
| `391D:1A03` | VGN 蜻蜓 3 Pro 无线接收器，[2.4G 接收器反馈](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7181199203) |
| `260D:0037` | 达尔优 EK87 PRO 无线接收器，[2.4G 接收器反馈](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7181199203) |
| `03F0:0A93` | HyperX Cloud Stinger Core Wireless（PS）接收器，[2.4G 接收器反馈](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7181199203) |
| `38A6:28E9` | 狼蛛 AULA SC800 Max 鼠标，[用户提交的 2.4G 接收器 ID](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7172067514) |

以上仅补充接收器识别，不增加电量或充电状态读取；Windows 真机待复测。

## 真机复测与反馈

兼容包上线后，在岛仔中更新并启用，拔插一次接收器，再看「无线设备」页。重点复测狼途 M8 Max 的 `A8A5:2255`，以及 ATK A9 Ultra Max 2.0 所配接收器是否为 `373B:11FE`。

如果仍未识别，欢迎在[岛仔 #267](https://github.com/Renly1994/xiaotang-daozai/issues/267) 留下完整型号、连接方式、岛仔/兼容包版本和接收器的 `VID_xxxx&PID_xxxx`，不需要设备实例路径、序列号或 MAC。若已识别但没电量，请单独注明。
