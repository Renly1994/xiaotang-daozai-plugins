const ROW = 48;
const VISIBLE = 3;
const LIST_TOP = 204;
const CHART_TOP = 80;
const FRESH = 30 * 60;
const RECENT = 18 * 3600;
const UP = "#F05252";
const DOWN = "#1F9D57";
const INDEX = "sh000001";

function refresh(input) {
  return render(input || {});
}

function action(input) {
  return render(input || {});
}

function render(input) {
  const settings = input.settings || {};
  const storage = input.storage && typeof input.storage === "object" ? input.storage : {};
  const nowMs = Number.isFinite(input.now) ? input.now : Date.now();
  const now = Math.floor(nowMs / 1000);
  const today = input.today || shanghaiDate(nowMs);
  const click = clicked(input);
  const title = textOr(settings.title, "自选");
  const tokens = watchTokens(settings);
  const colors = settings.up_color === "green" ? { up: DOWN, down: UP } : { up: UP, down: DOWN };
  const threshold = positive(settings.alert_pct);
  const alerts = readAlerts(settings.alerts);
  const source = (input.sources && input.sources.quotes) || { status: "unconfigured" };
  const sourceA = (input.sources && input.sources.a) || { status: "unconfigured" };
  const sourceB = (input.sources && input.sources.b) || { status: "unconfigured" };
  const period = resolvePeriod(click, storage.period);
  const focus = resolveFocus(click, storage, tokens);
  const parsedA = sourceA.status === "ready" ? parseMinute(sourceA.text) : null;
  const parsedB = sourceB.status === "ready" ? parseMinute(sourceB.text) : null;
  const charts = mergeCharts(storage, [parsedA, parsedB]);
  const previous = storage.quotes || {};
  const parsed = source.status === "ready" ? parseQuotes(source.text) : [];
  if (parsedA && parsedA.quote) parsed.push(parsedA.quote);
  if (parsedB && parsedB.quote) parsed.push(parsedB.quote);
  const quoteState = source.status === "ready" || parsedA && parsedA.quote || parsedB && parsedB.quote ? "ready" : source.status;
  const split = splitIndex(parsed);
  const live = split.rest.length || split.index ? orderQuotes(split.rest, tokens) : [];
  const cached = live.length ? [] : recall(previous, tokens);
  const rows = (live.length ? live : cached).slice(0, 12);
  const showingCache = !live.length && cached.length > 0;
  const indexRow = split.index || (!live.length && previous[INDEX] ? previous[INDEX] : null);
  applyNames(rows, alerts);
  if (indexRow) applyNames([indexRow], alerts);
  const sent = pruneSent(storage.sent, rows, today);
  const notice = live.length ? pickNotice(rows, previous, alerts, sent, threshold, today, now, title) : null;
  if (notice && notice.key) sent[notice.key] = 1;
  const tape = live.length ? updateTape(storage.tape, rows, split.index, today, nowMs) : cleanTape(storage.tape);
  const phase = phaseOf(tokens, nowMs, quoteState, parsed.length, showingCache, !!click);
  const latest = newest(indexRow && indexRow.price > 0 ? rows.concat([indexRow]) : rows);
  const keyB = symbolKey(norm(tokens[1] || ""));
  const focusStatus = focus && focus === keyB ? sourceB.status : sourceA.status;
  const series = makeSeries(focus, period, charts, tape, quoteOf(focus, rows, indexRow), colors, focusStatus);
  const view = buildCanvas(title, phase, rows, colors, alerts, today, focus, period, series, indexRow);
  const status = buildStatus(source, rows, phase, latest, now, tokens, indexRow);
  const pinned = pinnedCanvases(indexRow, rows, colors);
  const slots = [];
  for (let index = 0; index < rows.length; index++) slots.push(rows[index].key);
  const output = {
    status,
    canvas: view.canvas,
    storage: {
      quotes: live.length ? snapshot(live, split.index) : previous,
      sent,
      focus,
      period,
      slots,
      charts,
      tape
    }
  };
  if (pinned.length) output.pinned = { canvas: pinned.length === 1 ? pinned[0] : pinned };
  if (notice) output.notice = { id: notice.id, title: notice.title, body: notice.body };
  return output;
}

function clicked(input) {
  const value = input.action;
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value.id || "");
}

function resolvePeriod(click, stored) {
  if (click === "period-time" || click === "period-m5" || click === "period-m30" || click === "period-day") return click.slice(7);
  if (stored === "time" || stored === "m5" || stored === "m30" || stored === "day") return stored;
  return "time";
}

function resolveFocus(click, storage, tokens) {
  const allowed = [];
  for (let index = 0; index < tokens.length; index++) {
    const key = symbolKey(norm(tokens[index]));
    if (key && key !== INDEX && allowed.indexOf(key) < 0) allowed.push(key);
  }
  let focus = storage.focus || allowed[0] || "";
  const match = /^sym-(\d+)$/.exec(click || "");
  if (match && storage.slots && storage.slots[Number(match[1])]) focus = String(storage.slots[Number(match[1])]);
  if (allowed.indexOf(focus) < 0) focus = allowed[0] || "";
  return focus;
}

function buildStatus(source, rows, phase, latest, now, tokens, indexRow) {
  const priced = rows.filter(row => row.price > 0);
  if (!tokens.length && !(indexRow && indexRow.price > 0)) return { state: "idle", label: "等待填写" };
  if (source.status === "unconfigured" && !priced.length && !(indexRow && indexRow.price > 0)) return { state: "idle", label: "等待授权" };
  if (!priced.length && !(indexRow && indexRow.price > 0)) return { state: "offline", label: "暂不可用" };
  const up = priced.filter(row => row.pct > 0).length;
  const down = priced.filter(row => row.pct < 0).length;
  let summary = priced.length + " 只 · " + up + " 涨 " + down + " 跌";
  if (indexRow && indexRow.price > 0) summary += " · 上证 " + (indexRow.priceText || indexRow.price) + " " + formatPct(indexRow.pct);
  const status = {
    state: source.status === "ready" && !phase.stale ? "succeeded" : "offline",
    label: phase.label,
    summary: cut(summary, 120)
  };
  if (Number.isFinite(latest) && latest <= now + 60) status.observed_at = latest;
  return status;
}

