/*
MIT LICENSE

Copyright (c) 2026 Resin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

const HOT_PAGE_SIZE = 6;
const CUSTOM_PAGE_SIZE = 6;
const WIDTH = 387;
const HEIGHT = 278;
const PANEL_TOP = 30;
const PANEL_H = HEIGHT - PANEL_TOP;
const PAD = 8;
const LEFT_W = 132;
const RIGHT = 140;
const RIGHT_W = WIDTH - RIGHT;
const LEFT_X = PAD;
const LEFT_INNER_W = LEFT_W - PAD * 2;
const CONTENT_X = RIGHT + PAD;
const CONTENT_W = RIGHT_W - PAD * 2;
const FOOTER_H = 24;
const FOOTER_Y = HEIGHT - PAD - FOOTER_H;
const BODY_TOP = PANEL_TOP + PAD;
const BODY_BOTTOM = FOOTER_Y - 8;
const PROBLEM_URL = /^https:\/\/(leetcode\.cn|leetcode\.com)\/problems\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/description)?\/?(?:[?#].*)?$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const THEME = {
    hot: {accent: "#5B9BFF", hover: "#74ABFF", tint: "#5B9BFF22", border: "#5B9BFF45"},
    custom: {accent: "#A47CF3", hover: "#B997F8", tint: "#A47CF322", border: "#A47CF345"}
};
const FIELD_STYLES = {
    "输入": {color: "#5B9BFF", bg: "#5B9BFF14", border: "#5B9BFF38"},
    "输出": {color: "#34C78A", bg: "#34C78A14", border: "#34C78A38"},
    "约束": {color: "#F59E0B", bg: "#F59E0B14", border: "#F59E0B38"},
    "样例": {color: "#A47CF3", bg: "#A47CF314", border: "#A47CF338"}
};
const SAMPLE_JSON = JSON.stringify({
    questions: [
        {
            category: "动态规划",
            number: 198,
            slug: "house-robber",
            title: "打家劫舍",
            description: "不能连续偷相邻房屋，求最高金额。",
            input: "整数数组 nums",
            output: "最高总金额",
            constraints: "1 <= nums.length <= 100",
            example: "[1,2,3,1] -> 4",
            url: "https://leetcode.cn/problems/house-robber/"
        }
    ]
}, null, 2);
// 全面适配岛仔宿主的主题语义色（$card / $track / $text / $muted / $dim / $accent）。
const COLOR = {
    panel: "$card",
    button: "$track",
    hover: "$track",
    line: "$track",
    accent: "$accent",
    accentHover: "#74ABFF",
    accentInk: "#FFFFFF",
    text: "$text",
    muted: "$muted",
    dim: "$dim",
    inverse: "$bg",
    success: "#34C78A",
    error: "#FF8787",
    editor: "#1B1D24",
    code: "#EDEDF2"
};
const LANGUAGES = {
    text: "纯文本", python: "Python", javascript: "JavaScript", typescript: "TypeScript",
    java: "Java", c: "C", cpp: "C++", csharp: "C#", go: "Go", rust: "Rust",
    kotlin: "Kotlin", swift: "Swift", ruby: "Ruby", sql: "SQL"
};
const SYNTAX_COLORS = {
    comment: "#A0AAA0", keyword: "#E8B4F8", string: "#BBDDA3", char: "#BBDDA3",
    number: "#A7CEF1", boolean: "#A7CEF1", function: "#FFD9A0",
    "class-name": "#F2CF97", builtin: "#AEDDE0", operator: "#F5BC9F", punctuation: "#C9C9D3"
};

function languageId(value) {
    return Object.hasOwn(LANGUAGES, value) ? value : "text";
}

function label(text, x, y, options = {}) {
    return {text, at: [x, y], size: 11, fill: COLOR.text, ...options};
}

function panel(rect, fill, options = {}) {
    return {rect, r: 7, fill, ...options};
}

function lineIcon(path, stroke, width = 1.35) {
    return {path, stroke, width, cap: "round"};
}

function button(text, x, y, width, hit, kind = "neutral", options = {}) {
    const h = options.height ?? 24;
    const active = kind === "active";
    const primary = kind === "primary";
    const card = kind === "card";
    const fill = primary ? COLOR.accent : active ? COLOR.text : card ? COLOR.panel : COLOR.button;
    const color = primary ? COLOR.accentInk : active ? COLOR.inverse : COLOR.text;
    const hoverFill = primary ? COLOR.accentHover : COLOR.hover;
    const box = panel([x, y, width, h], fill, {r: options.r ?? 6});
    if (hit) {
        box.hit = typeof hit === "string" ? {action: hit} : hit;
        if (!active) box.hover = {fill: hoverFill};
    }
    const textX = options.icon ? x + width / 2 + 6 : x + width / 2;
    const nodes = [box];
    if (options.icon) nodes.push(lineIcon(options.icon, color, options.iconWidth ?? 1.35));
    nodes.push(label(text, textX, y + h / 2 + 3.5, {
        align: "center",
        size: options.size ?? 10.5,
        fill: color,
        weight: options.weight ?? 600
    }));
    return nodes;
}

function iconButton(x, y, width, height, hit, path, stroke = COLOR.text, fill = COLOR.button) {
    const box = panel([x, y, width, height], fill, {r: 6});
    if (hit) {
        box.hit = typeof hit === "string" ? {action: hit} : hit;
        box.hover = {fill: COLOR.hover};
    }
    return [box, lineIcon(path, stroke, 1.4)];
}

function titleFor(question) {
    return question.number ? question.number + ". " + question.title : question.title;
}

function wrap(text, maxWidth, size) {
    const widthOf = char => char.codePointAt(0) < 128 ? size * 0.62 : size;
    return text.split("\n").flatMap(line => {
        const lines = [];
        let current = "";
        let width = 0;
        for (const char of line) {
            const nextWidth = widthOf(char);
            if (current && width + nextWidth > maxWidth) {
                lines.push(current);
                current = "";
                width = 0;
            }
            current += char;
            width += nextWidth;
        }
        lines.push(current);
        return lines;
    });
}

function paragraph(nodes, text, x, y, width, options = {}) {
    const size = options.size ?? 11;
    const lineHeight = options.lineHeight ?? 16;
    const lines = wrap(text, width, size);
    for (const [index, line] of lines.entries()) {
        if (line) nodes.push(label(line, x, y + index * lineHeight, {size, weight: options.weight ?? 400, fill: options.fill ?? COLOR.text}));
    }
    return y + lines.length * lineHeight;
}

function normalizeImportedQuestion(raw) {
    if (!raw || typeof raw !== "object") return null;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) return null;
    const description = typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim()
        : (typeof raw.prompt === "string" ? raw.prompt.trim() : "");
    if (!description) return null;
    const rawUrl = typeof raw.url === "string" ? raw.url.trim() : "";
    const urlMatch = rawUrl ? PROBLEM_URL.exec(rawUrl) : null;
    if (rawUrl && !urlMatch) return null;
    const rawSlug = typeof raw.slug === "string" ? raw.slug.trim().toLowerCase() : "";
    const slug = urlMatch
        ? urlMatch[2].toLowerCase()
        : (SLUG_RE.test(rawSlug) ? rawSlug : "custom-" + textHash(title + "|" + description));
    const url = urlMatch
        ? "https://" + urlMatch[1].toLowerCase() + "/problems/" + slug + "/"
        : (SLUG_RE.test(rawSlug) ? "https://leetcode.cn/problems/" + slug + "/" : "");
    const category = typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : "默认";
    const number = Number.isInteger(raw.number) && raw.number > 0 ? raw.number : undefined;
    const item = {slug, title, category, description, url};
    if (number) item.number = number;
    for (const key of ["input", "output", "constraints", "example"]) {
        if (typeof raw[key] === "string" && raw[key].trim()) item[key] = raw[key].trim();
    }
    return item;
}

function parseImportSource(source, existingQuestions) {
    if (!source || source.status === "unconfigured") {
        return {status: "unconfigured", ready: [], duplicates: 0, invalid: 0};
    }
    if (source.status !== "ready" || typeof source.text !== "string") {
        return {status: "unavailable", sourceStatus: source.status ?? "unknown", ready: [], duplicates: 0, invalid: 0};
    }
    let parsed;
    try {
        parsed = JSON.parse(source.text);
    } catch {
        return {status: "invalid_json", ready: [], duplicates: 0, invalid: 0};
    }
    const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.questions) ? parsed.questions : null);
    if (!items) {
        return {status: "invalid_shape", ready: [], duplicates: 0, invalid: 0};
    }
    const seen = new Set(existingQuestions.map(q => q.slug));
    const ready = [];
    let duplicates = 0;
    let invalid = 0;
    for (const item of items) {
        const normalized = normalizeImportedQuestion(item);
        if (!normalized) {
            invalid++;
            continue;
        }
        if (seen.has(normalized.slug)) {
            duplicates++;
            continue;
        }
        seen.add(normalized.slug);
        ready.push(normalized);
    }
    return {status: "ready", ready, duplicates, invalid, total: items.length};
}

function customTopicsFor(custom) {
    const folders = [...new Set(custom.map(q => (typeof q.category === "string" && q.category.trim()) ? q.category.trim() : "默认"))];
    return ["全部", ...folders];
}

function textHash(str) {
    let h = 2166136261;
    const s = String(str ?? "");
    for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    }
    return h.toString(16);
}

function init(input) {
    const saved = input.storage ?? {};
    const settings = input.settings ?? {};
    const bundled = Object.values(input.data ?? {}).flatMap(file => file.questions ?? []);
    let custom = saved.customQuestions ?? [];
    let lastSourceHash = saved.lastSourceHash ?? null;
    const source = input.source ?? null;
    if (source?.status === "ready" && typeof source.text === "string") {
        const hash = textHash(source.text);
        if (hash !== lastSourceHash) {
            const info = parseImportSource(source, [...bundled, ...custom]);
            if (info.status === "ready") {
                if (info.ready.length > 0) custom = [...custom, ...info.ready];
                lastSourceHash = hash;
            }
        }
    }
    const topics = [...new Set(bundled.map(question => question.category))];
    const customTopics = customTopicsFor(custom);
    const ui = saved.ui ?? {};
    const defaultTab = settings.default_tab === "custom" ? "custom" : "hot";
    const defaultLanguage = languageId(settings.default_language || "python") === "text" ? "python" : languageId(settings.default_language);
    const openNoteFirst = settings.open_note_first === true || settings.open_note_first === "true";
    const pinnedMode = ["current", "idea", "progress", "rotate", "off"].includes(settings.pinned_mode)
        ? settings.pinned_mode : "current";
    const pinnedShowStatus = settings.pinned_show_status !== "false" && settings.pinned_show_status !== false;
    const focusPush = settings.focus_push !== "false" && settings.focus_push !== false;
    const settingChanged = saved.lastDefaultTab && saved.lastDefaultTab !== defaultTab;
    const initialTab = settingChanged ? defaultTab : ((ui.tab === "custom" || ui.tab === "hot") ? ui.tab : defaultTab);
    return {
        saved, bundled, custom, lastSourceHash, topics, customTopics,
        defaultTab,
        defaultLanguage,
        openNoteFirst,
        pinnedMode,
        pinnedShowStatus,
        focusPush,
        lastFocusId: saved.lastFocusId ?? null,
        notice: undefined,
        settings,
        source,
        notes: saved.notesBySlug ?? {},
        ui: {
            tab: initialTab,
            topic: topics.includes(ui.topic) ? ui.topic : topics[0],
            customTopic: customTopics.includes(ui.customTopic) ? ui.customTopic : "全部",
            page: settingChanged ? 0 : (ui.page ?? 0),
            slug: settingChanged ? null : ((saved.ui ? ui.slug : saved.selectedSlug) ?? null),
            mode: settingChanged ? "browse" : (ui.mode ?? "browse"),
            returnTab: ui.returnTab,
            returnSlug: ui.returnSlug,
            returnMode: ui.returnMode,
            addStep: Number.isInteger(ui.addStep) ? ui.addStep : 0,
            addDraft: ui.addDraft ?? {},
            editingSlug: ui.editingSlug ?? null,
            confirmDelete: ui.confirmDelete ?? null,
            draft: ui.draft
        }
    };
}

function noteFor(state, question) {
    return Object.prototype.hasOwnProperty.call(state.notes, question.slug) ? state.notes[question.slug] : null;
}

function pageSizeFor(state) {
    return state.ui.tab === "custom" ? CUSTOM_PAGE_SIZE : HOT_PAGE_SIZE;
}

function visibleQuestions(state) {
    if (state.ui.tab === "custom") {
        if (state.ui.customTopic === "全部") return state.custom;
        return state.custom.filter(q => ((q.category && q.category.trim()) || "默认") === state.ui.customTopic);
    }
    return state.bundled.filter(question => question.category === state.ui.topic);
}

function selection(state) {
    const pageSize = pageSizeFor(state);
    const questions = visibleQuestions(state);
    const count = Math.max(1, Math.ceil(questions.length / pageSize));
    const index = questions.findIndex(question => question.slug === state.ui.slug);
    const page = Number.isInteger(state.ui.page) ? Math.max(0, Math.min(state.ui.page, count - 1)) : 0;
    state.ui.page = index >= 0 ? Math.floor(index / pageSize) : page;
    const list = questions.slice(state.ui.page * pageSize, (state.ui.page + 1) * pageSize);
    const question = list.find(item => item.slug === state.ui.slug) ?? list[0] ?? null;
    state.ui.slug = question?.slug ?? null;
    return {list, question, count, pageSize};
}

function sidebar(nodes, state, context) {
    const {ui} = state;
    const hot = ui.tab === "hot";
    const theme = hot ? THEME.hot : THEME.custom;
    const activeTopic = hot ? ui.topic : ui.customTopic;
    const ty = PANEL_TOP + PAD;
    if (activeTopic) {
        nodes.push({
            rect: [LEFT_X, ty, LEFT_INNER_W, 22], r: 6, fill: theme.tint, stroke: theme.border, width: 1,
            hit: {action: "topics"}, hover: {fill: COLOR.button}
        });
        nodes.push(label(activeTopic, LEFT_X + 8, ty + 14.5, {size: 10, weight: 650, fill: theme.accent, max_width: LEFT_INNER_W - 22}));
        nodes.push(lineIcon(`M${LEFT_X + LEFT_INNER_W - 13} ${ty + 9.5} L${LEFT_X + LEFT_INNER_W - 9.5} ${ty + 13} L${LEFT_X + LEFT_INNER_W - 6} ${ty + 9.5}`, theme.accent, 1.3));
    }
    const firstRowY = ty + 27;
    for (const [index, question] of context.list.entries()) {
        const y = firstRowY + index * 28;
        const selected = question.slug === ui.slug;
        nodes.push(panel([LEFT_X, y, LEFT_INNER_W, 25], selected ? theme.tint : "#00000000", {
            r: 6,
            hit: {action: "row-" + index},
            hover: selected ? undefined : {fill: COLOR.hover}
        }));
        if (selected) {
            nodes.push(panel([LEFT_X + 4, y + 5, 3, 15], theme.accent, {r: 1.5}));
        }
        const textX = LEFT_X + (selected ? 11 : 7);
        nodes.push(label(titleFor(question), textX, y + 16, {
            size: 10,
            weight: selected ? 650 : 500,
            fill: selected ? theme.accent : COLOR.text,
            max_width: LEFT_INNER_W - (selected ? 15 : 11),
            lines: 1
        }));
    }
    if (context.count > 1) {
        if (ui.page > 0) {
            nodes.push(...iconButton(
                LEFT_X, FOOTER_Y, 26, FOOTER_H, "previous",
                `M${LEFT_X + 15} ${FOOTER_Y + 8} L${LEFT_X + 11} ${FOOTER_Y + 12} L${LEFT_X + 15} ${FOOTER_Y + 16}`
            ));
        }
        nodes.push(label((ui.page + 1) + "/" + context.count, LEFT_W / 2, FOOTER_Y + 15.5, {
            align: "center", size: 10, fill: COLOR.muted
        }));
        if (ui.page + 1 < context.count) {
            const nx = LEFT_W - PAD - 26;
            nodes.push(...iconButton(
                nx, FOOTER_Y, 26, FOOTER_H, "next",
                `M${nx + 11} ${FOOTER_Y + 8} L${nx + 15} ${FOOTER_Y + 12} L${nx + 11} ${FOOTER_Y + 16}`
            ));
        }
    }
}

function boundedNode(node) {
    const key = node.at ? "at" : node.rect ? "rect" : "circle";
    const coordinates = node[key];
    if (!coordinates || coordinates[1] <= 1500) return node;
    const position = [...coordinates];
    const segments = Math.floor(position[1] / 1500);
    position[1] -= segments * 1500;
    let group = {...node, [key]: position};
    for (let index = 0; index < segments; index++) {
        group = {translate: [0, 1500], group: [group]};
    }
    return group;
}

function body(nodes, content, end, scrollId, x = CONTENT_X, width = CONTENT_W, top = BODY_TOP) {
    const height = BODY_BOTTOM - top;
    if (end > top + height) {
        nodes.push({
            id: scrollId,
            clip: [x, top, width, height],
            scroll: {axis: "y", content: end - top + 4},
            group: content.map(boundedNode)
        });
    } else {
        nodes.push(...content);
    }
}

function questionBody(nodes, question, index, mode, hasNote, isCustom, confirmDelete = false) {
    const content = [];
    const theme = isCustom ? THEME.custom : THEME.hot;
    const rightBadgeW = isCustom ? (confirmDelete ? 92 : (hasNote ? 120 : 70)) : (hasNote ? 48 : 0);
    content.push(label(titleFor(question), CONTENT_X, BODY_TOP + 12, {
        size: 13.5, weight: 700, max_width: CONTENT_W - rightBadgeW - 4, lines: 1
    }));
    if (isCustom && confirmDelete) {
        const cancelX = CONTENT_X + CONTENT_W - 34;
        const confirmX = CONTENT_X + CONTENT_W - 88;
        content.push(
            panel([confirmX, BODY_TOP - 1, 50, 18], "#E05252", {r: 4, hit: {action: "confirm-delete-custom"}, hover: {fill: "#F06565"}}),
            label("确认删除", confirmX + 25, BODY_TOP + 11, {align: "center", size: 8.5, weight: 650, fill: "#FFFFFF"}),
            panel([cancelX, BODY_TOP - 1, 34, 18], COLOR.line, {r: 4, hit: {action: "cancel-delete-custom"}, hover: {fill: COLOR.hover}}),
            label("取消", cancelX + 17, BODY_TOP + 11, {align: "center", size: 8.5, weight: 600, fill: COLOR.muted})
        );
    } else if (isCustom) {
        const delX = CONTENT_X + CONTENT_W - 32;
        const editX = CONTENT_X + CONTENT_W - 68;
        content.push(
            panel([editX, BODY_TOP - 1, 32, 18], theme.tint, {r: 4, hit: {action: "edit-custom"}, hover: {fill: theme.border}}),
            label("编辑", editX + 16, BODY_TOP + 11, {align: "center", size: 8.5, weight: 600, fill: theme.accent}),
            panel([delX, BODY_TOP - 1, 32, 18], "#FF6B6B22", {r: 4, hit: {action: "delete-custom"}, hover: {fill: "#FF6B6B40"}}),
            label("删除", delX + 16, BODY_TOP + 11, {align: "center", size: 8.5, weight: 600, fill: "#FF8787"})
        );
    }
    if (hasNote && !(isCustom && confirmDelete)) {
        const bx = CONTENT_X + CONTENT_W - (isCustom ? 118 : 46);
        content.push(
            panel([bx, BODY_TOP - 1, 46, 18], "#34C78A28", {r: 4}),
            label("已写思路", bx + 23, BODY_TOP + 11, {align: "center", size: 8.5, weight: 650, fill: COLOR.success})
        );
    }
    let y = BODY_TOP + 29;
    if (isCustom && confirmDelete && hasNote) {
        y = paragraph(content, "删除后保留思路，重新导入同一道题可恢复。", CONTENT_X, y, CONTENT_W, {
            size: 9.5, lineHeight: 13, fill: COLOR.muted
        }) + 5;
    }
    const reqText = question.description ?? question.prompt ?? "";
    if (reqText) {
        content.push(label("要求：", CONTENT_X, y, {size: 10, weight: 700, fill: COLOR.text}));
        y = paragraph(content, reqText, CONTENT_X + 31, y, CONTENT_W - 31, {size: 10, lineHeight: 14, fill: COLOR.muted}) + 4;
    }
    for (const [key, value] of [
        ["输入", question.input], ["输出", question.output],
        ["约束", question.constraints], ["样例", question.example]
    ]) {
        if (!value) continue;
        const st = FIELD_STYLES[key];
        const lines = wrap(value, CONTENT_W - 42, 9.5);
        const boxH = Math.max(20, lines.length * 13 + 7);
        content.push({rect: [CONTENT_X, y, CONTENT_W, boxH], r: 5, fill: st.bg, stroke: st.border, width: 1});
        content.push(label(key, CONTENT_X + 6, y + 13, {size: 9.5, weight: 700, fill: st.color}));
        for (const [li, line] of lines.entries()) {
            if (line) content.push(label(line, CONTENT_X + 34, y + 13 + li * 13, {size: 9.5, fill: COLOR.text}));
        }
        y += boxH + 4;
    }
    body(nodes, content, y, "question-" + index);
    const showingRequirements = mode === "requirements";
    const title = showingRequirements ? "返回思路" : hasNote ? "翻开我的思路" : "写下我的思路";
    const action = showingRequirements || hasNote ? "show-note" : "edit";
    if (question.url) {
        const linkX = CONTENT_X + 118;
        nodes.push(
            {rect: [CONTENT_X, FOOTER_Y, 112, FOOTER_H], r: 6, fill: theme.accent, hit: {action}, hover: {fill: theme.hover}},
            label(title, CONTENT_X + 56, FOOTER_Y + 15.5, {align: "center", size: 10.5, weight: 650, fill: COLOR.accentInk}),
            ...button("进入原题", linkX, FOOTER_Y, CONTENT_W - 118, {open: question.url}, "neutral", {
                icon: `M${linkX + 18} ${FOOTER_Y + 10} V${FOOTER_Y + 16} H${linkX + 25} M${linkX + 21} ${FOOTER_Y + 8} H${linkX + 26} V${FOOTER_Y + 13} M${linkX + 21} ${FOOTER_Y + 13} L${linkX + 26} ${FOOTER_Y + 8}`
            })
        );
    } else {
        nodes.push(
            {rect: [CONTENT_X, FOOTER_Y, CONTENT_W, FOOTER_H], r: 6, fill: theme.accent, hit: {action}, hover: {fill: theme.hover}},
            label(title, CONTENT_X + CONTENT_W / 2, FOOTER_Y + 15.5, {align: "center", size: 10.5, weight: 650, fill: COLOR.accentInk})
        );
    }
}

const CODE_KEYWORDS = {
    common: new Set(["if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue", "return", "try", "catch", "finally", "throw", "new", "class", "struct", "enum", "interface", "import", "from", "export", "const", "let", "var", "function", "def", "fn", "func", "pub", "public", "private", "protected", "static", "void", "int", "long", "float", "double", "char", "bool", "boolean", "string", "str", "auto", "in", "as", "is", "not", "and", "or", "yield", "async", "await", "pass", "lambda", "with", "elif", "except", "raise", "global", "match", "impl", "trait", "mut", "self", "this", "super", "extends", "implements", "package", "using", "namespace", "template", "typename", "virtual", "override", "final", "const_cast", "typedef", "type", "val", "fun", "when", "defer", "go", "select", "chan", "range", "end", "then", "elsif", "unless", "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "JOIN", "ON", "GROUP", "BY", "ORDER", "LIMIT", "AS", "AND", "OR", "NOT", "IN", "NULL"]),
    builtins: new Set(["len", "range", "print", "println", "min", "max", "sum", "abs", "sorted", "enumerate", "zip", "map", "filter", "list", "dict", "set", "tuple", "int", "str", "float", "bool", "Math", "Array", "Object", "Set", "Map", "String", "Number", "console", "vector", "unordered_map", "unordered_set", "deque", "priority_queue", "sort", "push_back", "pop_back", "size", "empty", "begin", "end", "Vec", "HashMap", "HashSet", "Option", "Result", "Some", "None", "Ok", "Err", "fmt", "append", "make", "copy", "System", "Collections", "Arrays", "List", "Integer"]),
    booleans: new Set(["true", "false", "True", "False", "null", "None", "nil", "undefined", "NULL", "TRUE", "FALSE"])
};

function codeTokens(code, language) {
    if (language === "text") return [code];
    const tokens = [];
    const hashComment = language === "python" || language === "ruby";
    const dashComment = language === "sql";
    let i = 0;
    const n = code.length;
    while (i < n) {
        const ch = code[i];
        const next = code[i + 1] || "";
        if ((hashComment && ch === "#") || (dashComment && ch === "-" && next === "-") || (!hashComment && ch === "/" && next === "/")) {
            let j = code.indexOf("\n", i);
            if (j === -1) j = n;
            tokens.push({type: "comment", content: code.slice(i, j)});
            i = j;
            continue;
        }
        if (!hashComment && ch === "/" && next === "*") {
            let j = code.indexOf("*/", i + 2);
            j = j === -1 ? n : j + 2;
            tokens.push({type: "comment", content: code.slice(i, j)});
            i = j;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
            const triple = code.slice(i, i + 3) === ch.repeat(3);
            const delim = triple ? ch.repeat(3) : ch;
            let j = i + delim.length;
            while (j < n) {
                if (code[j] === "\\") { j += 2; continue; }
                if (triple ? code.slice(j, j + 3) === delim : code[j] === ch || code[j] === "\n") {
                    if (triple) j += 3;
                    else if (code[j] === ch) j += 1;
                    break;
                }
                j++;
            }
            tokens.push({type: ch === "'" && !triple && j - i <= 4 ? "char" : "string", content: code.slice(i, j)});
            i = j;
            continue;
        }
        if (/[0-9]/.test(ch)) {
            const m = /^(?:0[xXbBoO][0-9a-fA-F_]+|[0-9][0-9_]*(?:\.[0-9_]+)?(?:[eE][+-]?[0-9_]+)?)[uUlLfFdD]*/.exec(code.slice(i));
            tokens.push({type: "number", content: m[0]});
            i += m[0].length;
            continue;
        }
        if (/[A-Za-z_$]/.test(ch)) {
            const m = /^[A-Za-z0-9_$]+/.exec(code.slice(i));
            const word = m[0];
            i += word.length;
            if (CODE_KEYWORDS.booleans.has(word)) tokens.push({type: "boolean", content: word});
            else if (CODE_KEYWORDS.common.has(word) || (language === "sql" && CODE_KEYWORDS.common.has(word.toUpperCase()))) tokens.push({type: "keyword", content: word});
            else if (CODE_KEYWORDS.builtins.has(word)) tokens.push({type: "builtin", content: word});
            else if (code[i] === "(") tokens.push({type: "function", content: word});
            else if (/^[A-Z][A-Za-z0-9_]*$/.test(word)) tokens.push({type: "class-name", content: word});
            else tokens.push(word);
            continue;
        }
        if ("+-*/%=!<>&|^~?:".includes(ch)) {
            const m = /^[+\-*/%=!<>&|^~?:]+/.exec(code.slice(i));
            tokens.push({type: "operator", content: m[0]});
            i += m[0].length;
            continue;
        }
        if ("{}[]();,.".includes(ch)) {
            tokens.push({type: "punctuation", content: ch});
            i++;
            continue;
        }
        let j = i + 1;
        while (j < n && !/[A-Za-z0-9_$"'`#/\-+*%!=<>|&^~?:{}[\]();,.]/.test(code[j])) j++;
        tokens.push(code.slice(i, j));
        i = j;
    }
    return tokens;
}

