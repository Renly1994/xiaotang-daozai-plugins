#!/usr/bin/env python3
"""岛仔隐私指示 · 真机自测（硬件无关）。

自动枚举本机 DirectShow 摄像头／麦克风设备，占用它们，再用本项目的读数程序读回，
验证"占用 → 读数采到程序名 → 释放归零"整条链路。任何 Win10/11 机器都能跑，
**不需要预先知道设备型号名**（优先用 ASCII 的 Alternative name moniker 规避中文名编码坑）。

用法：
    python fixtures/device-use/selftest.py                 # 摄像头 + 麦克风各占 8 秒
    python fixtures/device-use/selftest.py --seconds 12
    python tools/selftest.py --camera-only
    python tools/selftest.py --mic-only
    python tools/selftest.py --ffmpeg /c/path/ffmpeg.exe --reader /c/path/device_use.exe

退出码：0=全部通过；1=有未通过项；2=环境缺失（找不到 ffmpeg/reader/设备）。
"""

import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

# 任何 Windows 控制台码页下都按 UTF-8 输出，避免设备中文名显示乱码。
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)


def find_ffmpeg():
    p = shutil.which("ffmpeg")
    if p:
        return p
    local = os.environ.get("LOCALAPPDATA", "")
    for cand in glob.glob(os.path.join(local, "ffmpeg", "*", "bin", "ffmpeg.exe")):
        if os.path.exists(cand):
            return cand
    return None


def find_reader():
    for cand in (
        os.path.join(HERE, "device_use.exe"),
        os.path.join(HERE, "device_use"),
        os.path.join(PROJECT, "build", "device_use.exe"),
        os.path.join(PROJECT, "build", "device_use"),
    ):
        if os.path.exists(cand):
            return cand
    return None


def list_dshow_devices(ffmpeg):
    """返回 {'video': [(name, moniker), ...], 'audio': [...]}。"""
    proc = subprocess.run(
        [ffmpeg, "-hide_banner", "-f", "dshow", "-list_devices", "true", "-i", "dummy"],
        capture_output=True,
    )
    text = proc.stderr.decode("utf-8", errors="replace")
    dev_re = re.compile(r'"(?P<name>.*?)"\s*\((?P<kind>video|audio)\)')
    mono_re = re.compile(r'Alternative name\s*"(?P<mono>.*?)"')
    out = {"video": [], "audio": []}
    current = None  # (kind, name)
    for line in text.splitlines():
        m = dev_re.search(line)
        if m:
            current = (m.group("kind"), m.group("name"))
            out[m.group("kind")].append([m.group("name"), None])
            continue
        mm = mono_re.search(line)
        if mm and current:
            out[current[0]][-1][1] = mm.group("mono")
            current = None
    return {k: [tuple(v) for v in vals] for k, vals in out.items()}


def occupy(ffmpeg, kind, moniker_or_name, seconds):
    """后台占用设备 seconds 秒，返回 Popen。优先用 moniker（ASCII，最稳）。"""
    target = f"{kind}={moniker_or_name}"
    return subprocess.Popen(
        [ffmpeg, "-hide_banner", "-loglevel", "error", "-f", "dshow",
         "-t", str(seconds), "-i", target, "-f", "null", "-"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def read_once(reader):
    """调用读数程序读一次占用，写到临时文件再读回，避免覆盖常驻数据文件。"""
    tmp = os.path.join(tempfile.gettempdir(), "island_privacy_selftest.json")
    subprocess.run([reader, "-o", tmp], capture_output=True)
    try:
        with open(tmp, "r", encoding="utf-8") as f:
            data = json.load(f)
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
    return data


def wait_for(reader, key, timeout=8.0, poll=1.0):
    """轮询读数程序，直到 key 非空或超时；返回最后一次读数。"""
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = read_once(reader)
        if last and last.get(key):
            return True, last
        time.sleep(poll)
    return False, last


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=int, default=8, help="每个设备占用秒数")
    ap.add_argument("--ffmpeg", help="ffmpeg 可执行文件路径")
    ap.add_argument("--reader", help="device_use 读数程序路径")
    ap.add_argument("--camera-only", action="store_true")
    ap.add_argument("--mic-only", action="store_true")
    args = ap.parse_args()

    ffmpeg = args.ffmpeg or find_ffmpeg()
    reader = args.reader or find_reader()
    if not ffmpeg:
        print("FAIL 环境：找不到 ffmpeg（用 --ffmpeg 指定路径）")
        return 2
    if not reader:
        print("FAIL 环境：找不到 device_use 读数程序（先编译或用 --reader 指定）")
        return 2

    devices = list_dshow_devices(ffmpeg)
    print(f"ffmpeg = {ffmpeg}")
    print(f"reader = {reader}")
    print(f"枚举到 视频 {len(devices['video'])} 个 / 音频 {len(devices['audio'])} 个")

    results = []

    if not args.mic_only:
        cam = devices["video"][0] if devices["video"] else None
        if not cam:
            print("WARN 没枚举到摄像头设备，跳过摄像头用例")
            results.append(("摄像头", False))
        else:
            name, mono = cam
            use = mono or name  # 优先 moniker，规避中文名编码坑
            print(f"\n[摄像头] 名称='{name}'  占用用={'moniker' if mono else 'name'}")
            proc = occupy(ffmpeg, "video", use, args.seconds)
            ok, data = wait_for(reader, "camera")
            proc.wait()
            print(f"  占用中读数：{data}")
            print(f"  摄像头检测：{'PASS' if ok else 'FAIL'}")
            results.append(("摄像头", ok))

    if not args.camera_only:
        mic = devices["audio"][0] if devices["audio"] else None
        if not mic:
            print("WARN 没枚举到麦克风设备，跳过麦克风用例")
            results.append(("麦克风", False))
        else:
            name, mono = mic
            use = mono or name
            print(f"\n[麦克风] 名称='{name}'  占用用={'moniker' if mono else 'name'}")
            proc = occupy(ffmpeg, "audio", use, args.seconds)
            ok, data = wait_for(reader, "microphone")
            proc.wait()
            print(f"  占用中读数：{data}")
            print(f"  麦克风检测：{'PASS' if ok else 'FAIL'}")
            results.append(("麦克风", ok))

    # 释放归零检查
    time.sleep(2)
    after = read_once(reader)
    released = not after.get("camera") and not after.get("microphone")
    print(f"\n[释放归零] 读数：{after}  →  {'PASS' if released else 'FAIL（可能还有别的应用占用）'}")

    failed = [n for n, ok in results if not ok]
    if not released:
        failed.append("释放归零")
    print("\n==== 结果 ====")
    for n, ok in results:
        print(f"  {n}: {'PASS' if ok else 'FAIL'}")
    print(f"  释放归零: {'PASS' if released else 'FAIL'}")
    if failed:
        print("有未通过项：", ", ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
