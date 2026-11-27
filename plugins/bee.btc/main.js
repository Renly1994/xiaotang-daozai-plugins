// 比特币现价 · 岛仔独立状态页插件
// 数据来源：币安公开行情镜像 BTCUSDT K 线，原始报价为 USDT 计价；
// 人民币按腾讯 USDCNY 汇率折算（USDT≈USD），页面与常驻位均标注为估算。
// 每次刷新从头运行，需要记住的选中项与上次价格放在返回的 storage 里。

const HOUR = 3600;
const DAY = 24 * HOUR;
// 汇率缓存有效期：腾讯汇率取不到时，缓存汇率最多再用 2 天，过期视为无汇率。
const FX_TTL = 2 * DAY;
const RANGES = { day: ["24小时", DAY], week: ["7日", 7 * DAY], month: ["30日", 30 * DAY] };
const UNITS = {
    usd: { short: "USDT" },
    cny: { short: "CNY" }
};
const ACCENT = "#F7931A";
const FADE = { ms: 240, ease: "linear" };

function readKline(source) {
    if (source?.status !== "ready" || typeof source.text !== "string") return [];
    let data;
    try {
        data = JSON.parse(source.text);
    } catch {
        return [];
    }
    // 币安 klines：[[开盘ms, 开, 高, 低, 收, ...], ...]，最后一根是进行中的 K 线。
    // 高低字段留给区间高低展示，走势仍用收盘价。
    if (!Array.isArray(data)) return [];
    return data
        .map(row => Array.isArray(row) ? {
            at: row[0] / 1000, price: Number(row[4]),
            high: Number(row[2]), low: Number(row[3])
        } : null)
        .filter(p => p && Number.isFinite(p.at) && Number.isFinite(p.price) && p.price > 0)
        .map(p => ({
            ...p,
            high: Number.isFinite(p.high) && p.high > 0 ? p.high : p.price,
            low: Number.isFinite(p.low) && p.low > 0 ? p.low : p.price
        }))
        .sort((a, b) => a.at - b.at);
}

function tencentFields(text, code) {
    const rows = typeof text === "string" ? text.split(";").map(row => row.trim()) : [];
    const prefix = `v_${code}="`;
    const row = rows.find(line => line.startsWith(prefix) && line.endsWith('"'));
    return row?.slice(prefix.length, -1).split("~") ?? [];
}

