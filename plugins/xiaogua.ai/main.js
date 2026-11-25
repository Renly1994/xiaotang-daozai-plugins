// 小米 MiMo 额度来源，按 Key 类型分两种展示：
// - Token Plan（tp- Key）：额度面板画百分比环；常驻位画小环 + 百分数
// - 充值余额（sk- Key）：额度面板逐行余额；常驻位画小米标 + ¥金额
// refresh 每次从头运行，跨次记忆只通过返回的 storage 传递。
const MAX_LABEL = 40;
const MAX_UNIT = 12;

function toNum(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
}

function round2(value) {
    return Math.round(value * 100) / 100;
}

function clampText(text, fallback, max) {
    const raw = String(text == null ? "" : text).replace(/[\u0000-\u001f\u007f]/g, " ").trim();
    return raw ? raw.slice(0, max) : fallback;
}

// 接口给出的时间是 UTC 文本 "YYYY-MM-DD HH:mm:ss"
function parseUtcText(text) {
    if (typeof text !== "string" || text.length < 19) return NaN;
    return Date.parse(text.replace(" ", "T") + "Z");
}

function rememberedResetAt(storage, nowMs) {
    const v = storage && Number(storage.resetAt);
    return Number.isFinite(v) && v > nowMs / 1000 ? v : 0;
}

// 常驻小画布：高 22、宽 1-156、最多 60 个图元
function pinnedCanvasForPercent(pct) {
    const sweep = Math.round(pct * 3.6 * 10) / 10;
    const label = Math.round(pct) + "%";
    return {
        width: Math.min(156, Math.max(56, 30 + label.length * 11)),
        nodes: [
            { circle: [11, 11, 9], stroke: "$track", width: 3 },
            { arc: { c: [11, 11], r: 9, start: -90, sweep: sweep }, stroke: "$accent", width: 3, cap: "round" },
            { text: label, at: [27, 17], size: 16, weight: 650, fill: "$text" }
        ]
    };
}

function pinnedCanvasForAmount(amountText) {
    const label = "¥" + amountText;
    return {
        width: Math.min(156, Math.max(64, 30 + label.length * 11)),
        nodes: [
            { image: "images/mi.png", rect: [0, 0, 21, 21], fit: "contain" },
            { text: label, at: [27, 17], size: 16, weight: 650, fill: "$text" }
        ]
    };
}

function fromTokenPlan(text, settings, storage, nowMs) {
    const data = JSON.parse(text);
    const quota = data && data.quota;
    if (!quota) return null;

    const remaining = toNum(quota.remaining_credits);
    const total = toNum(quota.total_credits);
    if (!Number.isFinite(remaining) || !Number.isFinite(total) || total <= 0) return null;

    // 只输出百分比：宿主据此画额度环并在环中标百分数
    let pct = (remaining / total) * 100;
    if (!Number.isFinite(pct)) return null;
    pct = Math.min(100, Math.max(0, Math.round(pct * 10) / 10));

    const period = data.period || {};
    const startMs = parseUtcText(period.start_at);
    let resetMs = parseUtcText(period.end_at);
    if (!Number.isFinite(resetMs)) {
        const remembered = rememberedResetAt(storage, nowMs);
        if (remembered) resetMs = remembered * 1000;
    }

    const win = { label: clampText(settings.quota_label, "本期剩余", MAX_LABEL), remaining_pct: pct };
    if (Number.isFinite(resetMs)) {
        win.reset_at = Math.floor(resetMs / 1000);
        if (Number.isFinite(startMs) && resetMs > startMs) {
            win.period_secs = Math.floor((resetMs - startMs) / 1000);
        }
    }

    const at = Math.floor(nowMs / 1000);
    const resetDate = win.reset_at
        ? new Date(win.reset_at * 1000).toISOString().slice(0, 10)
        : "";

    return {
        windows: [win],
        pinned: { canvas: pinnedCanvasForPercent(pct) },
        status: {
            state: "succeeded",
            label: "小米 MiMo 套餐额度",
            summary: "本期剩余 " + Math.round(pct) + "%（" + remaining + " / " + total + " 积分）",
            progress_pct: pct,
            metrics: [
                { label: "本期剩余", value: Math.round(pct) + "%" },
                { label: "已用积分", value: String(Math.round(total - remaining)) }
            ].concat(resetDate ? [{ label: "重置日期", value: resetDate }] : []),
            observed_at: at,
            expires_at: at + 3600
        },
        storage: {
            mode: "token_plan",
            pct: pct,
            resetAt: win.reset_at || 0,
            at: at
        }
    };
}

function fromBalance(text, settings, storage, nowMs) {
    const data = JSON.parse(text);
    const info = data && data.balance_infos && data.balance_infos[0];
    if (!info) return null;

    const total = toNum(info.total_available);
    if (!Number.isFinite(total)) return null;

    const currency = String(info.currency || "CNY");
    const unit = clampText(currency === "CNY" ? "元" : currency, "元", MAX_UNIT);
    const cash = toNum(info.cash_balance);
    const gift = toNum(info.gift_balance);

    const windows = [{
        label: clampText(settings.balance_label, "可用余额", MAX_LABEL),
        remaining: Math.max(0, round2(total)),
        unit: unit
    }];
    if (Number.isFinite(cash)) {
        windows.push({ label: "充值", remaining: Math.max(0, round2(cash)), unit: unit });
    }
    if (Number.isFinite(gift)) {
        windows.push({ label: "赠送", remaining: Math.max(0, round2(gift)), unit: unit });
    }

    // 余额不做周期重置：不填 limit、不填 reset_at，宿主按余额列表绘制，不出现百分比环
    const rounded = round2(Math.max(0, total));
    const at = Math.floor(nowMs / 1000);

    return {
        windows: windows.slice(0, 3),
        pinned: { canvas: pinnedCanvasForAmount(String(rounded)) },
        status: {
            state: "succeeded",
            label: "小米 MiMo 账户余额",
            summary: "总可用 " + rounded + " " + unit,
            metrics: windows.map(function (w) {
                return { label: w.label, value: w.remaining + " " + w.unit };
            }),
            observed_at: at,
            expires_at: at + 3600
        },
        storage: {
            mode: "balance",
            remaining: windows[0].remaining,
            unit: unit,
            at: at
        }
    };
}

function refresh(input) {
    const settings = (input && input.settings) || {};
    const storage = (input && input.storage) || null;
    const sources = (input && input.sources) || {};
    const nowMs = input && typeof input.now === "number" ? input.now : Date.now();

    const readers = [
        ["token_plan", fromTokenPlan],
        ["balance", fromBalance]
    ];

    for (let i = 0; i < readers.length; i += 1) {
        const key = readers[i][0];
        const read = readers[i][1];
        const source = sources[key];
        if (!source || source.status !== "ready" || typeof source.text !== "string") continue;

        let result = null;
        try {
            result = read(source.text, settings, storage, nowMs);
        } catch (error) {
            result = null;
        }
        if (result && result.windows && result.windows.length > 0) {
            return {
                quota: { windows: result.windows },
                pinned: result.pinned,
                status: result.status,
                storage: result.storage
            };
        }
    }

    // 未授权、读取失败或响应无法解析时撤下全部读数，保留原有私有数据
    if (storage) return { quota: null, pinned: null, status: null, storage: storage };
    return { quota: null, pinned: null, status: null };
}
