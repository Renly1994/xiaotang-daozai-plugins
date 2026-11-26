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

## 1.0.3 补充的接收器

本批仅匹配 Windows 枚举到的 USB 接收器，不读取电量，不区分共用接收器后的具体设备。外部项目资料只用于核对 VID/PID 和连接模式，未移植协议或程序。

### 反馈及交叉核实

| USB VID:PID | 接收器与证据 |
| --- | --- |
| `0C45:FEFE` | Sonix 2.4G 键盘接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7181336570) |
| `0B05:1AD3` | ROG Cetra True Wireless SpeedNova 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7181440744) |
| `320F:5112` | IQUNIX 2.4G 键盘接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7184892849) |
| `369B:0114` | 雷神 ML903mini 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7184892849) |
| `0E6A:0110` | iKF-V11 Pro 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7184892849) |
| `35D8:0133` | 水月雨 GM01 Pro 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7183795138) |
| `3554:FB4F` | IPI 奇 Pro 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai-plugins/issues/45) |
| `0B05:1ACE` | ROG Omni 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7186395578) |
| `0B05:1AD0` | ROG SpeedNova 8K 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7186395578) |
| `0B05:1AFA` | ROG Delta II 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7186395578) |
| `320F:7063` | HECATE G4M PRO 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7185793735) |
| `3151:4011` | 3151:4011 2.4G 键盘接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7185793735)， [交叉核实](https://github.com/dniminenn/sharkfin/blob/master/docs/PROTOCOL.md) |
| `35BB:A009` | HECATE G2 Wireless 7.1 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7185793735) |
| `1532:00CD` | 雷蛇 Basilisk V3 Pro 35K 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7188281354)， [交叉核实](https://github.com/openrazer/openrazer/issues/2335) |
| `3554:FA09` | 狼蛛 F87 系列 2.4G 键盘接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7189178633)， [交叉核实](https://github.com/leetrat/aula-f87-rgb)。该用户贴的是有线 ID；此处为独立证实的系列接收器 ID，用户所用接收器仍待核实。 |
| `3837:6011` | 迈从 V9 Pro 2 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7189643389) |
| `372E:1026` | 前行者 S9 Pro 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7189178633)， [交叉核实](https://github.com/wushuai0802/myfinder-device-battery/blob/main/docs/compatibility.md)。仅此接收器 ID，不涵盖其他 S9 版本。 |
| `248A:FF30` | 达摩鲨 M3 2.4G 接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7191797692)， [交叉核实](https://github.com/ferloom/Wireless-Device-Battery-Monitor)。按外部实测 ID 纳入，反馈者具体版本待核实；不含 M3S 或有线。 |
| `1A2C:7FFF` | Semico 2.4G 键盘接收器，[来源](https://github.com/Renly1994/xiaotang-daozai/issues/267#issuecomment-7185050673)， [交叉核实](https://github.com/ferloom/Wireless-Device-Battery-Monitor/issues/136)。共享 ID，不按 AULA S99 等具体型号显示。 |

### 外部项目收录

| USB VID:PID | 接收器与证据 |
| --- | --- |
| `3329:4B19` | Audeze Maxwell 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L15-L19) |
| `0ECB:2088` | JBL Quantum 910 Wireless 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L85-L89) |
| `046D:0AF7` | Logitech G PRO X 2 LIGHTSPEED 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L91-L95) |
| `1532:053A` | Razer Barracuda Pro 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L108-L112) |
| `373E:001E` | LAMZU Maya X 8K 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L260-L264) |
| `2023:F013` | MCHOSE A5 Pro Max 1K 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L266-L270) |
| `258A:2022` | Glorious Model O Wireless 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L332-L338) |
| `1532:0296` | Razer DeathStalker V2 Pro TKL 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L445-L449) |
| `3367:1961` | Endgame Gear XM2we 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/devices.md#L9) |
| `1B1C:0A6B` | Corsair HS80 RGB Wireless 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L27-L29) |
| `1B1C:0A3E` | Corsair Virtuoso SE 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L36-L41) |
| `1B1C:0A40` | Corsair Slipstream 通用接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L36-L41) |
| `1B1C:1B7F` | Corsair Dark Core RGB Pro SE 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L217-L221) |
| `03F0:08BE` | HyperX Cloud Alpha 2 无线基站，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L55-L59) |
| `03F0:0995` | HyperX Cloud II Core Wireless 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L61-L65) |
| `03F0:02CC` | HyperX Cloud III S Wireless 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L73-L77) |
| `03F0:06BE` | HyperX Cloud III S Wireless 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L73-L77) |
| `1532:0528` | 雷蛇 BlackShark V2 Pro 2020 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L114-L142) |
| `1532:0555` | 雷蛇 BlackShark V2 Pro 2023 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L114-L142) |
| `1038:22A1` | SteelSeries Arctis Nova 7 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L156-L166) |
| `1038:2244` | SteelSeries Arctis Nova Elite 无线基站，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L156-L166) |
| `5253:1020` | 迈从 M7 Ultra 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L284-L288) |
| `1532:00BF` | 雷蛇 DeathAdder V4 Pro 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L320-L324) |
| `3057:2001` | VAXEE 4K 通用接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L354-L358) |
| `3554:F505` | VGN Dragonfly 4K 通用接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L290-L297) |
| `36A7:A880` | WLmouse Beast X Max 8K 2.4G 接收器，[来源](https://github.com/HeyOkay/HaloBattery/blob/15a73ac4d88435a771b0060b28171733a43dab06/docs/protocols.md#L366-L370) |

## 真机复测与反馈

兼容包上线后，在岛仔中更新并启用，拔插一次接收器，再看「无线设备」页。重点复测狼途 M8 Max 的 `A8A5:2255`，以及 ATK A9 Ultra Max 2.0 所配接收器是否为 `373B:11FE`。

如果仍未识别，欢迎在[岛仔 #267](https://github.com/Renly1994/xiaotang-daozai/issues/267) 留下完整型号、连接方式、岛仔/兼容包版本和接收器的 `VID_xxxx&PID_xxxx`，不需要设备实例路径、序列号或 MAC。若已识别但没电量，请单独注明。
