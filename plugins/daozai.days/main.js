const DAY = 86400000;
const FILTERS = ["all", "holidays", "mine"];
const REMINDER_INTERVAL = 61000;
const DEFAULT_COLORS = { countdown: "red", birthday: "orange", anniversary: "purple", holiday: "red" };
const DEFAULT_ICONS = { countdown: "flag", birthday: "cake", anniversary: "heart", holiday: "calendar" };
const HOLIDAY_COLORS = { "元旦": "red", "春节": "red", "清明节": "green", "劳动节": "blue",
    "端午节": "teal", "中秋节": "orange", "国庆节": "red" };
const COLORS = {
    red: ["#FFB4A8", "#3A1410", "#FF806F"], orange: ["#FFD9A0", "#3A2410", "#FFB25F"],
    yellow: ["#F8E49C", "#3C3010", "#F6D36F"], green: ["#B5E3C8", "#0F2E1C", "#A7DD97"],
    teal: ["#97E1D8", "#13342F", "#77D6C9"], blue: ["#B9D8FF", "#172A45", "#8AB7FF"],
    purple: ["#C9B8FF", "#1E1440", "#BDACF5"], pink: ["#F2BEDE", "#431832", "#FF9CC6"]
};
const ICONS = ["heart", "cake", "ring", "plane", "star", "gift", "flag", "calendar", "coffee", "coin", "sun", "moon"];
const NEAREST = "最近的那一天";

function dateText(day) {
    const date = new Date(day * DAY);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const monthDay = date.getUTCDate();
    return ("0000" + year).slice(-4) + "-" + (month < 10 ? "0" : "") + month
        + "-" + (monthDay < 10 ? "0" : "") + monthDay;
}

function weekday(day) {
    return "星期" + "日一二三四五六"[((day + 4) % 7 + 7) % 7];
}

function dayOfMonth(year, month, day) {
    const date = new Date(0);
    date.setUTCFullYear(year, month, 0);
    return date.setUTCDate(Math.min(day, date.getUTCDate())) / DAY;
}

function repeatRule(value, birthday) {
    let rule = (value ?? "默认").trim();
    if (rule === "默认" || rule === "false" || !rule) rule = birthday ? "每年" : "不重复";
    if (rule === "true") rule = "每年";
    if (rule === "monthly") rule = "每月";
    if (rule === "不重复" || rule === "0") return null;
    const match = /^每\s*(?:(\d{1,3})\s*)?(天|周|个?月|年)$/.exec(rule);
    if (!match) return undefined;
    const count = Number(match[1] ?? 1);
    if (count > 100) return undefined;
    if (count === 0) return null;
    const unit = match[2].slice(-1);
    const label = count === 1 ? "每" + unit : `每${count}${unit === "月" ? "个月" : unit}`;
    return { count, unit, label };
}

function nextDate(iso, base, today, year, month, rule) {
    if (!rule || today <= base) return base;
    const { count, unit } = rule;
    if (unit === "天" || unit === "周") {
        const step = count * (unit === "周" ? 7 : 1);
        return base + Math.ceil((today - base) / step) * step;
    }
    const startYear = Number(iso.slice(0, 4));
    const startMonth = Number(iso.slice(5, 7));
    const startDay = Number(iso.slice(8));
    const step = count * (unit === "年" ? 12 : 1);
    const elapsed = (year - startYear) * 12 + month - startMonth;
    const targetMonth = startMonth + Math.floor(elapsed / step) * step;
    const candidate = dayOfMonth(startYear, targetMonth, startDay);
    return candidate >= today ? candidate : dayOfMonth(startYear, targetMonth + step, startDay);
}

function settingRows(settings, key) {
    return ["", "_2", "_3"].flatMap(suffix => JSON.parse(settings[key + suffix] || "[]"));
}

function singleLine(value) {
    let result = "";
    for (const char of value) {
        const code = char.charCodeAt(0);
        result += code < 32 || (code >= 127 && code <= 159) ? " " : char;
    }
    return result.trim();
}

