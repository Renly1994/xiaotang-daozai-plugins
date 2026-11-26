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
//   http://127.0.0.1:3425/v1/magpie/quotas/cards（推荐，只读缓存）
//   http://127.0.0.1:3425/v1/magpie/quotas?kept=1（旧版 magpie，参数只读缓存）
// 不带 kept 参数的地址会触发 magpie 向上游刷新，不要在引导文案里推荐。
// 同一平台的多个账号合并成一行；余额直接显示金额，积分显示剩余数量。
// 「AI 额度」页签保留读数：展示当前选中账号的前 3 个可换算窗口。

const COMPLETE_URL = "http://127.0.0.1:3425/v1/magpie/quotas/cards";
const LEGACY_URL = "http://127.0.0.1:3425/v1/magpie/quotas?kept=1";
const MAX_WINDOW_LABEL = 40;
const MAX_PLATFORM_NAME = 20;
const MAX_ROW_LABEL = 22;
const MAX_VALUE = 18;
const MAX_QUOTA_WINDOWS = 3;
const MAX_TIMESTAMP = 253402300799;
const CANVAS_WIDTH = 387;
// 页面总高 = 42（标题栏）+ 画布高度 + 16（底部留白）。岛仔状态页上限 348，
// 因此画布最高 290；超过会让底部圆角被窗口方角裁掉。
const CANVAS_HEIGHT = 290;
const MAX_RINGS = 4;
const CHART_TOP = 26;
const CHART_BOTTOM = 66;
const CHART_LEFT = 14;
const CHART_RIGHT = 373;
const CACHE_RIGHT = 373;
const STALE_CACHE_MS = 30 * 60 * 1000;
const AUTO = ["", "自动", "自动选择", "auto"];

const INDEX_LINES = ["当前地址只返回接口索引", COMPLETE_URL, "点地址复制，改为完整地址"];
const MISSING_LINES = ["该地址没有 magpie 额度接口", COMPLETE_URL, "点地址复制，核对端口和路径"];
const UNKNOWN_LINES = ["返回内容不是 magpie 额度接口", COMPLETE_URL, "点地址复制，核对完整地址"];
const SHAPE_LINES = ["返回数据不是 magpie 额度格式，请核对地址", COMPLETE_URL, "点地址复制，核对端口和路径"];
const UNAUTHORIZED_LINES = [
    "设置 → 插件 → 已安装 → 授权数据源",
    COMPLETE_URL,
    "点地址复制，粘贴后确认授权",
    "旧版：" + LEGACY_URL,
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
    shape: {
        id: "bad-url-shape",
        title: "数据格式不符",
        body: "data 数组里没有可识别的 magpie 额度卡片。请核对完整地址与端口。",
    },
};

function refresh(input) {
    const settings = (input && input.settings) || {};
    const storage = usableStorage(input && input.storage);
    const source = input && input.source;
    if (!source || source.status !== "ready" || typeof source.text !== "string") {
        return sourceView(source, storage);
    }

    const parsed = parseSource(source.text);
    if (parsed.kind === "index") {
        return messageView("error", "授权地址不完整", INDEX_LINES, NOTICES.index, storage);
    }
    if (parsed.kind === "missing") {
        return messageView("error", "授权地址不存在", MISSING_LINES, NOTICES.missing, storage);
    }
    if (parsed.kind === "unknown") {
        return messageView("error", "数据源不是额度接口", UNKNOWN_LINES, NOTICES.unknown, storage);
    }
    if (parsed.kind === "shape") {
        return messageView("error", "数据格式不符", SHAPE_LINES, NOTICES.shape, storage);
    }

    const cards = parsed.cards;
    const platforms = groupPlatforms(cards);
    const series = usageSeries(cards, input && input.today);
    const account = selectAccount(cards, settings, storage);

    // 额度页签沿用 1.1.0 的读数：当前选中账号的前 3 个可换算窗口。
    return {
        quota: quotaView(account),
        storage: storage,
        status: {
            state: platforms.length ? "succeeded" : "idle",
            label: "magpie 额度",
        },
        canvas: dataCanvas(platforms, series, cacheLabel(cards)),
    };
}