function readFx(source, now) {
    const fields = source?.status === "ready" ? tencentFields(source.text, "whUSDCNY") : [];
    const rate = Number(fields[3]);
    const stamp = fields[5] ?? "";
    if (fields[2] !== "USDCNY" || stamp.length !== 14 || !Number.isFinite(rate) || rate <= 0) return null;
    const at = Date.parse(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}+08:00`) / 1000;
    if (!Number.isFinite(at) || at > now + 60 || now - at >= DAY) return null;
    return { rate, at };
}

function choice(setting, values, previous, fallback) {
    const base = values.includes(setting) ? setting : fallback;
    return previous?.base === base && values.includes(previous.value) ? previous : { base, value: base };
}

function digits(value, precision = 1) {
    const [integer, fraction] = value.toFixed(precision).split(".");
    let end = integer.length % 3 || 3;
    let grouped = integer.slice(0, end);
    while (end < integer.length) {
        grouped += "," + integer.slice(end, end + 3);
        end += 3;
    }
    return fraction === undefined ? grouped : grouped + "." + fraction;
}

function money(unit, price) {
    const amount = digits(price, price >= 1000 ? 0 : 1);
    // 原始报价是 USDT，直接标 USDT；人民币是折算值，用 ≈ 提示为估算。
    return unit === "cny" ? "≈¥" + amount : amount + " USDT";
}

function bigMoney(unit, price) {
    // 大字号价格不拼 USDT 后缀（拼上会被截成 U...），币种由左上角切换条高亮标明。
    return unit === "cny" ? "≈¥" + digits(price, price >= 1000 ? 0 : 1)
        : digits(price, price >= 1000 ? 0 : 1);
}

function signedPercent(value) {
    const rounded = Math.round(value * 100) / 100;
    return (rounded > 0 ? "+" : "") + rounded.toFixed(2) + "%";
}

function computeState(input) {
    const { settings = {}, storage, sources, now, tz } = input;
    const at = Math.floor(now / 1000);
    const offset = (tz?.offset_minutes ?? 0) * 60;
    const unitKeys = Object.keys(UNITS);
    const rangeKeys = Object.keys(RANGES);
    const selection = {
        unit: choice(settings.currency, unitKeys, storage?.selection?.unit, "usd"),
        range: choice(settings.days, rangeKeys, storage?.selection?.range, "week")
    };
    const [control, requested] = (input.action?.id ?? "").split("-");
    if (control === "unit" && unitKeys.includes(requested)) {
        selection.unit = { ...selection.unit, value: requested };
    } else if (control === "range" && rangeKeys.includes(requested)) {
        selection.range = { ...selection.range, value: requested };
    }
    const unit = selection.unit.value;
    const range = selection.range.value;

    const fx = readFx(sources?.fx, at);
    // 汇率来源缺失或过期时退回缓存汇率，缓存本身也有有效期，过期当没有处理。
    const cachedRate = Number.isFinite(storage?.lastRate) && storage.lastRate > 0
        && Number.isFinite(storage?.lastRateAt) && at - storage.lastRateAt < FX_TTL
        ? storage.lastRate : null;
    const rate = fx ? fx.rate : cachedRate;
    const fxStale = unit === "cny" && !fx;
    // CNY 且连有效期内的缓存汇率都没有时，降级按 USDT 展示，避免整卡空白。
    const displayUnit = unit === "cny" && !rate ? "usd" : unit;

    const intraday = readKline(sources?.intraday);
    const daily = readKline(sources?.daily);
    // 7日 = 日线最后 7 根，30日 = 全部 30 根，24小时 = 15min 线（滞后不超过 15 分钟）。
    const series = range === "day" ? intraday : range === "week" ? daily.slice(-7) : daily;
    // 新鲜度按最后一根 K 线的收盘时刻（开盘时间 + 周期）判断：
    // 15min 线容忍 2 个周期（约 30 分钟），日线容忍 1 个周期（最后一根距今 2 天以上算旧行情）。
    const period = range === "day" ? 15 * 60 : DAY;
    const tolerance = range === "day" ? 2 * period : period;
    const newest = series.length ? series[series.length - 1] : null;
    const quoteAt = newest ? newest.at + period : 0;
    const stale = Boolean(newest) && at - quoteAt >= tolerance;
    let quote = null;
    let rawQuote = null;
    let points = [];
    let rawPoints = [];
    let low = 0;
    let high = 0;
    let change = 0;
    if (series.length >= 2) {
        rawPoints = series.map(p => ({ at: p.at, price: p.price }));
        points = displayUnit === "cny" && rate
            ? series.map(p => ({ at: p.at, price: p.price * rate, high: p.high * rate, low: p.low * rate }))
            : series;
        if (points.length >= 2) {
            quote = points[points.length - 1];
            rawQuote = rawPoints[rawPoints.length - 1];
            // 区间高低取 K 线的最高/最低字段，而不是只比收盘价。
            high = Math.max(...points.map(p => p.high));
            low = Math.min(...points.map(p => p.low));
            change = (quote.price - points[0].price) / points[0].price * 100;
        }
    }

    // 与上次刷新对比：仅在上次记录为 1 分钟前至 1 天内时展示。
    // 记录按「展示币种-区间」分键，避免切换设置后拿不同口径的价格算差值。
    const combo = displayUnit + "-" + range;
    const previous = storage?.last?.[combo];
    let sinceLast = null;
    if (quote && Number.isFinite(previous?.price) && Number.isFinite(previous?.at)
        && at - previous.at >= 60 && at - previous.at < DAY && quote.price !== previous.price) {
        sinceLast = quote.price - previous.price;
    }

    // 涨跌颜色：设置可选「红涨绿跌」（默认）或「绿涨红跌」。
    const rising = settings.up_color === "green" ? "#58D791" : "#FF6B6B";
    const falling = settings.up_color === "green" ? "#FF6B6B" : "#58D791";
    return {
        unit, displayUnit, range, offset, at, quote, points, low, high, change, sinceLast, fxStale,
        stale, quoteAt, rawQuote, rawPoints,
        deltaColor: change > 0 ? rising : change < 0 ? falling : "$muted",
        storage: {
            selection,
            lastRate: rate ?? storage?.lastRate,
            lastRateAt: fx ? fx.at : storage?.lastRateAt,
            last: quote ? { ...storage?.last, [combo]: { price: quote.price, at } } : storage?.last
        }
    };
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
            fill: active ? (type === "unit" ? "$accent" : "$track") : "#00000000",
            hover: active ? undefined : { fill: "$track" },
            animate: { ms: 160 },
            hit: { action: type + "-" + key }
        });
        nodes.push(text(label, left + segmentWidth / 2, 16, 10.5, {
            align: "center", fill: active && type === "unit" ? "#2B1500" : active ? "$text" : "$muted",
            weight: active ? 700 : 400
        }));
    }
}

function plotBounds(points) {
    const prices = points.map(point => point.price);
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    const padding = Math.max(high - low, high * 0.002) * 0.12;
    return [low - padding, high + padding];
}

function chart(state) {
    const { displayUnit, range, points, offset } = state;
    const [left, top, width, height] = [151, 36, 197, 125];
    const right = left + width;
    const bottom = top + height;
    if (points.length < 2) {
        return text("走势积累中", left + width / 2, 111, 11, { align: "center", fill: "$dim" });
    }
    const [low, high] = plotBounds(points);
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
            group.push(text(digits(value, high - low > 40 ? 0 : 1), 386, axisY + 3, 8, {
                align: "right", fill: "$dim"
            }));
        }
    }
    group.push({
        points: coords, area: bottom, width: 1.8, cap: "round", stroke: "$accent",
        fill: { linear: [[left, top], [left, bottom]], stops: [[0, ACCENT + "88"], [1, ACCENT + "00"]] },
        tips: points.map((point, index) => ({
            x: coords[index][0], label: timeLabel(point.at, offset, range), value: money(displayUnit, point.price)
        }))
    });
    const [lastX, lastY] = coords[coords.length - 1];
    group.push({ circle: [lastX, lastY, 6], fill: ACCENT + "50" });
    group.push({ circle: [lastX, lastY, 3], fill: "$accent", glow: true });
    for (const fraction of [0, 0.5, 1]) {
        const tick = timeLabel(first + span * fraction, offset, range);
        const align = fraction === 0 ? "left" : fraction === 1 ? "right" : "center";
        group.push(text(tick, left + width * fraction, bottom + 13, 8.5, { align, fill: "$dim" }));
    }
    return { id: "chart-" + displayUnit + "-" + range, group, animate: FADE };
}

function toCanvas(state) {
    const { unit, displayUnit, range, quote, low, high, change, sinceLast, fxStale, stale, quoteAt } = state;
    const nodes = [];
    toggleBar(nodes, Object.entries(UNITS).map(([key, value]) => [key, value.short]), unit, 0, 126, "unit");
    toggleBar(nodes, Object.entries(RANGES).map(([key, value]) => [key, value[0]]), range, 263, 124, "range");
    nodes.push({
        rect: [212, 2, 44, 19], r: 5, fill: "#00000000",
        hover: { fill: "$card" }, hit: { action: "refresh" }
    }, text("刷新", 234, 16, 9.5, { align: "center", fill: "$muted" }));
    if (!quote) {
        nodes.push(
            text("行情数据暂不可用", 193.5, 88, 16, { align: "center", weight: 700, fill: "$text" }),
            text("可点击刷新或稍后再试", 193.5, 112, 11, { align: "center", fill: "$muted" })
        );
        return { height: 196, nodes };
    }
    const deltaColor = state.deltaColor;
    // 数字位数多时（如 CNY 的 ≈¥ + 6 位数）自动缩小字号，避免被 max_width 截断。
    const bigPrice = bigMoney(displayUnit, quote.price);
    const price = text(bigPrice, 0, 61, bigPrice.length >= 9 ? 24 : 30, {
        id: "price-" + displayUnit + "-" + range, animate: FADE, weight: 800, max_width: 138, fill: "$text"
    });
    nodes.push(price, { rect: [0, 70, 110, 22], r: 7,
        fill: change === 0 ? "$card" : (deltaColor === "$muted" ? "$card" : deltaColor) + "35" });
    const arrow = change > 0 ? "M7 77 L11 84 H3 Z" : "M3 77 H11 L7 84 Z";
    if (change !== 0) nodes.push({ path: arrow, fill: deltaColor });
    nodes.push(text(signedPercent(change), change ? 17 : 8, 85.5, 10.5, { weight: 700, fill: deltaColor, max_width: 94 }));
    if (sinceLast !== null) {
        const magnitude = Math.abs(sinceLast);
        const diff = (sinceLast > 0 ? "↑" : "↓") + digits(magnitude, magnitude >= 1000 ? 0 : 1);
        nodes.push(text("较上次 " + diff, 122, 85.5, 9.5, { fill: "$muted", max_width: 120 }));
    }
    // 币种口径提示：CNY 是 USDT≈USD 折算的估算值；汇率失效时说明数据来源。
    if (displayUnit === "cny") {
        nodes.push(text(fxStale ? "汇率待更新，按缓存汇率估算" : "人民币为汇率折算，估算值",
            0, 108, 9.5, { fill: "$accent" }));
    } else if (fxStale) {
        nodes.push(text("汇率待更新，已按 USDT 显示", 0, 108, 9.5, { fill: "$accent" }));
    }
    const rows = [
        ["区间高", money(displayUnit, high)],
        ["区间低", money(displayUnit, low)]
    ];
    rows.forEach(([label, value], index) => {
        const baseline = 126 + index * 17;
        nodes.push(
            text(label, 0, baseline, 10.5, { fill: "$dim" }),
            text(value, 138, baseline, 10.5, { align: "right", fill: "$text", max_width: 108 })
        );
    });
    nodes.push(chart(state),
        text(stale ? "旧行情 · " + timeLabel(quoteAt, state.offset, range)
            : "更新 " + timeLabel(state.at, state.offset), 387, 191, 9.5,
            { align: "right", fill: stale ? "$accent" : "$dim" }));
    return { height: 196, nodes };
}

function toPinned(state) {
    const { quote, points, rawQuote, rawPoints, displayUnit, fxStale, stale } = state;
    // 旧行情不进常驻位，避免把旧价当最新展示。
    if (!quote || stale) return null;
    // 汇率失效时退回 USDT 原价，常驻位不展示按旧汇率折算的人民币。
    const fallback = fxStale && displayUnit === "cny";
    const pinnedUnit = fallback ? "usd" : displayUnit;
    const pinnedQuote = fallback ? rawQuote : quote;
    const pinnedPoints = fallback ? rawPoints : points;
    const price = money(pinnedUnit, pinnedQuote.price);
    const priceLeft = 18;
    const priceWidth = Math.min(96, 2 + [...price].reduce((width, char) =>
        width + (char === "." || char === "," ? 4 : 7), 0));
    const priceRight = priceLeft + priceWidth;
    // 常驻小曲线覆盖整个所选区间：在全长上等距采样约 8 个点，再补上最新点。
    const step = Math.max(1, Math.floor((pinnedPoints.length - 1) / 7));
    const tail = pinnedPoints.filter((_, index) => index % step === 0);
    const newest = pinnedPoints[pinnedPoints.length - 1];
    if (tail[tail.length - 1] !== newest) tail.push(newest);
    const hasTrend = tail.length > 1;
    const nodes = [
        text("币", 2, 15, 11, { fill: "#A3622D", weight: 700 }),
        text(price, hasTrend ? priceRight : priceLeft, 15, 11.5, {
            fill: "$text", weight: 700, max_width: priceWidth, align: hasTrend ? "right" : "left"
        })
    ];
    const trendLeft = priceRight + 7;
    const trendWidth = 30;
    if (hasTrend) {
        const [low, high] = plotBounds(tail);
        const coords = tail.map((point, index) => [
            trendLeft + index * trendWidth / (tail.length - 1), 4 + (high - point.price) / (high - low) * 14
        ]);
        nodes.push({ points: coords, stroke: state.deltaColor, width: 1.6, cap: "round" });
    }
    return { canvas: { width: (hasTrend ? trendLeft + trendWidth : priceRight) + 4, nodes, fit_width: !hasTrend || undefined } };
}

function refresh(input) {
    const state = computeState(input);
    const quote = state.quote;
    // K 线时间戳是开盘时间（日线是当天 00:00）， observed_at 用本次取数时刻表示，
    // 否则宿主会立刻显示「状态已过期」；数据本身的陈旧由 stale 标注在页面与常驻位。
    const at = Math.floor(input.now / 1000);
    const status = quote
        ? { state: "succeeded", label: state.stale ? "现货比特币（旧行情）" : "现货比特币", observed_at: at, expires_at: at + 30 * 60 }
        : { state: "offline", label: "行情数据暂不可用" };
    return {
        status, canvas: toCanvas(state), pinned: toPinned(state),
        storage: state.storage
    };
}

function action(input) {
    return refresh(input);
}

