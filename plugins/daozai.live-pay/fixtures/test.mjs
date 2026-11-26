import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync, readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {runInNewContext} from "node:vm";

const dir = new URL("../", import.meta.url);
const read = name => readFileSync(new URL(name, dir), "utf8");
const manifest = JSON.parse(read("plugin.json"));
const defaults = Object.fromEntries(manifest.settings.map(field => [field.key, field.default]));
const cases = {
    unset: "setup",
    before: "before",
    start: "working",
    working: "working",
    "unpaid-break": "unpaid-break",
    "paid-break": "paid-break",
    "break-ended": "working",
    "no-breaks": "working",
    done: "done",
    "done-already-notified": "done",
    "done-late": "done",
    "day-off": "day-off",
    "overnight-break": "unpaid-break",
    "overnight-paid": "paid-break",
    "overnight-done": "done",
    "midnight-done": "done",
    "invalid-overlap": "invalid",
    "invalid-bounds": "invalid",
    "invalid-no-pay": "invalid",
    "invalid-no-days": "invalid",
    "pinned-countdown": "working",
    "pinned-rotate-amount": "working",
    "pinned-rotate-countdown": "working",
    "custom-payday-working": "working",
    "custom-overnight-cutoff": "working",
    "custom-payroll-gap": "working",
    "short-month-payday": "setup",
    "short-month-payroll": "working"
};

const engine = runInNewContext(`${read("main.js")}\n({computeState, refresh, toCanvas})`);
const at = local => Date.parse(`${local}+08:00`) / 1000;
const date = "2026-11-24T";
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);
const stateByName = {};
const outputByName = {};
const exe = process.argv[2];

for (const file of readdirSync(new URL("fixtures/", dir)).filter(name => name.endsWith(".json")).sort()) {
    const name = file.replace(/\.json$/, "");
    const mock = JSON.parse(read(`fixtures/${file}`));
    const input = {...mock, settings: {...defaults, ...mock.settings}, tz: {offset_minutes: 480}};
    const state = engine.computeState(input);
    const output = JSON.parse(JSON.stringify(engine.refresh(input)));
    assert.equal(state.phase, cases[name], name);
    assert.deepEqual(output.canvas, JSON.parse(JSON.stringify(engine.toCanvas(state))), name);
    assert.equal(output.canvas.height, 200, name);
    stateByName[name] = state;
    outputByName[name] = output;
    if (exe) {
        const run = spawnSync(exe, ["--plugin-test", fileURLToPath(new URL("plugin.json", dir)),
            "--input", fileURLToPath(new URL(`fixtures/${file}`, dir))], {
            encoding: "utf8", windowsHide: true
        });
        assert.equal(run.status, 0, `${file}\n${run.error ?? ""}\n${run.stderr}\n${run.stdout}`);
        const raw = run.stdout.split(/\r?\n/).find(line => line.startsWith("{"));
        assert.deepEqual(JSON.parse(raw), output, file);
    }
    console.log(`${name} 通过${exe ? "（含宿主）" : ""}`);
}

assert.equal(Object.keys(stateByName).length, Object.keys(cases).length);
const start = stateByName.start;
assert.equal(start.shiftsPerCycle, 21);
assert.equal(start.payable, 27000);
closeTo(start.rate, 22000 / 21 / 27000);
assert.equal(start.earned, 0);
const meterDigits = canvas => canvas.nodes.filter(node => node.group?.[0]?.id?.startsWith("meter-"));
const startDigits = meterDigits(outputByName.start.canvas);
assert.equal(startDigits.length, 3);
assert.deepEqual(startDigits.map(node => node.group[0].fill), ["$text", "$text", "#3DDC84"]);
assert.ok(startDigits.every(node => node.clip[2] === 16 && node.group[0].roll));
assert.equal(meterDigits(engine.toCanvas({...start, earned: 999.98})).length, 6);
assert.equal(start.nextBoundary, at(`${date}12:00:00`));
assert.equal(stateByName.before.nextBoundary, at(`${date}09:00:00`));
assert.equal(stateByName["unpaid-break"].nextBoundary, at(`${date}13:30:00`));
assert.equal(outputByName["unpaid-break"].canvas.binds.cash.counter.per_second, 0);
assert.equal(stateByName["paid-break"].payable, 27000);
assert.equal(stateByName["paid-break"].nextBoundary, at(`${date}15:30:00`));
closeTo(outputByName["paid-break"].canvas.binds.cash.counter.per_second, start.rate);
closeTo(stateByName["break-ended"].earned, stateByName["paid-break"].earned + 1800 * start.rate);
assert.equal(stateByName["no-breaks"].payable, 32400);
closeTo(stateByName["no-breaks"].earned, 22000 / 21 / 3);
assert.equal(outputByName.done.notice.title, "下班啦");
assert.equal(outputByName.done.notice.body, undefined);
assert.equal(outputByName["done-already-notified"].notice, undefined);
assert.equal(outputByName["done-already-notified"].storage.last_notice, "off-2026-11-24");
assert.equal(outputByName["done-late"].notice, undefined);
assert.equal(stateByName["day-off"].nextStart, at("2026-11-30T09:00:00"));
assert.equal(stateByName["overnight-break"].shiftStart, at("2026-08-31T22:00:00"));
assert.equal(stateByName["overnight-break"].nextBoundary, at("2026-09-01T00:30:00"));
assert.equal(stateByName["overnight-paid"].payable, 25200);
assert.equal(stateByName["overnight-paid"].shiftsPerCycle, 21);
assert.equal(outputByName["overnight-done"].notice.id, "off-2026-08-31");
assert.equal(outputByName["midnight-done"].notice.id, "off-2026-11-27");
const pet = name => outputByName[name].canvas.nodes.find(node => node.pet).pet;
assert.equal(pet("working").mood, "expressions");
assert.equal(pet("working").motion, "run");
assert.equal(pet("working").at[0].bind, "worked");
assert.deepEqual(pet("unpaid-break"), pet("paid-break"));
assert.equal(pet("paid-break").mood, "sleeping");
assert.equal(pet("paid-break").motion, "none");
assert.equal(pet("done").mood, "praised");
assert.equal(pet("done").motion, "bob");
const [finishTitle, finishLabel, finishAmount] = outputByName.done.canvas.nodes.slice(0, 3);
assert.deepEqual([finishTitle.text, finishLabel.text, finishAmount.text], ["通关！", "今天到手", "¥{cash}"]);
assert.ok([finishTitle, finishLabel, finishAmount].every(node => node.align === "center"));
assert.equal(finishLabel.at[0], finishAmount.at[0]);
assert.equal(finishTitle.at[0] - finishLabel.at[0], 8);
assert.equal(outputByName.done.canvas.nodes.find(node => node.burst).id, "finish-2026-11-24");
assert.equal(outputByName["done-already-notified"].canvas.nodes.find(node => node.burst).id, "finish-2026-11-24");
assert.equal(outputByName["pinned-countdown"].pinned.canvas.binds.remaining.countdown.target_at, at(`${date}18:00:00`));
for (const name of ["pinned-rotate-amount", "pinned-rotate-countdown"]) {
    const [amount, countdown] = outputByName[name].pinned.canvas;
    assert.equal(amount.fit_width, true);
    assert.equal(countdown.fit_width, true);
    assert.equal(amount.height, 22);
    assert.equal(countdown.height, 22);
    assert.equal(amount.binds.cash.counter.per_second, start.rate);
    assert.equal(countdown.binds.remaining.countdown.target_at, at(`${date}18:00:00`));
    assert.ok(amount.nodes.some(node => node.roll));
}
for (const name of ["invalid-overlap", "invalid-bounds", "invalid-no-pay", "invalid-no-days", "unset"]) {
    assert.equal(outputByName[name].pinned, undefined, name);
    assert.equal(outputByName[name].canvas.binds, undefined, name);
}

