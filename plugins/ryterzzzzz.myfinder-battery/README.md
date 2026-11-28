# MyFinder 无线电量桥接

将 MyFinder Device Battery 已取得的 USB / 2.4G 电量接入岛仔原生无线设备列表、详情、提醒及常驻选择。

**当前依赖拟议的 `wireless.devices` 宿主接口。官方 v0.6.71 尚不支持这个接口，不能直接安装使用；本地验证使用基于 v0.6.71 的接口试用版。插件投稿和宿主接口提案分开审核。**

## 数据与权限

- 插件运行在 JS 沙箱，只申请 `source.read: "loopback"`，读取用户授权的 `http://127.0.0.1:17359/battery`。
- 桥接程序只读取同一用户的 MyFinder `wireless-cache.json`、`status.json`，并核对实际读取器进程。它不执行 HID 查询、不设置 DPI，也不修改外设或 MyFinder 配置。
- 只导出设备身份、型号、VID/PID、电量、连接/充电状态和各自来源时间；不导出进程号、序列号、文件路径、DPI 或账户配置。
- 仅监听 `127.0.0.1`，只允许 GET `/battery`，不访问外网、不记录请求日志。拒绝非本机 Host、浏览器跨来源请求和写入方法。
- 宿主按 60 秒刷新；停用、撤销数据源权限或关闭无线模块会停止该插件向原生页面提供设备。

## 使用

1. 安装支持 `wireless.devices` 的岛仔宿主，安装插件并启用。
2. 保持 MyFinder Device Battery 运行，启用保存读数。桥接按 schema 2 读取结果，不包含 MyFinder 本体或任何厂商协议代码。
3. 把文末 Python 源码保存为 `bridge.py`，使用 Python 3.10 或更新版本运行：

   ```powershell
   python -B bridge.py
   ```

   或使用自行安装的 MyFinder 自带 Python。终端按 Ctrl+C 停止桥接。桥接本身不自动注册启动项；如需随登录运行，应由用户显式设置隐藏启动快捷方式。
4. 在岛仔插件详情授权完整地址 `http://127.0.0.1:17359/battery`。无需输入凭据。
5. 在原生“无线设备”页查看设备，选择需要常驻的设备。浏览器自动收缩仍由宿主原有设置控制。

未授权、桥接未运行或 HTTP 数据源离线时，宿主清空该来源的原生设备输出。桥接仍可响应而 MyFinder 退出或心跳过期时，仅在有限时间内保留明确标记的历史读数。异常未来时间或电量未知时，不伪造当前电量。

## 时间与显示

插件保留原始测量、连接、充电时间。普通设备有效期 90 秒；ASUS 键盘的 `vendor_log` 使用 150 秒，涵盖厂商约 60 秒采样、读取器 60 秒轮询和 30 秒调度余量。旧值不会通过重新读取文件续期。历史百分比最长保留 10 分钟，充电未知保持未知，档位换算保留 `≈`。

宿主优先采用能够明确匹配同一设备的原生新鲜读数，保留其真实来源；不会因为同一接收器 VID/PID 相同就把一个设备的电量借给另一个设备。

## 软件更新

当前本地宿主是基于 v0.6.71 的接口试用版。岛仔更新可替换 `daozai.exe`，因此可能覆盖尚未合入官方的宿主接口。独立外挂、桥接和登录启动项通常保留；若新版没有 `wireless.devices` 接口，原生列表接入会停止。需由维护者合入接口后随正式版提供，或针对新版重新适配接口。保留旧程序备份用于回退，不应拿旧版程序覆盖新版来恢复接口。外部 MyFinder 更新也可能替换用户自行修改的设备解析器。

## 验证边界

支持范围取决于用户安装的 MyFinder 读取器，不代表本插件实现了所有厂商电量协议。曾核对的本地读取器包含 Razer Viper V2 Pro、ROG STRIX SCOPE II 96 RX WIRELESS 和 Flydigi APEX5；手柄电量为档位估算。ROG DELTA II 的历史记录或接收器响应不等于当前在线电量，需在开机的 2.4G 模式下单独核验。

开发验证将合成测试与真实观察分开记录，不把测试设备或越界输入作为设备实测电量。安装验证结果、宿主接口依赖及插件仓校验状态见投稿说明；不能将草稿 PR 视为已正式上架。

插件 JS、下方独立桥接源码和封面为本项目新增材料，使用 MIT 许可证。外部 MyFinder 由用户另行安装，遵守其自身许可证。

## 独立桥接源码

下面是完整的只读桥接程序，复制保存为 `bridge.py`。不需要第三方 Python 包。

