const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sdk = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8"), sdk);
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, `${name}.json`), "utf8"));
const run = (kind, input) => JSON.parse(JSON.stringify(sdk[kind](input)));
const act = (input, id) => run("action", { ...input, action: { id } });
const day = 86400000;
const flatten = nodes => nodes.flatMap(node => node.group ? [node, ...flatten(node.group)] : [node]);
const page = output => flatten(output.canvas.nodes);
const messages = output => page(output).map(node => node.text).filter(Boolean);
const pinned = output => output.pinned.canvas.nodes.map(node => node.text).filter(Boolean);

function quote(input, unit, at, price) {
    const original = JSON.parse(input.sources[unit].text);
    original.xau.price = price;
    original.price_as_of = new Date(at).toISOString();
    original.updated_at = original.price_as_of;
    return { status: "ready", text: JSON.stringify(original) };
}

test("人民币和美元独立取数，页面切换可记忆，修改设置优先", () => {
    const input = fixture("cny");
    assert.ok(messages(run("refresh", input)).includes("946.2"));
    const usd = act(input, "unit-usd");
    assert.ok(messages(usd).includes("4,118.6"));
    assert.ok(messages(usd).includes("¥946.2 / 克"));
    assert.deepEqual(pinned(run("refresh", { ...input, storage: usd.storage })), ["金", "$4,118.6"]);
    const cny = act({ ...input, settings: { unit: "usd" }, storage: usd.storage }, "unit-cny");
    assert.ok(messages(cny).includes("946.2"));
    assert.deepEqual(pinned(run("refresh", { ...input, settings: { unit: "usd" }, storage: cny.storage })), ["金", "¥946.2"]);
    assert.ok(messages(run("refresh", { ...input, storage: cny.storage })).includes("946.2"));
});

test("XAUS 离线时用腾讯伦敦金和美元兑人民币折算，优先使用正常的 XAUS", () => {
    const input = fixture("tencent");
    const output = run("refresh", input);
    assert.equal(output.status.state, "succeeded");
    assert.ok(messages(output).includes("腾讯行情"));
    assert.ok(messages(output).includes("$3,565.5 / 盎司"));
    assert.ok(pinned(output).includes("¥763.5"));
    assert.ok(pinned(act(input, "unit-usd")).includes("$3,565.5"));
    const original = fixture("cny");
    input.sources.cny = quote(original, "cny", input.now, 764.5);
    assert.ok(pinned(run("refresh", input)).includes("¥764.5"));
});

test("腾讯黄金过期时撤下报价，缺汇率时仍可切换到美元", () => {
    const input = fixture("tencent");
    assert.equal(run("refresh", { ...input, now: input.now + 16 * 60000 }).pinned, null);
    input.sources.tencent.text = input.sources.tencent.text.split("\n")[0];
    assert.equal(run("refresh", input).pinned, null);
    assert.ok(pinned(act(input, "unit-usd")).includes("$3,565.5"));
});

test("腾讯汇率过旧时提示时效并暂停跨线提醒，超过一天停止折算", () => {
    const input = fixture("tencent");
    input.sources.tencent.text = input.sources.tencent.text.replace("20261126181430", "20261126171430");
    const stale = run("refresh", input);
    assert.ok(messages(stale).includes("汇率待更新"));
    assert.ok(!messages(act(input, "unit-usd")).includes("汇率待更新"));
    input.sources.tencent.text = input.sources.tencent.text.replace("20261126171430", "20261125171430");
    assert.equal(run("refresh", input).pinned, null);
});

test("换源时保留历史和提醒去重，跨线提醒只比较同源报价", () => {
    const input = fixture("tencent");
    const original = fixture("cny");
    input.settings = { alert_cny: "764" };
    const old = run("refresh", { ...input, sources: { cny: quote(original, "cny", input.now - 180000, 764.5) } });
    const switched = run("refresh", { ...input, storage: old.storage });
    assert.equal(switched.notice, undefined);
    assert.equal(switched.storage.cny.day.length, 2);
    input.now += 60000;
    input.sources.tencent.text = input.sources.tencent.text.replace("3565.48", "3575.00").replace("18:13:00", "18:15:30");
    const crossed = run("refresh", { ...input, storage: switched.storage });
    assert.equal(crossed.notice.id, "gold-cny-764-up");
});

