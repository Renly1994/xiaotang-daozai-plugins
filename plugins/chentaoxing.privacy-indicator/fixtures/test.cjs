const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sdk = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8"), sdk);

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "plugin.json"), "utf8"));
const raw = name => fs.readFileSync(path.join(__dirname, name), "utf8");
const json = name => JSON.parse(raw(name));
const run = input => JSON.parse(JSON.stringify(sdk.refresh(input)));
const now = 1764150000000;

// 文件源：模拟宿主把已授权的本地数据文件交给插件。
const source = (name, status = "ready") => ({ source: { status, text: raw(name) } });
const idle = () => source("idle.json");

test("清单字段符合独立状态页插件要求", () => {
    assert.equal(manifest.id, "chentaoxing.privacy-indicator");
    assert.equal(manifest.owner, "status");
    assert.equal(manifest.runtime, "js");
    assert.equal(manifest.entry, "main.js");
    assert.equal(manifest.api, 1);
    assert.equal(manifest.cover, "cover.png");
    assert.ok(manifest.capabilities.includes("status.page"));
    assert.ok(manifest.capabilities.includes("island.pinned"));
    assert.ok(manifest.capabilities.includes("notice"));
    assert.ok(manifest.capabilities.includes("storage"));
    assert.ok(manifest.capabilities.includes("settings"));
    assert.ok(manifest.capabilities.includes("status.canvas"));
    assert.deepEqual(manifest.permissions, { "source.read": "file" });
    assert.ok(manifest.refreshSeconds >= 60);
    assert.ok(Array.isArray(manifest.settings));
    const keys = manifest.settings.map(s => s.key);
    assert.deepEqual(keys, ["camera_alert", "mic_alert"], "摄像头／麦克风爆闪各一个开关");
    for (const s of manifest.settings) {
        assert.equal(s.type, "switch");
        assert.equal(s.default, "true");
    }
    assert.ok(manifest.statusLayout && manifest.statusLayout.components.some(c => c.type === "canvas"),
        "状态页画布需在 statusLayout 声明 canvas 组件");
});

test("没有设备信息也没有数据源时是未知态，不显示常驻位", () => {
    const output = run({ now });
    assert.equal(output.status.state, "offline");
    assert.equal(output.status.summary, "未获得系统占用状态");
    assert.equal(output.pinned, null);
    assert.equal(output.notice, undefined);
});

test("数据源未授权或不可用时同样是未知态，不能当成未被占用", () => {
    for (const status of ["unconfigured", "offline"]) {
        const output = run({ now, source: { status, text: "" } });
        assert.equal(output.status.state, "offline");
        assert.equal(output.status.summary, "未获得系统占用状态");
        assert.equal(output.pinned, null);
    }
});

test("读到摄像头占用时点亮常驻位并列出占用程序", () => {
    const output = run({ now, ...source("normal.json") });
    assert.equal(output.status.state, "running");
    assert.equal(output.status.summary, "摄像头正在被 Zoom 使用");
    assert.equal(output.status.items[0].label, "摄像头 · Zoom");
    assert.equal(output.status.items[0].detail, "正在使用");
    assert.equal(output.status.items[0].state, "running");
    assert.deepEqual(output.status.tags, ["摄像头", "1 个程序"]);
});