function codeBlock(nodes, code, language, x, top, width) {
    const glyphs = [];
    const lineHeight = 15;
    const inset = 8;
    let y = top + 14;
    let column = x + inset;

    function draw(token, fill) {
        if (Array.isArray(token)) {
            for (const item of token) draw(item, fill);
        } else if (typeof token === "string") {
            for (const ch of token.replace(/\t/g, "    ")) {
                if (ch === "\n") {
                    column = x + inset;
                    y += lineHeight;
                    continue;
                }
                const advance = ch.codePointAt(0) < 128 ? 6.6 : 11;
                if (column + advance > x + width - inset) {
                    column = x + inset;
                    y += lineHeight;
                }
                if (ch.trim()) glyphs.push(label(ch, column + advance / 2, y, {size: 10.5, align: "center", fill}));
                column += advance;
            }
        } else {
            draw(token.content, SYNTAX_COLORS[token.type] ?? fill);
        }
    }
    draw(codeTokens(code, language), COLOR.code);
    const height = y - top + 8;
    for (let offset = 0; offset < height; offset += 1200) {
        nodes.push(panel([x, top + offset, width, Math.min(1200, height - offset)], COLOR.editor, {r: 5}));
    }
    nodes.push(...glyphs);
    return top + height;
}

function noteToMarkdown(note) {
    if (!note) return "";
    if (typeof note.markdown === "string") return note.markdown;
    const parts = [];
    if (note.idea) parts.push(note.idea);
    if (note.code && note.code.trim()) {
        const lang = languageId(note.language);
        parts.push("```" + (lang === "text" ? "" : lang) + "\n" + note.code + "\n```");
    }
    return parts.join("\n\n");
}