const textIn = nodes => nodes.flatMap(node => node.group ? textIn(node.group) : [node.text ?? ""]).join(" ");
const assertPayday = (canvas, day, countdown) => {
    const labels = textIn(canvas.nodes);
    assert.match(labels, day);
    assert.match(labels, countdown);
};

const custom = stateByName["custom-payday-working"];
const customOutput = outputByName["custom-payday-working"];
assert.equal(custom.shiftsPerCycle, 22);
closeTo(custom.daily, 15000 / 22);
closeTo(custom.earned, custom.daily * 12900 / 27000);
assert.equal(customOutput.canvas.binds.remaining.countdown.target_at, at("2026-11-26T18:00:00"));
assertPayday(customOutput.canvas, /12\s*月\s*5\s*日/, /还有\s*9\s*天/);
assertPayday(customOutput.pinned.canvas, /发薪/, /还有\s*9\s*天/);
assert.equal(customOutput.pinned.canvas.height, 22);
assert.doesNotMatch(textIn(outputByName.working.canvas.nodes), /发薪/);

function stateAt(name, local, settings = {}) {
    const mock = JSON.parse(read("fixtures/" + name + ".json"));
    return engine.computeState({...mock, now: at(local) * 1000, tz: {offset_minutes: 480},
        settings: {...defaults, ...mock.settings, ...settings}});
}

const overnight = stateByName["custom-overnight-cutoff"];
assert.equal(overnight.shiftDate, "2026-11-15");
assert.equal(overnight.shiftsPerCycle, 31);
assert.equal(overnight.daily, 1000);
closeTo(stateAt("custom-overnight-cutoff", "2026-11-16T23:00:00").daily, 31000 / 30);

const gap = stateByName["custom-payroll-gap"];
assert.equal(gap.earned, 0);
assert.equal(gap.daily, 0);
assert.equal(outputByName["custom-payroll-gap"].canvas.binds.cash.counter.per_second, 0);
for (const day of [5, 25]) {
    const active = stateAt("custom-payroll-gap", "2026-11-" + String(day).padStart(2, "0") + "T14:05:00");
    assert.equal(active.shiftsPerCycle, 15);
    closeTo(active.daily, 22000 / 15);
}

const shortPayday = outputByName["short-month-payday"];
assertPayday(shortPayday.canvas, /2\s*月\s*28\s*日/, /今天发薪/);
assertPayday(shortPayday.pinned.canvas, /发薪/, /今天发薪/);
assertPayday(engine.toCanvas(stateAt("short-month-payday", "2027-02-27T14:05:00")), /2\s*月\s*28\s*日/, /还有\s*1\s*天/);
assertPayday(engine.toCanvas(stateAt("short-month-payday", "2027-03-01T14:05:00")), /3\s*月\s*31\s*日/, /还有\s*30\s*天/);
assert.equal(stateAt("short-month-payroll", "2027-02-27T14:05:00").shiftsPerCycle, 28);
assert.equal(stateByName["short-month-payroll"].shiftsPerCycle, 31);
assert.equal(stateByName["short-month-payroll"].daily, 1000);
