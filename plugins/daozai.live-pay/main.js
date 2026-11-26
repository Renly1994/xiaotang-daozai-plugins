const DAY = 86400;
const HOUR = 3600;

function parseTime(text) {
    if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(text)) return NaN;
    const [hour, minute] = text.split(":").map(Number);
    return hour * HOUR + minute * 60;
}

function weekday(day) {
    return new Date(day * 1000).getUTCDay() || 7;
}

function calendarDay(year, month, day) {
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return Date.UTC(year, month, Math.min(day, last)) / 1000;
}

function workdaysInCycle(day, workdays, settings) {
    const date = new Date(day * 1000);
    const year = date.getUTCFullYear();
    let month = date.getUTCMonth();
    const custom = settings.payroll_cycle === "custom";
    const startDay = custom ? Math.round(Number(settings.cycle_start)) : 1;
    const endDay = custom ? Math.round(Number(settings.cycle_end)) : 31;
    if (day < calendarDay(year, month, startDay)) month--;
    const first = calendarDay(year, month, startDay);
    const endMonth = month + (endDay < startDay ? 1 : 0);
    // 短月把起止日收至月末，两期重合的那一天归新一期。
    const last = Math.min(calendarDay(year, endMonth, endDay), calendarDay(year, month + 1, startDay) - DAY);
    if (day > last) return 0;

    let count = 0;
    for (let cursor = first; cursor <= last; cursor += DAY) {
        if (workdays.includes(weekday(cursor))) count++;
    }
    return count;
}

function paydayFor(today, day) {
    if (!day) return;
    const local = new Date(today * 1000);
    const year = local.getUTCFullYear();
    const month = local.getUTCMonth();
    let target = calendarDay(year, month, day);
    if (target < today) target = calendarDay(year, month + 1, day);
    const date = new Date(target * 1000);
    const days = (target - today) / DAY;
    return {
        dateLabel: `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`,
        countdown: days === 0 ? "今天发薪" : `还有 ${days} 天`
    };
}

function parseBreaks(rows, start, end) {
    const toShiftTime = value => value < start && end >= DAY ? value + DAY : value;
    const breaks = rows.map(row => ({
        from: toShiftTime(parseTime(row.from)),
        to: toShiftTime(parseTime(row.to)),
        paid: row.paid === "true"
    })).sort((a, b) => a.from - b.from);
    const valid = breaks.every(({from, to}, index) =>
        from >= start && from < to && to <= end && (!index || from >= breaks[index - 1].to));
    return valid ? breaks : null;
}

function paidSeconds(from, to, unpaid) {
    const deduction = unpaid.reduce((total, period) =>
        total + Math.max(0, Math.min(to, period.to) - Math.max(from, period.from)), 0);
    return to - from - deduction;
}

