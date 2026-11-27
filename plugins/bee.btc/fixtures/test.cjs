const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sdk = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8"), sdk);
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, `${name}.json`), "utf8"));
const run = (kind, input) => JSON.parse(JSON.stringify(sdk[kind](input)));
const flatten = nodes => nodes.flatMap(node => node.group ? [node, ...flatten(node.group)] : [node]);
const page = output => flatten(output.canvas.nodes);
const messages = output => page(output).map(node => node.text).filter(Boolean);
const pinned = output => output.pinned ? output.pinned.canvas.nodes.map(node => node.text).filter(Boolean) : null;
const withDaily = (input, bars) => ({ ...input, sources: { ...input.sources, daily: { status: "ready", text: JSON.stringify(bars) } } });

test("USDT 口径：大价格不带后缀，区间高低取 K 线最高/最低字段，常驻位带 USDT", () => {
    const input = fixture("normal");
    const out = run("refresh", input);
    assert.equal(out.status.label, "现货比特币");
    assert.equal(out.status.state, "succeeded");
    const bars = JSON.parse(input.sources.daily.text).slice(-7)
        .map(row => ({ close: Number(row[4]), high: Number(row[2]), low: Number(row[3]) }));
    const high = Math.max(...bars.map(bar => bar.high));
    const low = Math.min(...bars.map(bar => bar.low));
    const last = bars[bars.length - 1].close;
    // 大价格是纯数字（不拼 USDT 后缀），币种由切换条标明
    assert.ok(messages(out).includes(sdk.digits(last, 0)));
    assert.ok(!messages(out).some(text => text.includes("$")));
    // 区间高低来自 K 线高低字段（比收盘价宽）
    assert.ok(messages(out).includes(sdk.money("usd", high)));
    assert.ok(messages(out).includes(sdk.money("usd", low)));
    // 常驻位是 USDT 原价
    assert.deepEqual(pinned(out), ["币", sdk.money("usd", last)]);
});

test("区间高低按 K 线高低字段而非收盘价：中间 K 线插针时取极值", () => {
    const input = fixture("normal");
    const bars = JSON.parse(input.sources.daily.text);
    // 第 25 根（在 7 日窗口内）插入长上下影线：高 70000、低 50000，收盘不变
    bars[24] = [bars[24][0], "60272", "70000", "50000", "60290", ...bars[24].slice(5)];
    const out = run("refresh", withDaily(input, bars));
    assert.ok(messages(out).includes(sdk.money("usd", 70000)));
    assert.ok(messages(out).includes(sdk.money("usd", 50000)));
    // 大价格与涨跌仍按收盘价计算
    assert.ok(messages(out).includes(sdk.digits(60348, 0)));
});

test("日线距今 2 天以上：标旧行情、撤下常驻位，阈值卡在收盘 +24h", () => {
    const input = fixture("stale");
    const out = run("refresh", input);
    assert.equal(out.status.label, "现货比特币（旧行情）");
    assert.equal(out.pinned, null);
    assert.ok(messages(out).some(text => text.startsWith("旧行情 · ")));
    // 最后一根收盘后恰好 24h 仍判旧；再早 1 秒为新鲜
    assert.ok(run("refresh", { ...input, now: input.now - 3600000 }).status.label.includes("旧行情"));
    const fresh = run("refresh", { ...input, now: input.now - 3601000 });
    assert.ok(!fresh.status.label.includes("旧行情"));
    assert.notEqual(fresh.pinned, null);
});

test("24小时视图：15 分钟线收盘后 45 分钟判旧行情", () => {
    const input = fixture("stale-day");
    const out = run("refresh", input);
    assert.ok(out.status.label.includes("旧行情"));
    assert.equal(out.pinned, null);
    assert.ok(messages(out).some(text => text.startsWith("旧行情 · ")));
    // 最后一根 15m 线距今 15 分钟 → 新鲜
    const fresh = run("refresh", { ...input, now: input.now - 2700000 });
    assert.ok(!fresh.status.label.includes("旧行情"));
    assert.notEqual(fresh.pinned, null);
});

test("汇率源缺失、缓存有效期内：页面按缓存折算并提示估算，常驻位退回 USDT", () => {
    const input = fixture("fx-stale");
    const out = run("refresh", input);
    assert.ok(messages(out).includes("汇率待更新，按缓存汇率估算"));
    assert.ok(messages(out).some(text => text.startsWith("≈¥")));
    assert.deepEqual(pinned(out), ["币", sdk.money("usd", 60348)]);
});

test("汇率缓存超过 2 天：整体退回 USDT 并提示", () => {
    const input = fixture("fx-expired");
    const out = run("refresh", input);
    assert.ok(messages(out).includes("汇率待更新，已按 USDT 显示"));
    assert.ok(messages(out).includes(sdk.digits(60348, 0)));
    assert.ok(!messages(out).some(text => text.startsWith("≈¥")));
    assert.ok(pinned(out).includes(sdk.money("usd", 60348)));
});

test("CNY 折算口径：≈ 前缀 + 估算提示，常驻位同样 ≈¥", () => {
    const input = fixture("cny");
    const out = run("refresh", input);
    const rate = 7.2456;
    const last = 60348;
    assert.ok(messages(out).includes("人民币为汇率折算，估算值"));
    assert.ok(messages(out).includes("≈¥" + sdk.digits(last * rate, 0)));
    assert.ok(pinned(out).includes("≈¥" + sdk.digits(last * rate, 0)));
    assert.equal(out.storage.lastRate, rate);
    assert.ok(Number.isFinite(out.storage.lastRateAt));
});

test("页面切换币种记忆到 storage，刷新后保持", () => {
    const input = fixture("normal");
    const switched = run("action", { ...input, action: { id: "unit-cny" } });
    assert.ok(messages(switched).includes("人民币为汇率折算，估算值"));
    const remembered = run("refresh", { ...input, storage: switched.storage });
    assert.ok(messages(remembered).includes("人民币为汇率折算，估算值"));
});