test("小时和日采样去重，三份历史均最多保留 48 点", () => {
    const input = fixture("cny");
    const start = input.now;
    let storage;
    for (let i = 0; i < 50; i++) {
        for (const minute of [0, 10, 20]) {
            const now = start + i * day + minute * 60000;
            storage = run("refresh", {
                ...input, storage, now,
                sources: { cny: quote(input, "cny", now, 950 + minute / 10) }
            }).storage;
        }
    }
    assert.equal(storage.cny.day.length, 48);
    assert.equal(storage.cny.week.length, 48);
    assert.equal(storage.cny.month.length, 48);
    assert.ok(storage.cny.month.every(point => point.price === 952));
    assert.equal(storage.cny.session.low, 950);
    const week = act(fixture("week"), "range-week");
    assert.ok(page(week).some(node => node.id === "chart-cny-week"));
    const month = act(fixture("month"), "range-month");
    assert.ok(page(month).some(node => node.id === "chart-cny-month"));
    assert.equal(act(input, "range-month").storage.selection.range.value, "month");
});

test("提醒跨线后按单位、价位和方向去重", () => {
    const input = fixture("crossing");
    const up = run("refresh", input);
    assert.equal(up.notice.id, "gold-cny-945-up");
    assert.equal(run("refresh", { ...input, storage: up.storage }).notice, undefined);
    const now = input.now + 60000;
    const down = run("refresh", { ...input, now, storage: up.storage, sources: { cny: quote(input, "cny", now, 944) } });
    assert.equal(down.notice.id, "gold-cny-945-down");
    const back = run("refresh", { ...input, now: now + 60000, storage: down.storage, sources: { cny: quote(input, "cny", now + 60000, 946) } });
    assert.equal(back.notice, undefined);
});

test("同时跨线时保留第二条提醒，间隔 60 秒交给宿主", () => {
    const input = fixture("crossing");
    input.settings.alert_usd = "4115";
    input.storage.usd.threshold = { price: 4115, side: -1, sent: 0 };
    const first = run("refresh", input);
    assert.equal(first.notice.id, "gold-cny-945-up");
    assert.equal(first.next_refresh_at, input.now / 1000 + 60);
    assert.equal(run("refresh", { ...input, storage: first.storage, now: input.now + 59999 }).notice, undefined);
    const second = run("refresh", { ...input, storage: first.storage, now: input.now + 60000 });
    assert.equal(second.notice.id, "gold-usd-4115-up");
    assert.equal(second.storage.pending.length, 0);
});

test("人民币展示汇率待更新，美元不受影响，失败或旧数据撤下读数", () => {
    const input = fixture("fx-stale");
    assert.ok(messages(run("refresh", input)).includes("汇率待更新"));
    assert.ok(!messages(act(input, "unit-usd")).includes("汇率待更新"));
    for (const key of ["offline", "active-offline"]) {
        const output = run("refresh", fixture(key));
        assert.equal(output.status.label, "数据源暂不可用");
        assert.ok(messages(output).includes("数据源暂不可用"));
        assert.ok(!page(output).some(node => node.id?.startsWith("price-")));
        assert.equal(output.pinned, null);
    }
    assert.equal(run("refresh", { ...input, now: input.now + 16 * 60000 }).pinned, null);
    const outOfOrder = { ...input, sources: { cny: quote(input, "cny", input.now - 240000, 944) } };
    const newer = run("refresh", input);
    assert.equal(run("refresh", { ...outOfOrder, storage: newer.storage }).pinned, null);
});