function computeState({settings, storage, now, tz}) {
    const lastNotice = typeof storage?.last_notice === "string" ? storage.last_notice : undefined;
    const seconds = Math.floor(now / 1000);
    const offset = tz.offset_minutes * 60;
    const today = Math.floor((seconds + offset) / DAY) * DAY;
    const payday = paydayFor(today, Math.round(Number(settings.payday)));
    const common = {lastNotice, pinnedShow: settings.pinned_show, payday};
    const nextDay = today + DAY - offset;
    const salary = Number(settings.salary);
    if (!(salary > 0)) return {...common, phase: "setup", summary: "请在插件设置中填写月薪"};

    const start = parseTime(settings.start);
    const closing = parseTime(settings.end);
    if (!Number.isFinite(start + closing) || start === closing) {
        return {...common, phase: "invalid", summary: "请设置不同的上班与下班时间"};
    }
    const end = closing < start ? closing + DAY : closing;
    const breaks = parseBreaks(JSON.parse(settings.breaks), start, end);
    if (!breaks) {
        return {...common, phase: "invalid", summary: "请检查插件设置中的休息时段，休息须在班次内且不能重叠"};
    }
    const unpaid = breaks.filter(period => !period.paid);
    const payable = paidSeconds(start, end, unpaid);
    if (payable <= 0) return {...common, phase: "invalid", summary: "每个班次至少需要一段计薪时间"};

    const workdays = settings.days ? settings.days.split(",").map(Number) : [];
    if (workdays.length === 0) return {...common, phase: "invalid", summary: "请在插件设置中选择工作日"};

    // 跨午夜的班次按上班日确定计薪周期。
    const wallSeconds = seconds + offset - today;
    const todayWorks = workdays.includes(weekday(today));
    const yesterdayWorks = workdays.includes(weekday(today - DAY));
    const priorShift = end >= DAY && yesterdayWorks && (!todayWorks || wallSeconds < start);
    const shiftDay = priorShift ? today - DAY : today;
    const shiftOrigin = shiftDay - offset;
    const shiftSeconds = seconds - shiftOrigin;
    const elapsed = Math.min(end, Math.max(start, shiftSeconds));
    const scheduled = priorShift || todayWorks;
    const active = scheduled && shiftSeconds >= start && shiftSeconds < end;
    const done = scheduled && shiftSeconds >= end;
    const rest = active ? breaks.find(period => period.from <= shiftSeconds && shiftSeconds < period.to) : undefined;
    const phase = rest ? (rest.paid ? "paid-break" : "unpaid-break")
        : active ? "working" : done ? "done" : todayWorks ? "before" : "day-off";

    let upcoming = 0;
    while (!workdays.includes(weekday(today + upcoming * DAY)) ||
        today + upcoming * DAY + start <= seconds + offset) {
        upcoming++;
    }
    const nextStart = today + upcoming * DAY + start - offset;
    const shiftsPerCycle = workdaysInCycle(shiftDay, workdays, settings);
    const daily = shiftsPerCycle ? salary / shiftsPerCycle : 0;
    const rate = daily / payable;
    const earned = scheduled ? (done ? daily : rate * paidSeconds(start, elapsed, unpaid)) : 0;
    const level = Math.min(Math.ceil((end - start) / HOUR), Math.floor((elapsed - start) / HOUR) + 1);
    const hourStart = start + (level - 1) * HOUR;
    const hourEarned = rate * paidSeconds(hourStart, elapsed, unpaid);
    const shiftBoundary = active
        ? (breaks.flatMap(period => [period.from, period.to]).find(time => time > shiftSeconds) ?? end) + shiftOrigin
        : Math.min(nextStart, nextDay);
    const nextBoundary = payday ? Math.min(shiftBoundary, nextDay) : shiftBoundary;
    const shiftEnd = shiftOrigin + end;
    const shiftDate = new Date(shiftDay * 1000).toISOString().slice(0, 10);
    const noticeId = `off-${shiftDate}`;
    // 开启或唤醒时也允许补发刚错过的下班提醒，避免隔很久再提示。
    const notice = done && seconds - shiftEnd < 120 && lastNotice !== noticeId
        ? {id: noticeId, title: "下班啦"} : undefined;
    return {
        ...common, phase, seconds, active, done, rest, daily, shiftsPerCycle, payable,
        rate, earned, level, hourEarned, progress: 100 * (elapsed - start) / (end - start),
        shiftStart: shiftOrigin + start, shiftEnd, shiftOrigin, shiftDate, offset,
        breaks, nextStart, nextBoundary,
        notice, lastNotice: notice?.id ?? lastNotice
    };
}

function money(value) {
    return `¥${value.toFixed(2)}`;
}

function counterFor(state) {
    return {
        start_value: state.earned, start_at: state.seconds, decimals: 2,
        per_second: state.active && state.phase !== "unpaid-break" ? state.rate : 0,
        until: state.active ? state.nextBoundary : undefined
    };
}

function countdownFor(state) {
    return state.active
        ? {target_at: state.shiftEnd, format: "HH:mm:ss"}
        : {target_at: state.nextStart, format: "d天 HH:mm"};
}

const GREEN = "#3DDC84";
const ORANGE = "#FFB547";
const DARK_GREEN = "#10261A";
const PAYDAY_ACCENT = "#D7C7FF";
const TRACK_START = 38;
const TRACK_WIDTH = 315;
const TRACK_TOP = 126;

