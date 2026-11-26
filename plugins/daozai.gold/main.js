const HOUR = 3600;
const DAY = 24 * HOUR;
const MAX_AGE = 15 * 60;
const GRAMS_PER_TROY_OUNCE = 31.1034768;
const UNITS = {
    usd: { currency: "USD", unit: "troy_oz", symbol: "$", short: "$ / 盎司", suffix: "盎司" },
    cny: { currency: "CNY", unit: "gram", symbol: "¥", short: "¥ / 克", suffix: "克" }
};
const RANGES = { day: ["1日", DAY], week: ["1周", 7 * DAY], month: ["1月", 30 * DAY] };
const FADE = { ms: 240, ease: "linear" };

function readQuote(source, unit, now) {
    if (source?.status !== "ready") return null;
    let quote;
    try {
        quote = JSON.parse(source.text);
    } catch {
        return null;
    }
    const timestamp = Math.floor(Date.parse(quote?.price_as_of ?? quote?.data_state?.as_of ?? quote?.updated_at) / 1000);
    const generated = Math.floor(Date.parse(quote?.updated_at) / 1000);
    const price = quote?.xau?.price;
    if (quote?.data_state?.status !== "fresh" || quote.stale ||
        quote.xau?.currency !== UNITS[unit].currency || quote.xau?.unit !== UNITS[unit].unit ||
        !Number.isFinite(price) || price <= 0 || !Number.isFinite(generated) || Math.abs(now - generated) > 300 ||
        !Number.isFinite(timestamp) || timestamp > now + 60 || now - timestamp >= MAX_AGE) {
        return null;
    }
    return { at: timestamp, updatedAt: generated, price, fxStale: unit === "cny" && quote.fx_stale === true };
}

function tencentFields(rows, code, separator) {
    const prefix = `v_${code}="`;
    const row = rows.find(line => line.startsWith(prefix) && line.endsWith('"'));
    return row?.slice(prefix.length, -1).split(separator) ?? [];
}

function readTencent(source, now) {
    if (source?.status !== "ready" || typeof source.text !== "string") return {};
    const rows = source.text.split(";").map(line => line.trim());
    const gold = tencentFields(rows, "hf_XAU", ",");
    const price = Number(gold[0]);
    const at = Date.parse(`${gold[12]}T${gold[6]}+08:00`) / 1000;
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(at) || at > now + 60 || now - at >= MAX_AGE) {
        return {};
    }
    const usd = { at, updatedAt: at, price, source: "tencent" };
    const fx = tencentFields(rows, "whUSDCNY", "~");
    const rate = Number(fx[3]);
    const stamp = fx[5] ?? "";
    const date = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
    const time = `${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}`;
    const fxTime = Date.parse(`${date}T${time}+08:00`) / 1000;
    const cnyPrice = price * rate / GRAMS_PER_TROY_OUNCE;
    if (fx[2] !== "USDCNY" || stamp.length !== 14 || !Number.isFinite(cnyPrice) || cnyPrice <= 0
        || !Number.isFinite(fxTime) || fxTime > now + 60 || now - fxTime >= DAY) {
        return { usd };
    }
    return { usd, cny: { ...usd, price: cnyPrice, fxStale: now - fxTime >= MAX_AGE } };
}

function append(points, point, bucket) {
    const last = points[points.length - 1];
    const sameBucket = last && Math.floor(last.at / bucket) === Math.floor(point.at / bucket);
    return [...points.slice(sameBucket ? -48 : -47, sameBucket ? -1 : undefined), point];
}

function updateUnit(previous, quote, threshold, offset, unit) {
    const day = previous?.day ?? [];
    const last = day[day.length - 1];
    if (!quote || quote.at < (last?.at ?? 0)) return { quote: null, saved: previous };
    const { at, price, fxStale } = quote;
    const point = { at, price };
    const date = Math.floor((at + offset) / DAY);
    const oldSession = previous?.session;
    const session = oldSession?.date === date
        ? { ...oldSession, high: Math.max(oldSession.high, price), low: Math.min(oldSession.low, price) }
        : { date, start: last?.price ?? price, high: price, low: price };
    const newPoint = at > (last?.at ?? 0);
    const side = Math.sign(price - threshold);
    const prior = previous?.threshold;
    const thresholdState = threshold > 0
        ? { price: threshold, side: side || (prior?.price === threshold ? prior.side : 0), sent: prior?.price === threshold ? prior.sent : 0 }
        : null;
    let notice;
    if (thresholdState && prior?.price === threshold && newPoint && !fxStale
        && previous.source === quote.source && prior.side * side < 0) {
        const flag = side > 0 ? 1 : 2;
        if (!(prior.sent & flag)) {
            thresholdState.sent |= flag;
            const direction = side > 0 ? "up" : "down";
            notice = {
                id: `gold-${unit}-${threshold}-${direction}`,
                title: "现货金价",
                body: `金价${side > 0 ? "涨破" : "跌破"} ${UNITS[unit].symbol}${threshold}`
            };
        }
    }
    // 过期汇率报价可以展示，提醒跨线必须由连续的有效报价确认。
    const alertState = fxStale && thresholdState ? { ...thresholdState, side: 0 } : thresholdState;
    return {
        quote, notice,
        saved: {
            day: newPoint ? append(day, point, 1) : day,
            week: newPoint ? append(previous?.week ?? [], point, HOUR) : previous?.week ?? [],
            month: newPoint ? append(previous?.month ?? [], point, DAY) : previous?.month ?? [],
            session, threshold: alertState, source: quote.source
        }
    };
}

