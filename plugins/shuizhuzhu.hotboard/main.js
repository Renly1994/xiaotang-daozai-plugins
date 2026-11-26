// 热点速览 · 岛仔插件（SDK v1）
// 三路数据：两路可配置的今日热榜频道 + 一路立创开源硬件。
// 界面：顶部画布概览（跟随皮肤令牌）+ 原生可点列表 + 翻页按钮。

var CH_NAME = {
  "KqndgxeLl9": "微博",
  "mproPpoq6O": "知乎",
  "Jb0vmloB1G": "百度",
  "Q1Vd5Ko85R": "36氪",
  "74KvxwokxM": "B站",
  "WnBe01o371": "微信"
};
var PAGE_SIZE = 8;
var PER_CHANNEL = 8;

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
  var a = Array.from(String(s || ""));
  if (a.length <= n) return a.join("");
  return a.slice(0, n - 1).join("") + "…";
}

// 今日热榜榜单页：不同频道模板不同（纯文本行 / 带缩略图行），
// 统一按 <tr> 切块，每块取排名 + 第一个外链标题 + 可选热度。
function parseTophub(text, channelId) {
  var out = [];
  if (!text) return out;
  var raw = String(text);
  // 榜单页面前半部分是导航，先定位第一个排名行，只处理其后的一小段
  var start = raw.indexOf('<td align="center">1.');
  if (start < 0) start = raw.indexOf('<td align="center">');
  if (start < 0) return out;
  var body = raw.slice(Math.max(0, start - 300), start + 90000);
  var rows = body.split("<tr");
  for (var i = 0; i < rows.length && out.length < PER_CHANNEL; i++) {
    var row = rows[i];
    if (!/<td align="center">\d+\.<\/td>/.test(row)) continue;

    var title = "";
    var linkRe = /<a href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
    var m;
    while ((m = linkRe.exec(row)) !== null) {
      var cand = decode(m[2]);
      if (cand.length >= 4) {
        title = cand;
        break;
      }
    }
    if (!title) continue;

    var heat = "";
    var hm = /<td class="ws">([^<]*)<\/td>/.exec(row);
    if (hm) heat = decode(hm[1]);

    out.push({
      t: title,
      u: "https://tophub.today/n/" + channelId,
      h: heat,
      s: CH_NAME[channelId] || "热榜"
    });
  }
  return out;
}

