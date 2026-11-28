// 今天你欠薪了吗 · 独立状态页（页面管理 → 插件页面）
// 版式参考原生页：左上「欠薪 + 第几天」、右上日期时间、中间大字「N 天 HH:mm:ss」、
// 下面「≈K 个月 · 起算 …」、底部三颗「记 1/3/6 个月」按钮。
//
// 时区：脚本环境的 new Date("YYYY-MM-DDTHH:mm") 会按 UTC 解析，所以统一用「本地墙上时间」
// = 输入时刻 + tz.offset_minutes，再用 Date.UTC 构造起算点。
// 秒：画布只能借 now 绑定显示时钟，把时区按「起算时刻」平移，就得到已过多久的 HH:mm:ss。
function pad(value) { return value < 10 ? "0" + value : String(value); }

function wallNow(now, tz) {
  const stamp = typeof now === "number" ? now : Date.now();
  const offset = tz && typeof tz.offset_minutes === "number" ? tz.offset_minutes : 0;
  return stamp + offset * 60000;
}

function parseAnchor(settings) {
  const day = String(settings.anchor || "").slice(0, 10);
  const time = String(settings.anchor_time || "00:00").slice(0, 5);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]), month = Number(dateMatch[2]) - 1, date = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]), minute = Number(timeMatch[2]);
  if (month < 0 || month > 11 || date < 1 || date > 31 || hour > 23 || minute > 59) return null;
  const check = new Date(Date.UTC(year, month, date));
  if (check.getUTCMonth() !== month || check.getUTCDate() !== date) return null;
  return { year: year, month: month, date: date, hour: hour, minute: minute };
}

// 自然月后移，月末向目标月最后一天裁剪：1 月 31 日 + 1 个月 = 2 月 28 日。
function shiftWall(anchor, months) {
  const lastDay = new Date(Date.UTC(anchor.year, anchor.month + months + 1, 0)).getUTCDate();
  return Date.UTC(
    anchor.year,
    anchor.month + months,
    Math.min(anchor.date, lastDay),
    anchor.hour,
    anchor.minute,
    0,
    0
  );
}

function thousands(value) {
  const digits = String(value);
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return out;
}

function clampMonths(value) {
  const parsed = parseInt(value, 10);
  if (!parsed || parsed < 0) return 0;
  return Math.min(parsed, 600);
}

function normalizeStorage(storage) {
  const source = storage || {};
  const history = Array.isArray(source.history) ? source.history.filter(function (n) {
    return n === 1 || n === 3 || n === 6;
  }).slice(0, 40) : [];
  return { months: clampMonths(source.months), history: history };
}

// 让 now 绑定显示「已过多久」的时钟：把时区按起算时刻平移。
// 起算 00:00 时直接用本地时区；否则平移成整小时的 Etc/GMT 区，非整小时退回本地时区。
function elapsedZone(input, anchor) {
  const tz = input.tz || {};
  const offset = typeof tz.offset_minutes === "number" ? tz.offset_minutes : 480;
  const name = typeof tz.name === "string" && tz.name ? tz.name : "Asia/Shanghai";
  const shift = anchor.hour * 60 + anchor.minute;
  const total = offset - shift;
  if (total === offset) return name;
  if (total % 60 === 0) {
    const hours = total / 60;
    const label = hours === 0 ? "" : (hours > 0 ? "-" + hours : "+" + Math.abs(hours));
    return "Etc/GMT" + label;
  }
  return name;
}

function weekdayName(wall) {
  const names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const index = new Date(wall).getUTCDay();
  return names[index];
}