function text(value, x, y, size, fill = "$text", extra = {}) {
    return {text: value, at: [x, y], size, fill, ...extra};
}

function rect(x, y, width, height, fill, r = 0, extra = {}) {
    return {rect: [x, y, width, height], fill, r, ...extra};
}

function flag(x, y, size = 1) {
    return {translate: [x, y], scale: size, group: [
        {line: [0, 0, 0, 15], stroke: "$text", width: 1.5, cap: "round"},
        {path: "M1 0 H12 L9 4 L12 8 H1 Z", fill: GREEN}
    ]};
}

function clock(seconds) {
    const time = (seconds + DAY) % DAY;
    return `${String(Math.floor(time / HOUR)).padStart(2, "0")}:${String(Math.floor(time / 60) % 60).padStart(2, "0")}`;
}

function meter(counter) {
    const size = 28;
    const digitWidth = 30;
    const gap = 4;
    const decimalWidth = 12;
    const currencyWidth = 26;
    // 宿主默认粗体在此字号的数字等宽，小数点占半个数字。
    const digitAdvance = 16;
    const decimalAdvance = 8;
    const beforeRefresh = Math.min(60, counter.until - counter.start_at);
    const count = (counter.start_value + counter.per_second * beforeRefresh).toFixed(2).indexOf(".");
    const width = currencyWidth + (count + 2) * (digitWidth + gap) - gap + decimalWidth;
    const left = (387 - width) / 2;
    const nodes = [text("¥", left + 9, 72, 22, GREEN, {align: "center", weight: 800})];
    let x = left + currencyWidth;
    for (let i = 0; i < count + 2; i++) {
        if (i === count) {
            nodes.push(text(".", x + (decimalWidth - gap) / 2, 76, 26, "$dim", {align: "center", weight: 800}));
            x += decimalWidth;
        }
        const center = x + digitWidth / 2;
        const place = count + 1 - i;
        const offset = (place + 0.5) * digitAdvance + (i < count ? decimalAdvance : 0);
        nodes.push(
            rect(x, 42, digitWidth, 44, "$card", 8, {stroke: "$track", width: 1}),
            {
                clip: [center - digitAdvance / 2, 42, digitAdvance, 44],
                group: [text("{cash}", center + offset, 74, size, place === 0 ? GREEN : "$text", {
                    id: `meter-${place}`, align: "right", weight: 800, roll: true
                })]
            },
            {line: [x + 1, 64, x + digitWidth - 1, 64], stroke: "$bg", opacity: 0.4}
        );
        x += digitWidth + gap;
    }
    return nodes;
}

