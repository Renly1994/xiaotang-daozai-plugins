const BOOKS = {
    ielts: { name: "雅思", full: "雅思 / 考研高频", color: "#5B9BFF" },
    cet: { name: "六级", full: "四六级核心", color: "#34C78A" },
    tech: { name: "科研", full: "科研 / 程序员", color: "#A47CF3" },
    custom: { name: "自建", full: "自建生词本", color: "#F59E0B" },
    mistakes: { name: "错词", full: "错词攻坚本", color: "#FF6B6B" }
};
const BOOK_KEYS = ["ielts", "cet", "tech", "custom", "mistakes"];
const MODES = [
    ["flash", "闪卡"],
    ["choice", "选义"],
    ["spell", "拼写"]
];
const MODE_KEYS = MODES.map(([k]) => k);
// 艾宾浩斯遗忘曲线复习间隔（秒）：新词 -> 5分 -> 30分 -> 12时 -> 1天 -> 3天 -> 7天 -> 15天
const SRS_INTERVALS = [0, 300, 1800, 43200, 86400, 259200, 604800, 1296000];
const FADE = { ms: 160, ease: "linear" };

function todayKey(nowMs, offsetMinutes) {
    const local = new Date(nowMs + offsetMinutes * 60000);
    const y = local.getUTCFullYear();
    const m = String(local.getUTCMonth() + 1).padStart(2, "0");
    const d = String(local.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function cleanText(value) {
    if (typeof value !== "string") return "";
    return value.replace(/[\x00-\x1f\x7f-\x9f]/g, " ").replace(/\s+/g, " ").trim();
}

function shortMeaning(meaning) {
    const cleaned = cleanText(meaning).replace(/^[a-z./]+\s*/i, "");
    return cleaned.split(/[；;]/)[0] || cleanText(meaning);
}

function truncateUnits(str, maxUnits) {
    if (typeof str !== "string") return "";
    let units = 0;
    let out = "";
    for (const ch of str) {
        const w = ch.charCodeAt(0) > 127 ? 2 : 1;
        if (units + w > maxUnits) return out + "…";
        units += w;
        out += ch;
    }
    return out;
}

function wrapLines(str, maxUnits, maxLines) {
    if (typeof str !== "string" || !str) return [];
    const lines = [];
    let cur = "";
    let units = 0;
    for (const ch of str) {
        const w = ch.charCodeAt(0) > 127 ? 2 : 1;
        if (units + w > maxUnits) {
            if (lines.length + 1 >= maxLines) {
                lines.push(cur.slice(0, Math.max(1, cur.length - 1)) + "…");
                return lines;
            }
            lines.push(cur);
            cur = ch === " " ? "" : ch;
            units = ch === " " ? 0 : w;
        } else {
            cur += ch;
            units += w;
        }
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines;
}

function text(value, x, y, size, options = {}) {
    return { text: value, at: [x, y], size, ...options };
}

function clampChars(str, max) {
    return [...str].slice(0, max).join("");
}

function parseCustomWords(raw) {
    try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
        if (!Array.isArray(parsed)) return [];
        const byLower = new Map();
        for (const row of parsed) {
            const w = clampChars(cleanText(row?.word), 40);
            const m = clampChars(cleanText(row?.meaning), 80);
            const rawEx = clampChars(cleanText(row?.example), 160);
            const e = rawEx === "无" ? "" : rawEx;
            if (w && m) {
                // 同词按大小写不敏感去重，保留后录入的释义，保证 customList 与 allMap 语义一致
                byLower.set(w.toLowerCase(), { w, p: "", m, e });
            }
        }
        return [...byLower.values()];
    } catch {
        return [];
    }
}

function buildAllWords(wordBank, customList) {
    const byWord = new Map();
    for (const key of ["ielts", "cet", "tech"]) {
        for (const item of Array.isArray(wordBank[key]) ? wordBank[key] : []) {
            if (item?.w && !byWord.has(item.w)) byWord.set(item.w, item);
        }
    }
    for (const item of customList) {
        byWord.set(item.w, item);
    }
    return byWord;
}

function getRecord(srs, word) {
    const rec = srs[word];
    if (!rec || typeof rec !== "object") return { lv: 0, due: 0, err: 0 };
    return {
        lv: Number.isInteger(rec.lv) ? rec.lv : 0,
        due: Number.isFinite(rec.due) ? rec.due : 0,
        err: Number.isInteger(rec.err) ? rec.err : 0
    };
}

function pickNextWord(list, srs, nowSec, currentWord) {
    if (!list.length) return -1;
    // 1. 最优先：艾宾浩斯已到期（lv > 0 && due <= nowSec）且过期最久的词
    let dueIdx = -1;
    let earliestDue = Infinity;
    for (let i = 0; i < list.length; i++) {
        const w = list[i].w;
        if (w === currentWord && list.length > 1) continue;
        const rec = getRecord(srs, w);
        if (rec.due > 0 && rec.due <= nowSec && rec.due < earliestDue) {
            earliestDue = rec.due;
            dueIdx = i;
        }
    }
    if (dueIdx >= 0) return dueIdx;

    // 2. 次优先：尚未学过的新词（lv === 0 && due === 0）
    const start = currentWord ? (list.findIndex(item => item.w === currentWord) + 1) % list.length : 0;
    for (let step = 0; step < list.length; step++) {
        const idx = (start + step) % list.length;
        const rec = getRecord(srs, list[idx].w);
        if (rec.lv === 0 && rec.due === 0 && (list[idx].w !== currentWord || list.length === 1)) {
            return idx;
        }
    }

    // 3. 兜底：选最快到期的词继续巩固
    let soonIdx = start;
    let soonest = Infinity;
    for (let i = 0; i < list.length; i++) {
        if (list[i].w === currentWord && list.length > 1) continue;
        const rec = getRecord(srs, list[i].w);
        if (rec.due < soonest) {
            soonest = rec.due;
            soonIdx = i;
        }
    }
    return soonIdx;
}

function wordHash(word) {
    let h = 2166136261;
    const str = String(word ?? "");
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
    }
    return h.toString(16);
}

function choiceDisplayLabel(meaning) {
    return truncateUnits(shortMeaning(meaning), 22);
}

function normalizeChoiceLabel(label) {
    return cleanText(label).toLowerCase();
}

function buildChoiceOptions(item, list, allMap) {
    if (!item) return [];
    const correctDisplay = choiceDisplayLabel(item.m);
    const seenWords = new Set([item.w]);
    const seenLabels = new Set([normalizeChoiceLabel(correctDisplay)]);
    const candidates = [];
    const appendFrom = source => {
        for (const row of source) {
            if (!row?.w || seenWords.has(row.w)) continue;
            const display = choiceDisplayLabel(row.m);
            const norm = normalizeChoiceLabel(display);
            if (!norm || seenLabels.has(norm)) continue;
            seenWords.add(row.w);
            seenLabels.add(norm);
            candidates.push({ w: row.w, label: display, correct: false });
        }
    };
    appendFrom(list);
    if (candidates.length < 3) appendFrom(allMap.values());

    // 基于单词生成确定性伪随机序列，先排除正确答案并按最终显示释义去重后再洗牌抽取 3 个干扰项
    let seed = 2166136261;
    for (let i = 0; i < item.w.length; i++) {
        seed = Math.imul(seed ^ item.w.charCodeAt(i), 16777619) >>> 0;
    }
    const nextRand = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed;
    };
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = nextRand() % (i + 1);
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const choices = [
        { w: item.w, label: correctDisplay, correct: true },
        ...candidates.slice(0, 3)
    ];
    for (let i = choices.length - 1; i > 0; i--) {
        const j = nextRand() % (i + 1);
        [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return choices;
}

function spellMask(word, revealCount) {
    const chars = [...word];
    if (chars.length <= 2) return chars.join(" ");
    return chars.map((ch, idx) => {
        if (ch === "-" || ch === " ") return ch;
        if (idx === 0 || idx === chars.length - 1 || idx <= revealCount) return ch;
        return "_";
    }).join(" ");
}

function formatDueCount(list, srs, nowSec) {
    let count = 0;
    for (const item of list) {
        const rec = getRecord(srs, item.w);
        if (rec.due > 0 && rec.due <= nowSec) count += 1;
    }
    return count;
}

function computeState(input) {
    const { settings = {}, storage = {}, data = {}, action, event } = input;
    const nowMs = input.now ?? Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const offset = input.tz?.offset_minutes ?? 0;
    const today = todayKey(nowMs, offset);
    const yesterday = todayKey(nowMs - 86400000, offset);

    const wordBank = data?.["words.json"] ?? {};
    const customList = parseCustomWords(settings.custom_words);
    const allMap = buildAllWords(wordBank, customList);

    const defaultBook = ["ielts", "cet", "tech", "custom"].includes(settings.book) ? settings.book : "ielts";
    let book = storage?.bookBase === defaultBook && BOOK_KEYS.includes(storage?.book)
        ? storage.book
        : defaultBook;
    const defaultMode = MODE_KEYS.includes(settings.default_mode) ? settings.default_mode : "flash";
    let mode = storage?.modeBase === defaultMode && MODE_KEYS.includes(storage?.mode)
        ? storage.mode
        : defaultMode;

    const rawGoal = Math.round(Number(settings.daily_goal));
    const dailyGoal = Number.isFinite(rawGoal) && rawGoal >= 5 ? Math.min(100, rawGoal) : 20;
    const pinnedMode = ["word_cn", "word_only", "progress", "off"].includes(settings.pinned_mode)
        ? settings.pinned_mode
        : "word_cn";
    const focusPush = settings.focus_push !== "false" && settings.focus_push !== false;
    const voiceAccent = settings.voice_accent === "uk" ? "uk" : "us";

    const srs = {};
    for (const [k, v] of Object.entries(storage?.srs ?? {})) {
        if (allMap.has(k) && v && typeof v === "object") {
            srs[k] = {
                lv: Number.isInteger(v.lv) ? v.lv : 0,
                due: Number.isFinite(v.due) ? v.due : 0,
                err: Number.isInteger(v.err) ? v.err : 0
            };
        }
    }
    let mistakes = Array.isArray(storage?.mistakes) ? [...new Set(storage.mistakes)].filter(w => allMap.has(w)) : [];
    let dailyDate = today;
    let dailyDone = storage?.dailyDate === today && Number.isInteger(storage?.dailyDone) ? storage.dailyDone : 0;
    let goalNotified = storage?.dailyDate === today && storage?.goalNotified === true;
    let streak = Number.isInteger(storage?.streak) ? storage.streak : 0;
    let lastStreakDate = typeof storage?.lastStreakDate === "string" ? storage.lastStreakDate : "";
    let lastFocusId = storage?.lastFocusId ?? null;
    let revealed = storage?.revealed === true;
    let spellHint = Number.isInteger(storage?.spellHint) ? storage.spellHint : 0;
    let wrongIndices = Array.isArray(storage?.wrongIndices)
        ? storage.wrongIndices.filter(n => Number.isInteger(n) && n >= 0 && n < 4)
        : [];
    let feedback = "";
    let feedbackTone = "muted";
    let currentWord = typeof storage?.currentWord === "string" ? storage.currentWord : "";

    const getBookList = key => {
        if (key === "custom") return customList;
        if (key === "mistakes") return mistakes.map(w => allMap.get(w)).filter(Boolean);
        return Array.isArray(wordBank[key]) ? wordBank[key] : [];
    };

    let list = getBookList(book);
    let currentIndex = list.findIndex(item => item.w === currentWord);
    if (currentIndex < 0 && list.length) {
        currentIndex = pickNextWord(list, srs, nowSec, "");
        currentWord = list[currentIndex]?.w ?? "";
    }

    let notice;

    const applyReview = (word, grade) => {
        const rec = getRecord(srs, word);
        if (grade === "know") {
            const nextLv = Math.min(SRS_INTERVALS.length - 1, rec.lv + 1);
            srs[word] = { lv: nextLv, due: nowSec + SRS_INTERVALS[nextLv], err: rec.err };
            dailyDone += 1;
            if (nextLv >= 2) {
                mistakes = mistakes.filter(w => w !== word);
            }
        } else if (grade === "fuzzy") {
            const nextLv = Math.max(1, Math.min(rec.lv, 2));
            srs[word] = { lv: nextLv, due: nowSec + 300, err: rec.err };
            dailyDone += 1;
        } else {
            srs[word] = { lv: 0, due: nowSec + 120, err: rec.err + 1 };
            if (!mistakes.includes(word)) mistakes.unshift(word);
            mistakes = mistakes.slice(0, 60);
        }

        if (dailyDone >= dailyGoal) {
            if (lastStreakDate !== today) {
                streak = lastStreakDate === yesterday ? streak + 1 : 1;
                lastStreakDate = today;
            }
            if (!goalNotified) {
                goalNotified = true;
                notice = {
                    id: `vocab-goal-${today}`,
                    title: "随手背词",
                    body: `今日目标达成（${dailyDone}/${dailyGoal}），已连续打卡 ${streak} 天！`
                };
            }
        }
    };

    const advanceWord = () => {
        list = getBookList(book);
        currentIndex = pickNextWord(list, srs, nowSec, currentWord);
        currentWord = currentIndex >= 0 ? list[currentIndex].w : "";
        revealed = false;
        spellHint = 0;
        wrongIndices = [];
    };

    const act = action?.id ?? "";
    if (act.startsWith("book-")) {
        const nextBook = act.slice(5);
        if (BOOK_KEYS.includes(nextBook)) {
            book = nextBook;
            currentWord = "";
            advanceWord();
        }
    } else if (act.startsWith("mode-")) {
        const nextMode = act.slice(5);
        if (MODE_KEYS.includes(nextMode)) {
            mode = nextMode;
            revealed = false;
            spellHint = 0;
            wrongIndices = [];
        }
    } else if (act === "flip") {
        revealed = !revealed;
    } else if (act === "skip") {
        advanceWord();
    } else if (act === "hint") {
        spellHint += 1;
    } else if (act === "know" || act === "fuzzy" || act === "forget") {
        if (currentWord) {
            applyReview(currentWord, act);
            advanceWord();
        }
    } else if (act.startsWith("pick-")) {
        const pickedIdx = Number(act.slice(5));
        const currentItem = currentIndex >= 0 ? list[currentIndex] : null;
        const currentChoices = currentItem ? buildChoiceOptions(currentItem, list, allMap) : [];
        const picked = Number.isInteger(pickedIdx) && pickedIdx >= 0 && pickedIdx < currentChoices.length
            ? currentChoices[pickedIdx]
            : null;
        if (currentWord && picked) {
            if (picked.correct) {
                applyReview(currentWord, "know");
                feedback = `答对：${currentWord}`;
                feedbackTone = "ok";
                advanceWord();
            } else {
                applyReview(currentWord, "forget");
                if (!wrongIndices.includes(pickedIdx)) wrongIndices.push(pickedIdx);
                feedback = "选错了，已加入错词本，再试一次";
                feedbackTone = "err";
            }
        }
    } else if (act === "submit-spell") {
        const typed = cleanText(action?.form?.spell ?? "");
        if (currentWord && typed) {
            if (typed.toLowerCase() === currentWord.toLowerCase()) {
                applyReview(currentWord, "know");
                feedback = `拼写正确：${currentWord}`;
                feedbackTone = "ok";
                advanceWord();
            } else {
                applyReview(currentWord, "forget");
                feedback = `拼写有误（正确：${currentWord}），已入错词本`;
                feedbackTone = "err";
                spellHint = Math.max(spellHint + 1, 1);
            }
        }
    } else if (event?.name === "focus.finished") {
        const rawEventId = event.id !== undefined && event.id !== null ? cleanText(String(event.id)) : "";
        const focusEventKey = rawEventId
            || (Number.isFinite(event.at) ? `at:${event.at}` : `ts:${nowSec}`);
        if (focusEventKey !== lastFocusId) {
            lastFocusId = focusEventKey;
            if (focusPush) {
                const ieltsList = Array.isArray(wordBank.ielts) && wordBank.ielts.length ? wordBank.ielts : null;
                const pushList = list.length ? list : (ieltsList ?? [...allMap.values()]);
                const idx = pickNextWord(pushList, srs, nowSec, "");
                const pushItem = idx >= 0 ? pushList[idx] : pushList[0];
                if (pushItem) {
                    if (list.length) {
                        currentIndex = idx >= 0 ? idx : 0;
                        currentWord = pushItem.w;
                        revealed = false;
                        wrongIndices = [];
                    }
                    const dueNow = formatDueCount(pushList, srs, nowSec);
                    notice = {
                        id: `vocab-focus-${wordHash(focusEventKey)}-${focusEventKey.length}`,
                        title: "专注结束 · 顺手背一词",
                        body: `${pushItem.w}${pushItem.p ? " " + pushItem.p : ""} · ${shortMeaning(pushItem.m)}${dueNow ? `（${dueNow}词待复习）` : ""}`
                    };
                }
            }
        }
    } else if (!act && list.length && !revealed && mode === "flash") {
        // 定时刷新时优先切到已到期的艾宾浩斯复习词，避免顶部“熟视无睹”
        const nextIdx = pickNextWord(list, srs, nowSec, currentWord);
        if (nextIdx >= 0) {
            currentIndex = nextIdx;
            currentWord = list[currentIndex].w;
            wrongIndices = [];
        }
    }

    list = getBookList(book);
    currentIndex = list.findIndex(item => item.w === currentWord);
    const item = currentIndex >= 0 ? list[currentIndex] : null;
    const dueCount = formatDueCount(list, srs, nowSec);
    const rec = item ? getRecord(srs, item.w) : { lv: 0, due: 0, err: 0 };
    const isDue = Boolean(item && rec.due > 0 && rec.due <= nowSec);
    const choices = mode === "choice" ? buildChoiceOptions(item, list, allMap) : [];

    let masteredCount = 0;
    for (const entry of list) {
        if (getRecord(srs, entry.w).lv >= 4) masteredCount += 1;
    }

    return {
        book,
        mode,
        item,
        listLength: list.length,
        masteredCount,
        mistakeCount: mistakes.length,
        dueCount,
        isDue,
        level: rec.lv,
        dailyDone,
        dailyGoal,
        streak,
        revealed,
        spellHint,
        wrongIndices,
        choices,
        feedback,
        feedbackTone,
        pinnedMode,
        voiceAccent,
        notice,
        storage: {
            bookBase: defaultBook,
            book,
            modeBase: defaultMode,
            mode,
            srs,
            mistakes,
            dailyDate,
            dailyDone,
            goalNotified,
            streak,
            lastStreakDate,
            lastFocusId,
            revealed,
            spellHint,
            wrongIndices,
            currentWord
        }
    };
}

function drawTopBar(nodes, state) {
    // 左右留出 8px 避开岛仔左右翻页箭头 < >
    const tabLeft = 8;
    const tabW = 205;
    const segW = tabW / BOOK_KEYS.length;
    nodes.push({ rect: [tabLeft, 0, tabW, 24], r: 7, fill: "$card" });
    BOOK_KEYS.forEach((key, idx) => {
        const left = tabLeft + idx * segW;
        const active = state.book === key;
        const meta = BOOKS[key];
        const label = key === "mistakes" && state.mistakeCount > 0
            ? `错${Math.min(99, state.mistakeCount)}`
            : meta.name;
        nodes.push({
            id: "book-" + key,
            rect: [left + 1.5, 1.5, segW - 3, 21],
            r: 6,
            fill: active ? meta.color : "#00000000",
            hover: active ? undefined : { fill: "$track" },
            animate: { ms: 160 },
            hit: { action: "book-" + key }
        });
        nodes.push(text(label, left + segW / 2, 16, 10, {
            align: "center",
            fill: active ? "#FFFFFF" : key === "mistakes" && state.mistakeCount > 0 ? "#FF8787" : "$muted",
            weight: active ? 700 : 500
        }));
    });

    // 右侧：模式切换（闪卡 / 选义 / 拼写）总宽 120px
    const modeLeft = 221;
    const modeW = 120;
    const mSeg = modeW / MODES.length;
    nodes.push({ rect: [modeLeft, 0, modeW, 24], r: 7, fill: "$card" });
    MODES.forEach(([key, label], idx) => {
        const left = modeLeft + idx * mSeg;
        const active = state.mode === key;
        nodes.push({
            id: "mode-" + key,
            rect: [left + 1.5, 1.5, mSeg - 3, 21],
            r: 6,
            fill: active ? "$track" : "#00000000",
            hover: active ? undefined : { fill: "$track" },
            animate: { ms: 140 },
            hit: { action: "mode-" + key }
        });
        nodes.push(text(label, left + mSeg / 2, 16, 10, {
            align: "center",
            fill: active ? "$text" : "$dim",
            weight: active ? 700 : 500
        }));
    });

    // 最右：换一词按钮（右侧留 8px 避开 > 箭头）
    nodes.push(
        {
            rect: [347, 1, 32, 22],
            r: 6,
            fill: "$card",
            hover: { fill: "$track" },
            hit: { action: "skip" }
        },
        text("换", 363, 15.5, 10, { align: "center", fill: "$muted" })
    );
}

function drawMetaStrip(nodes, state) {
    const meta = BOOKS[state.book];
    const ratio = Math.min(1, state.dailyDone / state.dailyGoal);
    const leftText = state.dueCount > 0
        ? `待复习 ${state.dueCount} 词 · 已掌握 ${state.masteredCount}/${state.listLength}`
        : `已掌握 ${state.masteredCount}/${state.listLength} · ${meta.full}`;
    nodes.push(
        text(leftText, 2, 39, 9.5, { fill: state.dueCount > 0 ? "#F59E0B" : "$dim", max_width: 230 }),
        text(
            (state.streak > 0 ? `连打${state.streak}天 · ` : "") + `今日 ${state.dailyDone}/${state.dailyGoal}`,
            332, 39, 9.5,
            { align: "right", fill: ratio >= 1 ? "#34C78A" : "$muted", weight: 600 }
        ),
        { rect: [339, 32.5, 48, 6], r: 3, fill: "$card" },
        { rect: [339, 32.5, Math.max(ratio > 0 ? 4 : 0, Math.round(48 * ratio)), 6], r: 3, fill: ratio >= 1 ? "#34C78A" : meta.color }
    );
}

function drawEmptyBook(nodes, state) {
    const title = state.book === "mistakes" ? "错词本空空如也" : "自建生词本还没有词";
    const sub = state.book === "mistakes"
        ? "答错或点「不认识」的词会自动收录到这里"
        : "打开插件设置 → 自建生词本，添加你的专属词汇";
    nodes.push(
        { rect: [0, 48, 387, 160], r: 10, fill: "$card" },
        text(title, 193.5, 114, 15, { align: "center", fill: "$text", weight: 700 }),
        text(sub, 193.5, 140, 10.5, { align: "center", fill: "$muted" })
    );
}

function voiceUrl(word, accent) {
    return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${accent === "uk" ? 1 : 2}`;
}

function speakButton(word, accent, x, y) {
    const label = accent === "uk" ? "英读" : "朗读";
    return [
        {
            rect: [x, y, 48, 18],
            r: 5,
            fill: "$track",
            hover: { fill: "#5B9BFF55" },
            hit: { open: voiceUrl(word, accent) }
        },
        // 简约小喇叭矢量图标
        {
            path: `M${x + 8} ${y + 7.2} H${x + 11} L${x + 14.5} ${y + 4.5} V${y + 13.5} L${x + 11} ${y + 10.8} H${x + 8} Z`,
            fill: "$text"
        },
        text(label, x + 31, y + 12.5, 9, { align: "center", fill: "$text", weight: 600 })
    ];
}

function drawFlashMode(nodes, state) {
    const meta = BOOKS[state.book];
    const item = state.item;
    const cardNodes = [
        {
            id: "word-card",
            rect: [0, 48, 387, 124],
            r: 10,
            fill: "$card",
            hover: { fill: "$track" },
            hit: { action: "flip" }
        }
    ];

    // 状态标签（到期复习 / 新词）、朗读按钮与熟练度指示点
    const tagText = state.isDue ? "艾宾浩斯复习" : state.level === 0 ? "新词" : `Lv.${state.level}`;
    cardNodes.push(
        { rect: [12, 56, 66, 18], r: 5, fill: state.isDue ? "#F59E0B30" : meta.color + "28" },
        text(tagText, 45, 68.5, 8.5, {
            align: "center",
            fill: state.isDue ? "#F7C968" : meta.color,
            weight: 700
        }),
        ...speakButton(item.w, state.voiceAccent, 84, 56)
    );
    for (let i = 0; i < 4; i++) {
        cardNodes.push({
            circle: [345 + i * 9, 64, 2.7],
            fill: i < state.level ? meta.color : "$track"
        });
    }

    if (!state.revealed) {
        cardNodes.push(
            text(item.w, 193.5, 108, 25, { align: "center", fill: "$text", weight: 800, max_width: 356 }),
            text(item.p || "", 193.5, 130, 11, { align: "center", fill: meta.color, max_width: 340 }),
            text("点击卡片查看释义与例句", 193.5, 158, 9.5, { align: "center", fill: "$dim" })
        );
    } else {
        cardNodes.push(
            text(item.w, 14, 93, 19, { fill: "$text", weight: 800, max_width: 225 }),
            text(item.p || "", 373, 92, 10, { align: "right", fill: meta.color, max_width: 145 }),
            { line: [14, 102, 373, 102], stroke: "$track", width: 1 },
            text(truncateUnits(item.m, 52), 14, 121, 12, { fill: "$text", weight: 700, max_width: 359 })
        );
        wrapLines(item.e || "", 56, 2).forEach((line, idx) => {
            cardNodes.push(text(line, 14, 141 + idx * 15, 9.8, { fill: "$muted", max_width: 359 }));
        });
    }
    nodes.push({ id: "flash-" + wordHash(item.w) + "-" + (state.revealed ? "1" : "0"), group: cardNodes, animate: FADE });

    const buttons = [
        { id: "forget", label: "不认识", x: 0, w: 123, bg: "#FF6B6B28", hover: "#FF6B6B48", fg: "#FF8787" },
        { id: "fuzzy", label: "模糊", x: 132, w: 123, bg: "#F5B94228", hover: "#F5B94248", fg: "#F7C968" },
        { id: "know", label: "认识", x: 264, w: 123, bg: "#34C78A30", hover: "#34C78A52", fg: "#4FE0A2" }
    ];
    for (const btn of buttons) {
        nodes.push(
            {
                id: "act-" + btn.id,
                rect: [btn.x, 180, btn.w, 30],
                r: 8,
                fill: btn.bg,
                hover: { fill: btn.hover },
                hit: { action: btn.id }
            },
            text(btn.label, btn.x + btn.w / 2, 199, 11.5, { align: "center", fill: btn.fg, weight: 700 })
        );
    }
}

function drawChoiceMode(nodes, state) {
    const meta = BOOKS[state.book];
    const item = state.item;
    nodes.push(
        { rect: [0, 48, 387, 62], r: 10, fill: "$card" },
        ...speakButton(item.w, state.voiceAccent, 329, 55),
        text(item.w, 193.5, 80, 22, { align: "center", fill: "$text", weight: 800, max_width: 260 }),
        text(
            state.feedback || item.p || "选择正确的中文释义",
            193.5, 100, 10,
            {
                align: "center",
                fill: state.feedbackTone === "ok" ? "#4FE0A2" : state.feedbackTone === "err" ? "#FF8787" : meta.color,
                max_width: 356
            }
        )
    );

    // 2x2 四选一按钮（统一使用符合 SDK 规范的内部 ID：choice-0..3 / pick-0..3）
    const labels = ["A", "B", "C", "D"];
    state.choices.slice(0, 4).forEach((opt, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const x = col * 198;
        const y = 118 + row * 48;
        const isWrong = state.wrongIndices.includes(idx);
        nodes.push(
            {
                id: "choice-" + idx,
                rect: [x, y, 189, 41],
                r: 8,
                fill: isWrong ? "#FF6B6B32" : "$card",
                hover: { fill: isWrong ? "#FF6B6B48" : "$track" },
                hit: { action: "pick-" + idx }
            },
            { rect: [x + 8, y + 12, 18, 17], r: 4, fill: isWrong ? "#FF6B6B" : "$track" },
            text(labels[idx], x + 17, y + 24, 9.5, {
                align: "center",
                fill: isWrong ? "#FFFFFF" : "$muted",
                weight: 700
            }),
            text(opt.label, x + 33, y + 24.5, 10.5, {
                fill: isWrong ? "#FF9B9B" : "$text",
                weight: 600,
                max_width: 148
            })
        );
    });
}

function drawSpellMode(nodes, state) {
    const meta = BOOKS[state.book];
    const item = state.item;
    nodes.push(
        { rect: [0, 48, 387, 126], r: 10, fill: "$card" },
        ...speakButton(item.w, state.voiceAccent, 327, 56),
        text(truncateUnits(item.m, 40), 14, 72, 13, { fill: "$text", weight: 700, max_width: 304 }),
        text(`${item.p || ""}  (${item.w.length} 字母)`, 14, 92, 10, { fill: meta.color, max_width: 359 }),
        text(spellMask(item.w, state.spellHint), 193.5, 118, 17, {
            align: "center",
            fill: "$text",
            weight: 700,
            max_width: 356
        }),
        // 拼写输入框（与 canvasFields.spell 位置 [14, 134, 286, 26] 对齐）
        { rect: [14, 134, 286, 26], r: 7, fill: "$track" },
        {
            rect: [306, 134, 67, 26],
            r: 7,
            fill: meta.color,
            hover: { fill: "#74ABFF" },
            hit: { action: "submit-spell" }
        },
        text("提交", 339.5, 151, 10.5, { align: "center", fill: "#FFFFFF", weight: 700 })
    );

    // 底部提示栏与辅助按钮
    const msg = state.feedback || "看释义直接输入单词，按回车提交";
    const msgColor = state.feedbackTone === "ok" ? "#4FE0A2" : state.feedbackTone === "err" ? "#FF8787" : "$dim";
    nodes.push(
        text(truncateUnits(msg, 36), 2, 198, 10, { fill: msgColor, max_width: 245 }),
        {
            rect: [256, 182, 62, 26],
            r: 7,
            fill: "$card",
            hover: { fill: "$track" },
            hit: { action: "hint" }
        },
        text("提示字母", 287, 199, 9.5, { align: "center", fill: "$muted" }),
        {
            rect: [324, 182, 63, 26],
            r: 7,
            fill: "$card",
            hover: { fill: "$track" },
            hit: { action: "skip" }
        },
        text("不会跳过", 355.5, 199, 9.5, { align: "center", fill: "#FF8787" })
    );
}

function toCanvas(state) {
    const nodes = [];
    drawTopBar(nodes, state);
    drawMetaStrip(nodes, state);
    if (!state.item) {
        drawEmptyBook(nodes, state);
        return { height: 214, nodes };
    }
    if (state.mode === "choice") {
        drawChoiceMode(nodes, state);
    } else if (state.mode === "spell") {
        drawSpellMode(nodes, state);
    } else {
        drawFlashMode(nodes, state);
    }
    return { height: 214, nodes };
}

function toPinned(state) {
    if (state.pinnedMode === "off") return null;
    const meta = BOOKS[state.book];

    if (state.pinnedMode === "progress" || !state.item) {
        const label = state.dueCount > 0
            ? `待复习 ${state.dueCount} · ${state.dailyDone}/${state.dailyGoal}`
            : `背词 ${state.dailyDone}/${state.dailyGoal}`;
        return {
            canvas: {
                width: 130,
                fit_width: true,
                nodes: [
                    { circle: [7, 11, 3.5], fill: state.dueCount > 0 ? "#F59E0B" : "#34C78A" },
                    text(label, 16, 15, 10.5, { fill: "$text", weight: 600, max_width: 112 })
                ]
            }
        };
    }

    const badgeFill = state.isDue ? "#F59E0B" : meta.color;
    const badgeChar = state.isDue ? "复" : "词";

    if (state.pinnedMode === "word_only") {
        return {
            canvas: {
                width: 124,
                fit_width: true,
                nodes: [
                    { rect: [1, 3.5, 15, 15], r: 4, fill: badgeFill },
                    text(badgeChar, 8.5, 14.5, 9, { align: "center", fill: "#FFFFFF", weight: 700 }),
                    text(truncateUnits(state.item.w, 16), 21, 15, 11.5, { fill: "$text", weight: 700, max_width: 100 })
                ]
            }
        };
    }

    const combined = `${state.item.w} · ${shortMeaning(state.item.m)}`;
    return {
        canvas: {
            width: 156,
            fit_width: true,
            nodes: [
                { rect: [1, 3.5, 15, 15], r: 4, fill: badgeFill },
                text(badgeChar, 8.5, 14.5, 9, { align: "center", fill: "#FFFFFF", weight: 700 }),
                text(truncateUnits(combined, 19), 21, 15, 11, { fill: "$text", weight: 600, max_width: 132 })
            ]
        }
    };
}

function refresh(input) {
    const state = computeState(input);
    const status = {
        state: "succeeded",
        label: `${BOOKS[state.book].name} ${state.dailyDone}/${state.dailyGoal}`
    };
    if (state.mode === "spell" && state.item) {
        status.fields = [{ key: "spell", label: "英文拼写", value: "", max: 40 }];
        status.actions = [{ id: "submit-spell", label: "提交" }];
    }
    return {
        status,
        canvas: toCanvas(state),
        pinned: toPinned(state),
        notice: state.notice,
        storage: state.storage
    };
}

function action(input) {
    return refresh(input);
}

function event(input) {
    return refresh(input);
}
