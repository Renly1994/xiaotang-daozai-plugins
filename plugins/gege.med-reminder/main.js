const DAY = 86400;
const MAX_MEDS = 24;
const MAX_TIMES = 8;
const KEEP_FIRED = 3 * DAY;
const ACCENT = "#7ED0A6";

function pad2(value) {
    return String(value).padStart(2, "0");
}

function clampInt(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
}

function clean(value, max) {
    const text = String(value ?? "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return [...text].slice(0, max).join("");
}

function parseTimes(value) {
    const parts = String(value ?? "").split(/[\s,，、;；]+/).filter(Boolean);
    const times = [];
    for (const part of parts) {
        const match = part.match(/^(\d{1,2})[:：](\d{1,2})$/);
        if (!match) continue;
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (hour > 23 || minute > 59) continue;
        const text = `${pad2(hour)}:${pad2(minute)}`;
        if (!times.includes(text)) times.push(text);
    }
    times.sort();
    return times.slice(0, MAX_TIMES);
}

function normalizeMed(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = typeof raw.id === "string" && raw.id ? raw.id : null;
    if (!id) return null;
    const name = clean(raw.name, 24);
    if (!name) return null;
    const times = Array.isArray(raw.times) ? parseTimes(raw.times.join(" ")) : [];
    if (!times.length) return null;
    return {
        id,
        name,
        dose: clean(raw.dose, 16),
        times,
        paused: Boolean(raw.paused),
        created_at: Number.isFinite(raw.created_at) ? raw.created_at : 0
    };
}

function dayStart(today, tzOffset) {
    return Date.parse(today + "T00:00:00Z") / 1000 - tzOffset;
}

function slotAt(today, tzOffset, time) {
    const [hour, minute] = time.split(":").map(Number);
    return dayStart(today, tzOffset) + hour * 3600 + minute * 60;
}

function shiftDay(today, days) {
    const stamp = Date.parse(today + "T00:00:00Z") + days * DAY * 1000;
    const date = new Date(stamp);
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function computeState(input) {
    const nowMs = Number(input.now);
    const now = Number.isFinite(nowMs) ? Math.floor(nowMs / 1000) : Math.floor(Date.now() / 1000);
    const tzOffset = Number((input.tz && input.tz.offset_minutes) || 0) * 60;
    const today = typeof input.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.today)
        ? input.today : "";
    const tomorrow = today ? shiftDay(today, 1) : "";
    const settings = input.settings || {};
    const windowSec = clampInt(settings.window, 1, 120, 10) * 60;
    const saved = input.storage || {};

    const meds = (Array.isArray(saved.meds) ? saved.meds : [])
        .map(normalizeMed).filter(Boolean).slice(0, MAX_MEDS);
    let nextId = clampInt(saved.next_id, 1, 99999, meds.length + 1);

    const prune = (map) => {
        const out = {};
        if (!map || typeof map !== "object") return out;
        for (const [key, value] of Object.entries(map)) {
            const at = Number(value);
            if (Number.isFinite(at) && at + KEEP_FIRED > now) out[key] = at;
        }
        return out;
    };
    const fired = prune(saved.fired);
    const taken = prune(saved.taken);

    const savedPick = saved.pick && typeof saved.pick === "object" ? saved.pick : {};
    let pickH = clampInt(savedPick.h, 0, 23, 8);
    let pickM = Math.round(clampInt(savedPick.m, 0, 59, 0) / 5) * 5 % 60;
    let pickTimes = parseTimes((Array.isArray(savedPick.times) ? savedPick.times : []).join(" "));
    let pickEcho = false;
    const savedConfirm = saved.confirm && typeof saved.confirm === 'object' ? saved.confirm : {};
    let confirmId = typeof savedConfirm.id === 'string' && Math.abs(now - Number(savedConfirm.at)) <= 190
        && meds.some(med => med.id === savedConfirm.id) ? savedConfirm.id : null;
    let listTop = clampInt(saved.top, 0, 999, 0);

    const actionId = String((input.action && input.action.id) || "");
    const form = (input.action && input.action.form) || {};
    let alert;
    let notice;
    if (!(actionId.startsWith('del-') || actionId.startsWith('dcf-') || actionId === 'dcn')) confirmId = null;

    const readForm = () => ({
        name: clean(form.name, 24),
        dose: clean(form.dose, 16),
        times: parseTimes(form.times)
    });

    const reject = (draft) => {
        if (!draft.name) return "请填写药品名称";
        if (!draft.times.length) return "请填写提醒时间，例如 08:00 12:00";
        return null;
    };

    const findByName = (name) => (name ? meds.find(med => med.name === name) || null : null);

    if (actionId === "hup" || actionId === "hdn" || actionId === "mup" || actionId === "mdn"
        || actionId === "tadd" || actionId.startsWith("tdel-")) {
        pickEcho = true;
        if (actionId === "hup") pickH = (pickH + 1) % 24;
        else if (actionId === "hdn") pickH = (pickH + 23) % 24;
        else if (actionId === "mup") pickM = (pickM + 5) % 60;
        else if (actionId === "mdn") pickM = (pickM + 55) % 60;
        else if (actionId === "tadd") {
            const text = `${pad2(pickH)}:${pad2(pickM)}`;
            if (pickTimes.includes(text)) alert = "「" + text + "」已经在列表里了";
            else if (pickTimes.length >= MAX_TIMES) alert = "最多 " + MAX_TIMES + " 个时间";
            else {
                pickTimes.push(text);
                pickTimes.sort();
                pickH = (pickH + 1) % 24;
                alert = "已加入 " + text;
            }
        } else if (actionId.startsWith("tdel-")) {
            const raw = actionId.slice(5);
            const text = raw.length === 4 ? raw.slice(0, 2) + ":" + raw.slice(2) : raw;
            const left = pickTimes.filter(item => item !== text);
            if (left.length !== pickTimes.length) {
                pickTimes = left;
                alert = "已移除 " + text;
            }
        }
    } else if (actionId.startsWith("dcf-")) {
        const id = actionId.slice(4);
        const index = meds.findIndex(med => med.id === id);
        if (index >= 0) {
            alert = "已删除 " + meds[index].name;
            meds.splice(index, 1);
        } else {
            alert = "这味药已经不在了";
        }
        confirmId = null;
    } else if (actionId === "dcn") {
        confirmId = null;
        alert = "已取消，没有删除";
    } else if (actionId.startsWith("del-")) {
        const id = actionId.slice(4);
        const target = meds.find(med => med.id === id) || null;
        if (target) {
            confirmId = id;
            alert = "删「" + target.name + "」？点下面确认";
        } else {
            alert = "这味药已经不在了";
        }
    } else if (actionId === "lup" || actionId === "ldn") {
        const maxTop = Math.max(0, meds.length - 3);
        listTop = clampInt(listTop + (actionId === "lup" ? -1 : 1), 0, maxTop, 0);
    } else if (actionId === "save" || actionId === "add") {
        const draft = readForm();
        if (!draft.times.length && pickTimes.length) draft.times = pickTimes.slice();
        const error = reject(draft);
        if (error) {
            alert = error;
        } else {
            const exist = findByName(draft.name);
            if (exist) {
                exist.dose = draft.dose;
                exist.times = draft.times;
                alert = "已更新 " + exist.name + " " + exist.times.join(" ");
            } else if (meds.length >= MAX_MEDS) {
                alert = "最多只能添加 " + MAX_MEDS + " 种药品";
            } else {
                meds.push({
                    id: "m-" + pad2(nextId), name: draft.name, dose: draft.dose,
                    times: draft.times, paused: false, created_at: now
                });
                nextId += 1;
                alert = "已添加 " + draft.name + " " + draft.times.join(" ");
            }
            pickTimes = [];
        }
    } else if (actionId === "delete") {
        const name = clean(form.name, 24);
        if (!name) {
            alert = "先把药品名称填上再点删除";
        } else {
            const index = meds.findIndex(med => med.name === name);
            if (index < 0) {
                alert = "列表里没有「" + name + "」";
            } else {
                meds.splice(index, 1);
                alert = "已删除 " + name;
            }
        }
    } else if (actionId.startsWith("tk-")) {
        const raw = actionId.slice(3);
        const cut = raw.lastIndexOf("-");
        const medId = raw.slice(0, cut);
        const hhmm = raw.slice(cut + 1);
        const time = hhmm.slice(0, 2) + ":" + hhmm.slice(2);
        const key = medId + "|" + today + "|" + time;
        if (taken[key]) {
            delete taken[key];
            alert = "已取消 " + time + " 这次";
        } else if (meds.some(med => med.id === medId && med.times.includes(time))) {
            taken[key] = now;
            alert = "已吃 " + time;
        }
    } else if (actionId === "taken") {
        const name = clean(form.name, 24);
        const target = findByName(name) || (!name && meds.length === 1 ? meds[0] : null);
        if (!target) {
            alert = name ? "列表里没有「" + name + "」" : "先在名称框填上要标记的药品";
        } else {
            const own = buildSlots().filter(slot => slot.med.id === target.id);
            const pick = own.filter(slot => !taken[slot.key]).sort((a, b) => a.at - b.at)[0]
                || own.sort((a, b) => Math.abs(a.at - now) - Math.abs(b.at - now))[0];
            if (pick) {
                taken[pick.key] = now;
                alert = "已记下 " + target.name + " " + pick.time + " 这次";
            } else {
                alert = "今天的 " + target.name + " 已经都记下了";
            }
        }
    }

    function buildSlots() {
        const list = [];
        if (!today) return list;
        for (const med of meds) {
            if (med.paused) continue;
            for (const time of med.times) {
                list.push({ med, time, at: slotAt(today, tzOffset, time), key: `${med.id}|${today}|${time}` });
            }
        }
        list.sort((a, b) => a.at - b.at);
        return list;
    }


    const slots = buildSlots();
    const totalCount = slots.length;
    const doneCount = slots.filter(slot => taken[slot.key]).length;
    const medDone = {};
    for (const med of meds) {
        const own = slots.filter(slot => slot.med.id === med.id);
        medDone[med.id] = own.length > 0 && own.every(slot => taken[slot.key]);
    }

    const due = slots.find(slot => !taken[slot.key] && !fired[slot.key]
        && now >= slot.at && now < slot.at + windowSec) || null;
    if (due && !notice) {
        fired[due.key] = now;
        notice = {
            id: due.key.replace(/\|/g, "-"),
            title: "该吃药了",
            body: due.med.name + (due.med.dose ? " " + due.med.dose : " 按医嘱") + " · " + due.time
        };
    }
    if (due && !alert) alert = "现在该吃 " + due.med.name + (due.med.dose ? " " + due.med.dose : "");

    let next = null;
    const consider = (at, day, med, time) => {
        if (!next || at < next.at) next = { at, day, med, time };
    };
    for (const med of meds) {
        if (med.paused) continue;
        for (const time of med.times) {
            const at = slotAt(today, tzOffset, time);
            const key = `${med.id}|${today}|${time}`;
            if (taken[key] || at <= now) continue;
            consider(at, "今天", med, time);
        }
    }
    if (tomorrow) {
        for (const med of meds) {
            if (med.paused) continue;
            for (const time of med.times) {
                consider(slotAt(tomorrow, tzOffset, time), "明天", med, time);
            }
        }
    }

    const nextLabel = next
        ? `${next.day === "明天" ? "明天 " : "下次 "}${next.time} · ${next.med.name}${next.med.dose ? " " + next.med.dose : ""}`
        : meds.length ? "今天已全部记下" : "还没有添加药品";

    return {
        now, today, tzOffset, windowSec, nextId,
        meds, fired, taken, slots, totalCount, doneCount, medDone,
        pickH, pickM, pickTimes, pickEcho,
        confirmTarget: confirmId ? meds.find(med => med.id === confirmId) || null : null,
        top: listTop,
        formEcho: actionId && (form.name || form.dose || formMode(actionId) === "clear")
            ? { name: clean(form.name, 24), dose: clean(form.dose, 16) } : null,
        alert, notice, next, nextLabel, formMode: formMode(actionId)
    };
}

function statusField(key, label, value, max) {
    return value === undefined ? { key, label, max } : { key, label, value: value || "", max };
}

function formMode(actionId) {
    if (actionId === "save" || actionId === "add" || actionId === "delete") return "clear";
    return "keep";
}

function toStatus(state) {
    const summary = state.meds.length
        ? `今天 ${state.doneCount}/${state.totalCount} 次 · ${state.nextLabel}`
        : "还没有药品，右侧填写后点「保存」";
    const mode = state.formMode;
    const pick = (key) => (state.formEcho ? (mode === "clear" ? "" : state.formEcho[key]) : undefined);
    return {
        state: "idle",
        label: "吃药提醒",
        summary: clampText(summary, 64),
        progress_pct: state.totalCount ? Math.round(state.doneCount / state.totalCount * 100) : 0,
        alert: state.alert ? clampText(state.alert, 48) : undefined,
        fields: [
            statusField("name", "药品名称", pick("name"), 24),
            statusField("dose", "数量", pick("dose"), 16)
        ],
        actions: state.confirmTarget
            ? [{ id: "dcn", label: "取消" }, { id: "dcf-" + state.confirmTarget.id, label: "确认删除" }]
            : []
    };
}

function clampText(text, limit) {
    const src = String(text === undefined || text === null ? "" : text);
    let out = "";
    let bytes = 0;
    for (const ch of src) {
        const weight = ch.charCodeAt(0) > 255 ? 3 : 1;
        if (bytes + weight > limit) break;
        bytes += weight;
        out += ch;
    }
    return out;
}

function label(text, x, y, size, fill, extra) {
    return { text, at: [x, y], size, fill, ...extra };
}

function drawList(state, y0, list) {
    if (!state.meds.length) {
        return [
            label("还没有药品", 12, y0 + 18, 11, "$muted"),
            label("选好时间、填上名称，点「保存」", 12, y0 + 34, 9, "$muted")
        ];
    }
    const nodes = [];
    let y = y0;
    for (const med of list) {
        nodes.push({ rect: [0, y, 344, 32], r: 8, fill: "$card", stroke: "$track", width: 1 });
        const done = state.medDone[med.id];
        if (done) nodes.push(label("✓", 11, y + 21, 10, ACCENT, { weight: 700 }));
        nodes.push(label(med.name, done ? 26 : 12, y + 21, 11, "$text", { max_width: 118, weight: 700 }));
        if (med.dose) nodes.push(label(med.dose, 196, y + 21, 8.5, "$muted", { align: "right", max_width: 40 }));
        const shownTimes = med.times.slice(0, 3);
        const extraTimes = med.times.length > 3;
        const timeW = 23;
        const timeGap = 6;
        const tailW = extraTimes ? 16 : 0;
        const totalW = shownTimes.length * timeW + Math.max(0, shownTimes.length - 1) * timeGap + tailW;
        let tx = 300 - totalW;
        shownTimes.forEach((time) => {
            const slotKey = med.id + "|" + state.today + "|" + time;
            const eaten = !!state.taken[slotKey];
            nodes.push({
                rect: [Math.round(tx - 3), y + 5, timeW + 6, 20], r: 5, fill: "#00000000",
                hit: { action: "tk-" + med.id + "-" + time.replace(":", "") },
                hover: { fill: "#FFFFFF14", hint: eaten ? "取消 " + time : "已吃 " + time }
            });
            nodes.push(label(time, Math.round(tx), y + 21, 8.5, eaten ? "#FFFFFF" : "#9FBFB0", eaten ? { weight: 700 } : {}));
            tx += timeW + timeGap;
        });
        if (extraTimes) nodes.push(label("…", Math.round(tx - timeGap + 4), y + 21, 8.5, "#9FBFB0"));
        const confirming = !!state.confirmTarget && state.confirmTarget.id === med.id;
        if (confirming) nodes.push({ rect: [305, y + 5, 28, 24], r: 8, fill: "#E0574F2E", stroke: "#E0574F", width: 1 });
        nodes.push({
            rect: [308, y + 8, 20, 18], r: 5, fill: "#00000000",
            hit: { action: "del-" + med.id },
            hover: { fill: "#FF6B6B1F", hint: confirming ? "再点一次删除" : "删除" + med.name }
        });
        nodes.push(centerLabel("×", 318, y + 20, confirming ? 11 : 9, confirming ? "#FFFFFF" : "#E0574F", { weight: 700 }));
        y += 34;
    }
    return nodes;
}

function centerLabel(text, cx, y, size, fill, extra) {
    const width = String(text).length * size * 0.56;
    return label(text, Math.round(cx - width / 2), y, size, fill, extra);
}

function shiftX(node, dx) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
        node.forEach(item => shiftX(item, dx));
        return;
    }
    if (Array.isArray(node.rect) && node.rect.length === 4) node.rect[0] += dx;
    if (Array.isArray(node.clip) && node.clip.length === 4) node.clip[0] += dx;
    if (Array.isArray(node.at) && node.at.length === 2) node.at[0] += dx;
    if (Array.isArray(node.line)) node.line = node.line.map(point => [point[0] + dx, point[1]]);
    Object.keys(node).forEach(key => {
        if (key === "rect" || key === "clip" || key === "at" || key === "line") return;
        shiftX(node[key], dx);
    });
}