test("按设置计算上涨和下跌的配色", () => {
    const input = fixture("cny");
    assert.equal(run("computeState", input).deltaColor, "#FF6B6B");
    assert.equal(run("computeState", { ...input, settings: { up_color: "green" } }).deltaColor, "#58D791");
    assert.ok(page(run("refresh", input)).some(node => node.fill === "#FF6B6B35"));
    assert.ok(page(run("refresh", { ...input, settings: { up_color: "green" } })).some(node => node.fill === "#58D79135"));
    input.sources.cny = quote(input, "cny", input.now, 940);
    assert.equal(run("computeState", input).deltaColor, "#58D791");
    assert.equal(run("computeState", { ...input, settings: { up_color: "green" } }).deltaColor, "#FF6B6B");
});

test("更新时间靠右，与左侧数据来源错开，刷新按钮留在操作区", () => {
    const input = fixture("cny");
    const nodes = page(run("refresh", { ...input, tz: { offset_minutes: 480 } }));
    const updated = nodes.find(node => node.text === "更新 14:05");
    const refresh = nodes.find(node => node.hit?.action === "refresh");
    assert.equal(updated.align, "right");
    assert.ok(updated.at[0] > 360 && updated.at[1] > 175);
    assert.ok(refresh.rect[1] + refresh.rect[3] < updated.at[1]);
});

test("折合读数保留千分位和单位，并使用折合行的可用宽度", () => {
    const input = fixture("cny");
    input.sources.usd = quote(input, "usd", input.now, 12345.6);
    input.sources.cny = quote(input, "cny", input.now, 1234.5);
    const yuanView = page(run("refresh", input));
    const dollarView = page(act(input, "unit-usd"));
    for (const [nodes, value] of [[yuanView, "$12,345.6 / 盎司"], [dollarView, "¥1,234.5 / 克"]]) {
        const label = nodes.find(node => node.text === "折合");
        const folded = nodes.find(node => node.text === value);
        assert.equal(folded.align, "right");
        assert.equal(folded.at[1], label.at[1]);
        assert.ok(folded.max_width >= 108);
    }
});

test("常驻用金色标识，迷你走势紧跟当前价格", () => {
    const input = fixture("usd");
    const widths = [];
    for (const [price, label] of [
        [765.8, "$765.8"], [4118.6, "$4,118.6"], [12345.6, "$12,345.6"],
        [123456.7, "$123,456.7"], [9999999.9, "$9,999,999.9"]
    ]) {
        input.sources.usd = quote(input, "usd", input.now, price);
        const { width, nodes } = run("refresh", input).pinned.canvas;
        const [icon, amount, trend] = nodes;
        assert.equal(icon.text, "金");
        assert.equal(icon.fill, "#A37B2D");
        assert.equal(amount.text, label);
        assert.equal(amount.align, "right");
        assert.equal(trend.points[0][0] - amount.at[0], 7);
        assert.equal(trend.points.at(-1)[0] - trend.points[0][0], 30);
        assert.equal(width - trend.points.at(-1)[0], 4);
        assert.ok(width <= 156);
        widths.push(width);
    }
    assert.ok(widths.every((width, index) => index === 0 || width > widths[index - 1]));
});

test("走势图含价格和时间刻度、提醒线、悬停读数和可切换区间", () => {
    const input = fixture("usd");
    const output = run("refresh", { ...input, tz: { offset_minutes: 480 } });
    assert.equal(output.canvas.height, 196);
    const nodes = page(output);
    const trace = nodes.find(node => node.tips);
    assert.ok(trace.tips.some(tip => tip.value === "$4,106.2"));
    assert.ok(trace.tips.every(tip => /^\d\d:\d\d$/.test(tip.label)));
    assert.ok(nodes.some(node => node.dash && node.stroke === "#FF6B6B"));
    assert.deepEqual(nodes.filter(node => node.hit).map(node => node.hit.action),
        ["unit-usd", "unit-cny", "range-day", "range-week", "range-month", "refresh"]);
    assert.ok(output.pinned.canvas.nodes.some(node => node.points && node.stroke === "#FF6B6B"));
    assert.ok(output.pinned.canvas.width < 130);
    assert.equal(output.pinned.canvas.fit_width, undefined);
    const initial = run("refresh", { ...fixture("usd"), storage: null });
    assert.equal(initial.pinned.canvas.fit_width, true);
    assert.ok(!initial.pinned.canvas.nodes.some(node => node.points));
});