function choice(setting, values, previous, fallback) {
    const base = values.includes(setting) ? setting : fallback;
    return previous?.base === base && values.includes(previous.value) ? previous : { base, value: base };
}

function computeState(input) {
    const { settings = {}, storage, sources, action } = input;
    const now = Math.floor(input.now / 1000);
    const offset = (input.tz?.offset_minutes ?? 0) * 60;
    const unitKeys = Object.keys(UNITS);
    const rangeKeys = Object.keys(RANGES);
    const selection = {
        unit: choice(settings.unit, unitKeys, storage?.selection?.unit, "cny"),
        range: choice(settings.range, rangeKeys, storage?.selection?.range, "day")
    };
    const [control, requested] = (action?.id ?? "").split("-");
    if (control === "unit" && unitKeys.includes(requested)) {
        selection.unit = { ...selection.unit, value: requested };
    } else if (control === "range" && rangeKeys.includes(requested)) {
        selection.range = { ...selection.range, value: requested };
    }
    const unit = selection.unit.value;
    const range = selection.range.value;
    const other = unit === "usd" ? "cny" : "usd";
    const thresholds = {};
    const quotes = {};
    const tencent = readTencent(sources?.tencent, now);
    for (const key of unitKeys) {
        const numeric = Number(settings[`alert_${key}`]);
        thresholds[key] = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
        const previous = storage?.[key];
        const primary = readQuote(sources?.[key], key, now);
        const last = previous?.day?.at(-1)?.at ?? 0;
        const quote = primary && primary.at >= last ? primary : tencent[key];
        quotes[key] = updateUnit(previous, quote, thresholds[key], offset, key);
    }

    const quote = quotes[unit].quote;
    const history = quotes[unit].saved;
    const delta = quote ? quote.price - history.session.start : 0;
    const rising = settings.up_color === "green" ? "#58D791" : "#FF6B6B";
    const falling = settings.up_color === "green" ? "#FF6B6B" : "#58D791";
    const pending = [...(storage?.pending ?? []), quotes[unit].notice, quotes[other].notice].filter(Boolean);
    let lastNotice = storage?.lastNotice ?? 0;
    const notice = now - lastNotice >= 60 ? pending.shift() : undefined;
    if (notice) lastNotice = now;
    return {
        unit, range, other, quote, offset, threshold: thresholds[unit],
        otherQuote: quotes[other].quote,
        high: history?.session?.high, low: history?.session?.low,
        points: quote ? history[range].filter(point => point.at >= quote.at - RANGES[range][1]) : [],
        delta, percent: delta ? delta / history.session.start * 100 : 0,
        deltaColor: delta > 0 ? rising : delta < 0 ? falling : "$muted",
        notice, nextRefresh: pending.length ? lastNotice + 60 : undefined,
        storage: { selection, usd: quotes.usd.saved, cny: quotes.cny.saved, pending, lastNotice }
    };
}

function digits(price, precision = 1) {
    const [integer, fraction] = price.toFixed(precision).split(".");
    let end = integer.length % 3 || 3;
    let grouped = integer.slice(0, end);
    while (end < integer.length) {
        grouped += "," + integer.slice(end, end + 3);
        end += 3;
    }
    return fraction === undefined ? grouped : grouped + "." + fraction;
}

function money(unit, price) {
    return UNITS[unit].symbol + digits(price);
}

function timeLabel(timestamp, offset, range = "day") {
    const local = new Date((timestamp + offset) * 1000);
    if (range !== "day") {
        return String(local.getUTCMonth() + 1) + "." + local.getUTCDate();
    }
    const pad = part => String(part).padStart(2, "0");
    return pad(local.getUTCHours()) + ":" + pad(local.getUTCMinutes());
}