function renderMarkdown(content, markdown, x, startY, width, options = {}) {
    const allowCopy = options.allowCopy !== false;
    const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
    let y = startY;
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const fence = /^```\s*([a-zA-Z0-9_+-]*)\s*$/.exec(line);
        if (fence) {
            const rawLang = (fence[1] || "").toLowerCase();
            const alias = rawLang === "py" ? "python" : rawLang === "js" ? "javascript" : rawLang === "ts" ? "typescript" : rawLang === "c++" ? "cpp" : rawLang === "cs" ? "csharp" : rawLang;
            const lang = languageId(alias);
            const codeLines = [];
            i++;
            while (i < lines.length && !/^```\s*$/.test(lines[i])) {
                codeLines.push(lines[i]);
                i++;
            }
            if (i < lines.length) i++;
            const code = codeLines.join("\n");
            if (allowCopy) {
                const copyX = x + width - 48;
                content.push(label(LANGUAGES[lang], x, y + 10, {size: 9, fill: COLOR.muted}));
                content.push(...button("复制", copyX, y - 3, 48, {copy: code}, "neutral", {
                    height: 18, size: 9,
                    icon: `M${copyX + 9} ${y + 3} H${copyX + 14} V${y + 8} H${copyX + 9} Z M${copyX + 11} ${y + 1} H${copyX + 16} V${y + 6}`,
                    iconWidth: 1.1
                }));
                y += 18;
            } else {
                content.push(label(LANGUAGES[lang], x, y + 8, {size: 8.5, fill: COLOR.muted}));
                y += 12;
            }
            y = codeBlock(content, code || " ", lang, x, y, width) + 6;
            continue;
        }
        if (!line.trim()) {
            y += 5;
            i++;
            continue;
        }
        const heading = /^(#{1,3})\s+(.+)$/.exec(line);
        if (heading) {
            const level = heading[1].length;
            const size = level === 1 ? 12.5 : level === 2 ? 11.5 : 10.5;
            y = paragraph(content, heading[2].trim(), x, y, width, {size, weight: 700, lineHeight: size + 4}) + 2;
            i++;
            continue;
        }
        const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
        if (bullet) {
            content.push({circle: [x + 3, y - 3.5, 1.6], fill: COLOR.accent});
            y = paragraph(content, bullet[1], x + 9, y, width - 9, {size: 10, lineHeight: 14}) + 1;
            i++;
            continue;
        }
        y = paragraph(content, line, x, y, width, {size: 10, lineHeight: 14.5}) + 2;
        i++;
    }
    return y;
}