function buildCanvas(title, phase, rows, colors, alerts, today, focus, period, series, indexRow) {
  const nodes = header(title, phase, indexRow, colors);
  if (!rows.length && focus !== INDEX) {
    nodes.push(
      text(phase.empty, 193.5, 112, 16, { align: "center", weight: 700, fill: "$text" }),
      text(phase.hint, 193.5, 138, 11, { align: "center", fill: "$muted", max_width: 320, lines: 2 })
    );
    return { canvas: { height: 176, nodes } };
  }
  nodes.push.apply(nodes, tabNodes(period));
  nodes.push.apply(nodes, chartNodes(series, CHART_TOP));
  if (!rows.length) return { canvas: { height: 210, nodes } };
  const body = [];
  for (let index = 0; index < rows.length; index++) {
    body.push.apply(body, rowNodes(rows[index], index * ROW, colors, alertFor(alerts, rows[index], today), rows[index].key === focus, "sym-" + index));
  }
  if (rows.length > VISIBLE) {
    nodes.push({
      group: body,
      clip: [0, LIST_TOP, 387, VISIBLE * ROW],
      scroll: { axis: "y", content: rows.length * ROW }
    });
  } else {
    shift(body, LIST_TOP);
    nodes.push.apply(nodes, body);
  }
  const height = LIST_TOP + Math.min(rows.length, VISIBLE) * ROW + 4;
  return { canvas: { height: Math.max(40, Math.min(360, height)), nodes } };
}

function header(title, phase, indexRow, colors) {
  const active = phase.id === "open" || phase.id === "auction";
  const waiting = phase.label === "等待授权" || phase.label === "等待填写";
  const nodes = [
    text(cut(title, 8), 0, 16, 14, { weight: 700, fill: "$text", max_width: 120 }),
    { rect: [208, 0, 102, 20], r: 6, fill: active ? "$accent" : "$card" },
    text(phase.label, 259, 14, 10, {
      align: "center", weight: 700, max_width: 94,
      fill: active ? "#FFFFFF" : "$muted"
    }),
    {
      rect: [318, 0, 69, 20], r: 6, fill: "$card",
      hover: { fill: "$track" }, hit: { action: "refresh" }
    },
    text("刷新", 352, 14, 10, { align: "center", fill: "$muted", hit: { action: "refresh" } }),
    text("上证指数", 8, 39, 12, { weight: 700, fill: "$text", max_width: 72 })
  ];
  if (indexRow && indexRow.price > 0) {
    const color = indexRow.pct > 0 ? colors.up : indexRow.pct < 0 ? colors.down : "$text";
    nodes.push(text(indexRow.priceText || Number(indexRow.price).toFixed(2), 86, 39, 12, {
      weight: 700, fill: color, max_width: 84
    }));
    nodes.push(text(formatPct(indexRow.pct), 176, 39, 12, {
      weight: 700, fill: color, max_width: 76
    }));
  } else {
    nodes.push(text(waiting ? "授权后显示" : "—", 86, 39, 12, { fill: "$dim" }));
  }
  nodes.push({ line: [0, 48, 387, 48], stroke: "$track", width: 1 });
  return nodes;
}

function tabNodes(period) {
  const items = [
    ["time", "分时", "period-time"],
    ["m5", "5分", "period-m5"],
    ["m30", "30分", "period-m30"],
    ["day", "日线", "period-day"]
  ];
  const nodes = [];
  for (let index = 0; index < items.length; index++) {
    const x = 3 + index * 96;
    const on = period === items[index][0];
    nodes.push({
      rect: [x, 52, 92, 22], r: 6,
      fill: on ? "$accent" : "$card",
      hover: { fill: on ? "$accent" : "$track" },
      hit: { action: items[index][2] }
    });
    nodes.push(text(items[index][1], x + 46, 67, 11, {
      align: "center", weight: 700,
      fill: on ? "#FFFFFF" : "$muted",
      hit: { action: items[index][2] }
    }));
  }
  return nodes;
}

function chartNodes(series, top) {
  const nodes = [
    text(cut(series.title, 8), 0, top + 16, 13, { weight: 700, fill: "$text", max_width: 108 })
  ];
  if (series.sampled) nodes.push(text("采样", 112, top + 16, 11, { fill: "$dim" }));
  if (series.priceText) {
    nodes.push(text(series.priceText, 292, top + 16, 13, {
      align: "right", weight: 700, fill: series.color, max_width: 90
    }));
    nodes.push(text(series.pctText, 387, top + 16, 12, {
      align: "right", weight: 700, fill: series.color, max_width: 84
    }));
  }
  const plot = [4, top + 26, 379, 68];
  if (series.kind === "line") nodes.push.apply(nodes, lineNodes(series.points, series.prev, plot, series.color, series.xMax));
  else if (series.kind === "candle") {
    nodes.push({ line: [4, top + 94, 383, top + 94], stroke: "$track", width: 1 });
    nodes.push.apply(nodes, candleNodes(series.bars, plot, series.colors));
  } else {
    nodes.push(text(series.empty, 193.5, top + 64, 13, { align: "center", fill: "$muted", max_width: 320 }));
  }
  if (series.axis[0]) nodes.push(text(series.axis[0], 4, top + 112, 9, { fill: "$dim" }));
  if (series.axis[1]) nodes.push(text(series.axis[1], 193.5, top + 112, 9, { align: "center", fill: "$dim" }));
  if (series.axis[2]) nodes.push(text(series.axis[2], 383, top + 112, 9, { align: "right", fill: "$dim" }));
  return nodes;
}

function lineNodes(points, prev, box, color, xMax) {
  const x = box[0];
  const y = box[1];
  const width = box[2];
  const height = box[3];
  let low = Infinity;
  let high = -Infinity;
  for (let index = 0; index < points.length; index++) {
    if (points[index].p < low) low = points[index].p;
    if (points[index].p > high) high = points[index].p;
  }
  if (prev > 0) {
    if (prev < low) low = prev;
    if (prev > high) high = prev;
  }
  if (!(high > low)) high = low + 1;
  const pad = (high - low) * 0.12;
  low -= pad;
  high += pad;
  const span = high - low;
  const scale = xMax > 0 ? xMax : 1;
  const yOf = price => y + (high - price) / span * height;
  const plotted = [];
  for (let index = 0; index < points.length; index++) {
    plotted.push([round(x + points[index].x / scale * width), round(yOf(points[index].p))]);
  }
  const nodes = [];
  if (prev > 0) {
    const lineY = round(yOf(prev));
    nodes.push({ line: [x, lineY, x + width, lineY], stroke: "$dim", width: 1, dash: [3, 3] });
  }
  nodes.push({
    points: plotted,
    stroke: color,
    width: 1.5,
    cap: "round",
    fill: tint(color),
    area: round(y + height)
  });
  const last = plotted[plotted.length - 1];
  nodes.push({ circle: [last[0], last[1], 2.5], fill: color });
  return nodes;
}