function parseOshwhub(text) {
  var out = [];
  try {
    var v = JSON.parse(text);
    var lists = (v && v.result && v.result.lists) || [];
    for (var i = 0; i < lists.length && out.length < PER_CHANNEL; i++) {
      var p = lists[i] || {};
      var name = decode(p.name);
      if (!name) continue;
      var intro = decode(p.introduction);
      var views = (p.count && p.count.views) || 0;
      out.push({
        t: name,
        u: "https://oshwhub.com/" + String(p.path || "").replace(/^\//, ""),
        h: views ? views + " 浏览" : "",
        s: "立创开源",
        d: intro
      });
    }
  } catch (e) {}
  return out;
}

// 三个来源轮流交错，保证每页都有各源内容
function interleave(groups) {
  var out = [];
  var i = 0;
  var more = true;
  while (more) {
    more = false;
    for (var g = 0; g < groups.length; g++) {
      if (i < groups[g].length) {
        out.push(groups[g][i]);
        more = true;
      }
    }
    i++;
  }
  return out;
}

function statOf(sources, key, channelId, fallbackName) {
  var s = sources && sources[key];
  var name = CH_NAME[channelId] || fallbackName;
  if (!s || s.status === "unconfigured") return { name: name, count: 0, state: "未授权" };
  if (s.status === "offline") return { name: name, count: 0, state: "不可用" };
  return { name: name, count: 0, state: "" };
}

// 画布：三列概览条，全部使用宿主主题令牌，换皮肤自动跟随
function buildCanvas(stats) {
  var nodes = [
    { rect: [0, 0, 387, 74], r: 10, fill: "$card" }
  ];
  var n = stats.length;
  var colW = n > 0 ? 387 / n : 387;
  for (var i = 0; i < n; i++) {
    var st = stats[i];
    var x = Math.round(colW * i) + 12;
    var w = Math.round(colW) - 24;
    var max = PER_CHANNEL;
    var ratio = max > 0 ? Math.min(1, st.count / max) : 0;
    nodes.push({ text: st.name, at: [x, 24], size: 10.5, fill: "$muted" });
    nodes.push({
      text: st.state ? st.state : String(st.count),
      at: [x + w, 24],
      size: 10.5,
      fill: st.state ? "$dim" : "$text",
      align: "right"
    });
    nodes.push({ rect: [x, 34, w, 5], r: 2.5, fill: "$track" });
    if (ratio > 0) {
      nodes.push({ rect: [x, 34, Math.max(3, Math.round(w * ratio)), 5], r: 2.5, fill: "$accent" });
    }
  }
  nodes.push({ text: "数据来自今日热榜与立创开源，点条目在浏览器查看", at: [12, 62], size: 9, fill: "$dim" });
  return { height: 74, nodes: nodes };
}

function buildView(st, settings) {
  var items = st.items || [];
  var total = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  var page = Math.min(Math.max(0, st.page || 0), total - 1);
  var slice = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  var list = [];
  for (var i = 0; i < slice.length; i++) {
    var it = slice[i];
    var detail = it.s + (it.h ? " · " + it.h : "") + (it.d ? " · " + it.d : "");
    var entry = {
      label: cut(it.t, 28),
      detail: cut(detail, 80),
      state: "succeeded"
    };
    if (it.u) entry.open = it.u;
    list.push(entry);
  }
  if (!list.length) {
    list.push({ label: "还没有数据", detail: "检查插件设置里的频道，或稍后刷新", state: "idle" });
  }
  return {
    status: {
      state: "succeeded",
      label: "热点速览",
      summary: "共 " + items.length + " 条 · 第 " + (page + 1) + "/" + total + " 页",
      items: list,
      actions: [
        { id: "prev", label: "上一页" },
        { id: "next", label: "下一页" }
      ]
    },
    canvas: buildCanvas(st.stats || []),
    storage: {
      page: page,
      items: items,
      stats: st.stats || [],
      noticeDay: st.noticeDay || "",
      updatedAt: st.updatedAt || 0
    }
  };
}

function refresh(input) {
  var settings = input.settings || {};
  var sources = input.sources || {};
  var storage = input.storage || {};
  var today = input.today || "";

  var ch1 = settings.channel1 || "KqndgxeLl9";
  var ch2 = settings.channel2 || "Q1Vd5Ko85R";
  var groups = [];
  var stats = [];

  var s1 = sources.c1 || {};
  var s2 = sources.c2 || {};
  var g1 = s1.status === "ready" ? parseTophub(s1.text, ch1) : [];
  var g2 = s2.status === "ready" ? parseTophub(s2.text, ch2) : [];
  groups.push(g1);
  groups.push(g2);
  stats.push({ name: CH_NAME[ch1] || "频道一", count: g1.length, state: s1.status === "ready" ? "" : (s1.status === "unconfigured" ? "未授权" : "不可用") });
  stats.push({ name: CH_NAME[ch2] || "频道二", count: g2.length, state: s2.status === "ready" ? "" : (s2.status === "unconfigured" ? "未授权" : "不可用") });

  var withHw = String(settings.show_hw) !== "off";
  if (withHw) {
    var shw = sources.hw || {};
    var g3 = shw.status === "ready" ? parseOshwhub(shw.text) : [];
    groups.push(g3);
    stats.push({ name: "立创开源", count: g3.length, state: shw.status === "ready" ? "" : (shw.status === "unconfigured" ? "未授权" : "不可用") });
  }

  var items = interleave(groups);

  // 每次整点刷新时退回第一页，避免用户看到过期页
  var next = {
    page: 0,
    items: items,
    stats: stats,
    noticeDay: storage.noticeDay || "",
    updatedAt: input.now || 0
  };

  var out = buildView(next, settings);

  // 每天首次打开推一条精选
  if (String(settings.daily_notice) !== "off" && items.length && next.noticeDay !== today) {
    var picks = [];
    for (var i = 0; i < items.length && picks.length < 3; i++) picks.push(items[i].t);
    out.notice = {
      id: "hot-" + today,
      title: "今日热点精选",
      body: cut(picks.join(" · "), 118)
    };
    out.storage.noticeDay = today;
  }

  return out;
}

function action(input) {
  var storage = input.storage || {};
  var id = (input.action && input.action.id) || "";
  var st = {
    page: storage.page || 0,
    items: storage.items || [],
    stats: storage.stats || [],
    noticeDay: storage.noticeDay || "",
    updatedAt: storage.updatedAt || 0
  };
  var total = Math.max(1, Math.ceil(st.items.length / PAGE_SIZE));
  if (id === "next") st.page = (st.page + 1) % total;
  if (id === "prev") st.page = (st.page - 1 + total) % total;
  return buildView(st, input.settings || {});
}