function noteBody(nodes, question, note, index) {
    const content = [];
    content.push(label(titleFor(question), CONTENT_X, BODY_TOP + 12, {
        size: 13.5, weight: 700, max_width: CONTENT_W - 68, lines: 1
    }));
    content.push(...button("题目要求", CONTENT_X + CONTENT_W - 64, BODY_TOP - 2, 64, "requirements", "neutral", {height: 20, size: 9.5}));
    const md = noteToMarkdown(note);
    const y = renderMarkdown(content, md, CONTENT_X, BODY_TOP + 31, CONTENT_W);
    body(nodes, content, y, "note-" + index);
    nodes.push(
        ...button("编辑思路", CONTENT_X, FOOTER_Y, 108, "edit", "primary"),
        ...button("收起思路", CONTENT_X + 115, FOOTER_Y, CONTENT_W - 115, "hide-note")
    );
}

function formHeader(nodes, caption, subtitle) {
    nodes.push(panel([0, 0, WIDTH, HEIGHT], COLOR.panel, {r: 10}));
    nodes.push(label(caption, 24, 21, {size: 14, weight: 700, max_width: 190, lines: 1}));
    if (subtitle) {
        nodes.push(label(subtitle, 24, 37, {size: 9.5, fill: COLOR.muted, max_width: 339, lines: 1}));
    }
}