function candleNodes(bars, box, colors) {
  const x = box[0];
  const y = box[1];
  const width = box[2];
  const height = box[3];
  let low = Infinity;
  let high = -Infinity;
  for (let index = 0; index < bars.length; index++) {
    if (bars[index].l < low) low = bars[index].l;
    if (bars[index].h > high) high = bars[index].h;
  }
  if (!(high > low)) high = low + 1;
  const pad = (high - low) * 0.1;
  low -= pad;
  high += pad;
  const span = high - low;
  const slot = width / bars.length;
  const body = Math.max(bars.length > 80 ? 1 : 2, Math.min(8, slot * 0.62));
  const yOf = price => y + (high - price) / span * height;
  const nodes = [];
  for (let index = 0; index < bars.length; index++) {
    const bar = bars[index];
    const cx = x + slot * index + slot / 2;
    const up = bar.c >= bar.o;
    const color = up ? colors.up : colors.down;
    const top = yOf(Math.max(bar.o, bar.c));
    const bottom = yOf(Math.min(bar.o, bar.c));
    nodes.push({ line: [round(cx), round(yOf(bar.h)), round(cx), round(yOf(bar.l))], stroke: color, width: 1 });
    nodes.push({ rect: [round(cx - body / 2), round(top), round(body), round(Math.max(1, bottom - top))], fill: color });
  }
  return nodes;
}

function rowNodes(row, y, colors, alert, selected, actionId) {
  const rising = row.pct > 0;
  const falling = row.pct < 0;
  const color = rising ? colors.up : falling ? colors.down : "$muted";
  const tintColor = rising ? colors.up + "22" : falling ? colors.down + "22" : "$card";
  const hint = selected ? "当前K线" : "切换K线";
  const plate = {
    rect: [0, y, 387, 44], r: 8, fill: selected ? "$card" : "#00000000",
    hover: { fill: "$card", hint },
    hit: { action: actionId }
  };
  const sub = row.missing ? "请检查代码，前缀用 sh/sz/bj/hk/us" : subtitle(row, alert);
  const nodes = [
    plate,
    text(cut(row.name || row.symbol, 10), 12, y + 18, 14, {
      weight: 700, fill: "$text", max_width: 168, hit: { action: actionId }
    }),
    text(cut(sub, 28), 12, y + 36, 10, { fill: "$dim", max_width: 176 }),
    text(row.price > 0 ? row.priceText : row.missing ? "无行情" : "停牌", 286, y + 27, 15, {
      align: "right", weight: 700, fill: row.price > 0 ? color : "$muted", max_width: 86,
      hit: { action: actionId }
    })
  ];
  const badge = { rect: [296, y + 11, 84, 22], r: 6, fill: row.price > 0 ? tintColor : "$card" };
  if (row.url) {
    badge.hit = { open: row.url };
    badge.hover = { hint: "打开行情" };
  }
  nodes.push(badge);
  nodes.push(text(row.price > 0 ? formatPct(row.pct) : "—", 338, y + 26, 11, {
    align: "center", weight: 700, fill: row.price > 0 ? color : "$muted", max_width: 76
  }));
  if (selected) nodes.push({ rect: [0, y + 10, 3, 24], r: 2, fill: "$accent" });
  return nodes;
}

function makeSeries(focus, period, charts, tape, quote, colors, minuteStatus) {
  const saved = charts[focus] || null;
  const ashare = isAshare(focus);
  const drawn = drawSeries(focus, period, saved, tape, quote, ashare);
  const title = (quote && quote.name) || (saved && saved.name) || (focus === INDEX ? "上证指数" : focus || "K线");
  const last = drawn.points && drawn.points.length ? drawn.points[drawn.points.length - 1].p : null;
  const color = directionColor(quote, drawn.prev, last, colors);
  return {
    title,
    priceText: quote && quote.price > 0 ? (quote.priceText || Number(quote.price).toFixed(2)) : "",
    pctText: quote && quote.price > 0 ? formatPct(quote.pct) : "",
    color,
    colors,
    kind: drawn.kind,
    points: drawn.points || [],
    prev: drawn.prev || null,
    xMax: drawn.xMax || 240,
    bars: drawn.bars || [],
    axis: drawn.axis || ["", "", ""],
    sampled: drawn.kind !== "empty" && !drawn.full,
    empty: emptyMessage(period, drawn.hasServer, minuteStatus)
  };
}

function drawSeries(focus, period, saved, tape, quote, ashare) {
  const minute = saved && saved.minute && saved.minute.length ? saved.minute : [];
  const days = saved && saved.day && saved.day.length ? saved.day : [];
  if (period === "day") {
    if (days.length) {
      const bars = days.slice(-80);
      return { kind: "candle", bars, full: true, hasServer: true, axis: candleAxis(bars) };
    }
    const taped = tape.days && tape.days[focus];
    if (taped && taped.length) return { kind: "candle", bars: taped.slice(-80), full: false, hasServer: false, axis: candleAxis(taped.slice(-80)) };
    return { kind: "empty", hasServer: false, axis: ["", "", ""] };
  }
  if (period === "time") {
    if (minute.length) {
      const points = sessionLine(minute, ashare);
      if (points.length >= 2) {
        return {
          kind: "line", points, full: true, hasServer: true,
          prev: (saved && saved.prec) || (quote && quote.prev) || null,
          xMax: ashare ? 240 : Math.max(1, points.length - 1),
          axis: lineAxis(points, ashare)
        };
      }
    }
    const raw = tape.points && tape.points[focus];
    if (raw && raw.length >= 2) {
      const points = [];
      for (let index = 0; index < raw.length; index++) points.push({ x: ashare ? sessionIndex(raw[index][0]) : index, p: raw[index][1], label: clockLabel(raw[index][0]) });
      return {
        kind: "line", points, full: false, hasServer: false,
        prev: quote && quote.prev,
        xMax: ashare ? 240 : Math.max(1, points.length - 1),
        axis: lineAxis(points, ashare)
      };
    }
    return { kind: "empty", hasServer: minute.length > 0, axis: ["", "", ""] };
  }
  if (period === "m5" && minute.length) {
    const bars = minuteCandles(minute).slice(-240);
    if (bars.length) return { kind: "candle", bars, full: true, hasServer: true, axis: candleAxis(bars) };
  }
  if (minute.length) {
    const bars = aggregate(minute, 30, ashare);
    if (bars.length) return { kind: "candle", bars, full: true, hasServer: true, axis: candleAxis(bars) };
  }
  const raw = tape.points && tape.points[focus];
  const day = String(tape.day || "").replace(/-/g, "");
  if (raw && raw.length >= 2 && /^20\d{6}$/.test(day)) {
    const fake = [];
    for (let index = 0; index < raw.length; index++) {
      const price = raw[index][1];
      fake.push({ t: day + pad(Math.floor(raw[index][0] / 100)) + pad(raw[index][0] % 100), o: price, c: price, h: price, l: price });
    }
    const bars = aggregate(fake, period === "m30" ? 30 : 5, ashare).slice(-48);
    if (bars.length) return { kind: "candle", bars, full: false, hasServer: false, axis: candleAxis(bars) };
  }
  return { kind: "empty", hasServer: false, axis: ["", "", ""] };
}