function ownDays(settings, today, year, month) {
    const options = new Map(settingRows(settings, "day_options").map(row => [singleLine(row.name), row]));
    return settingRows(settings, "days").slice(0, 20).map(row => {
        const settingName = singleLine(row.name);
        const name = [...settingName].slice(0, 12).join("") || "新日子";
        const extra = options.get(settingName) || {};
        const repeat = repeatRule(row.yearly ?? extra.yearly, row.kind === "birthday");
        const base = Date.parse(row.date) / DAY;
        const date = nextDate(row.date, base, today, year, month, repeat);
        const since = row.kind === "anniversary" && today >= base;
        const days = since ? today - base : date - today;
        const defaults = row.icon === "flag" && row.color === "red";
        const icon = !defaults && ICONS.includes(row.icon) ? row.icon : DEFAULT_ICONS[row.kind];
        const color = !defaults && Object.hasOwn(COLORS, row.color) ? row.color : DEFAULT_COLORS[row.kind];
        const template = row.pinned_text ?? extra.pinned_text ?? "";
        const displayDate = since ? base : date;
        const dateLabel = displayDate === base ? row.date : dateText(displayDate);
        return {
            name, settingName, kind: row.kind, repeat, date, displayDate, dateLabel, days, since,
            current: date === today,
            icon, color,
            template: [...singleLine(template === "默认" ? "" : template)].slice(0, 24).join(""),
            key: `${row.kind}:${row.date}:${settingName}`
        };
    });
}

function computeState(input) {
    const { settings = {}, storage, data, action } = input;
    const today = Date.parse(input.today) / DAY;
    const year = Number(input.today.slice(0, 4));
    const bundles = settings.show_holidays === "true" ? Object.values(data || {}) : [];
    const holidays = bundles.filter(bundle => !bundle.pending).flatMap(bundle =>
        bundle.holidays.map(([name, from, to]) => {
            const date = Date.parse(from) / DAY;
            const end = Date.parse(to) / DAY;
            const current = date <= today && today <= end;
            return {
                name, date, displayDate: date, dateLabel: from, end, days: current ? 0 : date - today, current,
                kind: "holiday", length: end - date + 1, key: "holiday:" + from + ":" + name,
                icon: DEFAULT_ICONS.holiday, color: HOLIDAY_COLORS[name] || DEFAULT_COLORS.holiday
            };
        })
    );
    const makeup = bundles.filter(bundle => !bundle.pending).flatMap(bundle => bundle.makeup);
    const weekdayIndex = (new Date(today * DAY).getUTCDay() + 6) % 7;
    const monday = today - weekdayIndex;
    const weekly = makeup.filter(date => Date.parse(date) / DAY >= monday && Date.parse(date) / DAY < monday + 7);
    const own = ownDays(settings, today, year, Number(input.today.slice(5, 7)));
    const days = [...holidays.filter(day => day.end >= today), ...own].sort((left, right) => left.date - right.date);
    days.forEach((day, index) => { day.pinAction = "pin-" + index; });
    const nearest = days.find(day => day.current) || days.find(day => day.date >= today)
        || days.findLast(day => day.since);
    const pinnedBase = singleLine(settings.pinned_day || NEAREST);
    const chosen = days.find(day => day.pinAction === action?.id);
    const savedKey = storage?.pinnedBase === pinnedBase ? storage.pinnedKey : undefined;
    const pinKey = action?.id === "pin-nearest" ? "" : chosen?.key ?? savedKey;
    const pinned = days.find(day => day.key === pinKey)
        || (pinKey === "" || pinnedBase === NEAREST ? undefined : days.find(day => (day.settingName || day.name) === pinnedBase))
        || nearest;
    const requested = action?.id?.startsWith("filter-") ? action.id.slice("filter-".length) : undefined;
    const filter = FILTERS.includes(requested) ? requested : FILTERS.includes(storage?.filter) ? storage.filter : "all";
    const visible = days.filter(day => filter === "all" || (day.kind === "holiday") === (filter === "holidays"));
    const activeHoliday = holidays.find(day => day.current);
    const currentOwn = own.find(day => day.current);
    const marker = activeHoliday ? `${activeHoliday.name} · 休` : makeup.includes(input.today) ? "班" : currentOwn?.name;
    const pending = bundles.find(bundle => bundle.pending && bundle.year >= year)?.year;
    return {today, year, own, days, filter, visible, nearest, pinned, pinnedBase, pinKey, weekly, marker, pending, storage};
}