// 宿主在未授权、离线或意外状态时不会给出读数。
// 地址不可用分不清「magpie 没运行」和「路径不对」，因此这里不发提醒，只做页面引导。
function sourceView(source, storage) {
    if (!source || source.status === "unconfigured") {
        return messageView("idle", "用默认地址授权？", UNAUTHORIZED_LINES, NOTICE_UNAUTHORIZED, storage);
    }
    return messageView(
        source.status === "offline" ? "offline" : "idle",
        "magpie 未运行或地址不通",
        OFFLINE_LINES,
        null,
        storage
    );
}

function messageView(state, title, lines, notice, storage) {
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
        storage: storage,
        status: { state: state, label: clipText(title, 40) },
        canvas: { height: 180, nodes: nodes },
    };
    if (notice) {
        result.notice = notice;
    }
    return result;
}

// 当前选中账号：账号设置为「自动选择」时沿用 1.1.0 的固定/自动逻辑。
// 手动填了具体账号但找不到唯一匹配时按未知处理，不回退自动选择，
// 也不改写固定账号，避免页签拿别的账号冒充（与 1.0.0 口径一致）。
function selectAccount(cards, settings, storage) {
    const wanted = normalize(settings.account);
    if (isAuto(wanted)) {
        return autoCard(cards, storage);
    }
    return manualCard(cards, wanted);
}

// 显示名、厂商、登录名、别名任一完全一致，且只有一个匹配时才算数。
function manualCard(cards, wanted) {
    const matches = cards.filter(card =>
        [card.provider, card.name, card.alias, card.user].some(field => normalize(field) === wanted));
    return matches.length === 1 ? matches[0] : null;
}

// 只有能确认固定账号已经消失时才改选。身份重复或数据缺少身份字段时按未知处理。
function autoCard(cards, storage) {
    const pinned = pinnedIdentity(storage.account);
    if (pinned) {
        const candidates = cards.filter(card => couldBeAccount(card, pinned));
        if (candidates.length > 0) {
            const candidate = candidates[0];
            const identity = cardIdentity(candidate);
            if (candidates.length !== 1 || identity[1] !== pinned[1] || (pinned[2] && identity[2] !== pinned[2])) {
                return null;
            }
            storage.account = JSON.stringify(identity);
            return candidate;
        }
    }

    const card = cards.find(candidate => {
        const identity = cardIdentity(candidate);
        return identity[0] && cardUsable(candidate) && cardWindows(candidate).length > 0
            && !cards.some(other => other !== candidate && couldBeAccount(other, identity));
    });
    if (card) {
        storage.account = JSON.stringify(cardIdentity(card));
    }
    return card;
}

function cardIdentity(card) {
    // Magpie 将远端来源 ID 加在 provider 前，保留完整路径以区分来源。
    return [normalize(card.provider), normalize(card.user), normalize(card.kind)];
}

function couldBeAccount(card, [provider, user, kind]) {
    const [candidateProvider, candidateUser, candidateKind] = cardIdentity(card);
    return candidateProvider === provider
        && (!user || !candidateUser || candidateUser === user)
        && (!kind || !candidateKind || candidateKind === kind);
}

function pinnedIdentity(value) {
    if (typeof value !== "string") {
        return null;
    }
    let key;
    try {
        key = JSON.parse(value);
    } catch (error) {
        return null;
    }
    if (!Array.isArray(key) || !key.every(part => typeof part === "string")) {
        return null;
    }
    if (key.length === 5 && key[1]) {
        // 兼容试装版保存的旧身份，后续使用接口提供的账号类型。
        return [key[1], key[2], ""];
    }
    return key.length === 3 && key[0] ? key : null;
}

function isAuto(wanted) {
    for (let i = 0; i < AUTO.length; i++) {
        if (wanted === AUTO[i]) {
            return true;
        }
    }
    return false;
}