function editBody(nodes, state, question, form, alert) {
    formHeader(nodes, "编辑思路", titleFor(question));
    const rawValue = form.note ?? form.markdown ?? "";
    const value = [...rawValue].slice(0, 200).join("");

    nodes.push(...button("刷新预览", 295, 7, 68, "refresh-preview", "neutral", {height: 21, size: 9.5}));
    nodes.push(panel([24, 48, 168, 184], COLOR.line, {r: 6}));

    const previewX = 200;
    const previewW = 163;
    nodes.push({rect: [previewX, 48, previewW, 184], r: 6, fill: "#00000000", stroke: COLOR.line, width: 1});
    if (value.trim()) {
        const previewContent = [];
        const endY = renderMarkdown(previewContent, value, previewX + 6, 62, previewW - 12, {allowCopy: false});
        nodes.push({
            id: "edit-preview",
            clip: [previewX + 2, 50, previewW - 4, 180],
            ...(endY > 230 ? {scroll: {axis: "y", content: endY - 50 + 6}} : {}),
            group: previewContent.map(boundedNode)
        });
    } else {
        nodes.push(label("支持 Markdown 与 ```" + (state.defaultLanguage || "python"), previewX + 8, 68, {
            size: 9.5, fill: COLOR.dim, max_width: previewW - 16
        }));
    }

    if (alert) nodes.push(label(alert, 24, 242, {size: 9.5, fill: COLOR.error, max_width: 339}));
    nodes.push(
        ...button("保存思路", 24, FOOTER_Y, 96, "commit", "primary"),
        ...button("取消", 127, FOOTER_Y, 56, "cancel"),
        ...button("清空", 190, FOOTER_Y, 48, "clear-note"),
        label("Markdown · 点刷新同步预览", 363, FOOTER_Y + 15.5, {align: "right", size: 9, fill: COLOR.dim})
    );
    return {
        fields: [{key: "note", label: "思路（Markdown）", max: 200, multiline: true, value}],
        actions: [{id: "commit", label: "保存思路"}]
    };
}

const ADD_STEPS = [
    {
        title: "1/5 基本信息",
        f1: {key: "category", fieldLabel: "文件夹分类（category）", label: "文件夹分类（category）", max: 20, color: "#A47CF3"},
        f2: {key: "title", fieldLabel: "题名（title）", label: "题名（title，可带题号如 198. 打家劫舍）", max: 40, color: "#5B9BFF"}
    },
    {
        title: "2/5 链接与题号",
        f1: {key: "url", fieldLabel: "力扣原题链接（选填）", label: "力扣原题链接（url，选填）", max: 200, color: "#34C78A"},
        f2: {key: "number", fieldLabel: "题号（选填）", label: "题号（number，纯数字选填）", max: 10, color: "#A47CF3"}
    },
    {
        title: "3/5 要求与约束",
        f1: {key: "constraints", fieldLabel: "约束条件（选填）", label: "约束条件（constraints，选填，如 1 <= n <= 10^4）", max: 120, color: "#F59E0B"},
        f2: {key: "description", fieldLabel: "题目要求（必填）", label: "题目要求（description，必填，≤200 字）", max: 200, color: "#5B9BFF", multiline: false}
    },
    {
        title: "4/5 输入与输出",
        f1: {key: "input", fieldLabel: "输入（选填）", label: "输入（input，选填）", max: 120, color: "#5B9BFF"},
        f2: {key: "output", fieldLabel: "输出（选填）", label: "输出（output，选填）", max: 120, color: "#34C78A", multiline: false}
    },
    {
        title: "5/5 样例",
        f1: {key: "example", fieldLabel: "样例（选填）", label: "样例（example，选填，如 [1,2,3,1] -> 4）", max: 200, color: "#A47CF3"},
        f2: null
    }
];

function addImportTabs(nodes, activeMode) {
    const x = 235;
    nodes.push(panel([x, 6, 128, 22], COLOR.line, {r: 6}));
    const tabs = [["add", "手动填写"], ["import", "JSON 导入"]];
    tabs.forEach(([key, title], idx) => {
        const left = x + idx * 64;
        const active = activeMode === key;
        nodes.push({
            rect: [left + 1.5, 7.5, 61, 19], r: 5,
            fill: active ? THEME.custom.accent : "#00000000",
            hover: active ? undefined : {fill: COLOR.panel},
            hit: {action: key}
        });
        nodes.push(label(title, left + 32, 20, {
            align: "center", size: 9.5,
            fill: active ? COLOR.accentInk : COLOR.muted,
            weight: active ? 650 : 500
        }));
    });
}

