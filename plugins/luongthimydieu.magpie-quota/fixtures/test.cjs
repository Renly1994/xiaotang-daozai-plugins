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

function render(name, settings = {}) {
    return call({ settings, source: ready(fixture(name)), storage: null });
}

function assertNoQuota(result) {
    assert.equal(result.quota, null);
    assert.equal(result.storage, undefined);
}

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

test("正常响应按平台汇总，舍弃没有订阅也没有余额的账号", () => {
    const result = render("normal.json");
    assertNoQuota(result);
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
});

test("同一平台的多账号合并为一行并累加积分", () => {
    const result = render("multi-account.json");
    assertCanvasShape(result.canvas);
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
    const labels = texts(result.canvas);
    assert.ok(labels.includes("DeepSeek ×2"));
    assert.ok(labels.includes("¥66.30"));
    assert.ok(!labels.some(text => text.includes("132.60")));
    assertCanvasShape(result.canvas);
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
        return call({ settings: {}, source: ready(JSON.stringify({ data })), storage: null });
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

    for (const canvas of [twelve.canvas, twentyFour.canvas, forty.canvas, overflow.canvas]) {
        assertCanvasShape(canvas);
    }
});

test("旧端点直接采用 remaining，不估算积分", () => {
    const result = render("legacy-quotas.json");
    const labels = texts(result.canvas);
    assert.ok(labels.includes("剩 96.8%"));
    assert.ok(labels.includes("1497 积分"));
    assert.ok(labels.includes("¥12.50"));
    assertCanvasShape(result.canvas);
});

test("只有无限额窗口时显示“无限”", () => {
    const result = render("unlimited-only.json");
    const labels = texts(result.canvas);
    assert.ok(labels.includes("无限"));
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
    const result = call({ settings: {}, source: ready(JSON.stringify({ data })), storage: null });
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

test("本机回环读取：正常、404、重定向、超限、超时", async t => {
    const server = await serve(routes);
    t.after(() => server.close());

    const source = await readLoopback(server.base + "/v1/magpie/quotas/cards");
    assert.equal(source.status, "ready");
    assert.ok(source.text.length < LIMIT);
    const result = call({ settings: {}, source, storage: null });
    assert.equal(result.quota, null);
    assert.ok(texts(result.canvas).includes("Copilot"));

    for (const route of ["/missing", "/redirect", "/huge", "/slow"]) {
        const failed = await readLoopback(server.base + route);
        assert.equal(failed.status, "offline", route);
        assert.equal(call({ settings: {}, source: failed, storage: null }).quota, null, route);
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
    assertNoQuota(live);
    assert.equal(live.notice, undefined);
    assertCanvasShape(live.canvas);
    const labels = texts(live.canvas);
    assert.ok(!labels.some(text => text.includes("ZCode")));

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
    assertNoQuota(legacyResult);
    assertCanvasShape(legacyResult.canvas);
});
