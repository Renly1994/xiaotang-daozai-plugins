/*
MIT License

Copyright (c) 2026 magpie-quota contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// magpie 额度：只读本机 magpie 的额度缓存，在状态详情页按平台汇总展示。
// 取数地址由用户在「授权数据源」中选择，需填写完整地址：
//   http://127.0.0.1:3425/v1/magpie/quotas/cards（新端点）
//   http://127.0.0.1:3425/v1/magpie/quotas（旧端点，窗口里带 remaining）
// 同一平台的多个账号合并成一行；余额直接显示金额，积分显示剩余数量。
// 额度页签不再展示读数（quota 始终为 null），所有内容画在自绘画布上。

const COMPLETE_URL = "http://127.0.0.1:3425/v1/magpie/quotas/cards";
const MAX_WINDOW_LABEL = 40;
const MAX_PLATFORM_NAME = 20;
const MAX_ROW_LABEL = 22;
const MAX_VALUE = 18;
const CANVAS_WIDTH = 387;
// 页面总高 = 42（标题栏）+ 画布高度 + 16（底部留白）。岛仔状态页上限 348，
// 因此画布最高 290；超过会让底部圆角被窗口方角裁掉。
const CANVAS_HEIGHT = 290;
const MAX_RINGS = 4;
const CHART_TOP = 26;
const CHART_BOTTOM = 66;
const CHART_LEFT = 14;
const CHART_RIGHT = 373;

const INDEX_LINES = ["当前地址只返回接口索引", COMPLETE_URL, "点地址复制，改为完整地址"];
const MISSING_LINES = ["该地址没有 magpie 额度接口", COMPLETE_URL, "点地址复制，核对端口和路径"];
const UNKNOWN_LINES = ["返回内容不是 magpie 额度接口", COMPLETE_URL, "点地址复制，核对完整地址"];
const UNAUTHORIZED_LINES = [
    "设置 → 插件 → 已安装 → 授权数据源",
    COMPLETE_URL,
    "点地址复制，粘贴后确认授权",
    "旧版 magpie 可改用 /v1/magpie/quotas",
];
const OFFLINE_LINES = ["magpie 未运行，或地址、端口不通", "启动后会自动重试，也可检查授权地址"];

const NOTICE_UNAUTHORIZED = {
    id: "url-unauthorized",
    title: "magpie 地址待授权",
    body: "在「已安装 → 授权数据源」填写 " + COMPLETE_URL,
};

const NOTICES = {
    index: {
        id: "bad-url-index",
        title: "授权地址不完整",
        body: "请填写完整地址：" + COMPLETE_URL + "。获取方式见插件详情页。",
    },
    missing: {
        id: "bad-url-missing",
        title: "授权地址不存在",
        body: "该地址没有 magpie 额度接口。请核对端口和完整路径，完整示例见插件详情页。",
    },
    unknown: {
        id: "bad-url-unknown",
        title: "数据源不是 magpie 额度接口",
        body: "返回内容里没有 data 数组。请核对完整地址与端口，完整示例见插件详情页。",
    },
};

function refresh(input) {
    const source = input && input.source;
    if (!source || source.status !== "ready" || typeof source.text !== "string") {
        return sourceView(source);
    }

    const parsed = parseSource(source.text);
    if (parsed.kind === "index") {
        return messageView("error", "授权地址不完整", INDEX_LINES, NOTICES.index);
    }
    if (parsed.kind === "missing") {
        return messageView("error", "授权地址不存在", MISSING_LINES, NOTICES.missing);
    }
    if (parsed.kind === "unknown") {
        return messageView("error", "数据源不是额度接口", UNKNOWN_LINES, NOTICES.unknown);
    }

    const cards = parsed.cards;
    const platforms = groupPlatforms(cards);
    const series = usageSeries(cards);

    // 额度页签按需求撤下读数，只在新的状态页展示。
    return {
        quota: null,
        status: {
            state: platforms.length ? "succeeded" : "idle",
            label: "magpie 额度",
        },
        canvas: dataCanvas(platforms, series),
    };
}

// 宿主在未授权、离线或意外状态时不会给出读数。
// 地址不可用分不清「magpie 没运行」和「路径不对」，因此这里不发提醒，只做页面引导。
function sourceView(source) {
    if (!source || source.status === "unconfigured") {
        return messageView("idle", "用默认地址授权？", UNAUTHORIZED_LINES, NOTICE_UNAUTHORIZED);
    }
    return messageView(
        source.status === "offline" ? "offline" : "idle",
        "magpie 未运行或地址不通",
        OFFLINE_LINES,
        null
    );
}

function messageView(state, title, lines, notice) {
    const nodes = [backgroundNode(180)];
    nodes.push({ text: clipText(title, 40), at: [16, 46], size: 15, fill: "$text" });
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const node = {
            text: line,
            at: [16, 78 + i * 24],
            size: 11,
            fill: line === COMPLETE_URL ? "$accent" : "$muted",
            max_width: 355,
        };
        if (line === COMPLETE_URL) {
            // 授权对话框由宿主管理，插件不能预填；这里让用户一键复制地址再粘贴。
            node.hit = { copy: COMPLETE_URL };
            node.hover = { hint: "点击复制地址" };
        }
        nodes.push(node);
    }
    const result = {
        quota: null,
        status: { state: state, label: clipText(title, 40) },
        canvas: { height: 180, nodes: nodes },
    };
    if (notice) {
        result.notice = notice;
    }
    return result;
}

// 按平台（provider）合并账号。条目报错且没有余额的账号直接舍弃。
function groupPlatforms(cards) {
    const groups = [];
    const index = {};
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const balance = balanceText(card);
        if (!cardUsable(card) && !balance) {
            continue;
        }
        const key = normalize(card.provider) || normalize(card.name);
        if (!key) {
            continue;
        }
        let group = index[key];
        if (!group) {
            group = {
                key: key,
                name: cleanText(card.name, MAX_PLATFORM_NAME) || cleanText(card.provider, MAX_PLATFORM_NAME),
                cards: [],
            };
            index[key] = group;
            groups.push(group);
        }
        group.cards.push(card);
    }

    const platforms = [];
    for (let i = 0; i < groups.length; i++) {
        const platform = aggregatePlatform(groups[i]);
        if (platform) {
            platforms.push(platform);
        }
    }
    // 剩余比例低的排在前面，余额类排在后面；同等条件按名称稳定排序。
    platforms.sort((left, right) => {
        const lp = left.pct === null ? 101 : left.pct;
        const rp = right.pct === null ? 101 : right.pct;
        if (lp !== rp) {
            return lp - rp;
        }
        return left.name < right.name ? -1 : (left.name > right.name ? 1 : 0);
    });
    return platforms;
}

function aggregatePlatform(group) {
    const windowMap = {};
    const balances = [];
    const balanceKeys = {};
    let unlimited = false;

    for (let i = 0; i < group.cards.length; i++) {
        const card = group.cards[i];
        const balance = balanceText(card);
        if (balance) {
            const shared = cleanText(card.sharedBalance, 40);
            const key = shared || balance;
            if (!balanceKeys[key]) {
                balanceKeys[key] = true;
                balances.push(balance);
            }
        }
        if (!cardUsable(card)) {
            continue;
        }
        const raw = Array.isArray(card.windows) ? card.windows : [];
        for (let j = 0; j < raw.length; j++) {
            if (raw[j] && raw[j].unlimited === true) {
                unlimited = true;
            }
        }
        const windows = cardWindows(card);
        for (let k = 0; k < windows.length; k++) {
            addWindow(windowMap, windows[k]);
        }
    }

    const windows = [];
    for (const key in windowMap) {
        if (Object.prototype.hasOwnProperty.call(windowMap, key)) {
            windows.push(finishWindow(windowMap[key]));
        }
    }
    const primary = choosePrimary(windows);

    let value = "";
    let pct = null;
    if (primary) {
        pct = primary.pct;
        if (primary.remaining !== null) {
            const unit = unitLabel(primary.unit);
            value = formatAmount(primary.remaining) + (unit ? " " + unit : "");
        } else if (primary.pct !== null) {
            value = "剩 " + formatPct(primary.pct) + "%";
        }
    }
    if (!value && balances.length) {
        value = balances[0] + (balances.length > 1 ? " 等" + balances.length + "个" : "");
    }
    if (!value && unlimited) {
        value = "无限";
    }
    if (!value) {
        return null;
    }

    return {
        name: group.name,
        accounts: group.cards.length,
        value: clipText(value, MAX_VALUE),
        pct: pct,
    };
}

function addWindow(map, window) {
    const key = normalize(window.label) || "-";
    let entry = map[key];
    if (!entry) {
        entry = {
            label: window.label,
            unit: "",
            pctSum: 0,
            pctCount: 0,
            limitSum: 0,
            remainingSum: 0,
            hasLimits: true,
        };
        map[key] = entry;
    }
    if (!entry.unit && window.unit) {
        entry.unit = window.unit;
    }
    if (window.remaining_pct !== null) {
        entry.pctSum += window.remaining_pct;
        entry.pctCount += 1;
        if (window.limit !== null) {
            entry.limitSum += window.limit;
            entry.remainingSum += window.limit * window.remaining_pct / 100;
        } else {
            entry.hasLimits = false;
        }
    } else {
        entry.hasLimits = false;
    }
}

function finishWindow(entry) {
    const pct = entry.hasLimits && entry.limitSum > 0
        ? clampPct(entry.remainingSum / entry.limitSum * 100)
        : (entry.pctCount ? clampPct(entry.pctSum / entry.pctCount) : null);
    return {
        label: entry.label,
        unit: entry.unit,
        pct: pct,
        remaining: entry.hasLimits && entry.limitSum > 0 ? entry.remainingSum : null,
    };
}

// 有 Total 一类汇总窗口时优先它，否则用剩余比例最低的窗口。
function choosePrimary(windows) {
    let total = null;
    let lowest = null;
    for (let i = 0; i < windows.length; i++) {
        const window = windows[i];
        if (window.pct === null) {
            continue;
        }
        if (!total && /total|总计|总额|合计/i.test(window.label)) {
            total = window;
        }
        if (!lowest || window.pct < lowest.pct) {
            lowest = window;
        }
    }
    return total || lowest || windows[0] || null;
}

// 折线：把各账号 daily.days 按日期相加，取最近 7 天。
function usageSeries(cards) {
    const totals = {};
    for (let i = 0; i < cards.length; i++) {
        const daily = cards[i].daily;
        if (!daily || !Array.isArray(daily.days)) {
            continue;
        }
        for (let j = 0; j < daily.days.length; j++) {
            const day = daily.days[j];
            if (!day || typeof day.day !== "string") {
                continue;
            }
            const used = typeof day.used === "number" && Number.isFinite(day.used) && day.used >= 0 ? day.used : 0;
            totals[day.day] = (totals[day.day] || 0) + used;
        }
    }
    const days = Object.keys(totals).sort().slice(-7);
    const series = [];
    for (let i = 0; i < days.length; i++) {
        series.push(Math.round(totals[days[i]] * 100) / 100);
    }
    return series;
}

function dataCanvas(platforms, series) {
    const plan = planLayout(platforms.length);
    const nodes = [backgroundNode(CANVAS_HEIGHT)];
    if (plan.mode !== "list") {
        nodes.push({ text: "近 7 天用量", at: [14, 14], size: 9, fill: "$muted" });
        drawSeries(nodes, series);
    }
    if (plan.mode === "full") {
        const rings = [];
        for (let i = 0; i < platforms.length && rings.length < MAX_RINGS; i++) {
            if (platforms[i].pct !== null) {
                rings.push(platforms[i]);
            }
        }
        drawRings(nodes, rings);
    }
    drawList(nodes, platforms, plan);

    return { height: CANVAS_HEIGHT, nodes: nodes };
}

// 平台越多，列数越多、图表逐步让位给列表；最多一页显示 45 个平台。
function planLayout(count) {
    const columns = count <= 6 ? 1 : (count <= 14 ? 2 : 3);
    let mode = "full";
    if (count > 21) {
        mode = "chart";
    }
    if (count > 30) {
        mode = "list";
    }
    const listY = mode === "full" ? 128 : (mode === "chart" ? 82 : 12);
    const available = CANVAS_HEIGHT - listY - 8;
    const limit = Math.min(count, 45);
    const rows = Math.max(1, Math.ceil(limit / columns));
    const rowHeight = Math.max(18, Math.min(32, Math.floor(available / rows)));
    const capacity = columns * Math.max(1, Math.floor(available / rowHeight));
    return { columns: columns, mode: mode, listY: listY, rowHeight: rowHeight, capacity: capacity };
}

// 内容区底部改成圆角，和岛仔其他页面一致。
function backgroundNode(height) {
    const radius = 12;
    const path = "M0 0 H" + CANVAS_WIDTH + " V" + (height - radius)
        + " Q" + CANVAS_WIDTH + " " + height + " " + (CANVAS_WIDTH - radius) + " " + height
        + " H" + radius + " Q0 " + height + " 0 " + (height - radius) + " Z";
    return { path: path, fill: "$card" };
}

function drawSeries(nodes, series) {
    if (series.length < 2) {
        nodes.push({ text: "暂无用量数据", at: [14, 50], size: 10, fill: "$muted" });
        return;
    }
    const max = Math.max.apply(null, series);
    const min = Math.min.apply(null, series);
    const low = Math.min(min, 0);
    const span = max > low ? max - low : 1;
    const points = [];
    for (let i = 0; i < series.length; i++) {
        const x = CHART_LEFT + (CHART_RIGHT - CHART_LEFT) * i / (series.length - 1);
        const y = CHART_BOTTOM - (series[i] - low) / span * (CHART_BOTTOM - CHART_TOP);
        points.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    }
    nodes.push({ points: points, area: CHART_BOTTOM, fill: "$accent", opacity: 0.14 });
    nodes.push({ points: points, stroke: "$accent", width: 2, cap: "round" });
    const last = points[points.length - 1];
    nodes.push({ circle: [last[0], last[1], 2.5], fill: "$accent" });
    nodes.push({ line: [CHART_LEFT, CHART_BOTTOM, CHART_RIGHT, CHART_BOTTOM], stroke: "$track", width: 1 });
}

function drawRings(nodes, rings) {
    const startX = 52;
    const step = 88;
    const cy = 94;
    const radius = 14;
    for (let i = 0; i < rings.length; i++) {
        const platform = rings[i];
        const cx = startX + i * step;
        nodes.push({ arc: { c: [cx, cy], r: radius, start: 0, sweep: 359.9 }, stroke: "$track", width: 5 });
        nodes.push({
            arc: { c: [cx, cy], r: radius, start: -90, sweep: Math.max(0.1, platform.pct * 3.6) },
            stroke: pctColor(platform.pct),
            width: 5,
            cap: "round",
        });
        nodes.push({
            text: Math.round(platform.pct) + "%",
            at: [cx, cy + 4],
            size: 10,
            fill: "$text",
            align: "center",
        });
        nodes.push({
            text: clipText(platform.name, 12).trim(),
            at: [cx, 118],
            size: 9,
            fill: "$muted",
            align: "center",
            max_width: 84,
        });
    }
}

// 一页放下全部平台，不滚动，避免上下滑动被岛仔当成翻页。
// 平台少时单列，多时两列或三列并压缩行高；平台极多时图表让位。
function drawList(nodes, platforms, plan) {
    if (!platforms.length) {
        nodes.push({ text: "没有可显示的账号", at: [14, plan.listY + 26], size: 12, fill: "$muted" });
        return;
    }
    const columns = plan.columns;
    const rowHeight = plan.rowHeight;
    let capacity = plan.capacity;
    let shown = platforms.slice(0, capacity);
    let hidden = platforms.length - shown.length;
    if (hidden > 0) {
        capacity = Math.max(columns, capacity - columns);
        shown = platforms.slice(0, capacity);
        hidden = platforms.length - shown.length;
    }

    const gap = columns === 1 ? 0 : 8;
    const columnWidth = (CANVAS_WIDTH - 28 - gap * (columns - 1)) / columns;
    const size = Math.max(8, Math.min(12, rowHeight - 11));
    const nameWidth = Math.max(40, columnWidth - 50);

    for (let i = 0; i < shown.length; i++) {
        const platform = shown[i];
        const column = i % columns;
        const row = Math.floor(i / columns);
        const x = 14 + column * (columnWidth + gap);
        const right = x + columnWidth;
        const y = plan.listY + row * rowHeight;
        const baseline = y + Math.round(rowHeight * 0.5) + 2;
        nodes.push({
            text: clipText(platform.name + (platform.accounts > 1 ? " ×" + platform.accounts : ""), MAX_ROW_LABEL),
            at: [x, baseline],
            size: size,
            fill: "$text",
            max_width: nameWidth,
        });
        nodes.push({
            text: platform.value,
            at: [right, baseline],
            size: size,
            fill: platform.pct === null ? "$text" : pctColor(platform.pct),
            align: "right",
        });
        if (platform.pct !== null) {
            nodes.push({ rect: [x, y + rowHeight - 4, columnWidth, 2], r: 1, fill: "$track" });
            nodes.push({
                rect: [x, y + rowHeight - 4, Math.max(2, columnWidth * clampPct(platform.pct) / 100), 2],
                r: 1,
                fill: pctColor(platform.pct),
            });
        }
    }

    if (hidden > 0) {
        nodes.push({
            text: "另有 " + hidden + " 个平台未显示",
            at: [14, CANVAS_HEIGHT - 8],
            size: 9,
            fill: "$muted",
        });
    }
}

// 识别三类常见错址：接口索引、404 文本、非 magpie 的 JSON 或其它内容。
// 宿主对非 2xx 一律报离线，脚本拿不到状态码，因此离线不在这里判断。
function parseSource(text) {
    let payload;
    try {
        payload = JSON.parse(text);
    } catch (error) {
        return { kind: looksMissing(text) ? "missing" : "unknown" };
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { kind: "unknown" };
    }
    if (Array.isArray(payload.apis)) {
        return { kind: "index" };
    }
    if (!Array.isArray(payload.data)) {
        return { kind: "unknown" };
    }
    return {
        kind: "cards",
        cards: payload.data.filter(card => card && typeof card === "object" && !Array.isArray(card)),
    };
}

// 保守判断 404 文本：必须同时出现 404 和“未找到”一类字样。
function looksMissing(text) {
    if (typeof text !== "string" || text.length > 2048) {
        return false;
    }
    return /(^|\D)404(\D|$)/.test(text) && /not\s*found|未找到|页面不存在|不存在/i.test(text);
}

function cardUsable(card) {
    return !errorFlag(card.error) && !errorFlag(card.pluginError) && !errorFlag(card.readError);
}

// 只保留能换算成百分比的窗口；unlimited、text、钱包窗口不参与。
function cardWindows(card) {
    if (!Array.isArray(card.windows)) {
        return [];
    }
    const windows = [];
    for (let i = 0; i < card.windows.length; i++) {
        const mapped = mapWindow(card.windows[i], i);
        if (mapped) {
            windows.push(mapped);
        }
    }
    return windows;
}

function mapWindow(window, index) {
    if (!window || typeof window !== "object") {
        return null;
    }
    if (window.unlimited === true || window.text === true || typeof window.balance === "number") {
        return null;
    }
    const remaining = remainingPct(window.remaining);
    const used = window.used;
    if (remaining === null && (typeof used !== "number" || !Number.isFinite(used) || used < 0)) {
        return null;
    }
    return {
        label: cleanText(window.name, MAX_WINDOW_LABEL) || "额度 " + (index + 1),
        remaining_pct: remaining !== null ? remaining : Math.max(0, 100 - used),
        limit: typeof window.limit === "number" && Number.isFinite(window.limit) && window.limit > 0
            ? window.limit
            : null,
        unit: cleanText(window.unit, 8),
    };
}

function remainingPct(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function balanceText(card) {
    return typeof card.balance === "string" && card.balance.trim() ? cleanText(card.balance, 16) : "";
}

function pctColor(pct) {
    if (pct >= 50) {
        return "#79AD67";
    }
    if (pct >= 20) {
        return "#EF9A4F";
    }
    return "#E26663";
}

function clampPct(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(100, value));
}

function formatPct(value) {
    const rounded = Math.round(value * 10) / 10;
    return String(rounded);
}

function formatAmount(value) {
    if (value >= 100) {
        return String(Math.round(value));
    }
    return String(Math.round(value * 10) / 10);
}

function unitLabel(unit) {
    const normalized = normalize(unit);
    if (normalized === "credits" || normalized === "credit" || normalized === "积分") {
        return "积分";
    }
    return cleanText(unit, 6);
}

function cleanText(value, max) {
    if (typeof value !== "string") {
        return "";
    }
    const text = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
    return max ? clipText(text, max) : text;
}

function clipText(text, max) {
    const chars = Array.from(text);
    return chars.length > max ? chars.slice(0, max).join("") : text;
}

function normalize(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function errorFlag(value) {
    if (value === null || value === undefined || value === false || value === 0) {
        return false;
    }
    return typeof value !== "string" || value.trim() !== "";
}
