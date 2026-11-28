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
const caption = output => output.pinned.canvas.nodes.flatMap(node => node.group || [node])
    .map(node => node.text || "").join("");

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
    assert.equal(caption(output), "1天 · 圣诞聚餐");
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
    assert.equal(caption(output), `400天 · ${name}`);
});

test("假期当天与调休上班写入日历标注", () => {
    const holiday = plugin.refresh(input("holiday"));
    assert.equal(holiday.status.state, "succeeded");
    assert.equal(holiday.marker, "国庆节 · 休");
    assert.equal(caption(holiday), "今天 · 国庆节");
    assert.ok(holiday.canvas.nodes.find(node => node.id?.startsWith("paper-")).group.some(node => node.text === "今天"));
    const makeup = plugin.refresh(input("makeup"));
    assert.equal(makeup.marker, "班");
    assert.ok(makeup.canvas.nodes.some(node => node.text === "周日调休上班"));
});

test("关闭节假日后仅显示自己的倒数和生日", () => {
    const output = plugin.refresh(input("own-only"));
    assert.equal(caption(output), "7天 · 项目交付");
    assert.deepEqual(labels(output), ["项目交付", "小唐"]);
    assert.ok(tickets(output)[1].group.some(node => node.text === "18"));
});

test("闰日生日在非闰年落在二月最后一天，闰年保留原日", () => {
    const ordinary = plugin.refresh(input("leap-birthday"));
    assert.equal(caption(ordinary), "今天 · 闰日朋友");
    assert.equal(ordinary.notice.title, "闰日朋友 生日快乐");
    const leap = plugin.refresh(input("leap-year"));
    assert.equal(caption(leap), "1天 · 闰日朋友");
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

function customDay(date, today, yearly, kind = "countdown") {
    const current = input("own-only");
    const row = {name: "固定约定", date, kind, yearly, icon: "flag", color: "red", pinned_text: "默认"};
    return {...current, today, now: Date.parse(today + "T12:00+08:00"),
        settings: {...current.settings, days: JSON.stringify([row])}};
}

test("自定义间隔按起始日计算，到期当天仍属于本期", () => {
    for (const [rule, base, today, next] of [
        ["每2天", "2026-11-28", "2026-11-27", "2026-11-28"],
        ["每2天", "2026-11-28", "2026-11-30", "2026-11-30"],
        ["每2天", "2026-11-28", "2026-12-01", "2026-12-02"],
        ["每2周", "2026-11-28", "2026-12-01", "2026-12-12"],
        ["每3个月", "2026-11-28", "2026-12-01", "2027-02-28"],
        ["每3月", "2026-11-28", "2027-03-01", "2027-05-28"],
        ["每月", "2027-01-31", "2027-03-01", "2027-03-31"],
        ["每2年", "2028-02-29", "2029-03-01", "2030-02-28"],
        ["每2年", "2028-02-29", "2030-03-01", "2032-02-29"],
        ["每100天", "2026-01-01", "2026-01-02", "2026-04-11"],
    ]) {
        const [day] = plugin.computeState(customDay(base, today, rule)).own;
        assert.equal(day.dateLabel, next, rule);
        assert.equal(day.current, today === next, rule);
    }
});

test("默认生日每年重复，显式不重复和非法间隔不会生成下一期", () => {
    const today = "2026-11-28";
    for (const value of ["默认", "false", "true", "每年"]) {
        const [day] = plugin.computeState(customDay("2020-11-28", today, value, "birthday")).own;
        assert.equal(day.current, true, value);
    }
    for (const value of ["不重复", "0", "每0天"]) {
        const [day] = plugin.computeState(customDay("2020-11-28", today, value, "birthday")).own;
        assert.equal(day.current, false, value);
        assert.equal(day.dateLabel, "2020-11-28", value);
    }
    for (const value of ["每2.5天", "每101天", "每两个月"]) {
        const output = plugin.refresh(customDay("2026-11-27", today, value));
        assert.ok(tickets(output)[0].group.some(node => node.text?.includes("重复格式有误")), value);
    }
});

test("纪念日保留累计天数并在副标题显示下一期", () => {
    const input = customDay("2026-11-28", "2026-11-29", "每2周", "anniversary");
    const [day] = plugin.computeState(input).own;
    assert.equal(day.days, 1);
    assert.ok(tickets(plugin.refresh(input))[0].group.some(node => node.text?.includes("下次 12.12")));

    const due = plugin.refresh(customDay("2026-11-28", "2026-12-12", "每2周", "anniversary"));
    assert.match(caption(due), /^14天了 · /);
    assert.ok(tickets(due)[0].group.some(node => node.text === "14"));
    assert.ok(tickets(due)[0].group.some(node => node.text?.includes("今天 · 每2周")));
});

test("四位天数按宽度缩字，常驻窄位优先保留完整计数", () => {
    const base = "2022-01-01";
    const today = new Date(Date.parse(base) + 1700 * 86400000).toISOString().slice(0, 10);
    const output = plugin.refresh(customDay(base, today, "不重复", "anniversary"));
    const sheet = output.canvas.nodes.find(node => node.id?.startsWith("paper-")).group;
    assert.ok(sheet.find(node => node.text === "1700")?.size < 62);
    assert.ok(tickets(output)[0].group.find(node => node.text === "1700")?.size < 14);
    const main = output.pinned.canvas.nodes.find(node => node.text === "1700天了");
    assert.ok(main && main.at[0] + main.max_width <= 46 && !main.loop);
    const secondary = output.pinned.canvas.nodes.find(node => node.group);
    assert.ok(secondary?.group.some(node => node.loop?.kind === "flow"));
});

test("农历支持按年、指定年份和闰月，列表同时显示对应公历", () => {
    const lunarData = {...data, "lunar-calendar.json": JSON.parse(read("../lunar-calendar.json"))};
    for (const [rule, now, expected] of [
        ["农历1-1", "2026-02-17", "2026-02-17"],
        ["农历1-1", "2026-02-18", "2027-02-06"],
        ["农历2027-1-30", "2027-03-06", "2027-03-07"],
        ["农历3-30", "2027-05-04", "2027-05-05"],
        ["农历2026-8-15", "2026-09-01", "2026-09-25"],
        ["农历2025-闰6-1", "2025-07-24", "2025-07-25"],
        ["农历闰6-1", "2026-07-01", "2026-07-14"],
    ]) {
        const scenario = {...customDay("2020-01-01", now, rule, "birthday"), data: lunarData};
        const [day] = plugin.computeState(scenario).own;
        assert.equal(day.dateLabel, expected, rule);
        assert.ok(tickets(plugin.refresh(scenario))[0].group.some(node =>
            node.text?.includes("农历") && node.text.includes(expected.slice(5).replace("-", "."))));
        assert.equal(Boolean(plugin.refresh(scenario).notice), now === expected);
    }
});

test("无效农历不回退到公历提醒，指定农历原日可累计纪念天数", () => {
    const lunarData = {...data, "lunar-calendar.json": JSON.parse(read("../lunar-calendar.json"))};
    const invalid = {...customDay("2026-11-28", "2026-11-28", "农历2026-闰6-1", "birthday"), data: lunarData};
    assert.equal(plugin.refresh(invalid).notice, undefined);
    assert.ok(tickets(plugin.refresh(invalid))[0].group.some(node => node.text?.includes("农历日期有误")));
    const shortMonth = {...customDay("2027-05-01", "2027-05-04", "农历2027-3-30"), data: lunarData};
    assert.equal(plugin.computeState(shortMonth).own[0].date, null);

    const anniversary = {...customDay("2026-01-01", "2026-02-18", "农历2026-1-1 每年", "anniversary"), data: lunarData};
    const [day] = plugin.computeState(anniversary).own;
    assert.equal(day.days, 1);
    assert.equal(day.dateLabel, "2026-02-17");
    assert.ok(tickets(plugin.refresh(anniversary))[0].group.some(node => node.text?.includes("02.06")));
});

test("发薪日遇休提前或顺延，调休上班按工作日计算", () => {
    for (const [kind, base, today, expected] of [
        ["payday", "2027-01-06", "2027-02-01", "2027-02-06"],
        ["payday-early", "2027-01-06", "2027-02-04", "2027-02-04"],
        ["payday-late", "2027-01-06", "2027-02-06", "2027-02-14"],
        ["payday-late", "2027-01-06", "2027-02-14", "2027-02-14"],
        ["payday-late", "2026-12-31", "2027-02-01", "2027-03-01"],
        ["payday-late", "2026-12-31", "2027-03-01", "2027-03-01"],
        ["payday-early", "2027-01-01", "2026-12-31", "2026-12-31"],
        ["payday-late", "2027-01-31", "2027-01-31", "2027-01-31"],
        ["payday-late", "2027-01-06", "2027-02-15", "2027-03-08"],
    ]) {
        const scenario = customDay(base, today, "默认", kind);
        const [day] = plugin.computeState(scenario).own;
        assert.equal(day.dateLabel, expected, `${kind} ${today}`);
    }
});

test("发薪日缺少下一年假期安排时保留原日期并提示待确认", () => {
    const scenario = customDay("2027-12-01", "2027-12-31", "默认", "payday-late");
    const [day] = plugin.computeState(scenario).own;
    assert.equal(day.dateLabel, "2028-01-01");
    assert.ok(tickets(plugin.refresh(scenario))[0].group.some(node => node.text?.includes("假期待公布")));
});

test("恢复最近即使筛选隐藏目标车票，也显示常驻反馈", () => {
    const current = input("design");
    const first = plugin.refresh(current);
    assert.match(caption(first), /元旦/);
    const birthday = tickets(first).find(row => row.group.some(node => node.text === "小唐生日"));
    const chosen = plugin.action({...current, storage: first.storage, action: {id: birthday.hit.action}});
    assert.match(caption(chosen), /^\d+天 · 小唐生日$/);
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