function text(value, x, y, size, options = {}) {
    return { text: value, at: [x, y], size, ...options };
}

function toggleBar(nodes, choices, selected, x, width, type) {
    const segmentWidth = width / choices.length;
    nodes.push({ rect: [x, 0, width, 23], r: 7, fill: "$card" });
    for (const [index, [key, label]] of choices.entries()) {
        const left = x + segmentWidth * index;
        const active = selected === key;
        nodes.push({
            id: type + "-" + key,
            rect: [left + 1, 1, segmentWidth - 2, 21], r: 6,
            fill: active ? type === "unit" ? "$accent" : "$track" : "#00000000",
            hover: active ? undefined : { fill: "$track" },
            animate: { ms: 160 },
            hit: { action: type + "-" + key }
        });
        nodes.push(text(label, left + segmentWidth / 2, 16, 10.5, {
            align: "center", fill: active && type === "unit" ? "#211900" : active ? "$text" : "$muted",
            weight: active ? 700 : 400
        }));
    }
}

function plotBounds(points, threshold) {
    const prices = points.map(point => point.price);
    let low = Math.min(...prices);
    let high = Math.max(...prices);
    const span = Math.max(high - low, high * 0.002);
    if (threshold > 0 && threshold >= low - span * 2 && threshold <= high + span * 2) {
        low = Math.min(low, threshold);
        high = Math.max(high, threshold);
    }
    const padding = Math.max(high - low, span) * 0.12;
    return [low - padding, high + padding];
}

function chart(state) {
    const { unit, range, points, offset, threshold } = state;
    const [left, top, width, height] = [151, 36, 197, 125];
    const right = left + width;
    const bottom = top + height;
    if (points.length < 2) {
        return text("积累走势中", left + width / 2, 111, 11, { align: "center", fill: "$dim" });
    }

    const [low, high] = plotBounds(points, threshold);
    const first = points[0].at;
    const span = points[points.length - 1].at - first;
    const y = price => top + (high - price) / (high - low) * height;
    const coords = points.map(point => [left + (point.at - first) / span * width, y(point.price)]);
    const group = [];
    for (const fraction of [0.1, 0.42, 0.74, 1]) {
        const axisY = top + height * fraction;
        group.push({ line: [left, axisY, right, axisY], stroke: "$track", width: 1 });
        if (fraction < 1) {
            const value = high - (high - low) * fraction;
            group.push(text(digits(value, unit === "usd" && high - low > 4 ? 0 : 1), 386, axisY + 3, 8, {
                align: "right", fill: "$dim"
            }));
        }
    }
    group.push({
        points: coords, area: bottom, width: 1.8, cap: "round", stroke: "$accent",
        fill: { linear: [[left, top], [left, bottom]], stops: [[0, "#E8B93188"], [1, "#E8B93100"]] },
        tips: points.map((point, index) => ({
            x: coords[index][0], label: timeLabel(point.at, offset, range), value: money(unit, point.price)
        }))
    });
    if (threshold > 0) {
        const inside = threshold >= low && threshold <= high;
        const markerY = inside ? y(threshold) : threshold > high ? top : bottom;
        if (inside) {
            group.push({ line: [left, markerY, right, markerY], stroke: "#FF6B6B", width: 1, dash: [3, 3] });
        }
        const label = "提醒 " + money(unit, threshold) + (inside ? "" : threshold > high ? " ↑" : " ↓");
        const labelY = Math.max(top + 1, markerY - 15);
        group.push({ rect: [left + 4, labelY, Math.min(112, label.length * 5 + 12), 13], r: 4, fill: "#461B1F" });
        group.push(text(label, left + 9, labelY + 9, 8, { fill: "#FF9B9B", max_width: 102 }));
    }
    const [lastX, lastY] = coords[coords.length - 1];
    group.push({ circle: [lastX, lastY, 6], fill: "#E8B93150" });
    group.push({ circle: [lastX, lastY, 3], fill: "$accent", glow: true });
    for (const fraction of [0, 0.5, 1]) {
        const tick = timeLabel(first + span * fraction, offset, range);
        const align = fraction === 0 ? "left" : fraction === 1 ? "right" : "center";
        group.push(text(tick, left + width * fraction, bottom + 13, 8.5, { align, fill: "$dim" }));
    }
    return { id: "chart-" + unit + "-" + range, group, animate: FADE };
}