function compute(input) {
  const settings = input.settings || {};
  const anchor = parseAnchor(settings);
  if (!anchor) return null;

  const storage = normalizeStorage(input.storage);
  const startWall = shiftWall(anchor, storage.months);
  const nowWall = wallNow(input.now, input.tz);
  const nowSec = Math.floor((typeof input.now === "number" ? input.now : Date.now()) / 1000);
  const elapsed = Math.max(0, nowWall - startWall);

  const days = Math.floor(elapsed / 86400000);
  const hours = Math.floor(elapsed / 3600000) % 24;
  const minutes = Math.floor(elapsed / 60000) % 60;
  const seconds = Math.floor(elapsed / 1000) % 60;

  let monthsElapsed = 0;
  while (shiftWall(anchor, storage.months + monthsElapsed + 1) <= nowWall) monthsElapsed++;

  const monthly = Math.max(0, parseInt(settings.monthly || "0", 10) || 0);
  const title = String(settings.title || "欠薪").slice(0, 12);

  return {
    anchor: anchor,
    storage: storage,
    nowSec: nowSec,
    wall: nowWall,
    elapsed: elapsed,
    days: days,
    hours: hours,
    minutes: minutes,
    seconds: seconds,
    monthsElapsed: monthsElapsed,
    monthly: monthly,
    title: title,
    zone: elapsedZone(input, anchor)
  };
}

function build(input) {
  const data = compute(input);
  if (!data) {
    return {
      storage: normalizeStorage(input.storage),
      status: { state: "failed", label: "欠薪", summary: "起算时间无效，请到插件设置里重新填写" },
      canvas: {
        height: 96,
        nodes: [
          { text: "起算时间无效，请在插件设置里填写", at: [8, 48], size: 13, fill: "$text" }
        ]
      }
    };
  }

  const anchorText = data.anchor.year + "-" + pad(data.anchor.month + 1) + "-" + pad(data.anchor.date)
    + " " + pad(data.anchor.hour) + ":" + pad(data.anchor.minute);

  const sub = "≈ " + data.monthsElapsed + " 个月 · 起算 " + anchorText
    + (data.monthly > 0 ? " · 约 ¥" + thousands(data.monthsElapsed * data.monthly) : "");

  const nowDate = new Date(data.wall);

  const binds = {
    days: {
      counter: {
        start_value: data.days,
        per_second: 0,
        start_at: data.nowSec,
        decimals: 0
      }
    },
    elapsed: { now: "HH:mm:ss", zone: data.zone }
  };

  // 页头「欠薪 第几天」由宿主按清单名 + 标题强调色绘制，画布不再重复画标题。
  const nodes = [];
  const W = 390;
  nodes.push({
    text: "{days} 天 {elapsed}",
    at: [W / 2, 46],
    size: 30,
    weight: 800,
    align: "center",
    max_width: 370,
    fill: "$text",
    id: "clock"
  });

  nodes.push({
    text: sub,
    at: [W / 2, 74],
    size: 10,
    align: "center",
    max_width: 370,
    fill: "$muted"
  });

  const bw = 104;
  const gap = 9;
  const start = (W - (bw * 3 + gap * 2)) / 2;
  const button = function (index, label, action) {
    const x = start + index * (bw + gap);
    return [
      { rect: [x, 90, bw, 30], r: 15, fill: "$track", hit: { action: action } },
      {
        text: label,
        at: [x + bw / 2, 111],
        size: 12,
        align: "center",
        max_width: bw,
        fill: "$text",
        hit: { action: action }
      }
    ];
  };
  Array.prototype.push.apply(nodes, button(0, "记 1 个月", "add1"));
  Array.prototype.push.apply(nodes, button(1, "记 3 个月", "add3"));
  Array.prototype.push.apply(nodes, button(2, "记 6 个月", "add6"));

  return {
    storage: { months: data.storage.months, history: data.storage.history },
    status: {
      state: "succeeded",
      label: data.title,
      summary: "第 " + data.days + " 天"
    },
    canvas: { height: 126, nodes: nodes, binds: binds }
  };
}

function refresh(input) {
  return build(input);
}

function action(input) {
  const id = input && input.action ? String(input.action.id || "") : "";
  const storage = normalizeStorage(input && input.storage);
  if (id === "add1" || id === "add3" || id === "add6") {
    const step = id === "add1" ? 1 : (id === "add3" ? 3 : 6);
    storage.months = clampMonths(storage.months + step);
    storage.history.push(step);
  } else if (id === "undo") {
    const last = storage.history.pop();
    if (last) storage.months = clampMonths(storage.months - last);
  }
  const next = Object.assign({}, input, { storage: storage });
  return build(next);
}