function usableStorage(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

// 额度页签只保留能换算成百分比的窗口，形状与 1.1.0 一致。
function quotaView(card) {
    if (!card || !cardUsable(card)) {
        return null;
    }
    const mapped = cardWindows(card);
    const windows = [];
    for (let i = 0; i < mapped.length && windows.length < MAX_QUOTA_WINDOWS; i++) {
        const window = { label: mapped[i].label, remaining_pct: mapped[i].remaining_pct };
        if (mapped[i].reset_at !== undefined) {
            window.reset_at = mapped[i].reset_at;
        }
        windows.push(window);
    }
    return windows.length ? { windows: windows } : null;
}

// 按平台（provider）合并账号。条目报错且没有余额的账号直接舍弃。
function groupPlatforms(cards) {
    const groups = [];
    const index = Object.create(null);
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
    const windowMap = Object.create(null);
    const balances = [];
    const walletKeys = Object.create(null);
    let unlimited = false;

    for (let i = 0; i < group.cards.length; i++) {
        const card = group.cards[i];
        const balance = balanceText(card);
        if (balance) {
            const key = walletKey(card, i);
            if (!walletKeys[key]) {
                walletKeys[key] = true;
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

// 钱包去重：同一 sharedBalance 视为同一个钱包；未声明共享的按账号身份各算各的。
// 不能用金额做键，否则两个独立的同额钱包会被合成一个。
function walletKey(card, position) {
    const shared = normalize(cleanText(card.sharedBalance, 60));
    if (shared) {
        return "shared\u0000" + shared;
    }
    const parts = [card.provider, card.name, card.alias, card.user, card.kind].map(normalize);
    if (parts.some(part => part)) {
        return "account\u0000" + parts.join("\u0000");
    }
    return "position\u0000" + position;
}

// 合并键带上单位：同单位同口径才合并，空单位与非空单位不合并。
function addWindow(map, window) {
    const key = (normalize(window.label) || "-") + "\u0000" + normalize(window.unit);
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

// 折线只聚合同一单位：先按单位分桶，取记录最多的单位作为主系列。
// 日期轴固定为最近 7 个自然日，缺日留空档，不用相邻日期补位。
// 轴尾取宿主给出的 today（YYYY-MM-DD），「不晚于今天」：晚于今天的日期不画，
// 也不参与锚点计算，避免一条 2099 的脏数据把真实数据挤出窗口。
// 日期必须能完整回环解析（2026-13-45 这类溢出日期整条跳过），不影响其它记录。
// 未提供 today 时今天不可知，退回旧行为锚定最后一条有效数据，不猜宿主时区。
function usageSeries(cards, today) {
    const todayKey = validDay(today);
    const buckets = Object.create(null);
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const daily = card.daily;
        if (!daily || !Array.isArray(daily.days)) {
            continue;
        }
        const unit = dailyUnit(card, daily);
        const key = normalize(unit);
        let bucket = buckets[key];
        if (!bucket) {
            bucket = { unit: unit, totals: Object.create(null), records: 0 };
            buckets[key] = bucket;
        }
        for (let j = 0; j < daily.days.length; j++) {
            const day = daily.days[j];
            const dayKey = day && validDay(day.day);
            if (!dayKey || (todayKey && dayKey > todayKey)) {
                continue;
            }
            const used = typeof day.used === "number" && Number.isFinite(day.used) && day.used >= 0
                ? day.used
                : null;
            if (used === null) {
                continue;
            }
            bucket.totals[dayKey] = (bucket.totals[dayKey] || 0) + used;
            bucket.records += 1;
        }
    }

    let primary = null;
    for (const key in buckets) {
        if (Object.prototype.hasOwnProperty.call(buckets, key) && betterSeries(buckets[key], primary)) {
            primary = buckets[key];
        }
    }
    if (!primary) {
        return [];
    }
    const days = Object.keys(primary.totals);
    if (!days.length) {
        return [];
    }
    days.sort();
    const slots = lastSevenDays(todayKey || days[days.length - 1]);
    const series = [];
    for (let i = 0; i < slots.length; i++) {
        const value = primary.totals[slots[i]];
        series.push(value === undefined ? null : Math.round(value * 100) / 100);
    }
    return series;
}

function betterSeries(candidate, current) {
    if (!current) {
        return true;
    }
    if (candidate.records !== current.records) {
        return candidate.records > current.records;
    }
    const candidateTotal = seriesTotal(candidate);
    const currentTotal = seriesTotal(current);
    if (candidateTotal !== currentTotal) {
        return candidateTotal > currentTotal;
    }
    return candidate.unit < current.unit;
}

function seriesTotal(bucket) {
    let total = 0;
    for (const day in bucket.totals) {
        if (Object.prototype.hasOwnProperty.call(bucket.totals, day)) {
            total += bucket.totals[day];
        }
    }
    return total;
}

// 每日用量本身不带单位，按 daily.window 对应的窗口取单位。
function dailyUnit(card, daily) {
    const direct = cleanText(daily.unit, 8);
    if (direct) {
        return direct;
    }
    const label = normalize(daily.window);
    if (!label || !Array.isArray(card.windows)) {
        return "";
    }
    for (let i = 0; i < card.windows.length; i++) {
        const window = card.windows[i];
        if (window && normalize(window.name) === label) {
            const unit = cleanText(window.unit, 8);
            if (unit) {
                return unit;
            }
        }
    }
    return "";
}

// 只接受形如 YYYY-MM-DD 且能回环解析的日期：Date.UTC 会把 13 月、45 日这类
// 越界值滚到下一个月或下一年，回读分量不一致就说明原文不是有效日期。
function validDay(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }
    const parts = value.split("-").map(Number);
    const when = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    if (when.getUTCFullYear() !== parts[0]
        || when.getUTCMonth() !== parts[1] - 1
        || when.getUTCDate() !== parts[2]) {
        return null;
    }
    return value;
}

function lastSevenDays(latest) {
    const parts = latest.split("-").map(Number);
    const end = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    const days = [];
    for (let i = 6; i >= 0; i--) {
        days.push(new Date(end - i * 86400000).toISOString().slice(0, 10));
    }
    return days;
}

// 缓存时间取展示卡片里最早的 readAt：只要有一张是旧缓存，就不说成刚更新。
// 缺少或无法解析时不显示这一行。时刻直接采用 readAt 自带的本地时间
// （magpie 与本机同一时区），避免宿主运行时区与系统不一致时显示成别的时区。
function cacheLabel(cards) {
    let oldest = null;
    let clock = "";
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        // 被舍弃的报错账号不参与页面，也不该影响这行小字。
        if (!cardUsable(card) && !balanceText(card)) {
            continue;
        }
        const value = card.readAt;
        if (typeof value !== "string") {
            continue;
        }
        const milliseconds = Date.parse(value);
        if (!Number.isFinite(milliseconds)) {
            continue;
        }
        if (oldest === null || milliseconds < oldest) {
            oldest = milliseconds;
            clock = clockOf(value, milliseconds);
        }
    }
    if (oldest === null) {
        return "";
    }
    const stale = Date.now() - oldest > STALE_CACHE_MS;
    return (stale ? "较早缓存 " : "缓存 ") + clock;
}

function clockOf(value, milliseconds) {
    const match = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/.exec(value);
    if (match) {
        return match[1] + ":" + match[2];
    }
    const when = new Date(milliseconds);
    return pad2(when.getHours()) + ":" + pad2(when.getMinutes());
}

function pad2(value) {
    return value < 10 ? "0" + value : String(value);
}

function dataCanvas(platforms, series, cache) {
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
    if (cache) {
        // 唯一新增的视觉元素：一行缓存时间小字，列表模式下放到右下角避开首行。
        nodes.push({
            text: cache,
            at: [CACHE_RIGHT, plan.mode === "list" ? CANVAS_HEIGHT - 3 : 14],
            size: 9,
            fill: "$muted",
            align: "right",
        });
    }

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

// 缺日的位置留空档：连续的点连成一段，单点只画圆点，不跨空档连线。
function drawSeries(nodes, series) {
    const values = [];
    for (let i = 0; i < series.length; i++) {
        if (series[i] !== null && Number.isFinite(series[i])) {
            values.push(series[i]);
        }
    }
    if (series.length < 2 || values.length < 2) {
        nodes.push({ text: "暂无用量数据", at: [14, 50], size: 10, fill: "$muted" });
        return;
    }
    const max = Math.max.apply(null, values);
    const min = Math.min.apply(null, values);
    const low = Math.min(min, 0);
    const span = max > low ? max - low : 1;
    const points = [];
    for (let i = 0; i < series.length; i++) {
        if (series[i] === null || !Number.isFinite(series[i])) {
            points.push(null);
            continue;
        }
        const x = CHART_LEFT + (CHART_RIGHT - CHART_LEFT) * i / (series.length - 1);
        const y = CHART_BOTTOM - (series[i] - low) / span * (CHART_BOTTOM - CHART_TOP);
        points.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    }

    let run = [];
    let lastPoint = null;
    const flush = () => {
        if (run.length >= 2) {
            nodes.push({ points: run, area: CHART_BOTTOM, fill: "$accent", opacity: 0.14 });
            nodes.push({ points: run, stroke: "$accent", width: 2, cap: "round" });
        } else if (run.length === 1) {
            nodes.push({ circle: [run[0][0], run[0][1], 2], fill: "$accent" });
        }
        if (run.length) {
            lastPoint = run[run.length - 1];
        }
        run = [];
    };
    for (let i = 0; i < points.length; i++) {
        if (points[i]) {
            run.push(points[i]);
        } else {
            flush();
        }
    }
    flush();

    if (lastPoint) {
        nodes.push({ circle: [lastPoint[0], lastPoint[1], 2.5], fill: "$accent" });
    }
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
        nodes.push({ text: "账号均无额度", at: [14, plan.listY + 26], size: 12, fill: "$muted" });
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

// 识别常见错址：接口索引、HTTP 200 却返回 404 文本、非 magpie 的 JSON 或其它内容。
// 宿主对非 2xx 一律报离线，插件拿不到真实 404 的正文，因此离线不在这里判断。
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
    const cards = payload.data.filter(card => card && typeof card === "object" && !Array.isArray(card));
    // 有 data 数组但里面没有一张带厂商或显示名的卡片，说明不是额度数据。
    if (cards.length && !cards.some(recognizableCard)) {
        return { kind: "shape" };
    }
    return { kind: "cards", cards: cards };
}

function recognizableCard(card) {
    return Boolean(cleanText(card.provider, 1) || cleanText(card.name, 1));
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
    const mapped = {
        label: cleanText(window.name, MAX_WINDOW_LABEL) || "额度 " + (index + 1),
        remaining_pct: remaining !== null ? remaining : Math.max(0, 100 - used),
        limit: typeof window.limit === "number" && Number.isFinite(window.limit) && window.limit > 0
            ? window.limit
            : null,
        unit: cleanText(window.unit, 8),
    };
    const reset = timestamp(window.resetsAt);
    if (reset !== null) {
        mapped.reset_at = reset;
    }
    return mapped;
}

function remainingPct(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function timestamp(value) {
    if (typeof value !== "string") {
        return null;
    }
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds)) {
        return null;
    }
    const seconds = Math.floor(milliseconds / 1000);
    return seconds >= 0 && seconds <= MAX_TIMESTAMP ? seconds : null;
}

// 合法数字 0 是有效读数；只有字段缺失或类型非法才算未知。
function balanceText(card) {
    if (typeof card.balance === "number" && Number.isFinite(card.balance) && card.balance >= 0) {
        const currency = cleanText(card.currency, 4);
        return cleanText(currency + formatAmount(card.balance), 16);
    }
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