function text(value, x, y, size, options = {}) {
    return { text: value, at: [x, y], size, ...options };
}

function textUnits(value) {
    return [...value].reduce((units, char) => units + (char >= "0" && char <= "9" ? 0.67 : 1), 0);
}

function fitSize(value, width, preferred) {
    return Math.max(6, Math.min(preferred, Math.floor(width / textUnits(value))));
}

function displayToday(day) {
    return day.current && (!day.since || day.days === 0);
}

function expandTemplate(template, replacements) {
    const segments = template.split("{");
    let result = segments[0];
    for (const segment of segments.slice(1)) {
        const end = segment.indexOf("}");
        const field = end < 0 ? undefined : replacements[segment.slice(0, end)];
        result += typeof field === "string" ? field + segment.slice(end + 1) : "{" + segment;
    }
    return result;
}

function toPinned({ pinned }) {
    if (!pinned) return;
    const today = displayToday(pinned);
    const [, , accent] = COLORS[pinned.color];
    if (pinned.template && !today) {
        const expanded = expandTemplate(pinned.template, {
            名称: pinned.name, 天数: String(pinned.days), 日期: pinned.dateLabel, 星期: weekday(pinned.displayDate)
        });
        const caption = [...expanded].slice(0, 24).join("");
        return { canvas: { width: 156, fit_width: true, nodes: [
            { icon: pinned.icon, rect: [2, 4, 14, 14], stroke: accent, width: 1.15, cap: "round" },
            text(caption, 21, 15, [...caption].length > 16 ? 9 : 11, { max_width: 135, fill: "$text", weight: 700 })
        ] } };
    }
    const value = today ? "今天" : pinned.days < 0 ? "已到期" : `${pinned.days}${pinned.since ? "天了" : "天"}`;
    const size = fitSize(value, 43, 11);
    const iconX = Math.ceil(textUnits(value) * size) + 6;
    const nameX = iconX + 16;
    const name = " · " + pinned.name;
    const width = Math.min(156, nameX + Math.ceil(textUnits(name) * 11));
    return { canvas: { width, fit_width: true, nodes: [
        { icon: pinned.icon, rect: [iconX, 4, 14, 14], stroke: accent, width: 1.15, cap: "round" },
        text(value, 2, 15, size, { max_width: 43, fill: "$text", weight: 700 }),
        { clip: [nameX, 0, width - nameX, 22], group: [
            text(name, nameX, 15, 11, { max_width: width - nameX, fill: "$text",
                loop: { kind: "flow", period_ms: 4800 } })
        ] }
    ] } };
}

function dateColumn(day) {
    let date = day.dateLabel.slice(5).replace("-", ".");
    if (day.since) {
        date = day.repeat
            ? day.current ? "今天" : "下次 " + dateText(day.date).slice(5).replace("-", ".")
            : day.dateLabel.replaceAll("-", ".") + " 起";
    }
    const rule = day.repeat === undefined && day.kind !== "holiday" ? "重复格式有误" : day.repeat?.label;
    return [date, day.length ? "放假 " + day.length + " 天" : rule].filter(Boolean).join(" · ");
}