function emptyMessage(period, hasServer, minuteStatus) {
  if (minuteStatus === "unconfigured" && !hasServer) {
    if (period === "day") return "授权后显示日线";
    if (period === "time") return "授权后显示分时";
    return "授权后显示K线";
  }
  if (period === "time") return "暂无分时";
  if (period === "m30") return "暂无30分钟线";
  if (period === "m5") return "暂无5分钟线";
  return "暂无日线";
}

function lineAxis(points, ashare) {
  if (ashare) return ["09:30", "11:30", "15:00"];
  if (!points.length) return ["", "", ""];
  return [points[0].label || "", "", points[points.length - 1].label || ""];
}

function candleAxis(bars) {
  if (!bars.length) return ["", "", ""];
  const mid = bars[Math.floor((bars.length - 1) / 2)];
  return [axisLabel(bars[0]), bars.length > 2 ? axisLabel(mid) : "", axisLabel(bars[bars.length - 1])];
}

function axisLabel(bar) {
  if (!bar) return "";
  if (bar.d && String(bar.d).length >= 10) return String(bar.d).slice(5);
  return bar.label || "";
}

function minuteCandles(minute) {
  const bars = [];
  for (let index = 0; index < minute.length; index++) {
    const bar = minute[index];
    const day = bar.t.slice(0, 4) + "-" + bar.t.slice(4, 6) + "-" + bar.t.slice(6, 8);
    bars.push({ d: day, o: bar.o, h: bar.h, l: bar.l, c: bar.c, label: day.slice(5) });
  }
  return bars;
}

function sessionLine(bars, ashare) {
  const day = bars[bars.length - 1].t.slice(0, 8);
  const points = [];
  for (let index = 0; index < bars.length; index++) {
    if (bars[index].t.slice(0, 8) !== day) continue;
    const hhmm = Number(bars[index].t.slice(8, 12));
    points.push({ x: ashare ? sessionIndex(hhmm) : points.length, p: bars[index].c, label: clockLabel(hhmm) });
  }
  return points;
}

function aggregate(bars, size, ashare) {
  const groups = [];
  const map = {};
  for (let index = 0; index < bars.length; index++) {
    const bar = bars[index];
    const day = bar.t.slice(0, 8);
    const hhmm = Number(bar.t.slice(8, 12));
    const mins = Math.floor(hhmm / 100) * 60 + (hhmm % 100);
    const bucket = ashare ? Math.floor(sessionIndex(hhmm) / size) : Math.floor(mins / size);
    const id = day + "-" + bucket;
    let group = map[id];
    if (!group) {
      group = {
        d: day.slice(0, 4) + "-" + day.slice(4, 6) + "-" + day.slice(6, 8),
        o: bar.o, h: bar.h, l: bar.l, c: bar.c,
        label: day.slice(4, 6) + "-" + day.slice(6, 8) + " " + clockLabel(hhmm)
      };
      map[id] = group;
      groups.push(group);
    } else {
      if (bar.h > group.h) group.h = bar.h;
      if (bar.l < group.l) group.l = bar.l;
      group.c = bar.c;
    }
  }
  return groups;
}

function aggregateDays(minute) {
  const groups = [];
  const map = {};
  for (let index = 0; index < minute.length; index++) {
    const bar = minute[index];
    const day = bar.t.slice(0, 4) + "-" + bar.t.slice(4, 6) + "-" + bar.t.slice(6, 8);
    let group = map[day];
    if (!group) {
      group = { d: day, o: bar.o, h: bar.h, l: bar.l, c: bar.c, label: day.slice(5) };
      map[day] = group;
      groups.push(group);
    } else {
      if (bar.h > group.h) group.h = bar.h;
      if (bar.l < group.l) group.l = bar.l;
      group.c = bar.c;
    }
  }
  return groups;
}

function mergeDays(stored, fresh) {
  const map = {};
  const dates = [];
  function put(bar, overwrite) {
    if (!bar || !/^\d{4}-\d{2}-\d{2}$/.test(String(bar.d || ""))) return;
    if (!map[bar.d]) dates.push(bar.d);
    if (!map[bar.d] || overwrite) map[bar.d] = bar;
  }
  const kept = stored || [];
  for (let index = 0; index < kept.length; index++) put(kept[index], false);
  const incoming = fresh || [];
  for (let index = 0; index < incoming.length; index++) put(incoming[index], true);
  dates.sort();
  const out = [];
  for (let index = Math.max(0, dates.length - 120); index < dates.length; index++) out.push(map[dates[index]]);
  return out;
}

function sessionIndex(hhmm) {
  const mins = Math.floor(hhmm / 100) * 60 + (hhmm % 100);
  if (mins <= 690) return Math.max(0, Math.min(120, mins - 570));
  if (mins < 780) return 120;
  return Math.max(120, Math.min(240, 120 + (mins - 780)));
}

function quoteOf(focus, rows, indexRow) {
  if (focus === INDEX) return indexRow && indexRow.price > 0 ? indexRow : null;
  for (let index = 0; index < rows.length; index++) if (rows[index].key === focus) return rows[index];
  return null;
}