function toCanvas(state) {
    const { unit, range, quote, other, otherQuote, delta, percent, deltaColor } = state;
    const nodes = [];
    toggleBar(nodes, Object.entries(UNITS).map(([key, value]) => [key, value.short]), unit, 0, 126, "unit");
    toggleBar(nodes, Object.entries(RANGES).map(([key, value]) => [key, value[0]]), range, 263, 124, "range");
    nodes.push({
        rect: [212, 2, 44, 19], r: 5, fill: "#00000000",
        hover: { fill: "$card" }, hit: { action: "refresh" }
    }, text("刷新", 234, 16, 9.5, { align: "center", fill: "$muted" }));
    if (!quote) {
        nodes.push(
            text("数据源暂不可用", 193.5, 97, 16, { align: "center", weight: 700, fill: "$text" }),
            text("可以切换计价单位或稍后刷新", 193.5, 121, 11, { align: "center", fill: "$muted" })
        );
        return { height: 196, nodes };
    }
    const summary = (delta > 0 ? "+" : "") + delta.toFixed(2)
        + " · " + (percent > 0 ? "+" : "") + percent.toFixed(2) + "%";
    const price = text(digits(quote.price), 0, 61, 30, {
        id: "price-" + unit, animate: FADE, weight: 800, max_width: 138, fill: "$text"
    });
    nodes.push(price, { rect: [0, 70, 136, 22], r: 7,
        fill: delta === 0 ? "$card" : deltaColor + "35" });
    const arrow = delta > 0 ? "M7 77 L11 84 H3 Z" : "M3 77 H11 L7 84 Z";
    if (delta !== 0) nodes.push({ path: arrow, fill: deltaColor });
    nodes.push(text(summary, delta ? 17 : 8, 85.5, 10.5, { weight: 700, fill: deltaColor, max_width: 119 }));
    if (quote.fxStale) {
        nodes.push(text("汇率待更新", 0, 108, 9.5, { fill: "$accent" }));
    }
    const rows = [
        ["折合", otherQuote ? money(other, otherQuote.price) + " / " + UNITS[other].suffix : "—"],
        ["今日高", digits(state.high)],
        ["今日低", digits(state.low)]
    ];
    rows.forEach(([label, value], index) => {
        const baseline = 126 + index * 17;
        nodes.push(
            text(label, 0, baseline, 10.5, { fill: "$dim" }),
            text(value, 138, baseline, 10.5, { align: "right", fill: "$text", max_width: 108 })
        );
    });
    nodes.push(chart(state), text(quote.source === "tencent" ? "腾讯行情" : "XAUS", 0, 191, 9.5, { fill: "$dim" }),
        text("更新 " + timeLabel(quote.updatedAt, state.offset), 387, 191, 9.5, {
            align: "right", fill: "$dim"
        }));
    return { height: 196, nodes };
}

function toPinned(state) {
    const { unit, quote, points, deltaColor } = state;
    if (!quote) return null;
    const price = money(unit, quote.price);
    const priceLeft = 18;
    const priceWidth = Math.min(96, 2 + [...price].reduce((width, char) =>
        width + (char === "." || char === "," ? 4 : 7), 0));
    const priceRight = priceLeft + priceWidth;
    const tail = points.slice(-8);
    const hasTrend = tail.length > 1;
    const nodes = [
        text("金", 2, 15, 11, { fill: "#A37B2D", weight: 700 }),
        text(price, hasTrend ? priceRight : priceLeft, 15, 11.5, {
            fill: "$text", weight: 700, max_width: priceWidth, align: hasTrend ? "right" : "left"
        })
    ];
    const trendLeft = priceRight + 7;
    const trendWidth = 30;
    if (hasTrend) {
        const [low, high] = plotBounds(tail, 0);
        const coords = tail.map((point, index) => [
            trendLeft + index * trendWidth / (tail.length - 1), 4 + (high - point.price) / (high - low) * 14
        ]);
        nodes.push({ points: coords, stroke: deltaColor, width: 1.6, cap: "round" });
    }
    return { canvas: { width: (hasTrend ? trendLeft + trendWidth : priceRight) + 4, nodes, fit_width: !hasTrend || undefined } };
}

function refresh(input) {
    const state = computeState(input);
    const quote = state.quote;
    const status = quote
        ? { state: "succeeded", label: "现货金价", observed_at: quote.at, expires_at: quote.at + MAX_AGE }
        : { state: "offline", label: "数据源暂不可用" };
    return {
        status, canvas: toCanvas(state), pinned: toPinned(state), notice: state.notice,
        storage: state.storage, next_refresh_at: state.nextRefresh
    };
}

function action(input) {
    return refresh(input);
}
