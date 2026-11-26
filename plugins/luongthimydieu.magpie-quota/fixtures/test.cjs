// 用 Node 模拟岛仔的调用与回环读取，核对 main.js 的输出。
// 运行：node --test fixtures/test.cjs
// 实况：设置 MAGPIE_LIVE=1 后再运行，可额外读取本机 magpie。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const DIR = __dirname;
const CODE = fs.readFileSync(path.join(DIR, "..", "main.js"), "utf8");
const LIMIT = 128 * 1024;
const TIMEOUT = 2000;
const COMPLETE_URL = "http://127.0.0.1:3425/v1/magpie/quotas/cards";
const CHART_LEFT = 14;
const CHART_RIGHT = 373;

function call(input) {
    const context = vm.createContext({});
    vm.runInContext(CODE, context, { filename: "main.js" });
    return JSON.parse(JSON.stringify(context.refresh(input)));
}

function fixture(name) {
    return fs.readFileSync(path.join(DIR, name), "utf8");
}

function ready(text) {
    return { status: "ready", text };
}

function allNodes(canvas) {
    const nodes = [];
    const walk = list => {
        for (const node of list) {
            nodes.push(node);
            if (Array.isArray(node.group)) {
                walk(node.group);
            }
        }
    };
    walk(canvas.nodes || []);
    return nodes;
}

function texts(canvas) {
    return allNodes(canvas).filter(node => typeof node.text === "string").map(node => node.text);
}

function nodesWith(canvas, key) {
    return allNodes(canvas).filter(node => node[key] !== undefined);
}

function assertCanvasShape(canvas) {
    assert.ok(canvas && typeof canvas === "object", "canvas 必须存在");
    assert.ok(canvas.height >= 40 && canvas.height <= 360);
    const nodes = allNodes(canvas);
    assert.ok(nodes.length <= 1500);
    let characters = 0;
    for (const node of nodes) {
        if (typeof node.text === "string") {
            const length = Array.from(node.text).length;
            characters += length;
            assert.ok(length >= 1);
            assert.ok(node.size >= 6 && node.size <= 96);
        }
        if (node.group !== undefined) {
            assert.ok(Array.isArray(node.clip) && node.clip.length === 4);
            assert.equal(node.scroll.axis, "y");
            assert.ok(node.scroll.content > 0);
        }
        if (node.arc !== undefined) {
            assert.ok(Number.isFinite(node.arc.r) && node.arc.r > 0);
            assert.ok(Number.isFinite(node.arc.sweep));
        }
    }
    assert.ok(characters <= 2000, "画布文字合计不能超过 2000 字");
}

function assertNoticeShape(notice) {
    assert.ok(notice, "notice 必须存在");
    assert.ok(typeof notice.id === "string" && notice.id.length >= 1 && notice.id.length <= 128);
    assert.ok(Array.from(notice.title).length >= 1 && Array.from(notice.title).length <= 40);
    if (notice.body !== undefined) {
        assert.ok(Array.from(notice.body).length >= 1 && Array.from(notice.body).length <= 120, notice.body);
    }
}

// 额度页签：必须给出可换算的读数，窗口形状与 1.1.0 一致。
function assertQuota(result) {
    assert.ok(result.quota && Array.isArray(result.quota.windows) && result.quota.windows.length >= 1, "额度页签应有读数");
    assert.ok(result.quota.windows.length <= 3);
    for (const window of result.quota.windows) {
        assert.equal(typeof window.label, "string");
        assert.ok(window.label.length >= 1);
        assert.ok(Number.isFinite(window.remaining_pct));
        if (window.reset_at !== undefined) {
            assert.ok(Number.isFinite(window.reset_at) && window.reset_at > 0);
        }
    }
    assert.ok(result.storage && typeof result.storage === "object");
}

function assertNoQuota(result) {
    assert.equal(result.quota, null);
    assert.ok(result.storage && typeof result.storage === "object");
}

// 折线上实际落点的坐标（去重后按 x 排序），用来核对空档和单位聚合。
function plotted(canvas) {
    const points = [];
    for (const node of allNodes(canvas)) {
        const list = node.points || (node.circle ? [[node.circle[0], node.circle[1]]] : null);
        if (!list) {
            continue;
        }
        for (const point of list) {
            if (!points.some(other => other[0] === point[0] && other[1] === point[1])) {
                points.push([point[0], point[1]]);
            }
        }
    }
    return points.sort((left, right) => left[0] - right[0]);
}