function sheet(day, dayNumber, retiring = false) {
    const nodes = [
        { rect: [0, 0, 146, 184], r: 10, fill: "#FBF8F1", shadow: "md" },
        { rect: [0, 0, 146, 34], r: [10, 10, 0, 0], fill: "#E8473B" },
        { rect: [33, 0, 7, 8], r: [0, 0, 3, 3], fill: "$bg" },
        { rect: [106, 0, 7, 8], r: [0, 0, 3, 3], fill: "$bg" }
    ];
    if (day) {
        const today = displayToday(day);
        const header = day.current || day.since || day.days < 0 ? day.name : "距 " + day.name;
        const number = today ? "今天" : day.days < 0 ? "已到期" : String(day.days);
        const word = today || day.days < 0 ? "" : day.since ? "天了" : "天";
        const size = fitSize(number, 132, today || day.days < 0 ? 39 : 62);
        nodes.push(
            text(header, 10, 24, 11, { weight: 700, fill: "#FFFFFF", max_width: day.length ? 84 : 128 }),
            text(number, 73, 114, size, { weight: 900, align: "center", max_width: 132, fill: "#E8473B" }),
            text(word, 73, 138, 11, { weight: 700, align: "center", fill: "#6B6355" }),
            { line: [0, 158, 146, 158], dash: [3, 3], width: 1, stroke: "#D2CBBC" },
            text((day.dateLabel || dateText(day.displayDate)).split("-").join("."), 10, 176, 10, { fill: "#6B6355" }),
            text("周" + weekday(day.displayDate).slice(-1), 136, 176, 10, { align: "right", fill: "#6B6355" })
        );
        if (day.length) {
            nodes.push(text("放假 " + day.length + " 天", 138, 24, 9.5, { align: "right", max_width: 54, fill: "#FFFFFFDD" }));
        }
    } else {
        nodes.push(
            text("日历", 10, 24, 11, { weight: 700, fill: "#FFFFFF" }),
            text("暂无倒数", 73, 107, 17, { weight: 700, align: "center", fill: "#6B6355" }),
            text("在设置中添加日子", 73, 129, 10.5, { align: "center", fill: "#6B6355" })
        );
    }
    return {
        id: "paper-" + dayNumber, group: nodes,
        animate: { ms: 540, ease: "linear" },
        ...(retiring ? { translate: [76, 39], rotate: 13, opacity: 0 } : {})
    };
}

function ticket(day, index, isPinned) {
    const [fill, ink] = COLORS[day.color];
    const shape = "M9 2H215Q222 2 222 9V12C219.24 12 217 14.24 217 17C217 19.76 219.24 22 222 22"
        + "V25Q222 32 215 32H9Q2 32 2 25V22C4.76 22 7 19.76 7 17C7 14.24 4.76 12 2 12V9Q2 2 9 2Z";
    // 凹形填色的外缘由描边平滑，留出列表裁切所需的余量。
    const stroke = day.current ? "#FFEF94" : isPinned ? "#FFFFFF" : fill;
    const badge = displayToday(day) || day.days < 0;
    const days = badge ? day.days < 0 ? "到期" : "今天" : String(day.days);
    const qualifier = badge ? "" : day.since ? "天了" : "天";
    return {
        id: "ticket-" + day.pinAction, translate: [0, index * 38], hit: { action: day.pinAction },
        hover: { lift: 1 }, animate: { ms: 160 },
        group: [
            { path: shape, fill, stroke, width: day.current || isPinned ? 1.7 : 1 },
            { icon: day.icon, rect: [10, 9, 13, 13], stroke: ink, width: 1.2, cap: "round" },
            text(day.name, 30, 14, 11, { weight: 700, max_width: 118, fill: ink }),
            text(dateColumn(day), 30, 25, 8.5, { max_width: 118, fill: ink, opacity: 0.74 }),
            { line: [158, 4, 158, 28], dash: [2, 2], width: 1, stroke: ink, opacity: 0.4 },
            text(days, badge ? 191 : 196, 21.5, fitSize(days, 34, 14), {
                align: badge ? "center" : "right", weight: 800, max_width: 34, fill: ink
            }),
            text(qualifier, 199, 21, 8, { fill: ink })
        ]
    };
}