function directionColor(quote, prev, last, colors) {
  if (quote && Number.isFinite(quote.pct) && quote.pct !== 0) return quote.pct > 0 ? colors.up : colors.down;
  if (prev > 0 && last > 0 && last !== prev) return last > prev ? colors.up : colors.down;
  return "$text";
}

function parseMinute(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    return null;
  }
  const data = payload && payload.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const keys = Object.keys(data);
  let matched = "";
  for (let index = 0; index < keys.length; index++) {
    const bucket = data[keys[index]];
    if (bucket && (Array.isArray(bucket.m5) || Array.isArray(bucket.m30) || Array.isArray(bucket.m1))) {
      matched = keys[index];
      break;
    }
  }
  if (!matched) return null;
  const bucket = data[matched];
  const series = bucket.m5 || bucket.m30 || bucket.m1;
  if (!Array.isArray(series)) return null;
  const bars = [];
  for (let index = 0; index < series.length; index++) {
    const row = series[index];
    if (!Array.isArray(row) || row.length < 5) continue;
    const stamp = String(row[0]);
    if (!/^20\d{10}$/.test(stamp)) continue;
    const bar = { t: stamp, o: Number(row[1]), c: Number(row[2]), h: Number(row[3]), l: Number(row[4]) };
    if (bar.o > 0 && bar.c > 0 && bar.h > 0 && bar.l > 0 && bar.h >= bar.l) bars.push(bar);
  }
  if (!bars.length) return null;
  bars.sort((left, right) => left.t < right.t ? -1 : left.t > right.t ? 1 : 0);
  const prec = Number(bucket.prec);
  const quote = quoteFromBucket(matched, bucket);
  return {
    key: symbolKey(matched),
    name: quote && quote.name ? quote.name : "",
    prec: prec > 0 ? prec : null,
    bars: bars.slice(-320),
    quote
  };
}