test("摄像头爆闪开着时，常驻位是跑马灯（圆点 + 滚动文字）", () => {
    const output = run({ now, ...source("normal.json") });
    assert.ok(output.pinned.canvas, "应返回画布常驻位");
    const nodes = output.pinned.canvas.nodes;
    const dots = nodes.filter(n => n.rect);
    assert.equal(dots.length, 1, "单设备应有一个圆点");
    assert.match(dots[0].fill, /^#[0-9A-Fa-f]{6}$/, "圆点应是高反差饱和色");
    const flow = nodes.flatMap(n => n.group || []).find(n => n.text && n.loop);
    assert.ok(flow, "应有滚动文字");
    assert.equal(flow.loop.kind, "flow");
    assert.ok(flow.loop.period_ms >= 800 && flow.loop.period_ms <= 1000, "滚动周期应足够快");
    assert.match(flow.text, /摄像头正在使用/);
    assert.match(flow.text, /Zoom/);
    assert.equal(output.pinned.canvas.width, 156);
});

test("摄像头与麦克风跑马灯圆点用不同颜色", () => {
    const camera = run({ now, ...source("normal.json") });
    const microphone = run({ now, ...source("mic-only.json") });
    const dotColor = output => output.pinned.canvas.nodes.find(n => n.rect).fill;
    assert.notEqual(dotColor(camera), dotColor(microphone));
});

test("关掉摄像头爆闪后该设备退回普通文字常驻位，不爆闪", () => {
    const output = run({ now, settings: { camera_alert: "false", mic_alert: "true" }, ...source("normal.json") });
    assert.equal(output.pinned.text, "摄像头");
    assert.equal(output.pinned.value, "Zoom");
    assert.equal(output.pinned.canvas, undefined);
    assert.equal(output.canvas, undefined, "摄像头爆闪关掉后状态页也不应有闪烁画布");
});

test("麦克风占用但只关麦克风爆闪，摄像头爆闪仍按各自开关", () => {
    const both = run({ now, devices: { camera: [{ name: "Zoom" }], microphone: [{ name: "Chrome" }] },
        settings: { camera_alert: "false", mic_alert: "true" } });
    // 摄像头爆闪关、麦克风爆闪开 → 常驻位跑马灯应点名麦克风
    const flow = both.pinned.canvas.nodes.flatMap(n => n.group || []).find(n => n.text && n.loop);
    assert.ok(flow, "麦克风爆闪开着，常驻位应有滚动文字");
    assert.match(flow.text, /麦克风/);
    assert.equal(both.pinned.canvas.nodes.filter(n => n.rect).length, 1, "只爆闪麦克风时一个圆点");
});

test("强提醒开着时，状态页顶层画布用真 pulse 闪烁亮块", () => {
    const output = run({ now, ...source("normal.json") });
    assert.ok(output.canvas, "应返回状态页顶层画布");
    assert.equal(typeof output.canvas.height, "number");
    const block = output.canvas.nodes.find(node => node.rect);
    assert.ok(block, "应有高反差亮块");
    assert.ok(block.loop, "亮块必须带循环动画");
    assert.equal(block.loop.kind, "pulse", "状态页画布用 pulse（实测宿主支持）");
    assert.ok(block.loop.period_ms >= 800);
    assert.match(block.fill, /^#[0-9A-Fa-f]{6}$/);
    const label = output.canvas.nodes.find(node => node.text && node.text === "摄像头");
    assert.ok(label, "应有「摄像头」文字");
    assert.ok(output.canvas.nodes.some(node => node.text === "Zoom"), "应显示占用程序名");
});

test("麦克风占用时状态页亮块换色且仍带 pulse", () => {
    const camera = run({ now, ...source("normal.json") });
    const microphone = run({ now, ...source("mic-only.json") });
    const color = o => o.canvas.nodes.find(node => node.rect).fill;
    assert.notEqual(color(camera), color(microphone));
    assert.equal(microphone.canvas.nodes.find(n => n.rect).loop.kind, "pulse");
});

test("无人占用时不输出闪烁画布", () => {
    const output = run({ now, ...source("idle.json") });
    assert.equal(output.canvas, undefined);
});

test("无人占用时常驻位为 null，不占位也不闪", () => {
    const output = run({ now, ...source("idle.json") });
    assert.equal(output.pinned, null);
});

test("读到无人占用时是空闲态且不占位", () => {
    for (const name of ["idle.json", "empty.json"]) {
        const output = run({ now, ...source(name) });
        assert.equal(output.status.state, "idle");
        assert.equal(output.status.summary, "摄像头与麦克风均未被占用");
        assert.equal(output.pinned, null);
        assert.deepEqual(output.status.items, []);
    }
});

test("数据损坏时退回未知态", () => {
    const output = run({ now, ...source("malformed.txt") });
    assert.equal(output.status.state, "offline");
    assert.equal(output.pinned, null);
});

test("宿主注入设备信息时同样读到占用", () => {
    const output = run({ now, devices: { camera: [{ name: "Zoom" }], microphone: [] } });
    assert.equal(output.status.state, "running");
    const flow = output.pinned.canvas.nodes.flatMap(n => n.group || []).find(n => n.text && n.loop);
    assert.match(flow.text, /Zoom/);
    const injected = run({ now, devices: { camera: [], microphone: [] } });
    assert.equal(injected.status.state, "idle");
});

test("麦克风占用单独出现时只显示麦克风", () => {
    const output = run({ now, ...source("mic-only.json") });
    assert.equal(output.status.state, "running");
    assert.equal(output.status.summary, "麦克风正在被 Chrome 使用");
    const flow = output.pinned.canvas.nodes.flatMap(n => n.group || []).find(n => n.text && n.loop);
    assert.match(flow.text, /麦克风/, "跑马灯应点名麦克风");
    assert.match(output.pinned.canvas.nodes.find(n => n.rect).fill, /^#/, "麦克风占用也要有圆点");
});

test("摄像头和麦克风同时占用时，胶囊与状态页同时告警两个设备", () => {
    const output = run({ now, devices: { camera: [{ name: "Zoom" }], microphone: [{ name: "Chrome" }] } });
    // 收起态胶囊：左右两半各"圆点 + 同色滚动文字"
    assert.ok(output.pinned.canvas, "常驻位应是画布");
    const dots = output.pinned.canvas.nodes.filter(n => n.rect);
    assert.equal(dots.length, 2, "双设备应有两个圆点");
    assert.notEqual(dots[0].fill, dots[1].fill, "两个圆点不同颜色");
    const flows = output.pinned.canvas.nodes.flatMap(n => n.group || []).filter(n => n.text && n.loop);
    assert.equal(flows.length, 2, "双设备应有两条滚动文字");
    // 文字色与各自圆点色一致
    assert.equal(flows[0].fill, dots[0].fill, "摄像头文字色=摄像头圆点色");
    assert.equal(flows[1].fill, dots[1].fill, "麦克风文字色=麦克风圆点色");
    const joined = flows.map(n => n.text).join(" ");
    assert.match(joined, /摄像头/);
    assert.match(joined, /麦克风/);
    assert.match(joined, /Zoom/);
    assert.match(joined, /Chrome/);
    // 展开态状态页：两个 pulse 块同时闪
    const rects = output.canvas.nodes.filter(n => n.rect);
    assert.equal(rects.length, 2, "状态页应有两个闪烁块");
    assert.ok(rects.every(n => n.loop && n.loop.kind === "pulse"));
    assert.ok(output.canvas.nodes.some(n => n.text === "Zoom"));
    assert.ok(output.canvas.nodes.some(n => n.text === "Chrome"));
    assert.equal(output.status.items.length, 2);
});

test("超长程序名按上限截断", () => {
    const output = run({ now, ...source("long-name.json") });
    const flow = output.pinned.canvas.nodes.flatMap(n => n.group || []).find(n => n.text && n.loop);
    assert.ok([...flow.text].length <= 60, "跑马灯文字有上限");
    assert.ok([...output.status.items[0].label].length <= 28);
    assert.ok([...output.status.summary].length <= 120);
});

test("程序过多时每个设备最多三条，并在摘要里注明总数", () => {
    const output = run({ now, ...source("many.json") });
    assert.equal(output.status.items.length, 6);
    assert.ok(output.status.items.length <= 8);
    const camera = output.status.items.filter(item => item.label.startsWith("摄像头"));
    assert.equal(camera.length, 3);
    assert.ok(!output.status.items.some(item => item.label.includes("Delta")));
    assert.match(output.status.summary, /4 个程序/);
});

test("只在新出现占用时提醒一次，释放后不提醒", () => {
    const before = run({ now, ...idle() });
    assert.equal(before.notice, undefined);
    const occupied = run({ now, ...source("normal.json"), storage: before.storage });
    assert.equal(occupied.notice.id, "device-use:camera:Zoom");
    assert.equal(occupied.notice.title, "摄像头正在使用");
    assert.equal(occupied.notice.body, "Zoom");
    const same = run({ now, ...source("normal.json"), storage: occupied.storage });
    assert.equal(same.notice, undefined);
    const released = run({ now, ...idle(), storage: same.storage });
    assert.equal(released.notice, undefined);
    assert.equal(released.status.state, "idle");
    assert.deepEqual(released.storage.last, { camera: [], microphone: [] });
});

test("存储被写坏时按空存储处理，不影响读数", () => {
    for (const storage of [null, "坏值", 42, [1, 2]]) {
        const output = run({ now, ...source("normal.json"), storage });
        assert.equal(output.status.state, "running");
        assert.deepEqual(output.storage.last, { camera: ["Zoom"], microphone: [] });
    }
});

test("单次输出不超过 16 KiB", () => {
    const output = run({ now, ...source("many.json") });
    const { storage, ...display } = output;
    assert.ok(Buffer.byteLength(JSON.stringify(display), "utf8") <= 16 * 1024);
});
