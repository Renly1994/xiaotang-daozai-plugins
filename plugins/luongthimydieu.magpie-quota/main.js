// magpie 额度来源：只读本机 magpie 的额度缓存，取一个账号展示。
// 取数地址由用户在「授权数据源」中选择：
//   http://127.0.0.1:3425/v1/magpie/quotas/cards
// 只请求一次；不读凭据，也不触发 magpie 向上游刷新。

const MAX_WINDOWS = 3;
const MAX_LABEL = 40;
const MAX_TIMESTAMP = 253402300799;
const AUTO = ["", "自动", "自动选择", "auto"];

function refresh(input) {
    const settings = (input && input.settings) || {};
    const source = input && input.source;
    const storage = usableStorage(input && input.storage);
    const windows = readWindows(settings, source, storage);
    // 额度未知时返回 null，由宿主撤下读数；绝不用 0 冒充额度。
    return { quota: windows ? { windows: windows } : null, storage: storage };
}

function readWindows(settings, source, storage) {
    if (!source || source.status !== "ready" || typeof source.text !== "string") {
        return null;
    }
    const cards = parseCards(source.text);
    if (!cards) {
        return null;
    }

    const wanted = normalize(settings.account);
    const card = isAuto(wanted)
        ? autoCard(cards, storage)
        : firstCard(cards, candidate => matches(candidate, wanted)
            && cardUsable(candidate) && cardWindows(candidate).length > 0);
    if (!card || !cardUsable(card)) {
        return null;
    }
    const windows = cardWindows(card);
    return windows.length ? windows.slice(0, MAX_WINDOWS) : null;
}

// 自动模式：优先沿用上次固定的账号；该账号仍在但本次不可读时按未知处理，
// 不悄悄换成另一个账号。账号消失后才重新选并更新固定项。
function autoCard(cards, storage) {
    const pinned = typeof storage.account === "string" ? storage.account : "";
    if (pinned) {
        const found = firstCard(cards, candidate => cardKey(candidate) === pinned);
        if (found) {
            return found;
        }
    }
    const card = firstCard(cards, candidate => cardUsable(candidate) && cardWindows(candidate).length > 0);
    if (card) {
        storage.account = cardKey(card);
    }
    return card;
}

function firstCard(cards, test) {
    for (let i = 0; i < cards.length; i++) {
        if (cards[i] && typeof cards[i] === "object" && test(cards[i])) {
            return cards[i];
        }
    }
    return null;
}

function matches(card, wanted) {
    const fields = [card.provider, card.name, card.user];
    for (let i = 0; i < fields.length; i++) {
        if (normalize(fields[i]) === wanted) {
            return true;
        }
    }
    return false;
}

function cardKey(card) {
    return JSON.stringify([
        normalize(card.from),
        normalize(card.provider),
        normalize(card.user),
        normalize(card.plan),
        normalize(card.name),
    ]);
}

function cardUsable(card) {
    // 条目级错误表示本次读数不可信；readError 表示当前读数取自更早的缓存。
    // 字段类型意外时也按错误处理：宁可报未知，也不把可疑读数当正常数据。
    return !errorFlag(card.error) && !errorFlag(card.pluginError) && !errorFlag(card.readError);
}

// 只保留能明确换算成百分比的窗口：
// unlimited 没有上限，text 只有厂商文字，balance 是钱包余额（used 不是读数）。
function cardWindows(card) {
    if (!Array.isArray(card.windows)) {
        return [];
    }
    const windows = [];
    for (let i = 0; i < card.windows.length; i++) {
        const window = card.windows[i];
        const mapped = mapWindow(window, i);
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
    const used = window.used;
    if (typeof used !== "number" || !Number.isFinite(used) || used < 0) {
        return null;
    }
    let remaining = 100 - used;
    remaining = Math.max(0, Math.min(100, remaining));
    remaining = Math.round(remaining * 100) / 100;
    const mapped = {
        label: cleanLabel(window.name, "额度 " + (index + 1)),
        remaining_pct: remaining === 0 ? 0 : remaining,
    };
    const reset = timestamp(window.resetsAt);
    if (reset !== null) {
        mapped.reset_at = reset;
    }
    return mapped;
}

function parseCards(text) {
    let payload;
    try {
        payload = JSON.parse(text);
    } catch (error) {
        return null;
    }
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) {
        return null;
    }
    return payload.data;
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

function cleanLabel(value, fallback) {
    let text = typeof value === "string" ? value : "";
    text = text.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim();
    if (!text) {
        text = fallback;
    }
    const chars = Array.from(text);
    return chars.length > MAX_LABEL ? chars.slice(0, MAX_LABEL).join("") : text;
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