function quoteFromBucket(symbol, bucket) {
  const table = bucket && bucket.qt;
  let fields = null;
  if (Array.isArray(table)) fields = table;
  else if (table && Array.isArray(table[symbol])) fields = table[symbol];
  else if (table && typeof table === "object") {
    const keys = Object.keys(table);
    for (let index = 0; index < keys.length; index++) {
      if (Array.isArray(table[keys[index]])) {
        fields = table[keys[index]];
        break;
      }
    }
  }
  if (!fields) return null;
  const parts = [];
  for (let index = 0; index < fields.length; index++) parts.push(String(fields[index]).replace(/["\\]/g, ""));
  const rows = parseQuotes("v_" + symbol + "=\"" + parts.join("~") + "\"");
  return rows.length ? rows[0] : null;
}

function parseKline(text, chartKey) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    return null;
  }
  const data = payload && payload.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const matched = matchedKey(data, chartKey);
  if (!matched) return null;
  const bucket = data[matched];
  const series = bucket && (bucket.qfqday || bucket.day);
  if (!Array.isArray(series)) return null;
  const bars = [];
  const start = Math.max(0, series.length - 40);
  for (let index = start; index < series.length; index++) {
    const row = series[index];
    if (!Array.isArray(row) || row.length < 5) continue;
    const day = normalizeDay(row[0]);
    const bar = { d: day, o: Number(row[1]), c: Number(row[2]), h: Number(row[3]), l: Number(row[4]), label: day.slice(5) };
    if (bar.o > 0 && bar.c > 0 && bar.h > 0 && bar.l > 0 && bar.h >= bar.l) bars.push(bar);
  }
  if (!bars.length) return null;
  const quote = bucket.qt && bucket.qt[matched];
  return { key: symbolKey(matched), name: Array.isArray(quote) && quote[1] ? String(quote[1]) : "", bars };
}

function matchedKey(data, chartKey) {
  const keys = Object.keys(data);
  for (let index = 0; index < keys.length; index++) if (symbolKey(keys[index]) === chartKey) return keys[index];
  return "";
}

function mergeCharts(storage, parsedList) {
  const charts = {};
  const raw = storage.charts;
  if (raw && typeof raw === "object") {
    const keys = Object.keys(raw);
    for (let index = 0; index < keys.length; index++) {
      const cleaned = cleanChart(raw[keys[index]]);
      if (cleaned) charts[keys[index]] = cleaned;
    }
  }
  if (storage.kline && storage.kline.key && Array.isArray(storage.kline.bars) && !charts[storage.kline.key]) {
    const day = cleanDayBars(storage.kline.bars);
    if (day.length) charts[storage.kline.key] = { name: storage.kline.name || "", prec: null, minute: [], day };
  }
  const list = parsedList || [];
  const preferred = [];
  for (let index = 0; index < list.length; index++) {
    const parsed = list[index];
    if (!parsed || !parsed.key) continue;
    preferred.push(parsed.key);
    const current = charts[parsed.key] || { name: "", prec: null, minute: [], day: [] };
    current.minute = parsed.bars;
    current.prec = parsed.prec;
    if (parsed.name) current.name = parsed.name;
    current.day = mergeDays(current.day, aggregateDays(parsed.bars));
    charts[parsed.key] = current;
  }
  const next = {};
  for (let index = 0; index < preferred.length && Object.keys(next).length < 6; index++) {
    if (charts[preferred[index]]) next[preferred[index]] = charts[preferred[index]];
  }
  const keys = Object.keys(charts);
  for (let index = 0; index < keys.length && Object.keys(next).length < 6; index++) {
    if (!next[keys[index]]) next[keys[index]] = charts[keys[index]];
  }
  return next;
}

function cleanChart(item) {
  if (!item || typeof item !== "object") return null;
  const minute = [];
  const rawMinute = Array.isArray(item.minute) ? item.minute : [];
  for (let index = Math.max(0, rawMinute.length - 320); index < rawMinute.length; index++) {
    const bar = rawMinute[index];
    if (!bar || !/^20\d{10}$/.test(String(bar.t || ""))) continue;
    const next = { t: String(bar.t), o: Number(bar.o), c: Number(bar.c), h: Number(bar.h), l: Number(bar.l) };
    if (next.o > 0 && next.c > 0 && next.h > 0 && next.l > 0) minute.push(next);
  }
  return { name: item.name ? String(item.name) : "", prec: item.prec > 0 ? Number(item.prec) : null, minute, day: cleanDayBars(item.day) };
}

function cleanDayBars(list) {
  const bars = [];
  if (!Array.isArray(list)) return bars;
  for (let index = Math.max(0, list.length - 120); index < list.length; index++) {
    const bar = list[index];
    if (!bar) continue;
    const next = {
      d: String(bar.d || ""),
      o: Number(bar.o), c: Number(bar.c), h: Number(bar.h), l: Number(bar.l),
      label: String(bar.label || String(bar.d || "").slice(5))
    };
    if (next.o > 0 && next.c > 0 && next.h > 0 && next.l > 0) bars.push(next);
  }
  return bars;
}

function updateTape(tape, rows, indexRow, today, nowMs) {
  const next = cleanTape(tape);
  if (next.day !== today) {
    next.day = today;
    next.points = {};
  }
  const people = rows.slice();
  if (indexRow && indexRow.price > 0) people.push(indexRow);
  for (let index = 0; index < people.length; index++) {
    const row = people[index];
    if (!row || !(row.price > 0) || !row.key) continue;
    const minute = sampleMinute(row.key, nowMs);
    const points = Array.isArray(next.points[row.key]) ? next.points[row.key].slice(-239) : [];
    if (points.length && points[points.length - 1][0] === minute) points[points.length - 1] = [minute, row.price];
    else points.push([minute, row.price]);
    next.points[row.key] = points;
    const days = Array.isArray(next.days[row.key]) ? next.days[row.key].slice(-47) : [];
    const candle = dayFromQuote(row, today);
    if (candle) {
      if (days.length && days[days.length - 1].d === today) days[days.length - 1] = candle;
      else days.push(candle);
    }
    next.days[row.key] = days;
  }
  return next;
}

function cleanTape(tape) {
  const next = { day: "", points: {}, days: {} };
  if (!tape || typeof tape !== "object") return next;
  next.day = typeof tape.day === "string" ? tape.day : "";
  if (tape.points && typeof tape.points === "object") {
    const keys = Object.keys(tape.points);
    for (let index = 0; index < keys.length && index < 16; index++) {
      const raw = tape.points[keys[index]];
      if (!Array.isArray(raw)) continue;
      const points = [];
      for (let point = Math.max(0, raw.length - 240); point < raw.length; point++) {
        if (!Array.isArray(raw[point]) || raw[point].length < 2) continue;
        const minute = Number(raw[point][0]);
        const price = Number(raw[point][1]);
        if (minute >= 0 && price > 0) points.push([minute, price]);
      }
      if (points.length) next.points[keys[index]] = points;
    }
  }
  if (tape.days && typeof tape.days === "object") {
    const keys = Object.keys(tape.days);
    for (let index = 0; index < keys.length && index < 16; index++) {
      const bars = cleanDayBars(tape.days[keys[index]]);
      if (bars.length) next.days[keys[index]] = bars;
    }
  }
  return next;
}

function dayFromQuote(row, today) {
  const close = row.price;
  if (!(close > 0)) return null;
  const open = row.open > 0 ? row.open : close;
  const high = Math.max(row.high > 0 ? row.high : close, open, close);
  const low = Math.min(row.low > 0 ? row.low : close, open, close);
  return { d: today, o: open, h: high, l: low, c: close, label: today.slice(5) };
}

function sampleMinute(key, nowMs) {
  const shifted = new Date(nowMs + 8 * 3600000);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  const hhmm = shifted.getUTCHours() * 100 + shifted.getUTCMinutes();
  if (isAshare(key)) {
    if (minutes < 570 || minutes > 900) return 1500;
    if (minutes >= 690 && minutes < 780) return 1130;
    return hhmm;
  }
  return hhmm;
}

function isAshare(key) {
  const kind = String(key || "").slice(0, 2);
  return kind === "sh" || kind === "sz" || kind === "bj";
}

function subtitle(row, alert) {
  const parts = [row.code || row.symbol];
  if (Number.isFinite(row.change)) parts.push(formatSigned(row.change, 2));
  if (alert && alert.pending) parts.push(alert.since.slice(5) + " 起");
  else if (alert && alert.price > 0) parts.push("提醒 " + trimNumber(alert.price));
  return parts.join("  ");
}

function pinnedCanvases(indexRow, rows, colors) {
  const items = [];
  if (indexRow && indexRow.price > 0) items.push(indexRow);
  for (let index = 0; index < rows.length; index++) if (rows[index].price > 0) items.push(rows[index]);
  return items.slice(0, 6).map(row => {
    const color = row.pct > 0 ? colors.up : row.pct < 0 ? colors.down : "$muted";
    const name = row.key === INDEX ? "上证" : row.name;
    return {
      width: 152,
      nodes: [
        text(cut(name, 4), 0, 15, 11, { weight: 700, fill: "$text", max_width: 48 }),
        text(compactPrice(row.price), 52, 15, 11, { weight: 700, fill: "$text", max_width: 52 }),
        text(formatPct(row.pct), 150, 15, 11, { align: "right", weight: 700, fill: color, max_width: 48 })
      ]
    };
  });
}

function pickNotice(rows, previous, alerts, sent, threshold, today, now, title) {
  for (const row of rows) {
    if (!(row.price > 0) || !isFresh(row, now)) continue;
    const prior = number((previous[row.key] || {}).price);
    for (const alert of matches(alerts, row)) {
      if (isPending(alert.since, today) || !(alert.price > 0) || !Number.isFinite(prior)) continue;
      const side = prior < alert.price && row.price >= alert.price ? "up"
        : prior > alert.price && row.price <= alert.price ? "down" : "";
      if (!side) continue;
      const verb = side === "up" ? "涨破" : "跌破";
      return {
        id: ["px", row.key, trimNumber(alert.price), side, row.at || now].join("|"),
        title: cut(title, 16),
        body: cut(row.name + " " + row.priceText + "，" + verb + " " + trimNumber(alert.price), 110)
      };
    }
  }
  let best = null;
  for (const row of rows) {
    if (!(threshold > 0) || !(row.price > 0) || !isRecent(row, now) || !(Math.abs(row.pct) >= threshold)) continue;
    const side = row.pct > 0 ? "up" : "down";
    const key = ["pct", row.key, side, today].join("|");
    if (sent[key]) continue;
    if (best && Math.abs(best.pct) >= Math.abs(row.pct)) continue;
    best = {
      pct: row.pct,
      key,
      id: key,
      title: cut(title, 16),
      body: cut(row.name + (side === "up" ? "上涨 " : "下跌 ") + Math.abs(row.pct).toFixed(2) + "%，现价 " + row.priceText, 110)
    };
  }
  return best;
}

function parseQuotes(text) {
  const out = [];
  for (const part of String(text || "").split(";")) {
    const match = part.trim().match(/^v_([A-Za-z0-9.]+)="([^"]*)"$/);
    if (!match) continue;
    const fields = match[2].split("~");
    const name = fields[1];
    const priceText = fields[3] || "";
    const price = Number(priceText);
    if (!name) continue;
    const stamp = findStamp(fields);
    const change = stamp ? Number(fields[stamp.index + 1]) : NaN;
    const pct = stamp ? Number(fields[stamp.index + 2]) : NaN;
    const symbol = match[1];
    out.push({
      key: symbolKey(symbol),
      symbol,
      name,
      code: fields[2] || symbol,
      priceText,
      price: price > 0 ? price : 0,
      change,
      pct: Number.isFinite(pct) ? pct : null,
      prev: Number(fields[4]) > 0 ? Number(fields[4]) : null,
      open: Number(fields[5]) > 0 ? Number(fields[5]) : null,
      high: stamp && Number(fields[stamp.index + 3]) > 0 ? Number(fields[stamp.index + 3]) : null,
      low: stamp && Number(fields[stamp.index + 4]) > 0 ? Number(fields[stamp.index + 4]) : null,
      at: stamp ? stamp.at : NaN,
      url: /^[A-Za-z0-9.]+$/.test(symbol) ? "https://gu.qq.com/" + symbol : ""
    });
  }
  return out;
}