function track(state, top = TRACK_TOP) {
    const duration = state.shiftEnd - state.shiftStart;
    const at = seconds => TRACK_START + (seconds - state.shiftStart) * TRACK_WIDTH / duration;
    const border = state.rest ? ORANGE : GREEN;
    const progress = (from, to) => ({bind: "worked", map: [from, to]});
    const nodes = [
        rect(0, top + 1, 31, 14, border, 4),
        text(`LV.${state.level}`, 15.5, top + 11, 9.5, "#112118", {align: "center", weight: 800}),
        rect(TRACK_START, top, TRACK_WIDTH, 16, "$track", 8),
        rect(TRACK_START, top, progress(0, TRACK_WIDTH), 16, border, 8, {
            glow: border,
            ...(state.active ? {loop: {kind: "flow", period_ms: 1400}} : {})
        })
    ];
    for (const rest of state.breaks) {
        const x = at(state.shiftOrigin + rest.from);
        const end = at(state.shiftOrigin + rest.to);
        const stripe = [];
        for (let i = -16; i < end - x; i += 8) {
            stripe.push({line: [x + i, top + 16, x + i + 12, top], stroke: "#FFB54742", width: 2.0});
        }
        nodes.push({clip: [x, top, end - x, 16], group: [
            rect(x, top, end - x, 16, state.rest === rest ? "#FFB54722" : "#705020", 3),
            ...stripe
        ]});
    }
    for (let hour = HOUR; hour < duration; hour += HOUR) {
        const x = at(state.shiftStart + hour);
        nodes.push({line: [x, top + 3, x, top + 13], stroke: "#10101380", width: 1});
    }
    nodes.push(
        flag(TRACK_START + TRACK_WIDTH - 2, top - 18),
        text("{percent}%", 387, top + 12, 10.5, border, {align: "right", weight: 700}),
        text(clock(state.shiftStart + state.offset), TRACK_START, top + 32, 9, "$dim"),
        text(`${clock(state.shiftEnd + state.offset)} 通关`, TRACK_START + TRACK_WIDTH, top + 32, 9, "$dim", {align: "right"}),
        {
            pet: {
                id: "runner",
                at: [progress(TRACK_START + 4, TRACK_START + TRACK_WIDTH - 9), top - 1],
                size: 26,
                mood: state.done ? "praised" : state.rest ? "sleeping" : "expressions",
                motion: state.done ? "bob" : state.rest ? "none" : "run"
            }
        }
    );
    if (state.rest) {
        nodes.push(text("Zz", progress(TRACK_START + 18, TRACK_START + TRACK_WIDTH + 1), top - 15, 11, ORANGE, {
            weight: 800, loop: {kind: "pulse", period_ms: 1200}
        }));
    }
    const restLabel = state.rest ?? state.breaks[0];
    if (restLabel) {
        nodes.push(text(`休息 ${clock(restLabel.from)}–${clock(restLabel.to)}`, 135, top + 32, 9, ORANGE, {align: "center"}));
    }
    if (state.active) {
        nodes.push(text("{local}", 244, top + 32, 9, "$text", {align: "center"}));
    }
    return nodes;
}

function calendarIcon(x, y) {
    return {translate: [x, y], group: [
        rect(0, 2, 11, 9, "#00000000", 2, {stroke: PAYDAY_ACCENT, width: 1}),
        {line: [0, 5, 11, 5], stroke: PAYDAY_ACCENT, width: 1},
        {line: [3, 0, 3, 3], stroke: PAYDAY_ACCENT, width: 1},
        {line: [8, 0, 8, 3], stroke: PAYDAY_ACCENT, width: 1}
    ]};
}

function paydayRow(payday) {
    if (!payday) return [];
    return [
        rect(0, 172, 387, 27, "#171322", 8, {stroke: "#2C2640", width: 1}),
        calendarIcon(8, 180),
        text("发薪日", 26, 189, 11, "#E3DBEE"),
        text(payday.dateLabel, 65, 189, 11, "#BDB3CF"),
        text(payday.countdown, 378, 189, 11.5, PAYDAY_ACCENT, {align: "right", weight: 800})
    ];
}