function addBody(nodes, state, form, alert) {
    const stepIdx = Math.max(0, Math.min(state.ui.addStep, ADD_STEPS.length - 1));
    const step = ADD_STEPS[stepIdx];
    const draft = state.ui.addDraft ?? {};
    const isEditing = Boolean(state.ui.editingSlug);
    formHeader(nodes, isEditing ? "编辑自选题" : "手动添加", step.title);
    if (!isEditing) addImportTabs(nodes, "add");

    const fields = [];
    if (step.f1) {
        const v1 = form.f1 ?? draft[step.f1.key] ?? (stepIdx === 0 ? "默认" : "");
        nodes.push(label(step.f1.label, 24, 58, {size: 10, weight: 650, fill: step.f1.color}));
        nodes.push({rect: [24, 64, 339, 30], r: 6, fill: COLOR.line, stroke: step.f1.color + "45", width: 1});
        fields.push({key: "f1", label: step.f1.fieldLabel, max: step.f1.max, multiline: false, value: v1});
    }
    if (step.f2) {
        const v2 = form.f2 ?? draft[step.f2.key] ?? "";
        nodes.push(label(step.f2.label, 24, 116, {size: 10, weight: 650, fill: step.f2.color}));
        nodes.push({rect: [24, 122, 339, 56], r: 6, fill: COLOR.line, stroke: step.f2.color + "45", width: 1});
        fields.push({key: "f2", label: step.f2.fieldLabel, max: step.f2.max, multiline: Boolean(step.f2.multiline), value: v2});
    }

    const summary = [draft.category && `#${draft.category}`, draft.title].filter(Boolean).join(" · ");
    if (summary) {
        nodes.push(label("已填：" + summary, 24, 196, {size: 9.5, fill: COLOR.muted, max_width: 339, lines: 1}));
    }
    if (alert) nodes.push(label(alert, 24, 236, {size: 9.5, fill: COLOR.error, max_width: 339}));

    const doneLabel = isEditing ? "保存修改" : "确认添加";
    let fx = 24;
    if (stepIdx > 0) {
        nodes.push(...button("上一步", fx, FOOTER_Y, 64, "prev-step"));
        fx += 70;
    }
    if (stepIdx < ADD_STEPS.length - 1) {
        nodes.push(
            {rect: [fx, FOOTER_Y, 82, FOOTER_H], r: 6, fill: THEME.custom.accent, hit: {action: "next-step"}, hover: {fill: THEME.custom.hover}},
            label("下一步", fx + 41, FOOTER_Y + 15.5, {align: "center", size: 10.5, weight: 650, fill: COLOR.accentInk})
        );
        fx += 88;
        if (stepIdx >= 2 || isEditing) {
            nodes.push(...button(isEditing ? "直接保存" : "直接添加", fx, FOOTER_Y, 72, "commit-add"));
            fx += 78;
        }
    } else {
        nodes.push(
            {rect: [fx, FOOTER_Y, 88, FOOTER_H], r: 6, fill: THEME.custom.accent, hit: {action: "commit-add"}, hover: {fill: THEME.custom.hover}},
            label(doneLabel, fx + 44, FOOTER_Y + 15.5, {align: "center", size: 10.5, weight: 650, fill: COLOR.accentInk})
        );
        fx += 94;
    }
    nodes.push(...button("取消", fx, FOOTER_Y, 54, "cancel"));

    return {
        fields,
        actions: stepIdx < ADD_STEPS.length - 1
            ? [{id: "next-step", label: "下一步"}]
            : [{id: "next-step", label: doneLabel}, {id: "commit-add", label: doneLabel}]
    };
}

function importBody(nodes, state, form = {}, alert = "") {
    formHeader(nodes, "JSON 导入", "粘贴单题 JSON（≤200 字符），解析后直接加入自选题");
    addImportTabs(nodes, "import");
    const val = form.f2 ?? "";
    nodes.push(label("粘贴单题 JSON（支持 category / title / url / description）", 24, 58, {size: 9.5, weight: 650, fill: THEME.custom.accent}));
    nodes.push({rect: [24, 122, 339, 56], r: 6, fill: COLOR.line, stroke: THEME.custom.border, width: 1});
    nodes.push(panel([24, 64, 339, 44], COLOR.panel, {r: 6}));
    paragraph(nodes, "示例：{\"category\":\"动态规划\",\"title\":\"打家劫舍\",\"url\":\"https://leetcode.cn/problems/house-robber/\",\"description\":\"不能连续偷相邻房屋\"}", 32, 79, 323, {size: 9, lineHeight: 13, fill: COLOR.muted});
    if (alert) nodes.push(label(alert, 24, 196, {size: 9.5, fill: COLOR.error, max_width: 339}));
    nodes.push(
        {rect: [24, FOOTER_Y, 102, FOOTER_H], r: 6, fill: THEME.custom.accent, hit: {action: "confirm-import"}, hover: {fill: THEME.custom.hover}},
        label("解析并导入", 75, FOOTER_Y + 15.5, {align: "center", size: 10.5, weight: 650, fill: COLOR.accentInk}),
        ...button("返回", 134, FOOTER_Y, 64, "cancel")
    );
    return {
        fields: [{key: "f2", label: "单题 JSON", max: 200, multiline: true, value: val}],
        actions: [{id: "next-step", label: "解析并导入"}, {id: "confirm-import", label: "解析并导入"}]
    };
}

function topicMenu(nodes, state) {
    const hot = state.ui.tab === "hot";
    const theme = hot ? THEME.hot : THEME.custom;
    const list = hot ? state.topics : state.customTopics;
    const current = hot ? state.ui.topic : state.ui.customTopic;
    nodes.push(label(hot ? "选择专题" : "选择文件夹", CONTENT_X, BODY_TOP + 12, {size: 13.5, weight: 700}));
    const content = [];
    let y = BODY_TOP + 22;
    for (const [index, topic] of list.entries()) {
        const x = CONTENT_X + index % 2 * 117;
        const rowY = y + Math.floor(index / 2) * 24;
        const active = topic === current;
        const item = panel([x, rowY, 112, 20], active ? theme.accent : COLOR.line, {
            r: 5, hit: {action: "topic-" + index}, hover: {fill: active ? theme.hover : COLOR.hover}
        });
        content.push(item, label(topic, x + 8, rowY + 13.5, {
            size: 9.5, fill: active ? COLOR.accentInk : COLOR.text, weight: active ? 650 : 400, max_width: 96, lines: 1
        }));
    }
    const endY = y + Math.ceil(list.length / 2) * 24;
    body(nodes, content, endY, "topics-" + state.ui.tab, CONTENT_X, CONTENT_W, BODY_TOP + 22);
    nodes.push(...button("返回", CONTENT_X, FOOTER_Y, 64, "cancel"));
}

function topBar(nodes, state) {
    const tabX = 8;
    const tabW = 128;
    const tabs = [["hot", "Hot 100"], ["custom", "自选题"]];
    const segW = tabW / tabs.length;
    nodes.push(panel([tabX, 0, tabW, 23], COLOR.panel, {r: 7}));
    tabs.forEach(([key, title], idx) => {
        const left = tabX + idx * segW;
        const active = state.ui.tab === key;
        const t = key === "hot" ? THEME.hot : THEME.custom;
        nodes.push({
            id: "tab-" + key,
            rect: [left + 1.5, 1.5, segW - 3, 20],
            r: 6,
            fill: active ? t.accent : "#00000000",
            hover: active ? undefined : {fill: COLOR.hover},
            animate: {ms: 160},
            hit: {action: key}
        });
        nodes.push(label(title, left + segW / 2, 15, {
            align: "center", size: 10,
            fill: active ? COLOR.accentInk : COLOR.muted,
            weight: active ? 700 : 500
        }));
    });

    if (state.ui.tab === "hot") {
        let written = 0;
        for (const q of state.bundled) {
            if (noteFor(state, q)) written++;
        }
        nodes.push(label(`已写 ${written} / ${state.bundled.length}`, 379, 15, {
            align: "right", size: 10, weight: 600, fill: COLOR.success
        }));
    } else {
        nodes.push(
            {rect: [248, 1, 78, 21], r: 6, fill: THEME.custom.accent, hit: {action: "add"}, hover: {fill: THEME.custom.hover}},
            label("+ 添加 / 导入", 287, 15, {align: "center", size: 9.5, weight: 650, fill: COLOR.accentInk}),
            label(`共 ${state.custom.length} 题`, 379, 15, {
                align: "right", size: 10, weight: 600, fill: THEME.custom.accent
            })
        );
    }
}