function toCanvas(state) {
    const { today, days, own, weekly, visible, nearest, pinned, pinKey, filter, pending, storage } = state;
    const priorDay = storage?.paperDay;
    const retiring = Number.isInteger(priorDay) && priorDay === today - 1 && storage.paper;
    const nodes = [
        { rect: [6, 10, 144, 184], r: 10, fill: "#D9D4C8" },
        { rect: [3, 6, 144, 185], r: 10, fill: "#EAE5DA" },
        sheet(nearest, today)
    ];
    const tabs = [
        [0, 34, "全部"], [38, 56, "节假日 " + (days.length - own.length)], [98, 47, "我的 " + own.length]
    ];
    tabs.forEach(([left, width, label], index) => {
        const value = FILTERS[index];
        const selected = filter === value;
        const x = 163 + left;
        nodes.push(
            { rect: [x, 0, width, 19], r: 6, fill: selected ? "$text" : "$card",
                hover: selected ? undefined : { fill: "$track" }, hit: { action: "filter-" + value } },
            text(label, x + width / 2, 13, 9.5, {
                align: "center", weight: selected ? 700 : 400, fill: selected ? "$bg" : "$muted"
            })
        );
    });
    if (weekly.length) {
        const work = weekly.length === 1 ? "周" + weekday(Date.parse(weekly[0]) / DAY).slice(-1) + "调休上班"
            : "本周 " + weekly.length + " 天调休";
        nodes.push(text(work, 387, 13, 9, { align: "right", max_width: 76, fill: "#FFB07A" }));
    }
    if (pinKey || (pinKey === "" && nearest)) {
        const [x, y] = weekly.length ? [0, 186] : [316, 0];
        if (pinKey) {
            nodes.push({ rect: [x, y, 71, weekly.length ? 14 : 19], r: 6, fill: "$card",
                hover: { fill: "$track" }, hit: { action: "pin-nearest" } });
        }
        nodes.push(text(pinKey ? "恢复最近" : "常驻跟随最近",
            x + 35.5, y + (weekly.length ? 10.5 : 13), 9,
            { align: "center", fill: pinKey ? "$muted" : "$accent" }));
    }
    if (visible.length) {
        nodes.push({
            id: "tickets-" + filter, translate: [163, 24], clip: [0, 0, 224, 167],
            scroll: { axis: "y", content: visible.length * 38 - 6 },
            group: visible.map((day, index) => ticket(day, index, day.key === pinned?.key))
        });
        if (visible.length > 4) {
            nodes.push({
                rect: [163, 180, 224, 12],
                fill: { linear: [[163, 180], [163, 192]], stops: [[0, "#00000000"], [1, "$bg"]] }
            });
        }
    } else {
        nodes.push(text("这一组还没有日子", 275, 94, 11, { align: "center", fill: "$muted" }));
    }
    if (pending) {
        nodes.push(text(pending + " 年放假安排待公布", 387, 199, 8.5, { align: "right", fill: "$muted" }));
    }
    if (retiring) nodes.push(sheet(storage.paper, priorDay, true));
    return { height: 200, nodes };
}

function refresh(input) {
    const state = computeState(input);
    const { today, own, filter, nearest, pinnedBase, pinKey } = state;
    const previous = state.storage;
    const sent = new Set(previous?.reminderDay === input.today && Array.isArray(previous.sent)
        ? previous.sent : []);
    const candidates = new Map(own.filter(day => !sent.has(day.key) && (
        (day.kind === "birthday" && day.current) ||
        (day.kind === "anniversary" && day.days > 0 && day.days % 100 === 0)
    )).map(day => [day.key, day]));
    let lastReminderAt = previous?.lastReminderAt;
    let notice;
    if (candidates.size && (lastReminderAt === undefined || input.now >= lastReminderAt + REMINDER_INTERVAL)) {
        const due = candidates.values().next().value;
        sent.add(due.key);
        candidates.delete(due.key);
        lastReminderAt = input.now;
        notice = {
            id: `${input.today}:${due.key}`,
            title: due.kind === "birthday" ? `${due.name} 生日快乐` : `${due.name}已满 ${due.days} 天`
        };
    }
    const midnight = (today + 1) * 86400 - (input.tz?.offset_minutes ?? 0) * 60;
    const nextReminder = candidates.size ? Math.ceil((lastReminderAt + REMINDER_INTERVAL) / 1000) : midnight;
    return {
        marker: state.marker,
        pinned: toPinned(state),
        status: { state: nearest?.current ? "succeeded" : nearest ? "running" : "idle", label: "我的日子" },
        canvas: toCanvas(state),
        storage: { filter, pinnedBase, pinnedKey: pinKey, paper: nearest, paperDay: today,
            reminderDay: input.today, sent: [...sent], lastReminderAt },
        notice,
        next_refresh_at: Math.min(midnight, nextReminder)
    };
}

function action(input) {
    return refresh(input);
}