function slotX(index) {
    return Math.round((CHART_LEFT + (CHART_RIGHT - CHART_LEFT) * index / 6) * 10) / 10;
}

// 带本地时区偏移的 ISO 时间，模拟 magpie 写出的 readAt。
function localIso(date) {
    const pad = value => String(value).padStart(2, "0");
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const hours = pad(Math.floor(Math.abs(offset) / 60));
    const minutes = pad(Math.abs(offset) % 60);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hours}:${minutes}`;
}

// 与宿主 source_read::read_http 相同：直连回环、不跟随重定向、2 秒、128 KiB。
function readLoopback(address) {
    return new Promise(resolve => {
        let settled = false;
        const finish = value => {
            if (!settled) {
                settled = true;
                resolve(value);
            }
        };
        const url = new URL(address);
        const request = http.request({
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: "GET",
            headers: { Accept: "application/json, text/plain", "Accept-Encoding": "identity" },
        }, response => {
            if (response.statusCode < 200 || response.statusCode > 299) {
                response.resume();
                finish({ status: "offline" });
                return;
            }
            const chunks = [];
            let size = 0;
            response.on("data", chunk => {
                size += chunk.length;
                if (size > LIMIT) {
                    request.destroy();
                    finish({ status: "offline" });
                    return;
                }
                chunks.push(chunk);
            });
            response.on("end", () => finish({ status: "ready", text: Buffer.concat(chunks).toString("utf8") }));
            response.on("error", () => finish({ status: "offline" }));
        });
        request.setTimeout(TIMEOUT, () => {
            request.destroy();
            finish({ status: "offline" });
        });
        request.on("error", () => finish({ status: "offline" }));
        request.end();
    });
}

async function serve(routes) {
    const server = http.createServer((request, response) => {
        const route = routes[request.url.split("?")[0]];
        if (!route) {
            response.writeHead(404);
            response.end("not found");
            return;
        }
        route(request, response);
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    return {
        base: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise(resolve => {
            server.closeAllConnections?.();
            server.close(resolve);
        }),
    };
}

const routes = {
    "/v1/magpie/quotas/cards": (request, response) => {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(fixture("normal.json"));
    },
    "/missing": (request, response) => {
        response.writeHead(404, { "Content-Type": "text/plain" });
        response.end("404 page not found");
    },
    "/redirect": (request, response) => {
        response.writeHead(302, { Location: "/v1/magpie/quotas/cards" });
        response.end();
    },
    "/huge": (request, response) => {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end("x".repeat(LIMIT + 1));
    },
    "/slow": (request, response) => {
        response.writeHead(200, { "Content-Type": "application/json" });
        setTimeout(() => response.end("{}"), TIMEOUT + 500);
    },
};

function render(name, settings = {}, storage = null) {
    return call({ settings, source: ready(fixture(name)), storage });
}

function dataSource(data, settings = {}, storage = null) {
    return call({ settings, source: ready(JSON.stringify({ data })), storage });
}

test("清单保留 1.0.0 的 storage 能力与 account 设置", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "..", "plugin.json"), "utf8"));
    assert.ok(manifest.capabilities.includes("storage"), "恢复 storage 能力，旧版才能升级");
    const account = manifest.settings.find(setting => setting.key === "account");
    assert.deepEqual(account, {
        key: "account",
        label: "账号（「自动选择」或厂商、显示名、登录名）",
        type: "text",
        default: "自动选择",
    });
    const address = manifest.settings.find(setting => setting.key === "address");
    assert.ok(address, "保留 address 设置");
    assert.equal(address.default, COMPLETE_URL);
});

test("未授权时提醒并提供可复制的地址，离线时不发提醒", () => {
    const unconfigured = call({ settings: {}, source: { status: "unconfigured" }, storage: null });
    assertNoQuota(unconfigured);
    assert.equal(unconfigured.status.state, "idle");
    assert.ok(texts(unconfigured.canvas).includes("用默认地址授权？"));
    assert.ok(texts(unconfigured.canvas).includes(COMPLETE_URL));
    assertNoticeShape(unconfigured.notice);
    assert.equal(unconfigured.notice.id, "url-unauthorized");
    assert.ok(unconfigured.notice.body.includes(COMPLETE_URL));
    const copyable = allNodes(unconfigured.canvas).find(node => node.hit && node.hit.copy === COMPLETE_URL);
    assert.ok(copyable, "地址应支持点击复制");
    assert.equal(copyable.text, COMPLETE_URL);
    assertCanvasShape(unconfigured.canvas);

    const offline = call({ settings: {}, source: { status: "offline" }, storage: null });
    assertNoQuota(offline);
    assert.equal(offline.status.state, "offline");
    assert.ok(texts(offline.canvas).includes("magpie 未运行或地址不通"));
    assert.equal(offline.notice, undefined);
    assertCanvasShape(offline.canvas);
});

test("正常响应按平台汇总，额度页签给出当前账号读数", () => {
    const result = render("normal.json");
    assertQuota(result);
    assert.equal(result.quota.windows.length, 1);
    assert.equal(result.quota.windows[0].label, "Premium requests");
    assert.equal(result.quota.windows[0].remaining_pct, 92.75);
    assert.equal(result.storage.account, JSON.stringify(["copilot", "demo-copilot", "subscription"]));
    assert.equal(result.status.state, "succeeded");
    assertCanvasShape(result.canvas);
    const labels = texts(result.canvas);
    assert.ok(labels.includes("Copilot"));
    assert.ok(labels.includes("WorkBuddy"));
    assert.ok(labels.includes("DeepSeek"));
    assert.ok(!labels.some(text => text.includes("ZCode")), "ZCode 没有订阅也没有余额，应舍弃");
    assert.ok(labels.includes("剩 92.8%"));
    assert.ok(labels.includes("336 积分"));
    assert.ok(labels.includes("¥12.50"));
    assert.ok(labels.includes("暂无用量数据"));
    assert.ok(!labels.some(text => text.includes("缓存")), "缺少 readAt 时不显示缓存行");
});

test("同一平台的多账号合并为一行并累加积分", () => {
    const result = render("multi-account.json");
    assertCanvasShape(result.canvas);
    assertQuota(result);
    const labels = texts(result.canvas);
    assert.ok(labels.includes("WorkBuddy ×3"));
    assert.equal(labels.filter(text => text === "WorkBuddy ×3").length, 1);
    assert.ok(labels.includes("7232 积分"));
    assert.ok(labels.includes("剩 96.8%"));
    assert.ok(labels.includes("剩 36.3%"));
    assert.ok(!labels.some(text => text.includes("ZCode")));

    // 圆环按剩余比例从低到高：Kimi、WorkBuddy、Copilot。
    assert.ok(labels.includes("36%"));
    assert.ok(labels.includes("86%"));
    assert.ok(labels.includes("97%"));

    // 折线取最近 7 天，三个 WorkBuddy 账号的当日用量相加。
    const points = nodesWith(result.canvas, "points");
    assert.equal(points.length, 2, "面积和折线各一个节点");
    assert.equal(points[0].points.length, 7);
});

test("共享余额只显示一次", () => {
    const result = render("shared-balance.json");
    assertNoQuota(result);
    const labels = texts(result.canvas);
    assert.ok(labels.includes("DeepSeek ×2"));
    assert.ok(labels.includes("¥66.30"));
    assert.ok(!labels.some(text => text.includes("132.60")));
    assert.ok(!labels.some(text => text.includes("等2个")));
    assertCanvasShape(result.canvas);
});

test("未声明共享的同额钱包各算各的", () => {
    const result = dataSource([
        { provider: "alpha", name: "Alpha", user: "a1", windows: [], balance: "¥5.00", kind: "balance" },
        { provider: "alpha", name: "Alpha", user: "a2", windows: [], balance: "¥5.00", kind: "balance" },
    ]);
    const labels = texts(result.canvas);
    assert.ok(labels.includes("Alpha ×2"));
    assert.ok(labels.includes("¥5.00 等2个"), "两个独立钱包不能按金额合并");
    assertCanvasShape(result.canvas);
});

test("同名不同单位的窗口分行保留，不跨单位相加", () => {
    const result = dataSource([
        {
            provider: "p",
            name: "P",
            user: "u",
            windows: [
                { name: "Quota", used: 10, limit: 100, unit: "credits" },
                { name: "Quota", used: 50, limit: 100, unit: "tokens" },
                { name: "Quota", used: 10, limit: 100 },
            ],
        },
    ]);
    const labels = texts(result.canvas);
    assert.ok(labels.includes("50 tokens"), "取剩余量最低的窗口，而不是合并后的总量");
    assert.ok(!labels.includes("230 积分"), "不同单位不能合并成同一行");
    assert.equal(result.quota.windows.length, 3, "同名不同单位的窗口分别保留");
    assert.deepEqual(result.quota.windows.map(window => window.label), ["Quota", "Quota", "Quota"]);
    assert.deepEqual(result.quota.windows.map(window => window.remaining_pct), [90, 50, 90]);
    assertCanvasShape(result.canvas);
});

test("趋势只聚合同一单位，不把积分和 token 相加", () => {
    const result = dataSource([
        {
            provider: "a",
            name: "A",
            user: "u1",
            windows: [{ name: "Credits", used: 10, limit: 100, unit: "credits" }],
            daily: {
                window: "Credits",
                days: [
                    { day: "2026-11-20", used: 10 },
                    { day: "2026-11-21", used: 20 },
                ],
            },
        },
        {
            provider: "b",
            name: "B",
            user: "u2",
            windows: [{ name: "Tokens", used: 10, limit: 100, unit: "tokens" }],
            daily: {
                window: "Tokens",
                days: [{ day: "2026-11-24", used: 999 }],
            },
        },
    ]);
    // 主单位取记录最多的 credits：日期轴止于 11-21，只应落 11-20、11-21 两个点。
    const points = plotted(result.canvas);
    assert.deepEqual(points.map(point => point[0]), [slotX(5), slotX(6)]);
});

test("趋势日期轴取最近 7 个自然日，缺日留空档", () => {
    const result = dataSource([
        {
            provider: "a",
            name: "A",
            user: "u1",
            windows: [{ name: "Credits", used: 10, limit: 100, unit: "credits" }],
            daily: {
                window: "Credits",
                days: [
                    { day: "2026-11-20", used: 10 },
                    { day: "2026-11-21", used: 20 },
                    { day: "2026-11-26", used: 5 },
                ],
            },
        },
    ]);
    const points = plotted(result.canvas);
    assert.deepEqual(points.map(point => point[0]), [slotX(0), slotX(1), slotX(6)]);
    const stroke = allNodes(result.canvas).find(node => node.stroke === "$accent");
    assert.equal(stroke.points.length, 2, "空档不能跨日连线");
});

test("折线日期轴不晚于 today：非法与未来日期不挤掉真实数据", () => {
    const days = [
        { day: "2026-11-20", used: 10 },
        { day: "2026-11-21", used: 20 },
        { day: "2026-11-26", used: 5 },
        { day: "2026-13-45", used: 999 },
        { day: "2099-01-01", used: 888 },
    ];
    const result = call({
        settings: {},
        source: ready(JSON.stringify({
            data: [{
                provider: "a",
                name: "A",
                user: "u1",
                windows: [{ name: "Credits", used: 10, limit: 100, unit: "credits" }],
                daily: { window: "Credits", days },
            }],
        })),
        storage: null,
        today: "2026-11-26",
    });
    // 轴止于 today，真实数据落在 11-20、11-21、11-26；脏日期既不占格也不改锚点。
    const points = plotted(result.canvas);
    assert.deepEqual(points.map(point => point[0]), [slotX(0), slotX(1), slotX(6)]);
    assertCanvasShape(result.canvas);

    // today 本身无法回环解析时按不可知处理，退回旧锚点（最后一条有效数据 11-26）。
    const badToday = call({
        settings: {},
        source: ready(JSON.stringify({
            data: [{
                provider: "a",
                name: "A",
                user: "u1",
                windows: [{ name: "Credits", used: 10, limit: 100, unit: "credits" }],
                daily: {
                    window: "Credits",
                    days: days.filter(day => day.day !== "2099-01-01"),
                },
            }],
        })),
        storage: null,
        today: "2026-13-45",
    });
    assert.deepEqual(plotted(badToday.canvas).map(point => point[0]), [slotX(0), slotX(1), slotX(6)]);
});

test("未提供 today 时折线沿用旧锚点，并跳过无法回环解析的日期", () => {
    const result = dataSource([{
        provider: "a",
        name: "A",
        user: "u1",
        windows: [{ name: "Credits", used: 10, limit: 100, unit: "credits" }],
        daily: {
            window: "Credits",
            days: [
                { day: "2026-11-20", used: 10 },
                { day: "2026-11-21", used: 20 },
                { day: "2026-13-45", used: 999 },
            ],
        },
    }]);
    // 没有 today 时锚定最后一条有效数据 11-21，非法日期不能成为锚点。
    assert.deepEqual(plotted(result.canvas).map(point => point[0]), [slotX(5), slotX(6)]);
    assertCanvasShape(result.canvas);
});

test("旧端点直接采用 remaining，并显示缓存时间", () => {
    const result = render("legacy-quotas.json");
    assertQuota(result);
    assert.equal(result.quota.windows[0].label, "Premium requests");
    assert.equal(result.quota.windows[0].remaining_pct, 96.75);
    assert.ok(Number.isFinite(result.quota.windows[0].reset_at));
    const labels = texts(result.canvas);
    assert.ok(labels.includes("剩 96.8%"));
    assert.ok(labels.includes("1497 积分"));
    assert.ok(labels.includes("¥12.50"));
    assert.ok(labels.some(text => text.startsWith("较早缓存 ")), "旧 readAt 应标为较早缓存");
    assertCanvasShape(result.canvas);
});

test("刚读取的卡片显示缓存时间，缺少或非法 readAt 时不显示", () => {
    const now = new Date();
    const fresh = dataSource([
        {
            provider: "p",
            name: "P",
            user: "u",
            windows: [{ name: "W", used: 10 }],
            readAt: localIso(now),
        },
    ]);
    const expected = "缓存 " + String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    const cacheLine = texts(fresh.canvas).find(text => text.includes("缓存"));
    assert.equal(cacheLine, expected);

    // 有一张是旧缓存时，不能把整页说成刚更新。
    const old = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const mixed = dataSource([
        { provider: "a", name: "A", user: "u1", windows: [{ name: "W", used: 10 }], readAt: localIso(old) },
        { provider: "b", name: "B", user: "u2", windows: [{ name: "W", used: 20 }], readAt: localIso(now) },
    ]);
    const mixedLine = texts(mixed.canvas).find(text => text.includes("缓存"));
    const oldClock = String(old.getHours()).padStart(2, "0") + ":" + String(old.getMinutes()).padStart(2, "0");
    assert.equal(mixedLine, "较早缓存 " + oldClock);

    const invalid = dataSource([
        { provider: "p", name: "P", user: "u", windows: [{ name: "W", used: 10 }], readAt: "not-a-date" },
    ]);
    assert.ok(!texts(invalid.canvas).some(text => text.includes("缓存")));
    assert.ok(!texts(render("normal.json").canvas).some(text => text.includes("缓存")));
});

test("零余额是有效读数，正常显示", () => {
    const result = dataSource([
        { provider: "a", name: "A", user: "u1", windows: [], balance: "¥0.00", kind: "balance" },
        { provider: "b", name: "B", user: "u2", windows: [], balance: 0, currency: "¥", kind: "balance" },
    ]);
    const labels = texts(result.canvas);
    assert.ok(labels.includes("¥0.00"));
    assert.ok(labels.includes("¥0"));
    assertNoQuota(result);
    assert.equal(result.status.state, "succeeded");
});

test("data 数组格式不符与账号均无额度使用不同文案", () => {
    const shape = dataSource([{ foo: 1 }, "x", 2]);
    assertNoQuota(shape);
    assert.equal(shape.status.state, "error");
    assertNoticeShape(shape.notice);
    assert.equal(shape.notice.id, "bad-url-shape");
    assert.ok(texts(shape.canvas).includes("返回数据不是 magpie 额度格式，请核对地址"));
    assert.ok(allNodes(shape.canvas).some(node => node.hit && node.hit.copy === COMPLETE_URL));
    assertCanvasShape(shape.canvas);

    const empty = render("empty.json");
    assertNoQuota(empty);
    assert.equal(empty.status.state, "idle");
    assert.equal(empty.notice, undefined);
    assert.ok(texts(empty.canvas).includes("账号均无额度"));
    assert.ok(!texts(empty.canvas).includes("返回数据不是 magpie 额度格式，请核对地址"));

    const errored = dataSource([
        { provider: "x", name: "X", user: "u", windows: [], error: "读取失败", kind: "subscription" },
    ]);
    assert.ok(texts(errored.canvas).includes("账号均无额度"));
    assert.equal(errored.notice, undefined);
});

test("平台数量增加时自动换列并让出图表", () => {
    const make = count => {
        const data = [];
        for (let i = 0; i < count; i++) {
            data.push({
                provider: "p" + i,
                name: "P" + i,
                user: "u" + i,
                windows: [{ name: "Credits", used: 10, limit: 100, unit: "credits" }],
            });
        }
        return dataSource(data);
    };

    // 7 至 14 个：两列，保留折线和圆环。
    const twelve = make(12);
    const twelveLabels = texts(twelve.canvas);
    for (let i = 0; i < 12; i++) {
        assert.ok(twelveLabels.includes("P" + i), "P" + i);
    }
    assert.ok(twelveLabels.includes("近 7 天用量"));
    assert.ok(nodesWith(twelve.canvas, "arc").length > 0);

    // 15 至 21 个：三列，仍保留图表。
    const twentyFour = make(24);
    const twentyFourLabels = texts(twentyFour.canvas);
    for (let i = 0; i < 24; i++) {
        assert.ok(twentyFourLabels.includes("P" + i), "P" + i);
    }
    assert.ok(twentyFourLabels.includes("近 7 天用量"));
    assert.equal(nodesWith(twentyFour.canvas, "arc").length, 0, "平台多时圆环让位给列表");

    // 31 个以上：图表全部让位，只保留列表。
    const forty = make(40);
    const fortyLabels = texts(forty.canvas);
    for (let i = 0; i < 40; i++) {
        assert.ok(fortyLabels.includes("P" + i), "P" + i);
    }
    assert.ok(!fortyLabels.includes("近 7 天用量"));
    assert.equal(nodesWith(forty.canvas, "arc").length, 0);

    // 超过一页容量时在底部说明未显示数量。
    const overflow = make(50);
    assert.ok(texts(overflow.canvas).some(text => text.startsWith("另有 ")));

    // 列表模式下缓存行落在右下角，不能压住最后一行文字。
    const packed = dataSource(
        Array.from({ length: 45 }, (unused, i) => ({
            provider: "p" + i,
            name: "P" + i,
            user: "u" + i,
            windows: [{ name: "Credits", used: 10, limit: 100, unit: "credits" }],
            readAt: localIso(new Date()),
        }))
    );
    const cacheNode = allNodes(packed.canvas).find(node => typeof node.text === "string" && node.text.includes("缓存"));
    assert.ok(cacheNode);
    const rowBaselines = allNodes(packed.canvas)
        .filter(node => typeof node.text === "string" && node !== cacheNode && !node.text.startsWith("另有 "))
        .map(node => node.at[1]);
    assert.ok(cacheNode.at[1] - Math.max(...rowBaselines) >= 10, "缓存行与最后一行列表要有间距");
    assertCanvasShape(packed.canvas);

    for (const canvas of [twelve.canvas, twentyFour.canvas, forty.canvas, overflow.canvas]) {
        assertCanvasShape(canvas);
    }
});

test("只有无限额窗口时显示“无限”", () => {
    const result = render("unlimited-only.json");
    const labels = texts(result.canvas);
    assert.ok(labels.includes("无限"));
    assertNoQuota(result);
    assertCanvasShape(result.canvas);
});

test("条目报错但有余额时保留余额", () => {
    const result = call({
        settings: {},
        source: ready(JSON.stringify({
            data: [{ provider: "x", name: "X", user: "u", windows: [], balance: "¥5.00", error: "读取失败", kind: "balance" }],
        })),
        storage: null,
    });
    assert.ok(texts(result.canvas).includes("¥5.00"));
    assertNoQuota(result);
    assertCanvasShape(result.canvas);
});

test("平台超过 8 个时仍在一页显示，不使用滚动", () => {
    const data = [];
    for (let i = 0; i < 12; i++) {
        data.push({
            provider: "p" + i,
            name: "P" + i,
            user: "u" + i,
            windows: [{ name: "Credits", used: 10, limit: 100, unit: "credits" }],
        });
    }
    const result = dataSource(data);
    assertCanvasShape(result.canvas);
    const labels = texts(result.canvas);
    for (let i = 0; i < 12; i++) {
        assert.ok(labels.includes("P" + i), "P" + i);
    }
    assert.ok(!allNodes(result.canvas).some(node => node.scroll !== undefined));
    assert.ok(!allNodes(result.canvas).some(node => node.group !== undefined));
});

test("三类错址分别发一次性提醒，并在画布上给出引导", () => {
    const index = render("api-index.json");
    assertNoQuota(index);
    assert.equal(index.status.state, "error");
    assertNoticeShape(index.notice);
    assert.equal(index.notice.id, "bad-url-index");
    assert.ok(texts(index.canvas).includes("授权地址不完整"));
    assert.ok(allNodes(index.canvas).some(node => node.hit && node.hit.copy === COMPLETE_URL));
    assertCanvasShape(index.canvas);

    const missing = render("malformed.txt");
    assert.equal(missing.status.state, "error");
    assertNoticeShape(missing.notice);
    assert.equal(missing.notice.id, "bad-url-missing");

    for (const text of ["{}", '{"hello":"world"}', "not json", ""]) {
        const unknown = call({ settings: {}, source: ready(text), storage: null });
        assert.equal(unknown.status.state, "error", JSON.stringify(text));
        assertNoticeShape(unknown.notice);
        assert.equal(unknown.notice.id, "bad-url-unknown", JSON.stringify(text));
    }

    assert.equal(render("normal.json").notice, undefined);
    assert.equal(call({ settings: {}, source: { status: "offline" }, storage: null }).notice, undefined);
});

test("账号设置优先匹配，多匹配按未知处理，固定账号保持", () => {
    // 手动匹配：按登录名选中 WorkBuddy，读数取它的前 3 个窗口，且不写固定账号。
    const manual = render("normal.json", { account: "demo-workbuddy" });
    assertQuota(manual);
    assert.deepEqual(manual.quota.windows.map(window => window.label), ["Credits", "Extra credits", "Total credits"]);
    assert.equal(manual.quota.windows[0].remaining_pct, 0, "零剩余比例是有效读数");
    assert.equal(manual.storage.account, undefined, "手动匹配不覆盖固定账号");

    // 大小写不敏感，别名也算。
    const alias = dataSource([
        {
            provider: "p",
            name: "P",
            alias: "Team-A",
            user: "u",
            windows: [{ name: "W", used: 10 }],
        },
    ], { account: "TEAM-A" });
    assertQuota(alias);
    assert.equal(alias.quota.windows[0].label, "W");

    // 多个同名账号不算唯一匹配，按未知处理，不回退自动选择。
    const ambiguous = render("multi-account.json", { account: "WorkBuddy" });
    assertNoQuota(ambiguous);
    assert.equal(ambiguous.storage.account, undefined, "多匹配时不固定到别的账号");

    // 原 storage.account 固定账号逻辑保留。
    const pinned = JSON.stringify(["workbuddy", "jinnn", "subscription"]);
    const held = call({
        settings: {},
        source: ready(fixture("multi-account.json")),
        storage: { account: pinned },
    });
    assertQuota(held);
    assert.equal(held.quota.windows[0].label, "Credits");
    assert.equal(held.storage.account, pinned);
});

test("手动填了失效账号名时 quota 为 null，不固定到别的账号", () => {
    const missing = render("normal.json", { account: "no-such-account" });
    assertNoQuota(missing);
    assert.equal(missing.storage.account, undefined, "找不到指定账号时不能拿别的账号顶上");
    assert.equal(missing.status.state, "succeeded", "状态页仍正常汇总全部账号");
    const labels = texts(missing.canvas);
    for (const name of ["Copilot", "WorkBuddy", "DeepSeek"]) {
        assert.ok(labels.includes(name), name);
    }
    assertCanvasShape(missing.canvas);

    // 已有固定账号时，手动失效也不改写它。
    const pinned = JSON.stringify(["workbuddy", "jinnn", "subscription"]);
    const held = call({
        settings: { account: "no-such-account" },
        source: ready(fixture("multi-account.json")),
        storage: { account: pinned },
    });
    assertNoQuota(held);
    assert.equal(held.storage.account, pinned);
});

test("constructor 等原型链名称不会破坏分组、窗口和钱包查找", () => {
    const result = dataSource([
        {
            provider: "constructor",
            name: "constructor",
            user: "u1",
            windows: [{ name: "constructor", used: 10, limit: 100, unit: "credits" }],
        },
        {
            provider: "constructor",
            name: "constructor",
            user: "u2",
            windows: [{ name: "constructor", used: 20, limit: 100, unit: "credits" }],
        },
    ]);
    assertCanvasShape(result.canvas);
    const labels = texts(result.canvas);
    assert.ok(labels.includes("constructor ×2"));
    assert.ok(labels.includes("170 积分"));
    assert.ok(labels.includes("85%"));
    assertQuota(result);
    assert.equal(result.quota.windows[0].label, "constructor");

    const shared = dataSource([
        { provider: "deepseek", name: "DeepSeek", user: "a", windows: [], balance: "¥9.00", sharedBalance: "constructor", kind: "balance" },
        { provider: "deepseek", name: "DeepSeek", user: "b", windows: [], balance: "¥9.00", sharedBalance: "constructor", kind: "balance" },
    ]);
    const sharedLabels = texts(shared.canvas);
    assert.ok(sharedLabels.includes("¥9.00"));
    assert.ok(!sharedLabels.some(text => text.includes("等2个")), "同一共享钱包只算一次");
});

test("画布文字保持简短且符合坐标与字号限制", () => {
    const result = render("multi-account.json");
    assertCanvasShape(result.canvas);
    const labels = texts(result.canvas);
    for (const label of labels) {
        assert.ok(Array.from(label).length <= 40, label);
    }
    assert.ok(labels.every(label => !/[\r\n]/.test(label)));
});

test("内容区底部使用圆角背景", () => {
    for (const canvas of [render("multi-account.json").canvas, render("api-index.json").canvas]) {
        assert.equal(canvas.nodes[0].fill, "$card");
        assert.match(canvas.nodes[0].path, /^M0 0 H387 V\d+ Q387 \d+ \d+ \d+ H12 Q0 \d+ 0 \d+ Z$/);
    }
});

test("文案只推荐完整地址，旧版只写带 kept 参数的地址", () => {
    for (const file of ["main.js", "README.md", "TESTING.md"]) {
        const text = fs.readFileSync(path.join(DIR, "..", file), "utf8");
        const bare = text.match(/\/v1\/magpie\/quotas(?![\/?\w])/g) || [];
        assert.deepEqual(bare, [], file + " 不应出现不带 kept 参数的旧端点路径");
        const badQuery = text.match(/\/v1\/magpie\/quotas\?(?!kept=1)/g) || [];
        assert.deepEqual(badQuery, [], file + " 旧端点只允许 ?kept=1 的只读写法");
    }
});

test("本机回环读取：正常、404、重定向、超限、超时", async t => {
    const server = await serve(routes);
    t.after(() => server.close());

    const source = await readLoopback(server.base + "/v1/magpie/quotas/cards");
    assert.equal(source.status, "ready");
    assert.ok(source.text.length < LIMIT);
    const result = call({ settings: {}, source, storage: null });
    assertQuota(result);
    assert.ok(texts(result.canvas).includes("Copilot"));

    for (const route of ["/missing", "/redirect", "/huge", "/slow"]) {
        const failed = await readLoopback(server.base + route);
        assert.equal(failed.status, "offline", route);
        const failedResult = call({ settings: {}, source: failed, storage: null });
        assert.equal(failedResult.quota, null, route);
        assert.equal(failedResult.status.state, "offline", route);
    }
});

test("连接拒绝按离线处理", async () => {
    const server = http.createServer();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    const source = await readLoopback(`http://127.0.0.1:${port}/v1/magpie/quotas/cards`);
    assert.equal(source.status, "offline");
    assert.equal(call({ settings: {}, source, storage: null }).status.state, "offline");
});

