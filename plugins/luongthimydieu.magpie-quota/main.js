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
    const card = isAuto(wanted) ? autoCard(cards, storage) : manualCard(cards, wanted);
    if (!card || !cardUsable(card)) {
        return null;
    }
    const windows = cardWindows(card);
    return windows.length ? windows.slice(0, MAX_WINDOWS) : null;
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

function manualCard(cards, wanted) {
    const matches = cards.filter(card =>
        [card.provider, card.name, card.alias, card.user].some(field => normalize(field) === wanted));
    return matches.length === 1 ? matches[0] : null;
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
    const mapped = {
        label: cleanLabel(window.name, "额度 " + (index + 1)),
        remaining_pct: Math.max(0, 100 - used),
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
    return payload.data.filter(card => card && typeof card === "object" && !Array.isArray(card));
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
