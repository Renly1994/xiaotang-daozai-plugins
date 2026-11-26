function toNum(value) {
    if (typeof value !== "number" && typeof value !== "string") return NaN;
    if (typeof value === "string" && value.trim() === "") return NaN;
    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
}

function round2(value) {
    return Math.round(value * 100) / 100;
}

function pinnedCanvas(amount, unit) {
    const label = unit === "元" ? "¥" + amount : amount + " " + unit;
    return {
        width: Math.min(156, Math.max(64, 30 + label.length * 10)),
        nodes: [
            { image: "images/wallet.png", rect: [0, 0, 21, 21], fit: "contain" },
            { text: label, at: [27, 17], size: label.length > 13 ? 13 : 16, weight: 650, fill: "$text" }
        ]
    };
}

function refresh(input) {
    const source = input && input.sources && input.sources.balance;
    const unavailable = { quota: null, pinned: null, status: null };
    if (input && input.storage) unavailable.storage = input.storage;
    if (!source || source.status !== "ready" || typeof source.text !== "string") return unavailable;

    let data;
    try {
        data = JSON.parse(source.text);
    } catch (error) {
        return unavailable;
    }

    const info = data && Array.isArray(data.balance_infos) && data.balance_infos[0];
    if (!info) return unavailable;
    const total = toNum(info.total_available);
    if (!Number.isFinite(total)) return unavailable;

    const currency = String(info.currency || "CNY").trim().toUpperCase();
    const unit = currency === "CNY" ? "元" : /^[A-Z]{3}$/.test(currency) ? currency : "币种未知";
    const frozen = toNum(info.frozen);
    const hasFrozen = Number.isFinite(frozen) && frozen >= 0;
    const settings = input.settings || {};
    const spendable = settings.balance_mode === "spendable" && hasFrozen;
    const amount = round2(spendable ? Math.max(0, total - frozen) : total);
    const label = spendable ? "可消费余额" : "总余额（含冻结）";
    const windows = [{ label: label, remaining: amount, unit: unit }];

    const cash = toNum(info.cash_balance);
    if (Number.isFinite(cash)) windows.push({ label: "现金余额", remaining: round2(cash), unit: unit });
    const gift = toNum(info.gift_balance);
    if (Number.isFinite(gift)) windows.push({ label: "赠送余额", remaining: round2(gift), unit: unit });

    const metrics = windows.map(function (window) {
        return { label: window.label, value: window.remaining + " " + window.unit };
    });
    if (hasFrozen) metrics.push({ label: "冻结余额", value: round2(frozen) + " " + unit });

    let summary = label + " " + amount + " " + unit;
    if (settings.balance_mode === "spendable" && !hasFrozen) summary += "（缺少冻结金额）";

    const now = typeof input.now === "number" ? input.now : Date.now();
    const at = Math.floor(now / 1000);
    return {
        quota: { windows: windows },
        pinned: { canvas: pinnedCanvas(amount, unit) },
        status: {
            state: "succeeded",
            label: "小米 MiMo 账户余额",
            summary: summary,
            metrics: metrics,
            observed_at: at,
            expires_at: at + 3600
        },
        storage: { mode: "balance", remaining: amount, unit: unit, at: at }
    };
}