function drawPicker(state, py) {
    const nodes = [];
    const panelH = 70;

    nodes.push({ rect: [0, py, 344, panelH], r: 9, fill: "$card", stroke: "$track", width: 1 });
    nodes.push(label("吃药时间", 80, py + 25, 9.5, "$muted", { align: "right" }));

    const blocks = [
        { value: pad2(state.pickH), plus: "hup", minus: "hdn", x: 120 },
        { value: pad2(state.pickM), plus: "mup", minus: "mdn", x: 202 }
    ];
    for (const block of blocks) {
        nodes.push({
            rect: [block.x, py + 6, 18, 26], r: 5, fill: "#00000000",
            hit: { action: block.minus }, hover: { fill: "#FFFFFF16" }
        });
        nodes.push(centerLabel("◀", block.x + 9, py + 24, 8.5, "$muted"));
        nodes.push({ rect: [block.x + 20, py + 6, 34, 26], r: 7, fill: "$track" });
        nodes.push(centerLabel(block.value, block.x + 37, py + 24, 14, "$text", { weight: 700 }));
        nodes.push({
            rect: [block.x + 56, py + 6, 18, 26], r: 5, fill: "#00000000",
            hit: { action: block.plus }, hover: { fill: "#FFFFFF16" }
        });
        nodes.push(centerLabel("▶", block.x + 65, py + 24, 8.5, "$muted"));
    }

    nodes.push(centerLabel("：", 194, py + 24, 12, "$muted"));

    nodes.push({
        rect: [276, py + 6, 46, 26], r: 7, fill: ACCENT,
        hit: { action: "tadd" }, hover: { fill: "#9BE0BE", hint: "加入这个时间" }
    });
    nodes.push(centerLabel("加入", 299, py + 24, 9.5, "#0B1F16", { weight: 700 }));

    if (state.pickTimes.length) {
        state.pickTimes.slice(0, 3).forEach((time, index) => {
            const x = 86 + index * 64;
            const y = py + 40;
            nodes.push({ rect: [x, y, 60, 24], r: 7, fill: "$track" });
            nodes.push(label(time, x + 6, y + 16, 9, "$text", { weight: 700 }));
            nodes.push({
                rect: [x + 40, y + 3, 18, 18], r: 5, fill: "#00000000",
                hit: { action: "tdel-" + time.replace(":", "") }, hover: { fill: "#FF6B6B1F", hint: "移除 " + time }
            });
            nodes.push(label("×", x + 45, y + 15, 9, "$muted"));
        });
        if (state.pickTimes.length > 3) {
            const x = 86 + 3 * 64;
            const y = py + 40;
            nodes.push({ rect: [x, y, 60, 24], r: 7, fill: "$track" });
            nodes.push(centerLabel("+" + (state.pickTimes.length - 3), x + 30, y + 16, 9, ACCENT, { weight: 700 }));
        }
    } else {
        nodes.push(label("调好时间后点「加入」，存进列表", 86, py + 56, 8.5, "$muted"));
    }
    return { nodes, panelH };
}

