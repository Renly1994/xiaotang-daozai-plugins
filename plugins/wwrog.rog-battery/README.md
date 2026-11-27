# ROG 设备电量

在「状态」页查看 ROG 键盘和鼠标的实时电量、充电状态，支持奥创识别的 OMNI 2.4G 设备。

安装后在「设置 → 插件 → 已安装」启用，然后在插件详情的数据源授权里填入本机桥接地址 `http://127.0.0.1:17358/`。插件只读取回环地址，不联网、不上传任何数据。停用或卸载后岛仔恢复原状；本机桥接服务需要手动关闭。桥接服务未启动或未授权时，插件显示离线提示，不影响岛仔其他功能。

## 来源与范围

- 本机服务：`rog_battery_bridge.py`（见下方全文），只向 OMNI 接收器发送只读查询命令，不修改设备任何设置。
- 授权地址：`http://127.0.0.1:17358/`，只绑定 `127.0.0.1`，外部无法访问。
- 读取数据：`GET /` 返回的 JSON，字段为设备名称、类别、PID、电量百分比、充电状态、是否在线；不含键盘按键、鼠标轨迹或其他隐私数据。
- 兼容范围：华硕 ROG 键盘/鼠标，经 OMNI 接收器（VID `0B05` / PID `1ACE`）2.4G 连接，且被奥创（Armoury Crate）识别。设备名称从奥创 `ACKbMsData.ini` 同步，奥创未收录时使用内置型号表兜底；未列出的型号会以「ROG 设备」显示，电量协议不兼容时显示离线。
- 环境依赖：Windows、Python 3、`pip install hidapi`。
- 上游版本：在岛仔 v0.6.70 上试装并用 `--plugin-test` 校验通过。
- 许可：插件代码与图标按 MIT 许可分发，见 `LICENSE`。图标提取自奥创界面，仅用于设备识别展示。

## 桥接服务全文

将下面内容保存为 `rog_battery_bridge.py`，安装 `hidapi` 后运行 `python rog_battery_bridge.py`，再按上文授权地址。