<!-- BRIDGE_SOURCE_START -->
```python
"""MIT. MyFinder result adapter: localhost read-only GET; no hardware queries."""
from __future__ import annotations
import argparse
import ctypes
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer

MAX_BYTES = 128 * 1024
FIELDS = ("id", "name", "kind", "transport", "vendorId", "productId", "percent",
          "charging", "approximate", "online", "fresh", "provider", "sourceQuality",
          "measurementState", "connectionState", "measuredAtUtc", "confirmedAtUtc",
          "queriedAtUtc", "connectionCheckedAtUtc", "chargingCheckedAtUtc")

def utcnow():
    return datetime.now(timezone.utc)

def recent(value, now, seconds=180):
    try:
        stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
        delta = (now - stamp).total_seconds()
        return -5 <= delta <= seconds
    except (ValueError, TypeError, AttributeError):
        return False

def read_json(path):
    with path.open("rb") as stream:
        raw = stream.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("bounded input exceeded")
    return json.loads(raw.decode("utf-8-sig"))

def reader_running(pid):
    if os.name != "nt" or type(pid) is not int or pid <= 0:
        return False
    from ctypes import wintypes as W
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.argtypes = [W.DWORD, W.BOOL, W.DWORD]
    kernel.OpenProcess.restype = W.HANDLE
    kernel.GetExitCodeProcess.argtypes = [W.HANDLE, ctypes.POINTER(W.DWORD)]
    kernel.GetExitCodeProcess.restype = W.BOOL
    kernel.QueryFullProcessImageNameW.argtypes = [W.HANDLE, W.DWORD, W.LPWSTR, ctypes.POINTER(W.DWORD)]
    kernel.QueryFullProcessImageNameW.restype = W.BOOL
    kernel.CloseHandle.argtypes = [W.HANDLE]
    kernel.CloseHandle.restype = W.BOOL
    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle:
        return False
    try:
        code = W.DWORD()
        if not kernel.GetExitCodeProcess(handle, ctypes.byref(code)) or code.value != 259:
            return False
        path = ctypes.create_unicode_buffer(32768)
        size = W.DWORD(len(path))
        return bool(kernel.QueryFullProcessImageNameW(handle, 0, path, ctypes.byref(size))
                    and Path(path.value).name.lower() == "atkmousebattery.exe")
    finally:
        kernel.CloseHandle(handle)

def snapshot(directory, now=None, process_check=reader_running):
    now = now or utcnow()
    result = {"schema": 1, "observedAtUtc": now.isoformat().replace("+00:00", "Z"),
              "reader": {"running": False, "ready": False, "lastStatusAtUtc": None}, "devices": []}
    try:
        cache = read_json(directory / "wireless-cache.json")
        status = read_json(directory / "status.json")
        if cache.get("schema") != 2 or not isinstance(cache.get("devices"), list) or len(cache["devices"]) > 64:
            return result
        running = process_check(status.get("processId"))
        stamp = status.get("snapshotGeneratedAtUtc")
        result["reader"] = {"running": running,
                            "ready": running and status.get("universalReady") is True and recent(stamp, now),
                            "lastStatusAtUtc": stamp if isinstance(stamp, str) else None}
        for device in cache["devices"]:
            if isinstance(device, dict):
                # Do not expose paths, PID, serials, DPI controls or account data.
                result["devices"].append({key: device.get(key) for key in FIELDS})
        if len(json.dumps(result, ensure_ascii=False).encode("utf-8")) > MAX_BYTES:
            result["devices"] = []
    except (OSError, ValueError, TypeError, AttributeError, OverflowError):
        pass
    return result

def handler(directory):
    class BatteryHandler(BaseHTTPRequestHandler):
        server_version = "MyFinderReadOnlyBridge/1.0"
        sys_version = ""
        def setup(self):
            super().setup()
            self.connection.settimeout(2)
        def do_GET(self):
            expected_host = "127.0.0.1:" + str(self.server.server_address[1])
            if self.headers.get("Host") != expected_host or self.headers.get("Origin") is not None:
                self.send_error(403)
                return
            if self.path != "/battery":
                self.send_error(404)
                return
            data = json.dumps(snapshot(directory), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                pass
        def do_POST(self):
            self.send_error(405)
        def do_PUT(self):
            self.send_error(405)
        def do_DELETE(self):
            self.send_error(405)
        def log_message(self, *_):
            pass
    return BatteryHandler

def main():
    parser = argparse.ArgumentParser(description="Read-only MyFinder snapshot on 127.0.0.1")
    parser.add_argument("--port", type=int, default=17359)
    parser.add_argument("--data-directory", type=Path,
                        default=Path(os.environ.get("LOCALAPPDATA", "")) / "MyFinderDeviceBattery")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--pid-file", type=Path)
    args = parser.parse_args()
    if args.once:
        print(json.dumps(snapshot(args.data_directory), ensure_ascii=False))
        return
    if not 1024 <= args.port <= 65535:
        parser.error("port must be between 1024 and 65535")
    server = HTTPServer(("127.0.0.1", args.port), handler(args.data_directory))
    server.timeout = 1
    if args.pid_file:
        args.pid_file.parent.mkdir(parents=True, exist_ok=True)
        args.pid_file.write_text(json.dumps({"pid":os.getpid(),"startedAtUtc":utcnow().isoformat()}),encoding="utf-8")
    try:
        server.serve_forever(poll_interval=1)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if args.pid_file:
            try:
                if json.loads(args.pid_file.read_text(encoding="utf-8"))["pid"] == os.getpid():
                    args.pid_file.unlink()
            except (OSError,ValueError,KeyError,TypeError):
                pass

if __name__ == "__main__":
    main()
```
<!-- BRIDGE_SOURCE_END -->