function toCanvas(state) {
    const nodes = [];

    const rows = state.meds.length;
    const viewH = 102;
    const perPage = 3;
    const maxTop = Math.max(0, rows - perPage);
    const top = clampInt(state.top, 0, maxTop, 0);
    const ordered = state.meds
        .map((med, index) => ({ med, index }))
        .sort((a, b) => (a.med.created_at - b.med.created_at) || (a.index - b.index))
        .map(entry => entry.med);
    const scene = { clip: [0, 0, 346, viewH], group: drawList(state, 0, ordered.slice(top, top + perPage)) };
    nodes.push(scene);

    if (maxTop) {
        const barY = 20;
        const barH = viewH - 40;
        const thH = Math.max(12, Math.round(barH * perPage / rows));
        const thY = barY + Math.round((barH - thH) * top / maxTop);
        nodes.push({ rect: [338, barY, 4, barH], r: 2, fill: "#FFFFFF14" });
        nodes.push({ rect: [338, thY, 4, thH], r: 2, fill: "#FFFFFF6B" });
        nodes.push({
            rect: [331, 0, 13, 18], r: 5, fill: "#00000000",
            hit: { action: "lup" }, hover: { fill: "#FFFFFF1A", hint: "上一味" }
        });
        nodes.push(centerLabel("▲", 338, 13, 7, "#FFFFFF", { weight: 700 }));
        nodes.push({
            rect: [331, viewH - 18, 13, 18], r: 5, fill: "#00000000",
            hit: { action: "ldn" }, hover: { fill: "#FFFFFF1A", hint: "下一味" }
        });
        nodes.push(centerLabel("▼", 338, viewH - 5, 7, "#FFFFFF", { weight: 700 }));
    }

    const fy = viewH + 6;
    nodes.push({ rect: [0, fy + 1, 344, 32], r: 8, fill: "$card", stroke: "$track", width: 1 });
    nodes.push({ rect: [0, fy + 39, 344, 32], r: 8, fill: "$card", stroke: "$track", width: 1 });
    nodes.push(label("药品名称", 78, fy + 20, 9.5, "$muted", { align: "right" }));
    nodes.push(label("数量", 78, fy + 58, 9.5, "$muted", { align: "right" }));

    const picker = drawPicker(state, fy + 78);
    nodes.push(...picker.nodes);

    let height = fy + 78 + picker.panelH + 8;
    if (!state.confirmTarget) {
        nodes.push({ rect: [0, height, 344, 32], r: 9, fill: ACCENT, hit: { action: "save" }, hover: { fill: "#9BE0BE", hint: "保存药单" } });
        nodes.push(centerLabel("保存", 172, height + 21, 11, "#0B1F16", { weight: 700 }));
        height += 32;
    }
    const CENTER_DX = 20;
    shiftX(nodes, CENTER_DX);
    return { height, nodes, binds: {} };
}

