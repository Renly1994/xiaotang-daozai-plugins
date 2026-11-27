import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {runInNewContext} from "node:vm";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const manifest = JSON.parse(read("../plugin.json"));
const data = Object.fromEntries(manifest.data.map(name => [name, JSON.parse(read(`../${name}`))]));
const defaults = Object.fromEntries(manifest.settings.map(field => [field.key, field.default]));
const plugin = runInNewContext(`${read("../main.js")}\n({refresh, action, computeState})`);
const tickets = output => output.canvas.nodes.find(node => node.id?.startsWith("tickets-")).group;
const labels = output => Array.from(tickets(output), ticket => ticket.group.find(node => node.text).text);
const caption = output => output.pinned.canvas.nodes.find(node => node.text).text;

function input(name) {
    const fixture = JSON.parse(read(`./${name}.json`));
    return {
        now: fixture.now,
        today: new Date(fixture.now + 8 * 3600000).toISOString().slice(0, 10),
        tz: {offset_minutes: 480, name: "Asia/Shanghai"},
        settings: {...defaults, ...fixture.settings},
        storage: fixture.storage || null,
        data
    };
}

test("我的日子由独立功能管理，不向待办输出卡片", () => {
    const output = plugin.refresh(input("ordinary"));
    assert.equal(manifest.owner, "status");
    assert.ok(manifest.capabilities.includes("status.page"));
    assert.ok(!manifest.capabilities.includes("card"));
    assert.match(manifest.navigationIcon.path, /^M/);
    assert.match(manifest.navigationIcon.background, /^#[0-9a-f]{6}$/i);
    assert.equal(output.card, undefined);
    assert.ok(output.status && output.canvas && output.pinned);
});

test("普通日合并己方日子与节假日并按日期排序", () => {
    const output = plugin.refresh(input("ordinary"));
    assert.equal(caption(output), "还有 1 天 · 圣诞聚餐");
    assert.deepEqual(labels(output).slice(0, 3), ["圣诞聚餐", "朋友", "元旦"]);
    assert.equal(output.canvas.height, 200);
    assert.equal(output.next_refresh_at, Date.parse("2026-12-25T00:00+08:00") / 1000);
});

test("常驻长名称的自定义倒数优先保留完整天数", () => {
    const current = input("design");
    const name = "甲乙丙丁戊己庚辛壬癸甲乙";
    const settings = {...current.settings, pinned_day: name, days: JSON.stringify([{
        name, date: "2027-12-31", kind: "countdown", yearly: "false",
        icon: "flag", color: "red", pinned_text: "默认"
    }])};
    const output = plugin.refresh({...current, today: "2026-11-26",
        now: Date.parse("2026-11-26T12:00+08:00"), settings});
    assert.equal(caption(output), `还有 400 天 · ${name}`);
});

test("假期当天与调休上班写入日历标注", () => {
    const holiday = plugin.refresh(input("holiday"));
    assert.equal(holiday.status.state, "succeeded");
    assert.equal(holiday.marker, "国庆节 · 休");
    assert.equal(caption(holiday), "今天是 国庆节");
    assert.ok(holiday.canvas.nodes.find(node => node.id?.startsWith("paper-")).group.some(node => node.text === "今天"));
    const makeup = plugin.refresh(input("makeup"));
    assert.equal(makeup.marker, "班");
    assert.ok(makeup.canvas.nodes.some(node => node.text === "周日调休上班"));
});

test("关闭节假日后仅显示自己的倒数和生日", () => {
    const output = plugin.refresh(input("own-only"));
    assert.equal(caption(output), "还有 7 天 · 项目交付");
    assert.deepEqual(labels(output), ["项目交付", "小唐"]);
    assert.ok(tickets(output)[1].group.some(node => node.text === "18"));
});

test("闰日生日在非闰年落在二月最后一天，闰年保留原日", () => {
    const ordinary = plugin.refresh(input("leap-birthday"));
    assert.equal(caption(ordinary), "今天是 闰日朋友");
    assert.equal(ordinary.notice.title, "闰日朋友 生日快乐");
    const leap = plugin.refresh(input("leap-year"));
    assert.equal(caption(leap), "生日还有 1 天 · 闰日朋友");
    assert.equal(leap.notice, undefined);
});

test("纪念日给出已过去的天数、整百天提醒和完整模板替换", () => {
    const output = plugin.refresh(input("anniversary"));
    assert.equal(caption(output), "开工纪念·100天·2026-08-16·星期日");
    assert.equal(output.notice.title, "开工纪念已满 100 天");
    assert.ok(tickets(output)[0].group.some(node => node.text === "100"));
    assert.ok(tickets(output)[0].group.some(node => node.text === "天了"));
});

test("筛选动作持久化，未知动作保留筛选", () => {
    const current = input("filtered");
    const holidays = plugin.refresh(current);
    assert.equal(labels(holidays)[0], "元旦");
    const own = plugin.action({...current, action: {id: "filter-mine"}});
    assert.equal(own.storage.filter, "mine");
    assert.deepEqual(labels(own), ["项目交付"]);
    const next = plugin.action({...current, storage: own.storage, action: {id: "randomall"}});
    assert.equal(next.storage.filter, "mine");
});

test("次年安排未公布时只提示 pending，保留自己的日子", () => {
    const current = input("ordinary");
    const pending = plugin.refresh({...current, data: {
        "holidays-2026.json": data["holidays-2026.json"],
        "holidays-2027.json": {year: 2027, pending: true}
    }});
    assert.ok(pending.canvas.nodes.some(node => node.text === "2027 年放假安排待公布"));
    assert.equal(tickets(pending).length, 2);
});

test("同日两条提醒按间隔排队，重排条目后 ID 稳定且已发送提醒不重复", () => {
    const current = input("reminder-queue");
    const first = plugin.refresh(current);
    assert.equal(first.notice.title, "小唐 生日快乐");
    assert.equal(first.next_refresh_at, current.now / 1000 + 61);

    const rows = JSON.parse(current.settings.days).reverse();
    const reordered = {...current, settings: {...current.settings, days: JSON.stringify(rows)}};
    const early = plugin.action({...reordered, now: current.now + 60000,
        storage: first.storage, action: {id: "filter-all"}});
    assert.equal(early.notice, undefined);
    assert.equal(early.storage.sent.length, 1);

    const second = plugin.refresh({...reordered, storage: early.storage, now: current.now + 61000});
    assert.equal(second.notice.title, "开工纪念已满 100 天");
    assert.equal(second.notice.id, plugin.refresh(reordered).notice.id);
    assert.equal(second.storage.sent.length, 2);
    const third = plugin.refresh({...current, storage: second.storage, now: current.now + 122000});
    assert.equal(third.notice, undefined);
    assert.equal(third.next_refresh_at, Date.parse("2026-11-25T00:00+08:00") / 1000);
});

test("设置中的每年重复、二十条日子和常驻选择可同时使用", () => {
    const current = input("own-only");
    const rows = Array.from({length: 20}, (_, i) => ({
        name: `约定${i + 1}`, date: "2020-12-05", kind: "countdown",
        yearly: i === 19 ? "true" : "false", icon: "star", color: "teal", pinned_text: "{名称}还有{天数}天"
    }));
    const settings = {...current.settings, days: JSON.stringify(rows),
        pinned_day: "约定20"};
    assert.equal(plugin.computeState({...current, settings}).own.length, 20);
    const output = plugin.refresh({...current, settings});
    assert.equal(caption(output), "约定20还有11天");
    assert.equal(output.pinned.canvas.nodes[0].icon, "star");
    assert.equal(output.pinned.canvas.fit_width, true);
    assert.equal(output.pinned.canvas.nodes[0].stroke, "#77D6C9");
    assert.equal(tickets(output).length, 20);
    assert.ok(tickets(output).every(ticket => /^[a-z][a-z0-9_-]{0,39}$/.test(ticket.hit.action)));
    assert.ok(tickets(output)[0].group.some(node => node.text === "到期"));
});

test("每月重复按原日期计算，短月取月末，次月恢复原日", () => {
    const current = input("own-only");
    for (const [date, today, expected] of [
        ["2027-01-31", "2027-02-01", "2027-02-28"],
        ["2027-01-31", "2027-02-28", "2027-02-28"],
        ["2027-01-31", "2027-03-01", "2027-03-31"],
        ["2027-01-31", "2028-02-28", "2028-02-29"],
        ["2027-01-05", "2027-12-06", "2028-01-05"],
        ["2028-02-29", "2027-12-31", "2028-02-29"]
    ]) {
        const settings = {...current.settings, days: JSON.stringify([{
            name: "交房租", date, kind: "countdown", yearly: "monthly",
            icon: "flag", color: "red", pinned_text: "默认"
        }])};
        const scenario = {...current, today, now: Date.parse(today + "T12:00+08:00"), settings};
        const [day] = plugin.computeState(scenario).own;
        assert.equal(day.dateLabel, expected, today);
        assert.equal(day.current, today === expected);
        assert.ok(tickets(plugin.refresh(scenario))[0].group.some(node => node.text?.endsWith("每月")));
    }
});

test("恢复最近即使筛选隐藏目标车票，也显示常驻反馈", () => {
    const current = input("design");
    const first = plugin.refresh(current);
    assert.match(caption(first), /元旦/);
    const birthday = tickets(first).find(row => row.group.some(node => node.text === "小唐生日"));
    const chosen = plugin.action({...current, storage: first.storage, action: {id: birthday.hit.action}});
    assert.match(caption(chosen), /^生日还有 .* · 小唐生日$/);
    assert.equal(chosen.pinned.canvas.nodes[0].icon, "cake");
    const saved = plugin.refresh({...current, storage: chosen.storage});
    assert.equal(caption(saved), caption(chosen));
    const own = plugin.action({...current, storage: saved.storage, action: {id: "filter-mine"}});
    assert.ok(own.canvas.nodes.some(node => node.hit?.action === "pin-nearest"));
    const nearest = plugin.action({...current, storage: own.storage, action: {id: "pin-nearest"}});
    assert.match(caption(nearest), /元旦/);
    assert.equal(nearest.storage.filter, "mine");
    assert.ok(!labels(nearest).includes("元旦"));
    assert.ok(nearest.canvas.nodes.some(node => node.text === "常驻跟随最近" && !node.hit));
    assert.ok(!nearest.canvas.nodes.some(node => node.hit?.action === "pin-nearest"));
    const refreshed = plugin.refresh({...current, storage: nearest.storage});
    assert.ok(refreshed.canvas.nodes.some(node => node.text === "常驻跟随最近"));
    assert.equal(caption(refreshed), caption(nearest));
});

test("节假日列表的车票轮廓完整，国庆节可点击并恢复常驻", () => {
    const current = input("design");
    const filtered = plugin.action({...current, action: {id: "filter-holidays", form: {}}});
    const rows = tickets(filtered);
    const ordinary = rows[1].group.find(node => node.path);
    assert.equal(ordinary.stroke, ordinary.fill);
    assert.equal(rows[0].group.find(node => node.path).stroke, "#FFFFFF");
    const national = rows.find(row => row.group.some(node => node.text === "国庆节"));
    const chosen = plugin.action({...current, storage: filtered.storage, action: {id: national.hit.action, form: {}}});
    assert.equal(chosen.status.state, "running");
    assert.match(caption(chosen), /国庆节/);
    assert.equal(chosen.storage.pinnedKey, "holiday:2027-10-01:国庆节");
    const saved = plugin.refresh({...current, storage: chosen.storage});
    assert.equal(caption(saved), caption(chosen));
    assert.equal(tickets(saved).find(row => row.hit.action === national.hit.action).group.find(node => node.path).stroke,
        "#FFFFFF");
});

test("午夜换页保留旧页身份和向右下飞出的过渡目标", () => {
    const current = input("design");
    const first = plugin.refresh(current);
    const next = plugin.refresh({...current, today: "2026-11-25", now: current.now + 86400000, storage: first.storage});
    const oldPaper = first.canvas.nodes.find(node => node.id?.startsWith("paper-"));
    const retired = next.canvas.nodes.find(node => node.id === oldPaper.id);
    assert.deepEqual([...retired.translate], [76, 39]);
    assert.equal(retired.rotate, 13);
    assert.equal(retired.opacity, 0);
    assert.equal(retired.animate.ms, 540);
    assert.ok(next.canvas.nodes.some(node => node.id?.startsWith("paper-") && node.id !== oldPaper.id));
});

test("脚本兼容标准版分组数据和按名称关联的重复配置", () => {
    const current = input("own-only");
    const settings = {...current.settings, days: "[]", pinned_day: "旧约定",
        days_2: JSON.stringify([{name: "旧约定", date: "2020-12-01", kind: "countdown"}]),
        day_options_2: JSON.stringify([{name: "旧约定", yearly: "true", pinned_text: "{名称} {天数}"}])};
    assert.equal(caption(plugin.refresh({...current, settings})), "旧约定 7");
});