function noteSummary(note) {
    if (!note) return "";
    const lines = noteToMarkdown(note).split(/\r?\n/);
    let inFence = false;
    for (const raw of lines) {
        const line = raw.trim();
        if (line.startsWith("```")) {
            inFence = !inFence;
            continue;
        }
        if (inFence || !line) continue;
        const cleaned = line.replace(/^#{1,6}\s+/, "").replace(/^[-*]\s+/, "").replace(/`/g, "").trim();
        if (cleaned) {
            const chars = [...cleaned];
            return chars.length > 28 ? chars.slice(0, 28).join("") + "…" : cleaned;
        }
    }
    return "";
}

function pinnedSlide(id, question, isCustom, hasNote, showStatus, showIdea, note) {
    const badgeFill = isCustom ? THEME.custom.accent : THEME.hot.accent;
    const badgeText = isCustom ? "自" : "热";
    const nodes = [
        {rect: [1, 3.5, 15, 15], r: 4, fill: badgeFill},
        label(badgeText, 8.5, 14.5, {align: "center", size: 9, weight: 700, fill: COLOR.accentInk})
    ];
    if (showStatus && hasNote) {
        nodes.push({circle: [15.5, 16.5, 2.6], fill: COLOR.success});
    }
    const summary = showIdea ? noteSummary(note) : "";
    const text = showIdea
        ? `${titleFor(question)} · ${summary || "待记录思路"}`
        : titleFor(question);
    const textX = 21;
    const textW = 156 - textX;
    nodes.push({
        clip: [textX, 0, textW, 22],
        group: [
            label(text, textX, 15, {
                id,
                size: 11,
                weight: 650,
                fill: COLOR.text,
                max_width: textW,
                loop: {kind: "flow", period_ms: 4900}
            })
        ]
    });
    return {width: 156, fit_width: true, nodes};
}

function toPinned(state, question, note) {
    if (state.pinnedMode === "off") return null;

    if (state.pinnedMode === "progress") {
        const hotNoted = state.bundled.filter(q => Boolean(noteFor(state, q))).length;
        const hotTotal = state.bundled.length;
        const customCount = state.custom.length;
        const text = customCount > 0
            ? `已记思路 ${hotNoted}/${hotTotal} · 自选 ${customCount}`
            : `已记思路 ${hotNoted}/${hotTotal}`;
        return {
            canvas: {
                width: 152,
                fit_width: true,
                nodes: [
                    {circle: [7, 11, 3.5], fill: hotNoted > 0 ? COLOR.success : THEME.hot.accent},
                    label(text, 16, 15, {size: 10.5, weight: 650, fill: COLOR.text, max_width: 134})
                ]
            }
        };
    }

    if (state.pinnedMode === "rotate") {
        const customSet = new Set(state.custom.map(q => q.slug));
        const noted = [...state.bundled, ...state.custom]
            .filter(q => Boolean(noteFor(state, q)))
            .slice(0, 16);
        if (noted.length > 0) {
            const slides = noted.map(q => pinnedSlide(
                "pin-" + q.slug,
                q,
                customSet.has(q.slug),
                true,
                state.pinnedShowStatus,
                true,
                noteFor(state, q)
            ));
            return {canvas: slides.length === 1 ? slides[0] : slides};
        }
    }

    if (!question) {
        return {
            canvas: {
                width: 140,
                fit_width: true,
                nodes: [
                    {circle: [7, 11, 3], fill: COLOR.accent},
                    label("力扣速记卡", 15, 15, {size: 11, weight: 650, fill: COLOR.text})
                ]
            }
        };
    }

    return {
        canvas: pinnedSlide(
            "pin-q",
            question,
            state.ui.tab === "custom",
            Boolean(note),
            state.pinnedShowStatus,
            state.pinnedMode === "idea",
            note
        )
    };
}

function render(state, form = state.ui.draft ?? {}, alert) {
    const context = selection(state);
    const {ui} = state;
    const question = context.question;
    const note = question && noteFor(state, question);
    const focused = ["edit", "add", "import"].includes(ui.mode);
    if (!question && !focused) ui.mode = "browse";
    const nodes = [];
    const status = {state: "idle", label: "力扣速记卡"};
    const questionIndex = question?.number ?? "custom-" + (ui.page * context.pageSize + context.list.indexOf(question));
    if (ui.mode === "edit" && question) {
        Object.assign(status, editBody(nodes, state, question, form, alert));
    } else if (ui.mode === "add") {
        Object.assign(status, addBody(nodes, state, form, alert));
    } else if (ui.mode === "import") {
        Object.assign(status, importBody(nodes, state, form, alert));
    }

    if (!focused) {
        topBar(nodes, state);
        nodes.push(
            panel([0, PANEL_TOP, LEFT_W, PANEL_H], COLOR.panel, {r: 10}),
            panel([RIGHT, PANEL_TOP, RIGHT_W, PANEL_H], COLOR.panel, {r: 10})
        );
        sidebar(nodes, state, context);
        if (ui.mode === "topics") {
            topicMenu(nodes, state);
        } else if (ui.mode === "note" && note) {
            noteBody(nodes, question, note, questionIndex);
        } else if (question) {
            questionBody(nodes, question, questionIndex, ui.mode, Boolean(note), ui.tab === "custom", ui.confirmDelete === question.slug);
        } else {
            nodes.push(label(ui.tab === "custom" ? "还没有自选题" : "题库暂为空", CONTENT_X, BODY_TOP + 13, {size: 14, weight: 700}));
            if (ui.tab === "custom") {
                paragraph(nodes, "点击右上角「+ 添加 / 导入」可分步手动添加新题，或粘贴单题 JSON 导入。", CONTENT_X, BODY_TOP + 34, CONTENT_W, {size: 10, lineHeight: 15, fill: COLOR.muted});
            }
        }
    }
    return {
        status,
        canvas: {height: HEIGHT, nodes},
        pinned: toPinned(state, question, note),
        ...(state.notice ? {notice: state.notice} : {}),
        storage: {
            ...state.saved,
            customQuestions: state.custom,
            lastSourceHash: state.lastSourceHash,
            lastDefaultTab: state.defaultTab,
            lastFocusId: state.lastFocusId,
            notesBySlug: state.notes,
            ui
        }
    };
}

function refresh(input) {
    const state = init(input);
    delete state.ui.draft;
    state.ui.confirmDelete = null;
    state.ui.mode = "browse";
    return render(state);
}

function captureStepForm(state, form) {
    const step = ADD_STEPS[Math.max(0, Math.min(state.ui.addStep, ADD_STEPS.length - 1))];
    const nextDraft = {...state.ui.addDraft};
    if (step.f1) {
        nextDraft[step.f1.key] = (form.f1 ?? state.ui.addDraft?.[step.f1.key] ?? "").trim();
    }
    if (step.f2) {
        nextDraft[step.f2.key] = (form.f2 ?? state.ui.addDraft?.[step.f2.key] ?? "").trim();
    }
    state.ui.addDraft = nextDraft;
}

function saveAdd(state, form) {
    captureStepForm(state, form);
    const d = state.ui.addDraft;
    const rawNum = Number.parseInt(d.number, 10);
    const candidate = normalizeImportedQuestion({
        category: d.category || "默认",
        number: Number.isInteger(rawNum) && rawNum > 0 ? rawNum : undefined,
        title: d.title,
        url: d.url,
        description: d.description,
        constraints: d.constraints,
        input: d.input,
        output: d.output,
        example: d.example
    });
    if (!candidate) {
        return render(state, {}, "请确保已填写有效的「题名」和「题目要求」（力扣链接可留空）。");
    }
    const editingSlug = state.ui.editingSlug;
    const duplicate = [...state.bundled, ...state.custom].some(q => q.slug === candidate.slug && q.slug !== editingSlug);
    if (duplicate) {
        return render(state, {}, "该题目（" + candidate.slug + "）已在题库中。");
    }
    if (editingSlug) {
        state.custom = state.custom.map(q => q.slug === editingSlug ? candidate : q);
        if (candidate.slug !== editingSlug && Object.prototype.hasOwnProperty.call(state.notes, editingSlug)) {
            state.notes = {...state.notes, [candidate.slug]: state.notes[editingSlug]};
            delete state.notes[editingSlug];
        }
    } else {
        state.custom = [...state.custom, candidate];
    }
    state.customTopics = customTopicsFor(state.custom);
    Object.assign(state.ui, {
        tab: "custom",
        customTopic: "全部",
        slug: candidate.slug,
        page: 0,
        mode: "browse",
        addStep: 0,
        addDraft: {},
        editingSlug: null,
        returnTab: null,
        returnSlug: null
    });
    return render(state);
}

function save(state, form, question) {
    if (state.ui.mode === "edit" && question) {
        const markdown = (form.note ?? state.ui.draft?.markdown ?? "").trim();
        if (!markdown) {
            return render(state, {markdown: ""}, "请写下思路（支持 Markdown 与代码块）。");
        }
        state.notes = {...state.notes, [question.slug]: {markdown}};
        delete state.ui.draft;
        state.ui.mode = "note";
    }
    return render(state);
}

function syncBrowseMode(state) {
    if (!state.openNoteFirst) {
        state.ui.mode = "browse";
        return;
    }
    const q = selection(state).question;
    state.ui.mode = q && noteFor(state, q) ? "note" : "browse";
}

function action(input) {
    const state = init(input);
    const {ui} = state;
    const context = selection(state);
    const question = context.question;
    const {id, form = {}} = input.action;
    if (id !== "delete-custom") ui.confirmDelete = null;
    if (id === "commit") return save(state, form, question);
    if (id === "commit-add" && ui.mode === "add") return saveAdd(state, form);
    if (id === "hot" || id === "custom") {
        if (ui.tab !== id) {
            Object.assign(ui, {tab: id, page: 0, slug: null});
            syncBrowseMode(state);
        }
    } else if (id === "add" || id === "import") {
        if (ui.mode !== "add" && ui.mode !== "import") {
            Object.assign(ui, {returnTab: ui.tab, returnSlug: ui.slug, addStep: 0, addDraft: {}, editingSlug: null});
        }
        ui.mode = id;
    } else if (id === "edit-custom" && ui.tab === "custom" && question) {
        Object.assign(ui, {
            returnTab: ui.tab,
            returnSlug: question.slug,
            editingSlug: question.slug,
            addStep: 0,
            addDraft: {
                category: question.category ?? "默认",
                title: question.title ?? "",
                url: question.url ?? "",
                number: question.number ? String(question.number) : "",
                constraints: question.constraints ?? "",
                description: question.description ?? "",
                input: question.input ?? "",
                output: question.output ?? "",
                example: question.example ?? ""
            },
            mode: "add"
        });
    } else if (id === "next-step" && ui.mode === "add") {
        captureStepForm(state, form);
        if (ui.addStep === 0 && !ui.addDraft.title) return render(state, {}, "请填写题名。");
        if (ui.addStep === 1 && ui.addDraft.url && !PROBLEM_URL.exec(ui.addDraft.url)) return render(state, {}, "力扣链接格式无效（可留空，或填 https://leetcode.cn/problems/...）。");
        if (ui.addStep === 2 && !ui.addDraft.description) return render(state, {}, "请填写题目要求。");
        if (ui.addStep >= ADD_STEPS.length - 1) return saveAdd(state, form);
        ui.addStep = ui.addStep + 1;
        return render(state, {});
    } else if (id === "prev-step" && ui.mode === "add") {
        captureStepForm(state, form);
        ui.addStep = Math.max(0, ui.addStep - 1);
        return render(state, {});
    } else if ((id === "confirm-import" || id === "next-step") && ui.mode === "import") {
        const rawText = (form.f2 ?? "").trim();
        const info = parseImportSource({status: "ready", text: rawText.startsWith("[") || rawText.includes("\"questions\"") ? rawText : "[" + rawText + "]"}, [...state.bundled, ...state.custom]);
        if (info.status !== "ready" || info.ready.length === 0) {
            const msg = info.status === "invalid_json"
                ? "JSON 格式有误，请检查引号和逗号。"
                : info.duplicates > 0
                    ? "这道题已在题库中（Hot 100 或自选题已存在）。"
                    : "未解析到有效新题目（需含 title 和 description）。";
            return render(state, form, msg);
        }
        state.custom = [...state.custom, ...info.ready];
        state.customTopics = customTopicsFor(state.custom);
        Object.assign(ui, {
            tab: "custom",
            customTopic: "全部",
            slug: info.ready[0].slug,
            page: 0,
            mode: "browse",
            returnTab: null,
            returnSlug: null
        });
    } else if (id === "delete-custom" && ui.tab === "custom" && question) {
        ui.confirmDelete = question.slug;
    } else if (id === "cancel-delete-custom") {
        ui.confirmDelete = null;
    } else if (id === "confirm-delete-custom" && ui.tab === "custom" && question) {
        state.custom = state.custom.filter(q => q.slug !== question.slug);
        state.customTopics = customTopicsFor(state.custom);
        if (!state.customTopics.includes(ui.customTopic)) ui.customTopic = "全部";
        ui.confirmDelete = null;
        ui.slug = null;
        ui.page = 0;
        ui.mode = "browse";
    } else if (id === "topics") {
        ui.mode = ui.mode === "topics" ? "browse" : "topics";
    } else if (id.startsWith("topic-") && ui.mode === "topics") {
        const list = ui.tab === "hot" ? state.topics : state.customTopics;
        const topic = list[Number(id.slice(6))];
        if (topic) {
            if (ui.tab === "hot") ui.topic = topic;
            else ui.customTopic = topic;
            Object.assign(ui, {slug: null, page: 0});
            syncBrowseMode(state);
        }
    } else if (id === "previous" || id === "next") {
        Object.assign(ui, {slug: null, page: ui.page + (id === "previous" ? -1 : 1)});
        syncBrowseMode(state);
    } else if (id.startsWith("row-")) {
        const item = context.list[Number(id.slice(4))];
        if (item) {
            ui.slug = item.slug;
            syncBrowseMode(state);
        }
    } else if (id === "edit" && question) {
        const existingNote = noteFor(state, question);
        const markdown = existingNote
            ? noteToMarkdown(existingNote)
            : "```" + (state.defaultLanguage || "python") + "\n\n```";
        ui.mode = "edit";
        ui.draft = {markdown};
        return render(state, {markdown});
    } else if (id === "refresh-preview" && ui.mode === "edit") {
        const markdown = (form.note ?? state.ui.draft?.markdown ?? "");
        ui.draft = {markdown};
        return render(state, {markdown});
    } else if (id === "clear-note" && ui.mode === "edit") {
        ui.draft = {markdown: ""};
        return render(state, {markdown: ""});
    } else if (id === "show-note" && question && noteFor(state, question)) {
        ui.mode = "note";
    } else if (id === "requirements" && ui.mode === "note") {
        ui.mode = "requirements";
    } else if (id === "hide-note") {
        ui.mode = "browse";
    } else if (id === "cancel") {
        if (ui.mode === "add" || ui.mode === "import") {
            Object.assign(ui, {tab: ui.returnTab ?? "custom", slug: ui.returnSlug, mode: "browse", addStep: 0, addDraft: {}, editingSlug: null, returnTab: null, returnSlug: null});
        } else {
            ui.mode = ui.mode === "edit" && question && noteFor(state, question) ? "note" : "browse";
            delete ui.draft;
        }
    }
    return render(state);
}

function event(input) {
    const state = init(input);
    const ev = input.event;
    if (ev?.name === "focus.finished") {
        const rawId = ev.id !== undefined && ev.id !== null ? String(ev.id).trim() : "";
        const focusKey = rawId || (Number.isFinite(ev.at) ? "at:" + ev.at : "ts:" + Math.floor((input.now ?? Date.now()) / 1000));
        if (focusKey !== state.lastFocusId) {
            state.lastFocusId = focusKey;
            if (state.focusPush) {
                const pool = state.ui.tab === "custom" && state.custom.length ? state.custom : state.bundled;
                const unnoted = pool.filter(q => !noteFor(state, q));
                const candidates = unnoted.length ? unnoted : pool;
                if (candidates.length) {
                    const seed = parseInt(textHash(focusKey), 16) || 0;
                    const picked = candidates[seed % candidates.length];
                    const hasNote = Boolean(noteFor(state, picked));
                    state.notice = {
                        id: "lc-focus-" + textHash(focusKey),
                        title: "专注结束 · 顺手刷一题",
                        body: `${titleFor(picked)}（${picked.category || "默认"}）· ${hasNote ? "复习思路" : "待记录思路"}`
                    };
                }
            }
        }
    }
    return render(state);
}