function splitIndex(parsed) {
  let index = null;
  const rest = [];
  for (let cursor = 0; cursor < parsed.length; cursor++) {
    if (parsed[cursor].key === INDEX && !index) index = parsed[cursor];
    else if (parsed[cursor].key !== INDEX) rest.push(parsed[cursor]);
  }
  return { index, rest };
}

function findStamp(fields) {
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    let at = NaN;
    if (/^20\d{12}$/.test(field)) at = Date.parse(field.slice(0, 4) + "-" + field.slice(4, 6) + "-" + field.slice(6, 8) + "T" + field.slice(8, 10) + ":" + field.slice(10, 12) + ":" + field.slice(12, 14) + "+08:00");
    else if (/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(field)) at = Date.parse(field.replace(/\//g, "-").replace(" ", "T") + "+08:00");
    else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(field)) at = Date.parse(field.replace(" ", "T") + usOffset(field));
    if (Number.isFinite(at)) return { index: i, at: Math.floor(at / 1000) };
  }
  return null;
}

function orderQuotes(parsed, tokens) {
  const used = {};
  const out = [];
  for (const token of tokens) {
    const key = symbolKey(norm(token));
    if (!key || key === INDEX) continue;
    const found = parsed.find(row => !used[row.key] && (row.key === key || symbolKey(row.code) === key));
    if (found) {
      used[found.key] = true;
      out.push(found);
    } else {
      out.push({ key, symbol: key, name: token, code: token, price: 0, pct: 0, change: NaN, missing: true });
    }
  }
  return out;
}

function recall(previous, tokens) {
  const out = [];
  const used = {};
  const keys = tokens.length ? tokens.map(token => symbolKey(norm(token))).filter(key => key && key !== INDEX) : Object.keys(previous || {}).filter(key => key !== INDEX);
  for (const key of keys) {
    const row = previous[key];
    if (!row || used[key]) continue;
    used[key] = true;
    out.push(row);
  }
  return out;
}

function snapshot(rows, indexRow) {
  const quotes = {};
  const all = indexRow && indexRow.price > 0 ? rows.concat([indexRow]) : rows;
  for (const row of all) {
    if (row.missing || !(row.price > 0)) continue;
    quotes[row.key] = {
      key: row.key,
      symbol: row.symbol,
      name: row.name,
      code: row.code,
      priceText: row.priceText,
      price: row.price,
      change: Number.isFinite(row.change) ? row.change : null,
      pct: Number.isFinite(row.pct) ? row.pct : null,
      prev: row.prev > 0 ? row.prev : null,
      open: row.open > 0 ? row.open : null,
      high: row.high > 0 ? row.high : null,
      low: row.low > 0 ? row.low : null,
      at: Number.isFinite(row.at) ? row.at : null,
      url: row.url || ""
    };
  }
  return quotes;
}

function readAlerts(raw) {
  let rows = [];
  try {
    rows = JSON.parse(raw || "[]");
  } catch (error) {
    rows = [];
  }
  if (!Array.isArray(rows)) return [];
  return rows.map(row => ({
    key: symbolKey(norm(row && row.code)),
    name: textOr(row && row.name, ""),
    price: Number(row && row.price),
    since: String(row && row.since || "")
  })).filter(row => row.key);
}

function alertFor(alerts, row, today) {
  const found = matches(alerts, row).find(alert => alert.price > 0 || (alert.name && alert.name !== row.name));
  if (!found) return null;
  return { price: found.price, since: found.since, pending: isPending(found.since, today) };
}

function isPending(since, today) {
  return /^\d{4}-\d{2}-\d{2}$/.test(since) && since > today;
}

function matches(alerts, row) {
  return alerts.filter(alert => alert.key === row.key);
}

function pruneSent(sent, rows, today) {
  const live = {};
  for (const row of rows) live[row.key] = true;
  const next = {};
  for (const key of Object.keys(sent || {})) {
    const parts = key.split("|");
    if (parts[0] === "pct" && parts[3] === today && live[parts[1]]) next[key] = 1;
  }
  return next;
}

function applyNames(rows, alerts) {
  for (const row of rows) {
    const named = matches(alerts, row).find(item => item.name && item.name !== "贵州茅台");
    if (named) row.name = named.name;
  }
}