function toCanvas(state) {
    const height = 200;
    const payday = paydayRow(state.payday);
    if (state.summary) {
        return {height, nodes: [
            rect(0, 18, 387, 141, "$card", 12),
            text(state.phase === "setup" ? "填写月薪" : "检查设置", 20, 59, 22, "$text", {weight: 800}),
            text(state.summary, 20, 96, 13, "$muted", {max_width: 340, lines: 2}),
            ...payday
        ]};
    }
    const remaining = {countdown: countdownFor(state)};
    if (!state.active && !state.done) {
        return {height, binds: {remaining}, nodes: [
            rect(0, 22, 387, 140, "$card", 12),
            text(state.phase === "day-off" ? "今天不打怪" : "还没上班", 193.5, 64, 22, "$text", {weight: 800, align: "center"}),
            text("距离上班", 193.5, 97, 12, "$muted", {align: "center"}),
            text("{remaining}", 193.5, 134, 26, GREEN, {weight: 800, align: "center"}),
            ...payday
        ]};
    }
    const binds = {
        cash: {counter: counterFor(state)},
        remaining,
        worked: {progress: [state.shiftStart, state.shiftEnd]},
        percent: {counter: {
            start_value: 0, per_second: 100 / (state.shiftEnd - state.shiftStart),
            start_at: state.shiftStart, until: state.shiftEnd, decimals: 0
        }},
        local: {now: "HH:mm"}
    };
    if (state.done) {
        const center = 193.5;
        return {height, binds, nodes: [
            // 全角叹号右侧有留白，补偿字形后再与下方金额对齐。
            text("通关！", center + 8, 37, 24, GREEN, {weight: 800, align: "center"}),
            text(state.shiftsPerCycle ? "今天到手" : "今天不在计薪周期", center, 62, 12, "$muted", {align: "center"}),
            text("¥{cash}", center, 102, 33, "$text", {weight: 800, align: "center"}),
            ...track(state),
            {id: `finish-${state.shiftDate}`, circle: [315, 92, 1], fill: GREEN, burst: "confetti"},
            ...payday
        ]};
    }
    const gain = counterFor(state);
    const nextHour = Math.min(state.shiftEnd, state.shiftStart + state.level * HOUR);
    binds.thisHour = {counter: {...gain, start_value: state.hourEarned, until: Math.min(gain.until, nextHour)}};
    const trackTop = payday.length ? 106 : TRACK_TOP;
    const footerTop = payday.length ? 143 : 170;
    const footerBaseline = footerTop + 17;
    const rateLabel = !state.shiftsPerCycle ? "今天不在计薪周期"
        : state.phase === "unpaid-break" ? "暂停计薪" : `每秒 +¥${state.rate.toFixed(4)}`;
    return {height, binds, nodes: [
        text(state.rest ? "休息中 · 回血" : "今天已赚", 0, 23, 11.5, state.rest ? ORANGE : "$muted", {weight: 700}),
        text(rateLabel, 387, 23, 11, state.rest ? ORANGE : GREEN, {align: "right"}),
        ...meter(gain),
        ...track(state, trackTop),
        text(`第 ${state.level} 小时 · 本小时已赚`, 0, footerBaseline, 11, "$muted"),
        text("¥{thisHour}", 128, footerBaseline, 11, "$text", {weight: 700}),
        rect(247, footerTop, 140, 26, DARK_GREEN, 7),
        text("距离通关", 258, footerBaseline, 11, GREEN),
        text("{remaining}", 375, footerBaseline, 12, GREEN, {align: "right", weight: 800}),
        ...payday
    ]};
}

function toPinned(state) {
    if (state.pinnedShow === "payday") {
        if (!state.payday) return;
        return {canvas: {width: 129, fit_width: true, height: 22, nodes: [
            calendarIcon(5, 5),
            text("发薪", 22, 16, 11.5, "$muted"),
            text(state.payday.countdown, 52, 16, 12, PAYDAY_ACCENT, {max_width: 75, weight: 800})
        ]}};
    }
    if (state.summary) return;
    const amount = {width: 110, fit_width: true, height: 22, binds: {cash: {counter: counterFor(state)}}, nodes: [
        {circle: [10, 11, 7.5], fill: GREEN},
        text("¥", 10, 15, 10.5, "#112118", {align: "center", weight: 800}),
        text("{cash}", 25, 16, 12, "$text", {max_width: 83, roll: true, weight: 800})
    ]};
    const countdown = {width: 144, fit_width: true, height: 22, binds: {remaining: {countdown: countdownFor(state)}}, nodes: [
        flag(5, 5, 0.85),
        text(state.active ? "下班" : "上班", 22, 16, 11.5, "$muted"),
        text("{remaining}", 52, 16, 12, "$text", {max_width: 91, weight: 800})
    ]};
    return {canvas: state.pinnedShow === "alternate" ? [amount, countdown] : state.pinnedShow === "countdown" ? countdown : amount};
}

function refresh(input) {
    const state = computeState(input);
    return {
        canvas: toCanvas(state), pinned: toPinned(state), notice: state.notice,
        storage: state.lastNotice ? {last_notice: state.lastNotice} : null,
        next_refresh_at: state.nextBoundary
    };
}