test("本机 magpie 实况", { skip: process.env.MAGPIE_LIVE !== "1" }, async () => {
    const started = Date.now();
    const source = await readLoopback("http://127.0.0.1:3425/v1/magpie/quotas/cards");
    const elapsed = Date.now() - started;
    if (source.status !== "ready") {
        console.log("本机 magpie 未运行，跳过实况读取");
        return;
    }
    console.log(`实况读取 ${Buffer.byteLength(source.text)} 字节，${elapsed} 毫秒`);
    assert.ok(Buffer.byteLength(source.text) <= LIMIT);
    assert.ok(elapsed < TIMEOUT);

    const live = call({ settings: {}, source, storage: null });
    assertQuota(live);
    assert.equal(live.notice, undefined);
    assertCanvasShape(live.canvas);
    const labels = texts(live.canvas);
    assert.ok(!labels.some(text => text.includes("ZCode")));
    assert.ok(labels.some(text => /^(缓存|较早缓存) \d{2}:\d{2}$/.test(text)), "实况 readAt 应显示缓存时间");

    const data = JSON.parse(source.text).data;
    const workbuddy = data.filter(card => card && card.provider === "workbuddy" && card.windows && card.windows.length);
    if (workbuddy.length > 1) {
        assert.ok(labels.includes("WorkBuddy ×" + workbuddy.length), labels.join("|"));
    }

    // 旧端点：窗口里额外带 remaining，插件应直接采用。
    const legacy = await readLoopback("http://127.0.0.1:3425/v1/magpie/quotas?kept=1");
    if (legacy.status !== "ready") {
        console.log("旧端点不可用，跳过实况读取");
        return;
    }
    console.log(`旧端点读取 ${Buffer.byteLength(legacy.text)} 字节`);
    assert.ok(Buffer.byteLength(legacy.text) <= LIMIT);
    const legacyResult = call({ settings: {}, source: legacy, storage: null });
    assertQuota(legacyResult);
    assertCanvasShape(legacyResult.canvas);
});
