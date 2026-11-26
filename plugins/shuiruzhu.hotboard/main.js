// 热点速览 · 岛仔插件（api: 1 / runtime: js / owner: status）
// 三路数据：百度热搜（可选频道）、哔哩哔哩全站热门、立创开源硬件。
// 界面为自绘画布：来源概览 + 可滚动列表 + 点击行直接打开原文，全部使用皮肤令牌。

const CH1_NAME = {
    realtime: "百度热搜",
    car: "百度汽车",
    game: "百度游戏",
    movie: "百度电影",
    teleplay: "百度电视剧",
    novel: "百度小说"
};
const COLOR_BAIDU = "#4E6EF2";
const COLOR_BILI = "#FB7299";
const COLOR_OSHW = "#2E9E6B";
const PER_CHANNEL = 12;
const ROW_H = 28;
const LIST_TOP = 32;
const LIST_VIEW_H = 238;
const CANVAS_H = 306;

function decode(s) {
    return String(s || "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function cut(s, n) {
    const a = Array.from(String(s || ""));
    return a.length <= n ? a.join("") : a.slice(0, n - 1).join("") + "…";
}

function fmtHeat(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return "";
    if (v >= 10000) return String(Math.round(v / 1000) / 10) + "万";
    return String(Math.round(v));
}

// 百度：data.cards[].content[].content[]，不同频道标题字段与热度结构不同
function parseBaidu(text, tab) {
    const out = [];
    try {
        const cards = JSON.parse(text)?.data?.cards || [];
        for (const card of cards) {
            if (out.length >= PER_CHANNEL) break;
            for (const group of card.content || []) {
                if (out.length >= PER_CHANNEL) break;
                const list = group.content || (group.word || group.title ? [group] : []);
                for (const it of list) {
                    if (out.length >= PER_CHANNEL) break;
                    const title = decode(it?.word || it?.title || "");
                    if (!title) continue;
                    const hot = it.hotScore
                        ? (typeof it.hotScore === "object" ? it.hotScore.value : it.hotScore)
                        : "";
                    out.push({
                        t: cut(title, 26),
                        u: "https://top.baidu.com/board?tab=" + tab,
                        h: fmtHeat(hot)
                    });
                }
            }
        }
    } catch { }
    return out;
}

// 哔哩哔哩全站热门：data.list[]，含 title、bvid、stat.view
function parseBili(text) {
    const out = [];
    try {
        const list = JSON.parse(text)?.data?.list || [];
        for (const it of list) {
            if (out.length >= PER_CHANNEL) break;
            const title = decode(it?.title);
            if (!title) continue;
            let link = "https://www.bilibili.com";
            if (it.bvid) link = "https://www.bilibili.com/video/" + it.bvid;
            else if (it.aid) link = "https://www.bilibili.com/video/av" + it.aid;
            const heat = fmtHeat(it.stat?.view);
            out.push({ t: cut(title, 26), u: link, h: heat ? heat + "播放" : "" });
        }
    } catch { }
    return out;
}

// 立创开源：result.lists[]
function parseOshwhub(text) {
    const out = [];
    try {
        const lists = JSON.parse(text)?.result?.lists || [];
        for (const p of lists) {
            if (out.length >= PER_CHANNEL) break;
            const name = decode(p?.name);
            if (!name) continue;
            const views = p.count?.views || 0;
            out.push({
                t: cut(name, 26),
                u: "https://oshwhub.com/" + String(p.path || "").replace(/^\//, ""),
                h: views ? views + "浏览" : ""
            });
        }
    } catch { }
    return out;
}

// 三个来源轮流交错，滚动时各源内容均匀出现
function interleave(groups) {
    const out = [];
    let i = 0;
    let more = true;
    while (more) {
        more = false;
        for (const g of groups) {
            if (i < g.length) {
                out.push(g[i]);
                more = true;
            }
        }
        i++;
    }
    return out;
}

function buildCanvas(items, stats) {
    const nodes = [];

    // 顶部三来源概览
    stats.forEach((st, i) => {
        const x = i * 129;
        nodes.push({ circle: [x + 5, 9, 3], fill: st.color });
        const label = st.name + " " + (st.state ? st.state : String(st.count));
        nodes.push({ text: label, at: [x + 13, 13], size: 10, fill: "$muted", max_width: 112 });
    });
    nodes.push({ line: [0, 24, 387, 24], stroke: "$track", width: 1 });

    if (!items.length) {
        nodes.push({ text: "数据源暂不可用", at: [193.5, 140], size: 15, align: "center", weight: 700, fill: "$text" });
        nodes.push({ text: "可检查网络或点右下角刷新", at: [193.5, 164], size: 11, align: "center", fill: "$muted" });
    } else {
        const rows = [];
        items.forEach((it, i) => {
            const y = i * ROW_H;
            rows.push({
                rect: [0, y, 387, ROW_H - 2], r: 6,
                fill: "#00000000",
                hover: { fill: "$card" },
                hit: { open: it.u }
            });
            rows.push({ circle: [9, y + 12, 3], fill: it.color });
            rows.push({ text: it.t, at: [20, y + 18], size: 11.5, fill: "$text", max_width: 248 });
            if (it.h) {
                rows.push({ text: it.h, at: [379, y + 18], size: 9.5, fill: "$dim", align: "right", max_width: 108 });
            }
        });
        nodes.push({
            group: rows,
            clip: [0, LIST_TOP, 387, LIST_VIEW_H],
            scroll: { axis: "y", content: items.length * ROW_H }
        });
    }

    // 底部说明与刷新
    nodes.push({
        text: "共 " + items.length + " 条 · 滚轮查看 · 点击打开原文",
        at: [0, 294], size: 9.5, fill: "$dim"
    });
    nodes.push({
        rect: [322, 280, 65, 22], r: 6, fill: "$card",
        hover: { fill: "$track" }, hit: { action: "refresh" }
    });
    nodes.push({ text: "刷新", at: [354.5, 295], size: 10, fill: "$muted", align: "center" });

    return { height: CANVAS_H, nodes };
}

function refresh(input) {
    const settings = input.settings || {};
    const sources = input.sources || {};
    const storage = input.storage || {};
    const today = input.today || "";

    const ch1 = settings.channel1 || "realtime";
    const s1 = sources.c1 || {};
    const s2 = sources.c2 || {};
    const shw = sources.hw || {};

    const groups = [
        { name: CH1_NAME[ch1] || "百度", color: COLOR_BAIDU, status: s1.status, list: s1.status === "ready" ? parseBaidu(s1.text, ch1) : [] },
        { name: "B站热门", color: COLOR_BILI, status: s2.status, list: s2.status === "ready" ? parseBili(s2.text) : [] }
    ];
    if (settings.show_hw !== "off") {
        groups.push({ name: "立创开源", color: COLOR_OSHW, status: shw.status, list: shw.status === "ready" ? parseOshwhub(shw.text) : [] });
    }

    const stats = groups.map(g => ({
        name: g.name,
        color: g.color,
        count: g.list.length,
        state: g.status === "ready" ? "" : (g.status === "unconfigured" ? "未授权" : "不可用")
    }));

    const items = interleave(groups.map(g => g.list.map(it => ({ ...it, color: g.color }))));

    const out = {
        status: {
            state: items.length ? "succeeded" : "offline",
            label: "热点速览",
            summary: "共 " + items.length + " 条"
        },
        canvas: buildCanvas(items, stats),
        storage: { noticeDay: storage.noticeDay || "" }
    };

    // 每天首次刷新推一条精选
    if (settings.daily_notice !== "off" && items.length && storage.noticeDay !== today) {
        const picks = items.slice(0, 3).map(it => it.t);
        out.notice = { id: "hot-" + today, title: "今日热点精选", body: cut(picks.join(" · "), 118) };
        out.storage.noticeDay = today;
    }

    return out;
}

function action(input) {
    return refresh(input);
}