function phaseOf(tokens, nowMs, source, parsedCount, showingCache, fromAction) {
  if (!tokens.length) {
    return { id: "idle", label: "等待填写", stale: true, empty: "请填写自选代码", hint: "自选1、自选2各填一只，如 sh600519。上证指数固定显示在上方" };
  }
  const kinds = tokens.map(token => symbolKey(norm(token)).slice(0, 2));
  const market = kinds.every(kind => kind === "sh" || kind === "sz" || kind === "bj")
    ? aSharePhase(nowMs) : { id: "mixed", label: "行情" };
  if (source === "unconfigured" && !showingCache && !fromAction) {
    return { id: "offline", label: "等待授权", stale: true, empty: "请授权腾讯行情", hint: "在已安装插件中允许访问腾讯行情" };
  }
  if (showingCache && source !== "ready" && !fromAction) {
    return { id: "offline", label: source === "unconfigured" ? "等待授权" : "暂不可用", stale: true, empty: "", hint: "" };
  }
  if (source === "ready" && parsedCount === 0) {
    return {
      id: "offline", label: "暂不可用", stale: true,
      empty: "没有读到这些代码",
      hint: "沪 sh、深 sz、京 bj、港 hk、美 us，用英文逗号且不要空格"
    };
  }
  if (source !== "ready" && !fromAction) {
    return { id: "offline", label: "暂不可用", stale: true, empty: "行情暂不可用", hint: "可以稍后点刷新再试" };
  }
  return Object.assign({ stale: source !== "ready", empty: "没有读到这些代码", hint: "" }, market);
}

function aSharePhase(nowMs) {
  const shifted = new Date(nowMs + 8 * 3600000);
  const day = shifted.getUTCDay();
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  if (day === 0 || day === 6) return { id: "closed", label: "已收盘" };
  if (minutes >= 555 && minutes < 570) return { id: "auction", label: "集合竞价" };
  if ((minutes >= 570 && minutes < 690) || (minutes >= 780 && minutes < 900)) return { id: "open", label: "交易中" };
  if (minutes >= 690 && minutes < 780) return { id: "lunch", label: "午间休市" };
  return { id: "closed", label: "已收盘" };
}

function codesOf(value) {
  return String(value || "").split(/[,，]/).map(item => item.trim()).filter(Boolean).slice(0, 12);
}

function watchTokens(settings) {
  const raw = [];
  const primary = textOr(settings.a, "");
  const secondary = textOr(settings.b, "");
  if (primary || secondary) {
    if (primary) raw.push(primary);
    if (secondary) raw.push(secondary);
  } else {
    const list = codesOf(settings.codes);
    if (list.length) raw.push.apply(raw, list.slice(0, 2));
    else if (textOr(settings.chart, "")) raw.push(textOr(settings.chart, ""));
  }
  const out = [];
  const seen = {};
  for (let index = 0; index < raw.length; index++) {
    const key = symbolKey(norm(raw[index]));
    if (!key || key === INDEX || seen[key]) continue;
    seen[key] = true;
    out.push(String(raw[index]).trim());
  }
  return out;
}

function norm(raw) {
  const compact = String(raw || "").trim().replace(/\s+/g, "");
  const lower = compact.toLowerCase();
  if (/^(sh|sz|bj|hk)/.test(lower)) return lower;
  if (lower.startsWith("us")) return "us" + compact.slice(2).toUpperCase();
  if (/^\d{6}$/.test(compact)) {
    if (compact.startsWith("92") || compact.startsWith("8") || compact.startsWith("4")) return "bj" + compact;
    if (compact.startsWith("0") || compact.startsWith("3") || compact.startsWith("1")) return "sz" + compact;
    return "sh" + compact;
  }
  if (/^\d{5}$/.test(compact)) return "hk" + compact;
  if (/^[A-Za-z]/.test(compact)) return "us" + compact.toUpperCase();
  return lower;
}

function symbolKey(symbol) {
  const value = String(symbol || "");
  return value.toLowerCase().startsWith("us") ? "us" + value.slice(2).toUpperCase() : value.toLowerCase();
}

function normalizeDay(raw) {
  const value = String(raw || "");
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (/^20\d{6}/.test(value)) return value.slice(0, 4) + "-" + value.slice(4, 6) + "-" + value.slice(6, 8);
  return value.slice(0, 10);
}

function usOffset(field) {
  const month = Number(field.slice(5, 7));
  return month >= 3 && month <= 10 ? "-04:00" : "-05:00";
}

function shanghaiDate(nowMs) {
  const shifted = new Date(nowMs + 8 * 3600000);
  return shifted.getUTCFullYear() + "-" + pad(shifted.getUTCMonth() + 1) + "-" + pad(shifted.getUTCDate());
}

function clockLabel(hhmm) {
  return pad(Math.floor(hhmm / 100)) + ":" + pad(hhmm % 100);
}

function newest(rows) {
  let at = NaN;
  for (const row of rows) if (Number.isFinite(row.at) && !(at > row.at)) at = row.at;
  return at;
}

function isFresh(row, now) {
  return Number.isFinite(row.at) && row.at <= now + 60 && now - row.at <= FRESH;
}

function isRecent(row, now) {
  return Number.isFinite(row.at) && row.at <= now + 60 && now - row.at <= RECENT;
}

function positive(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatPct(pct) {
  if (!Number.isFinite(pct) || pct === 0) return Number.isFinite(pct) ? "0.00%" : "—";
  return (pct > 0 ? "+" : "") + pct.toFixed(2) + "%";
}

function formatSigned(value, digits) {
  if (!Number.isFinite(value)) return "";
  return (value > 0 ? "+" : "") + value.toFixed(digits);
}

function compactPrice(price) {
  if (!(price > 0)) return "—";
  if (price >= 1000) return price.toFixed(0);
  if (price >= 100) return price.toFixed(1);
  return price.toFixed(2);
}

function trimNumber(value) {
  return String(Math.round(value * 100) / 100);
}

function textOr(value, fallback) {
  const textValue = String(value == null ? "" : value).trim();
  return textValue || fallback;
}

function cut(value, limit) {
  const chars = Array.from(String(value || ""));
  return chars.length <= limit ? chars.join("") : chars.slice(0, limit - 1).join("") + "…";
}

function tint(color) {
  return typeof color === "string" && color.length === 7 && color.charAt(0) === "#" ? color + "33" : "$card";
}

function text(value, x, y, size, options) {
  return Object.assign({ text: value, at: [x, y], size }, options || {});
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function shift(nodes, offset) {
  for (const node of nodes) {
    if (node.rect) node.rect = [node.rect[0], node.rect[1] + offset, node.rect[2], node.rect[3]];
    if (node.at) node.at = [node.at[0], node.at[1] + offset];
  }
}
