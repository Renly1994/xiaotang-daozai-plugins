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

test("未授权与离线一律返回未知", () => {
    const unconfigured = call({ settings: { account: "自动选择" }, source: { status: "unconfigured" }, storage: null });
    assert.equal(unconfigured.quota, null);
    const offline = call({ settings: { account: "自动选择" }, source: { status: "offline" }, storage: null });
    assert.equal(offline.quota, null);
});

test("正常响应只换算可用的百分比窗口", () => {
    const result = call({ settings: { account: "自动选择" }, source: ready(fixture("normal.json")), storage: null });
    assert.equal(result.quota.windows.length, 1);
    assert.equal(result.quota.windows[0].label, "Premium requests");
    assert.equal(result.quota.windows[0].remaining_pct, 92.75);
    assert.equal(result.quota.windows[0].reset_at, Math.floor(Date.parse("2026-12-15T00:00:00Z") / 1000));
    assert.equal(result.storage.account, JSON.stringify(["copilot", "demo-copilot", "subscription"]));
});

test("自动选择会固定账号，不随返回顺序漂移", () => {
    const first = call({ settings: { account: "自动选择" }, source: ready(fixture("normal.json")), storage: null });
    const second = call({ settings: { account: "自动选择" }, source: ready(fixture("reordered.json")), storage: first.storage });
    assert.equal(second.quota.windows[0].label, "Premium requests");
    assert.equal(second.storage.account, first.storage.account);
});

test("固定账号报错时按未知处理，不换成别的账号", () => {
    const first = call({ settings: { account: "自动选择" }, source: ready(fixture("normal.json")), storage: null });
    const result = call({ settings: { account: "自动选择" }, source: ready(fixture("pinned-error.json")), storage: first.storage });
    assert.equal(result.quota, null);
});

test("固定账号消失后重新选择，并保留原存储的其他字段", () => {
    const first = call({ settings: { account: "自动选择" }, source: ready(fixture("normal.json")), storage: null });
    first.storage.note = "保留";
    const result = call({ settings: { account: "自动选择" }, source: ready(fixture("no-copilot.json")), storage: first.storage });
    assert.deepEqual(result.quota.windows.map(window => window.label), ["5 hours", "Month"]);
    assert.deepEqual(result.quota.windows.map(window => window.remaining_pct), [57.5, 63.75]);
    assert.equal(result.storage.note, "保留");
    assert.equal(result.storage.account, JSON.stringify(["kimi", "", "plan"]));
});

test("unlimited、text、钱包窗口不换算，超额按 0 剩余", () => {
    const unlimited = call({ settings: { account: "自动选择" }, source: ready(fixture("unlimited-only.json")), storage: null });
    assert.equal(unlimited.quota, null);

    const mixed = call({ settings: { account: "自动选择" }, source: ready(fixture("text-and-unlimited.json")), storage: null });
    assert.equal(mixed.quota.windows.length, 1);
    assert.equal(mixed.quota.windows[0].label, "已用超额");
    assert.equal(mixed.quota.windows[0].remaining_pct, 0);
});

test("窗口名称按宿主规则截断并去掉控制字符", () => {
    const result = call({ settings: { account: "自动选择" }, source: ready(fixture("long-label.json")), storage: null });
    const label = result.quota.windows[0].label;
    assert.equal(Array.from(label).length, 40);
    assert.ok(!/[\u0000-\u001f\u007f-\u009f]/.test(label));
});

test("空数据与坏响应按未知处理", () => {
    assert.equal(call({ settings: {}, source: ready(fixture("empty.json")), storage: null }).quota, null);
    assert.equal(call({ settings: {}, source: ready(fixture("malformed.txt")), storage: null }).quota, null);
    assert.equal(call({ settings: {}, source: ready("{}"), storage: null }).quota, null);
    assert.equal(call({ settings: {}, source: ready('{"data":{}}'), storage: null }).quota, null);
});

test("条目错误字段为意外类型时按未知处理", () => {
    const cards = [
        { provider: "a", name: "A", user: "a", windows: [{ name: "W", used: 10 }], error: { code: 1 }, kind: "subscription" },
        { provider: "b", name: "B", user: "b", windows: [{ name: "W", used: 20 }], pluginError: [], kind: "subscription" },
        { provider: "c", name: "C", user: "c", windows: [{ name: "W", used: 30 }], readError: 7, kind: "subscription" },
        { provider: "d", name: "D", user: "d", windows: [{ name: "W", used: 40 }], error: "", pluginError: false, readError: 0, kind: "subscription" },
    ];
    const result = call({ settings: { account: "自动选择" }, source: ready(JSON.stringify({ data: cards })), storage: null });
    assert.equal(result.quota.windows[0].remaining_pct, 60);
});

test("storage 为异常类型时重置为对象并正常返回", () => {
    for (const storage of [[], "旧数据", 42, null]) {
        const result = call({ settings: { account: "自动选择" }, source: ready(fixture("normal.json")), storage });
        assert.equal(result.quota.windows.length, 1);
        assert.equal(result.quota.windows[0].remaining_pct, 92.75);
        assert.equal(typeof result.storage, "object");
        assert.ok(!Array.isArray(result.storage));
        assert.equal(typeof result.storage.account, "string");
    }
});