```python
# -*- coding: utf-8 -*-
"""ROG OMNI 电量桥接服务（只读，通用适配）。

岛仔 JS 插件跑在沙箱里，不能直接读 HID。本服务：
  1. 从奥创（Armoury Crate）的 ACKbMsData.ini 同步设备名称、类别和 PID；
  2. 对 OMNI 接收器配对列表里的在线设备，按类别探测电量；
  3. 通过回环 HTTP 输出 JSON，供岛仔插件 source.read loopback 读取。

适配范围：只要奥创能识别的 ROG 键鼠（用 OMNI 接收器的），都能出现在插件里。
只发送查询命令，不修改设备任何设置。

用法： python rog_battery_bridge.py
地址： http://127.0.0.1:17358/
"""
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import hid

VID, PID = 0x0B05, 0x1ACE
PORT = 17358

# 奥创设备清单（名称同步来源）
AC_KBMS = os.path.join(
    os.environ.get("PROGRAMDATA", r"C:\ProgramData"),
    "ASUS", "ARMOURY CRATE Diagnosis", "ACPeripheralData", "ACKbMsData.ini",
)
AC_DEVICES = os.path.join(os.path.dirname(AC_KBMS), "ACDeviceListData.ini")

# 已知电量协议：usage_page -> (report_id, subcmd, 电量字节, 充电字节, 充电判据)
PROTOCOLS = {
    0xFF00: (0x02, 0x01, 6, 9, lambda v: v == 1),   # OMNI 键盘
    0xFF01: (0x03, 0x07, 5, 10, lambda v: v != 0),  # OMNI 鼠标
}

# 兜底型号名（奥创清单缺失时用），键为小写的 4 位 PID
FALLBACK_NAMES = {
    "1a85": ("ROG AZOTH", "keyboard"),
    "1a68": ("ROG KERIS WIRELESS AIMPOINT", "mouse"),
    "1a6a": ("ROG KERIS WIRELESS AIMPOINT", "mouse"),
    "1a72": ("ROG GLADIUS III AIMPOINT", "mouse"),
    "1b1a": ("ROG KERIS II ACE", "mouse"),
    "1b18": ("ROG KERIS II ACE", "mouse"),
    "1c0e": ("ROG KERIS II ORIGIN", "mouse"),
    "1a94": ("ROG HARPE ACE AIM LAB", "mouse"),
    "1b65": ("ROG HARPE ACE MINI", "mouse"),
    "1ab0": ("ROG STRIX SCOPE II 96", "keyboard"),
    "1b06": ("ROG FALCHION RX LOW PROFILE", "keyboard"),
}


def read_ini(path):
    """读 ANSI/UTF8 INI，返回 section -> {key: value}。"""
    data = {}
    if not os.path.isfile(path):
        return data
    raw = open(path, "rb").read()
    text = None
    for enc in ("utf-8-sig", "utf-16", "gbk", "latin1"):
        try:
            text = raw.decode(enc)
            if "\x00" in text[:200]:
                continue
            break
        except Exception:
            continue
    if text is None:
        return data
    section = None
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith((";", "#")):
            continue
        if line.startswith("[") and line.endswith("]"):
            section = line[1:-1]
            data.setdefault(section, {})
        elif section and "=" in line:
            k, v = line.split("=", 1)
            data[section][k.strip()] = v.strip()
    return data


def armoury_devices():
    """从奥创清单同步设备：返回 {pid4lower: {name, kind}}。"""
    out = {}
    for section, kv in read_ini(AC_KBMS).items():
        pid = kv.get("PID", "").replace("0B05", "").replace("0b05", "").lstrip("0").lower()
        if not pid:
            continue
        pid = pid.zfill(4)
        name = kv.get("Name") or section.split("_")[0]
        dtype = kv.get("DeviceType", "").lower()
        kind = "keyboard" if "keyboard" in dtype else "mouse" if "mouse" in dtype else "device"
        out[pid] = {"name": name, "kind": kind}
    # 设备列表 INI 补充名称（如 ROG OMNI RECEIVER）
    for section, kv in read_ini(AC_DEVICES).items():
        if not (len(section) == 9 and "/" in section):
            continue
        vid, pid = section.split("/", 1)
        if vid.upper() != "0B05":
            continue
        pid = pid.lower()
        out.setdefault(pid, {"name": kv.get("Name", "ROG 设备"), "kind": "device"})
    return out


def enumerate_devices():
    return hid.enumerate(VID, PID)


def paired_pids(devs):
    d = next((x for x in devs if x["usage_page"] == 0xFF02), None)
    if not d:
        return []
    try:
        h = hid.device()
        h.open_path(d["path"])
        h.write(bytes([0x01, 0xA0, 0x00] + [0] * 61))
        r = h.read(64, 1200)
        h.close()
        if len(r) < 12:
            return []
        pids = []
        for i in range(5, len(r) - 1, 4):
            pid = int.from_bytes(r[i:i + 2], "little")
            if pid == 0:
                break
            pids.append("%04x" % pid)
        return pids
    except Exception:
        return []


def probe_battery(devs, usage_page):
    """按已知协议探测电量，返回 (percent, charging) 或 None。"""
    proto = PROTOCOLS.get(usage_page)
    if not proto:
        return None
    report_id, sub, b_idx, c_idx, charge_test = proto
    d = next((x for x in devs if x["usage_page"] == usage_page), None)
    if not d:
        return None
    # 设备刚从休眠唤醒时首次查询可能无应答，短重试避免偶发误判为离线
    for _ in range(3):
        try:
            h = hid.device()
            h.open_path(d["path"])
            h.write(bytes([report_id, 0x12, sub] + [0] * 61))
            r = h.read(64, 1200)
            h.close()
            if len(r) < 12 or r[1] != 0x12 or r[2] != sub:
                continue
            percent = r[b_idx]
            if percent > 100:
                continue
            return (percent, charge_test(r[c_idx]))
        except Exception:
            continue
    return None


def snapshot():
    devs = enumerate_devices()
    pids = paired_pids(devs)
    ac = armoury_devices()
    devices = []
    for pid in pids:
        info = ac.get(pid, {})
        name = info.get("name")
        kind = info.get("kind", "device")
        if not name:
            name, fb_kind = FALLBACK_NAMES.get(pid, ("ROG 设备", "device"))
            if kind == "device":
                kind = fb_kind
        # 用 DeviceType 决定探哪个通道，保证键盘/鼠标图标正确
        usage = 0xFF00 if kind == "keyboard" else 0xFF01 if kind == "mouse" else None
        reading = probe_battery(devs, usage) if usage else None
        devices.append({
            "kind": kind,
            "name": name,
            "pid": "0B05:" + pid.upper(),
            "battery": reading[0] if reading else None,
            "charging": reading[1] if reading else False,
            "online": reading is not None,
            "source": "armoury" if pid in ac else "fallback",
        })
    # 奥创有记录但没进配对列表的（如 USB 有线），也列出来，状态未知
    if not devices:
        for pid, info in ac.items():
            if info.get("kind") not in ("keyboard", "mouse"):
                continue
            devices.append({
                "kind": info["kind"], "name": info["name"],
                "pid": "0B05:" + pid.upper(), "battery": None,
                "charging": False, "online": False, "source": "armoury",
            })
    return {
        "devices": devices,
        "armoury_found": len(ac),
        "updated_at": int(time.time()),
    }


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            body = json.dumps(snapshot(), ensure_ascii=False).encode("utf-8")
        except Exception as exc:
            body = json.dumps({"devices": [], "error": str(exc)}, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    print("ROG battery bridge -> http://127.0.0.1:%d/" % PORT)
    print(json.dumps(snapshot(), ensure_ascii=False))
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
```
