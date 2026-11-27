// 岛仔「隐私指示」插件：在岛上显示摄像头／麦克风正在被哪个程序使用。
//
// 数据来源按优先级：
//   1) input.devices —— 宿主代读系统占用账本后注入（SDK 提案 1 落地后的正式路径）
//   2) input.source  —— 用户授权的本地数据文件（路线 C 自用，由伴随程序写入）
//   3) 两者都没有     —— 未知态。读不到不等于没占用，绝不显示成"一切正常"。

const MAX_PER_DEVICE = 3;
const MAX_ITEMS = 8;
const MAX_TAGS = 4;

const LIMITS = {
    label: 28,
    detail: 80,
    summary: 120,
    tag: 8,
    pinnedText: 12,
    pinnedValue: 24,
    noticeId: 128,
    noticeTitle: 40,
    noticeBody: 120
};

const DEVICE_TEXT = { camera: "摄像头", microphone: "麦克风" };
const DEVICE_ORDER = ["camera", "microphone"];

// 强提醒亮光：摄像头用红、麦克风用绿，都是高反差的饱和色。
const ALERT_COLOR = { camera: "#FF3B30", microphone: "#30C853" };
const ALERT_PERIOD_MS = 800;   // 画布脉动周期，最快 800 ms

// 去掉控制字符与多余空白，保证单行可显示。
function clean(text) {
    return String(text ?? "")
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// 按字符截断（中文算一个字）。
function clip(text, max) {
    const chars = [...String(text ?? "")];
    return chars.length <= max ? chars.join("") : chars.slice(0, max).join("");
}

// 同名程序只保留一条，大小写不同视为同一个。
function uniqueNames(names) {
    const seen = new Set();
    const out = [];
    for (const name of names) {
        const value = clean(name);
        if (!value) continue;
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(value);
    }
    return out;
}

// 取出设备列表里的程序名，元素可以是字符串或 {name}。
function readNames(list) {
    if (!Array.isArray(list)) return [];
    const names = [];
    for (const item of list) {
        const raw = typeof item === "string" ? item
            : (item && typeof item.name === "string" ? item.name : "");
        const name = clean(raw);
        if (name) names.push(name);
    }
    return uniqueNames(names);
}

// 宿主注入的设备信息。
function fromDevices(devices) {
    if (!devices || typeof devices !== "object") return null;
    const known = "camera" in devices || "microphone" in devices;
    if (!known) return null;
    return {
        camera: Array.isArray(devices.camera) ? devices.camera : [],
        microphone: Array.isArray(devices.microphone) ? devices.microphone : []
    };
}

// 用户授权的本地数据文件。
function fromSource(source) {
    if (!source || typeof source !== "object") return null;
    if (source.status !== "ready" || typeof source.text !== "string") return null;
    let parsed;
    try {
        parsed = JSON.parse(source.text);
    } catch (error) {
        return null;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
}

function readPayload(input) {
    if (input && input.devices) return fromDevices(input.devices);
    return fromSource(input && input.source);
}

function summarize(devices) {
    const parts = [];
    for (const device of DEVICE_ORDER) {
        const names = devices[device];
        if (!names.length) continue;
        const text = DEVICE_TEXT[device];
        parts.push(names.length === 1
            ? `${text}正在被 ${names[0]} 使用`
            : `${text}正在被 ${names[0]} 等 ${names.length} 个程序使用`);
    }
    if (!parts.length) return "摄像头与麦克风均未被占用";
    return parts.join("；");
}

function buildItems(devices) {
    const items = [];
    for (const device of DEVICE_ORDER) {
        for (const name of devices[device].slice(0, MAX_PER_DEVICE)) {
            items.push({
                label: clip(`${DEVICE_TEXT[device]} · ${name}`, LIMITS.label),
                detail: "正在使用",
                state: "running"
            });
        }
    }
    return items.slice(0, MAX_ITEMS);
}

function buildTags(devices) {
    const tags = [];
    const total = devices.camera.length + devices.microphone.length;
    for (const device of DEVICE_ORDER) {
        if (devices[device].length) tags.push(DEVICE_TEXT[device]);
    }
    if (total) tags.push(clip(`${total} 个程序`, LIMITS.tag));
    return tags.slice(0, MAX_TAGS);
}

// 摄像头／麦克风爆闪各一个开关（settings.camera_alert / mic_alert，默认都开）。
// 返回"被占用且对应爆闪开关开着"的设备列表（摄像头在前），用于同时告警两个设备。
function activeFlashDevices(devices, cameraAlert, micAlert) {
    const out = [];
    if (devices.camera.length && cameraAlert) out.push("camera");
    if (devices.microphone.length && micAlert) out.push("microphone");
    return out;
}

// 不论开关，取第一个被占用的设备（用于爆闪都关掉时退回普通文字）。
function occupiedDevice(devices) {
    if (devices.camera.length) return "camera";
    if (devices.microphone.length) return "microphone";
    return null;
}

// 强提醒（岛体展开后的状态页画布）：每个告警设备画一个 pulse 真闪烁块 + 设备名，
// 摄像头和麦克风同时占用时上下两行同时闪烁。实测状态页顶层画布支持 pulse（见验证记录 §11.1）。
function buildStatusCanvas(devices, cameraAlert, micAlert) {
    const active = activeFlashDevices(devices, cameraAlert, micAlert);
    if (!active.length) return undefined;
    const rowH = 48;
    const nodes = [];
    active.forEach((device, i) => {
        const color = ALERT_COLOR[device];
        const name = devices[device][0];
        const y = 8 + i * rowH;
        nodes.push({ rect: [8, y, 40, 40], r: 20, fill: color, glow: color,
                     loop: { kind: "pulse", period_ms: ALERT_PERIOD_MS } });
        nodes.push({ text: DEVICE_TEXT[device], at: [60, y + 18], size: 15, fill: color, weight: 800 });
        nodes.push({ text: clip(name, LIMITS.pinnedValue), at: [60, y + 36], size: 12, fill: "$muted" });
    });
    return { height: 8 + active.length * rowH, nodes };
}

// 收起态常驻位（灵动岛胶囊）：跑马灯——左侧彩色圆点 + 右侧滚动文字。
// 实测 pinned.canvas 只接受 flow（横向滚动），pulse/bob/spin 被拒（见 §11.1），
// 所以收起态用"圆点 + 滚动文字"的跑马灯样式（用户偏好，比色块频闪耐看）。
// 双设备时放两个圆点（红+绿），文字同时点名两个设备。
function buildPinnedMarquee(items) {
    const NAME_CLIP = 16;       // 程序名放宽截断
    const nodes = [];
    if (items.length === 1) {
        const it = items[0];
        const color = ALERT_COLOR[it.device];
        nodes.push({ rect: [2, 4, 14, 14], r: 7, fill: color });
        const text = `${DEVICE_TEXT[it.device]}正在使用 · ${clip(it.name, NAME_CLIP)}`.repeat(2);
        nodes.push({ clip: [20, 0, 136, 22], group: [
            { text, at: [20, 15], size: 11, max_width: 136, fill: color, weight: 700,
              loop: { kind: "flow", period_ms: ALERT_PERIOD_MS } }
        ] });
    } else {
        // 双设备：左右两半，各"圆点 + 同色滚动文字"，文字色与圆点一致
        const segW = 78;
        items.slice(0, 2).forEach((it, i) => {
            const x0 = i * segW;
            const color = ALERT_COLOR[it.device];
            nodes.push({ rect: [x0 + 2, 5, 12, 12], r: 6, fill: color });
            const tx = x0 + 16;
            const text = `${DEVICE_TEXT[it.device]} ${clip(it.name, NAME_CLIP)}`.repeat(2);
            nodes.push({ clip: [tx, 0, segW - 16, 22], group: [
                { text, at: [tx, 15], size: 11, max_width: segW - 16, fill: color, weight: 700,
                  loop: { kind: "flow", period_ms: ALERT_PERIOD_MS } }
            ] });
        });
    }
    return { canvas: { width: 156, fit_width: true, nodes } };
}

// 常驻位：有告警设备就跑马灯；爆闪都关掉则退回普通文字常驻位。
function buildPinned(devices, cameraAlert, micAlert) {
    const active = activeFlashDevices(devices, cameraAlert, micAlert);
    if (active.length) {
        return buildPinnedMarquee(active.map(device => ({ device, name: devices[device][0] })));
    }
    const plain = occupiedDevice(devices);
    if (!plain) return null;
    return {
        text: clip(DEVICE_TEXT[plain], LIMITS.pinnedText),
        value: clip(devices[plain][0], LIMITS.pinnedValue)
    };
}

// 只在"新出现占用"时提醒：上一次已经占用过的程序不重复提醒。
function buildNotice(devices, previous) {
    for (const device of DEVICE_ORDER) {
        const before = new Set(previous[device].map(name => name.toLowerCase()));
        for (const name of devices[device]) {
            if (before.has(name.toLowerCase())) continue;
            return {
                id: clip(`device-use:${device}:${name}`, LIMITS.noticeId),
                title: clip(`${DEVICE_TEXT[device]}正在使用`, LIMITS.noticeTitle),
                body: clip(name, LIMITS.noticeBody)
            };
        }
    }
    return undefined;
}

function previousNames(previous, device) {
    const list = previous && Array.isArray(previous[device]) ? previous[device] : [];
    return list.filter(item => typeof item === "string").map(clean).filter(Boolean);
}

function refresh(input) {
    const source = input || {};
    const settings = source.settings && typeof source.settings === "object" ? source.settings : {};
    // 摄像头／麦克风爆闪各一个开关，默认都开；关掉某设备就只在该设备被占用时退回普通文字。
    const cameraAlert = settings.camera_alert !== "false";
    const micAlert = settings.mic_alert !== "false";
    const now = typeof source.now === "number" ? Math.floor(source.now / 1000) : Math.floor(Date.now() / 1000);
    const saved = source.storage && typeof source.storage === "object" && !Array.isArray(source.storage)
        ? source.storage : {};
    const previous = saved.last && typeof saved.last === "object" && !Array.isArray(saved.last)
        ? saved.last : {};
    const last = {
        camera: previousNames(previous, "camera"),
        microphone: previousNames(previous, "microphone")
    };

    const payload = readPayload(source);
    if (!payload) {
        // 未知态：读不到就说明读不到，不显示成"未被占用"。
        return {
            status: {
                state: "offline",
                label: "隐私指示",
                summary: "未获得系统占用状态",
                items: [],
                tags: [],
                observed_at: now,
                note: "未读到系统占用账本。需要宿主注入设备占用信息，或在「设置 → 插件 → 已安装」授权本机数据文件。"
            },
            pinned: null,
            storage: { last }
        };
    }

    const devices = {
        camera: readNames(payload.camera),
        microphone: readNames(payload.microphone)
    };
    const occupied = devices.camera.length + devices.microphone.length;
    const output = {
        status: {
            state: occupied ? "running" : "idle",
            label: "隐私指示",
            summary: clip(summarize(devices), LIMITS.summary),
            items: buildItems(devices),
            tags: buildTags(devices),
            observed_at: now
        },
        pinned: buildPinned(devices, cameraAlert, micAlert),
        storage: { last: { camera: devices.camera, microphone: devices.microphone } }
    };
    if (occupied) {
        const pageCanvas = buildStatusCanvas(devices, cameraAlert, micAlert);
        if (pageCanvas) output.canvas = pageCanvas;
    }
    if (occupied) {
        const notice = buildNotice(devices, last);
        if (notice) output.notice = notice;
    }
    return output;
}