function toPinned(state) {
    const text = state.meds.length ? "下次吃药" : "吃药提醒";
    const value = state.next
        ? `${state.next.day === "明天" ? "明天 " : ""}${state.next.time} ${state.next.med.name}${state.next.med.dose ? " " + state.next.med.dose : ""}`
        : state.meds.length ? "今天已全部记下" : "还没有添加药品";
    return { text, value: clampText(value, 60) };
}

function refresh(input) {
    try {
        return buildOutput(input);
    } catch (err) {
        return {
            status: {
                state: "idle",
                label: "吃药提醒",
                summary: "数据读取异常",
                progress_pct: 0,
                alert: "插件数据异常，请重启岛仔",
                fields: [],
                actions: []
            },
            canvas: { height: 1, nodes: [] },
            pinned: { text: "吃药提醒", value: "数据异常" }
        };
    }
}

function buildOutput(input) {
    const state = computeState(input);
    const result = {
        status: toStatus(state),
        canvas: toCanvas(state),
        pinned: toPinned(state),
        storage: {
            meds: state.meds, next_id: state.nextId,
            fired: state.fired, taken: state.taken,
            pick: { h: state.pickH, m: state.pickM, times: state.pickTimes },
            confirm: state.confirmTarget ? { id: state.confirmTarget.id, at: state.now } : null,
            top: state.top,
        }
    };
    if (state.notice) result.notice = state.notice;
    let nextAt = state.next && state.next.at > state.now ? state.next.at : Infinity;
    if (Number.isFinite(nextAt)) result.next_refresh_at = nextAt;
    return result;
}

function action(input) {
    return refresh(input);
}

function event(input) {
    return refresh(input);
}