test("设置可以指定一个账号", () => {
    const result = call({ settings: { account: "workbuddy" }, source: ready(fixture("normal.json")), storage: { note: "原有" } });
    assert.deepEqual(result.quota.windows.map(window => window.label), ["Credits", "Extra credits", "Total credits"]);
    assert.deepEqual(result.quota.windows.map(window => window.remaining_pct), [0, 83.875, 52.421875]);
    assert.equal(result.storage.note, "原有");
    assert.equal(result.storage.account, undefined);

    const mixedCase = call({ settings: { account: "Copilot" }, source: ready(fixture("normal.json")), storage: null });
    assert.equal(mixedCase.quota.windows.length, 1);

    const missing = call({ settings: { account: "没有这个账号" }, source: ready(fixture("normal.json")), storage: null });
    assert.equal(missing.quota, null);
});

function exampleCard(user, used, overrides = {}) {
    return {
        provider: "example",
        name: "Example",
        kind: "subscription",
        user,
        windows: [{ name: "本月", used }],
        ...overrides,
    };
}

function exampleRefresh(cards, account = "自动选择", storage = null) {
    return call({ settings: { account }, source: ready(JSON.stringify({ data: cards })), storage });
}

test("套餐和显示名变化后仍固定同一账号", () => {
    const before = exampleRefresh([exampleCard("first", 10, { plan: "Basic" }), exampleCard("second", 20)]);
    const renamed = exampleCard("first", 30, { name: "Renamed", plan: "Plus" });
    const after = exampleRefresh([exampleCard("second", 20), renamed], "自动选择", before.storage);
    assert.equal(after.quota.windows[0].remaining_pct, 70);
    assert.equal(after.storage.account, before.storage.account);

    const oldStorage = { account: JSON.stringify(["", "example", "first", "basic", "example"]), note: "保留" };
    assert.equal(exampleRefresh([exampleCard("second", 20), renamed], "自动选择", oldStorage).quota.windows[0].remaining_pct, 70);
    assert.deepEqual(oldStorage, { account: before.storage.account, note: "保留" });
});

test("多个账号同属一个厂商时，手动选择不依赖返回顺序", () => {
    const first = exampleCard("first", 10);
    const second = exampleCard("second", 20, { alias: "常用账号" });
    for (const cards of [[first, second], [second, first]]) {
        assert.equal(exampleRefresh(cards, "Example").quota, null);
        assert.equal(exampleRefresh(cards, "second").quota.windows[0].remaining_pct, 80);
        assert.equal(exampleRefresh(cards, "常用账号").quota.windows[0].remaining_pct, 80);
    }
    const offline = exampleCard("first", 10, { readError: "暂时离线" });
    assert.equal(exampleRefresh([offline, second], "Example").quota, null);
});

test("自动选择区分来源且保留身份不完整或重复的固定账号", () => {
    const local = exampleCard("first", 10);
    const remote = exampleCard("first", 20, { provider: "remote-id/example", from: "远端" });
    const pinned = exampleRefresh([remote, local]);
    const remoteRenamed = { ...remote, from: "新的远端名称", name: "Example · 新的远端名称" };
    assert.equal(exampleRefresh([local, remoteRenamed], "自动选择", pinned.storage).quota.windows[0].remaining_pct, 80);

    const duplicate = exampleCard("first", 30, { provider: "remote-id/example", from: "远端" });
    const partial = exampleCard("", 50, { provider: "remote-id/example", from: "远端", readError: "暂时离线" });
    for (const candidate of [duplicate, partial]) {
        const result = exampleRefresh([candidate, remote, local], "自动选择", pinned.storage);
        assert.equal(result.quota, null);
        assert.equal(result.storage.account, pinned.storage.account);
    }
    assert.equal(exampleRefresh([partial, local], "自动选择", pinned.storage).quota, null);
    assert.equal(exampleRefresh([local], "自动选择", pinned.storage).quota.windows[0].remaining_pct, 90);
});

test("极小的正剩余量保持正数，耗尽才返回零", () => {
    for (const used of [99.999, 99.9999999]) {
        const quota = exampleRefresh([exampleCard("first", used)]).quota;
        assert.equal(quota.windows[0].remaining_pct, 100 - used);
    }
    for (const used of [100, 140]) {
        assert.equal(exampleRefresh([exampleCard("first", used)]).quota.windows[0].remaining_pct, 0);
    }
});

test("本机回环读取：正常、404、重定向、超限、超时", async t => {
    const server = await serve(routes);
    t.after(() => server.close());

    const source = await readLoopback(server.base + "/v1/magpie/quotas/cards");
    assert.equal(source.status, "ready");
    assert.ok(source.text.length < LIMIT);
    const result = call({ settings: { account: "自动选择" }, source, storage: null });
    assert.equal(result.quota.windows[0].remaining_pct, 92.75);

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
    assert.equal(call({ settings: {}, source, storage: null }).quota, null);
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
    const result = call({ settings: { account: "自动选择" }, source, storage: null });
    if (result.quota) {
        assert.ok(result.quota.windows.length >= 1 && result.quota.windows.length <= 3);
        for (const window of result.quota.windows) {
            assert.ok(window.label.length > 0 && Array.from(window.label).length <= 40);
            assert.ok(window.remaining_pct >= 0 && window.remaining_pct <= 100);
        }
    }
});
