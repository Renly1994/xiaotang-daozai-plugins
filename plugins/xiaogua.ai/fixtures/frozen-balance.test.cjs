const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "../main.js"), "utf8");
const refresh = vm.runInNewContext(script + "\nrefresh");
const balance = {
    status: "ready",
    text: JSON.stringify({ balance_infos: [{
        currency: "CNY", total_available: "100.00", frozen_balance: "20.00"
    }] })
};

for (const [mode, label, expected] of [
    ["available", "总余额（含冻结）", 100],
    ["spendable", "可消费余额", 80]
]) {
    test(mode + " with a nonzero frozen_balance", () => {
        const result = refresh({ sources: { balance }, settings: { balance_mode: mode } });
        const first = result.quota.windows[0];
        assert.equal(first.remaining, expected);
        assert.equal(first.label, label);
        assert.equal(first.unit, "元");
        assert.equal(result.pinned.canvas.nodes[1].text, "¥" + expected);
        assert.ok(result.status.metrics.some(metric =>
            metric.label === "冻结余额" && metric.value === "20 元"));
    });
}
