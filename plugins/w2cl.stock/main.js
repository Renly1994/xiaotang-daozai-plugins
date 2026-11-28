const ROW = 48;
const VISIBLE = 3;
const LIST_TOP = 220;
const CHART_TOP = 56;
const FRESH = 30 * 60;
const RECENT = 18 * 3600;
const UP = "#F05252";
const DOWN = "#1F9D57";
const DEFAULT_INDEX = "sh000001";
const MINUTE_KEEP = 700;
const DAY_KEEP = 320;
const CANDLES = 240;

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
  const indexKey = indexKeyOf(settings);
  const tokens = watchTokens(settings, indexKey);
  const colors = settings.up_color === "green" ? { up: DOWN, down: UP } : { up: UP, down: DOWN };
  const threshold = positive(settings.alert_pct);
  const alerts = readAlerts(settings.alerts);
  const plans = readPlans(settings.plans);
  const source = (input.sources && input.sources.quotes) || { status: "unconfigured" };
  const sourceA = (input.sources && input.sources.a) || { status: "unconfigured" };
  const sourceB = (input.sources && input.sources.b) || { status: "unconfigured" };
  const sourceDayA = (input.sources && input.sources.dayA) || { status: "unconfigured" };
  const sourceDayB = (input.sources && input.sources.dayB) || { status: "unconfigured" };
  const period = "time";
  const focus = resolveFocus(click, storage, tokens);
  const parsedA = sourceA.status === "ready" ? parseMinute(sourceA.text) : null;
  const parsedB = sourceB.status === "ready" ? parseMinute(sourceB.text) : null;
  const parsedDayA = readKline(sourceA) || readKline(sourceDayA);
  const parsedDayB = readKline(sourceB) || readKline(sourceDayB);
  const charts = mergeCharts(storage, [parsedA, parsedB], [parsedDayA, parsedDayB]);
  const previous = storage.quotes || {};
  const parsed = source.status === "ready" ? parseQuotes(source.text) : [];
  if (parsedA && parsedA.quote) parsed.push(parsedA.quote);
  if (parsedB && parsedB.quote) parsed.push(parsedB.quote);
  const quoteState = source.status === "ready" || parsedA && parsedA.quote || parsedB && parsedB.quote ? "ready" : source.status;
  const split = splitIndex(parsed, indexKey);
  const live = split.rest.length || split.index ? orderQuotes(split.rest, tokens, indexKey) : [];
  const cached = live.length ? [] : recall(previous, tokens, indexKey);
  const rows = (live.length ? live : cached).slice(0, 12);
  const showingCache = !live.length && cached.length > 0;
  const indexSaved = previous[indexKey] && previous[indexKey].price > 0 ? previous[indexKey] : null;
  const indexRow = split.index && split.index.price > 0 ? split.index : source.status !== "ready" ? indexSaved : null;
  applyNames(rows, alerts, plans);
  if (indexRow) applyNames([indexRow], alerts, plans);
  applyQuoteDays(charts, rows);
  const tracked = indexRow && indexRow.price > 0 ? rows.concat([indexRow]) : rows;
  const sent = pruneSent(storage.sent, tracked);
  const pending = readPending(storage.pending, tracked);
  let notice = null;
  if (live.length) {
    const seen = {};
    for (let index = 0; index < pending.length; index++) seen[pending[index].id] = true;
    const fresh = collectNotices(tracked, previous, alerts, plans, sent, threshold, today, now, title);
    for (let index = 0; index < fresh.length && pending.length < 16; index++) {
      const item = fresh[index];
      if (seen[item.id] || (item.key && sent[item.key])) continue;
      seen[item.id] = true;
      pending.push(item);
    }
    if (pending.length) {
      notice = pending.shift();
      if (notice.key) sent[notice.key] = 1;
    }
  }
  const tape = live.length ? updateTape(storage.tape, rows, split.index, today, nowMs) : cleanTape(storage.tape);
  const phase = phaseOf(tokens, nowMs, quoteState, parsed.length, showingCache);
  const latest = newest(indexRow && indexRow.price > 0 ? rows.concat([indexRow]) : rows);
  const keyB = symbolKey(norm(tokens[1] || ""));
  const focusStatus = focus && focus === keyB ? sourceB.status : sourceA.status;
  const series = makeSeries(focus, period, charts, tape, quoteOf(focus, rows, indexRow, indexKey), colors, focusStatus, indexKey);
  const view = buildCanvas(title, phase, rows, colors, alerts, plans, today, focus, period, series, indexRow, indexKey);
  const status = buildStatus({ status: quoteState }, rows, phase, latest, now, tokens, indexRow, indexKey);
  const pinned = pinnedCanvases(indexRow, rows, colors, indexKey);
  const slots = [];
  for (let index = 0; index < rows.length; index++) slots.push(rows[index].key);
  const output = {
    status,
    canvas: view.canvas,
    storage: {
      quotes: live.length ? snapshot(live, indexRow) : previous,
      sent,
      focus,
      period,
      slots,
      charts,
      tape,
      pending
    }
  };
  if (pinned.length) output.pinned = { canvas: pinned.length === 1 ? pinned[0] : pinned };
  if (notice) output.notice = { id: notice.id, title: notice.title, body: notice.body };
  if (pending.length) output.next_refresh_at = now + 60;
  return output;
}

function clicked(input) {
  const value = input.action;
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value.id || "");
}

function resolveFocus(click, storage, tokens) {
  const allowed = [];
  for (let index = 0; index < tokens.length; index++) {
    const key = symbolKey(norm(tokens[index]));
    if (key && allowed.indexOf(key) < 0) allowed.push(key);
  }
  let focus = storage.focus || allowed[0] || "";
  const match = /^sym-(\d+)$/.exec(click || "");
  if (match && storage.slots && storage.slots[Number(match[1])]) focus = String(storage.slots[Number(match[1])]);
  if (allowed.indexOf(focus) < 0) focus = allowed[0] || "";
  return focus;
}

function buildStatus(source, rows, phase, latest, now, tokens, indexRow, indexKey) {
  const priced = rows.filter(row => row.price > 0);
  if (!tokens.length && !(indexRow && indexRow.price > 0)) return { state: "idle", label: "等待填写" };
  if (source.status === "unconfigured" && !priced.length && !(indexRow && indexRow.price > 0)) return { state: "idle", label: "等待授权" };
  if (!priced.length && !(indexRow && indexRow.price > 0)) return { state: "offline", label: "暂不可用" };
  const up = priced.filter(row => row.pct > 0).length;
  const down = priced.filter(row => row.pct < 0).length;
  let summary = priced.length + " 只 · " + up + " 涨 " + down + " 跌";
  if (indexRow && indexRow.price > 0) {
    summary += " · " + indexShort(indexKey, indexRow.name) + " " + (indexRow.priceText || indexRow.price);
    const points = formatPoints(indexMove(indexRow));
    if (points) summary += " " + points;
    summary += " " + formatPct(indexRow.pct);
  }
  const status = {
    state: source.status === "ready" && !phase.stale ? "succeeded" : "offline",
    label: phase.label,
    summary: cut(summary, 120)
  };
  if (Number.isFinite(latest) && latest <= now + 60) status.observed_at = latest;
  return status;
}

function buildCanvas(title, phase, rows, colors, alerts, plans, today, focus, period, series, indexRow, indexKey) {
  const nodes = header(title, phase, indexRow, colors, indexKey);
  if (!rows.length && focus !== indexKey) {
    nodes.push(
      text(phase.empty, 193.5, 112, 16, { align: "center", weight: 700, fill: "$text" }),
      text(phase.hint, 193.5, 138, 11, { align: "center", fill: "$muted", max_width: 320, lines: 2 })
    );
    return { canvas: { height: 176, nodes } };
  }
  nodes.push.apply(nodes, chartNodes(series, CHART_TOP));
  if (!rows.length) return { canvas: { height: 210, nodes } };
  const body = [];
  for (let index = 0; index < rows.length; index++) {
    body.push.apply(body, rowNodes(rows[index], index * ROW, colors, alertFor(alerts, plans, rows[index], today), rows[index].key === focus, "sym-" + index));
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

function header(title, phase, indexRow, colors, indexKey) {
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
    text(indexTitle(indexKey, indexRow && indexRow.name), 8, 39, 12, { weight: 700, fill: "$text", max_width: 72 })
  ];
  if (indexRow && indexRow.price > 0) {
    const move = indexMove(indexRow);
    const direction = indexRow.pct > 0 || indexRow.pct < 0 ? indexRow.pct : move;
    const color = direction > 0 ? colors.up : direction < 0 ? colors.down : "$text";
    const points = formatPoints(move);
    nodes.push(text(indexRow.priceText || Number(indexRow.price).toFixed(2), 80, 39, 12, {
      weight: 700, fill: color, max_width: 78
    }));
    if (points) {
      nodes.push(text(points, 162, 39, 12, { weight: 700, fill: color, max_width: 84 }));
      nodes.push(text(formatPct(indexRow.pct), 250, 39, 12, { weight: 700, fill: color, max_width: 80 }));
    } else {
      nodes.push(text(formatPct(indexRow.pct), 168, 39, 12, { weight: 700, fill: color, max_width: 80 }));
    }
  } else {
    nodes.push(text(waiting ? "授权后显示" : "—", 86, 39, 12, { fill: "$dim" }));
  }
  nodes.push({ line: [0, 48, 387, 48], stroke: "$track", width: 1 });
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
  if (series.ohlc) {
    nodes.push(text("开 " + series.ohlc.openText, 4, top + 130, 10, { fill: series.ohlc.openColor }));
    nodes.push(text("高 " + series.ohlc.highText, 193.5, top + 130, 10, { align: "center", fill: series.ohlc.highColor }));
    nodes.push(text("低 " + series.ohlc.lowText, 383, top + 130, 10, { align: "right", fill: series.ohlc.lowColor }));
  }
  if (series.stats) {
    if (series.stats.amount) nodes.push(text(series.stats.amount, 4, top + 148, 10, { fill: "$muted", max_width: 128 }));
    if (series.stats.turnover) nodes.push(text(series.stats.turnover, 193.5, top + 148, 10, { align: "center", fill: "$muted", max_width: 110 }));
    if (series.stats.amplitude) nodes.push(text(series.stats.amplitude, 383, top + 148, 10, { align: "right", fill: "$muted", max_width: 120 }));
  }
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
  for (let index = 0; index < points.length; index++) {
    const avg = points[index].avg;
    if (!(avg > 0)) continue;
    if (avg < low) low = avg;
    if (avg > high) high = avg;
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
  const average = [];
  for (let index = 0; index < points.length; index++) {
    if (!(points[index].avg > 0)) continue;
    average.push([round(x + points[index].x / scale * width), round(yOf(points[index].avg))]);
  }
  if (average.length >= 2) nodes.push({ points: average, stroke: "#C8960A", width: 1.25, cap: "round" });
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
    text(cut(sub, 40), 12, y + 36, 10, { fill: "$dim", max_width: 176 }),
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

function makeSeries(focus, period, charts, tape, quote, colors, minuteStatus, indexKey) {
  const saved = charts[focus] || null;
  const ashare = isAshare(focus);
  const drawn = drawSeries(focus, period, saved, tape, quote, ashare);
  const title = (quote && quote.name) || (saved && saved.name) || (focus === indexKey ? indexTitle(indexKey, "") : focus || "K线");
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
    empty: emptyMessage(period, drawn.hasServer, minuteStatus),
    ohlc: period === "time" ? sessionOhlc(quote, saved && saved.minute, colors) : null,
    stats: sessionStats(quote)
  };
}

function drawSeries(focus, period, saved, tape, quote, ashare) {
  const minute = saved && saved.minute && saved.minute.length ? saved.minute : [];
  const days = saved && saved.day && saved.day.length ? saved.day : [];
  if (period === "day") {
    if (days.length) {
      const bars = days.slice(-DAY_KEEP);
      const sampled = bars.some(bar => bar.sampled);
      return { kind: "candle", bars, full: !sampled, hasServer: true, axis: candleAxis(bars) };
    }
    const taped = tape.days && tape.days[focus];
    if (taped && taped.length) return { kind: "candle", bars: taped.slice(-DAY_KEEP), full: false, hasServer: false, axis: candleAxis(taped.slice(-DAY_KEEP)) };
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
  if (period === "m5") {
    if (minute.length) {
      const bars = minuteCandles(minute).slice(-CANDLES);
      if (bars.length) return { kind: "candle", bars, full: true, hasServer: true, axis: candleAxis(bars) };
    }
  } else {
    const history = saved && Array.isArray(saved.m30) ? saved.m30 : [];
    const bars = (history.length ? history : aggregate(minute, 30, ashare)).slice(-CANDLES);
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
    const point = { x: ashare ? sessionIndex(hhmm) : points.length, p: bars[index].c, label: clockLabel(hhmm) };
    const avg = averagePrice(Number(bars[index].a), Number(bars[index].v), bars[index].c, ashare);
    if (avg) point.avg = avg;
    points.push(point);
  }
  return points;
}

function averagePrice(amount, volume, price, ashare) {
  if (!(amount > 0) || !(volume > 0) || !(price > 0)) return null;
  const scaled = ashare ? amount / (volume * 100) : amount / volume;
  if (scaled > price * 0.5 && scaled < price * 1.5) return scaled;
  const plain = ashare ? amount / volume : amount / (volume * 100);
  if (plain > price * 0.5 && plain < price * 1.5) return plain;
  return null;
}

function sessionOhlc(quote, minute, colors) {
  let open = quote && quote.open > 0 ? Number(quote.open) : NaN;
  let high = quote && quote.high > 0 ? Number(quote.high) : NaN;
  let low = quote && quote.low > 0 ? Number(quote.low) : NaN;
  const bars = [];
  if (Array.isArray(minute) && minute.length) {
    const day = String(minute[minute.length - 1].t || "").slice(0, 8);
    for (let index = 0; index < minute.length; index++) {
      if (String(minute[index].t || "").slice(0, 8) === day) bars.push(minute[index]);
    }
  }
  if (bars.length && (!(open > 0) || !(high > 0) || !(low > 0))) {
    if (!(open > 0)) open = bars[0].o > 0 ? Number(bars[0].o) : Number(bars[0].c);
    let peak = -Infinity;
    let floor = Infinity;
    for (let index = 0; index < bars.length; index++) {
      const price = Number(bars[index].c);
      if (price > peak) peak = price;
      if (price < floor) floor = price;
    }
    if (!(high > 0)) high = peak;
    if (!(low > 0)) low = floor;
  }
  if (!(open > 0) && !(high > 0) && !(low > 0)) return null;
  const sample = quote && quote.priceText;
  const prev = quote && quote.prev > 0 ? Number(quote.prev) : NaN;
  return {
    openText: formatPrice(open, sample),
    highText: formatPrice(high, sample),
    lowText: formatPrice(low, sample),
    openColor: priceTone(open, prev, colors),
    highColor: priceTone(high, prev, colors),
    lowColor: priceTone(low, prev, colors)
  };
}

function sessionStats(quote) {
  if (!quote) return null;
  const amount = formatTurnover(quote.amount, isAshare(quote.key));
  const turnover = quote.turnover > 0 ? "换手 " + quote.turnover.toFixed(2) + "%" : "";
  const amplitude = Number.isFinite(quote.amplitude) && quote.amplitude >= 0 ? "振幅 " + quote.amplitude.toFixed(2) + "%" : "";
  if (!amount && !turnover && !amplitude) return null;
  return { amount: amount ? "成交额 " + amount : "", turnover, amplitude };
}

function formatTurnover(value, ashare) {
  if (!(value > 0)) return "";
  const yuan = ashare ? value * 10000 : value;
  if (yuan >= 100000000) {
    const yi = yuan / 100000000;
    return (yi >= 10000 ? yi.toFixed(0) : yi.toFixed(2)) + "亿";
  }
  if (yuan >= 10000) {
    const wan = yuan / 10000;
    return (wan >= 100 ? wan.toFixed(0) : wan.toFixed(2)) + "万";
  }
  return yuan.toFixed(0);
}

function priceTone(value, prev, colors) {
  if (!(value > 0) || !(prev > 0) || value === prev) return "$text";
  return value > prev ? colors.up : colors.down;
}

function formatPrice(value, sample) {
  if (!(Number(value) > 0)) return "—";
  const match = String(sample || "").match(/\.(\d+)/);
  const digits = match ? Math.min(4, match[1].length) : 2;
  return Number(value).toFixed(digits);
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
        id: day + "-" + pad(bucket),
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

function mergeDays(stored, fresh) {
  const map = {};
  const dates = [];
  function put(bar, overwrite) {
    if (!bar || !/^\d{4}-\d{2}-\d{2}$/.test(String(bar.d || ""))) return;
    const next = copyDay(bar);
    if (!next) return;
    const existing = map[next.d];
    if (!existing) {
      dates.push(next.d);
      map[next.d] = next;
      return;
    }
    if (!overwrite) return;
    if (next.sampled && !existing.sampled) return;
    if (next.sampled && existing.sampled && (Number(existing.n) || 0) > (Number(next.n) || 0)) return;
    map[next.d] = next;
  }
  const kept = stored || [];
  for (let index = 0; index < kept.length; index++) put(kept[index], false);
  const incoming = fresh || [];
  for (let index = 0; index < incoming.length; index++) put(incoming[index], true);
  dates.sort();
  const out = [];
  for (let index = Math.max(0, dates.length - DAY_KEEP); index < dates.length; index++) out.push(map[dates[index]]);
  return out;
}

function copyDay(bar) {
  if (!bar) return null;
  const next = {
    d: String(bar.d || ""),
    o: Number(bar.o), c: Number(bar.c), h: Number(bar.h), l: Number(bar.l),
    label: String(bar.label || String(bar.d || "").slice(5))
  };
  if (!(next.o > 0 && next.c > 0 && next.h > 0 && next.l > 0)) return null;
  if (bar.sampled) next.sampled = true;
  if (bar.quote) next.quote = true;
  if (Number(bar.n) > 0) next.n = Number(bar.n);
  return next;
}

function quoteCandle(row) {
  const day = quoteDay(row);
  if (!day || !(row.price > 0) || !(row.open > 0) || !(row.high > 0) || !(row.low > 0)) return null;
  const close = row.price;
  const high = Math.max(row.high, row.open, close);
  const low = Math.min(row.low, row.open, close);
  if (!(high >= low)) return null;
  return { d: day, o: row.open, h: high, l: low, c: close, label: day.slice(5), quote: true };
}

function mergeQuoteDay(stored, bar) {
  const days = [];
  let replaced = false;
  const kept = stored || [];
  for (let index = 0; index < kept.length; index++) {
    const current = kept[index];
    if (!current || current.d !== bar.d) {
      if (current) days.push(current);
      continue;
    }
    replaced = true;
    days.push(current.sampled || current.quote ? bar : current);
  }
  if (!replaced) days.push(bar);
  days.sort((left, right) => left.d < right.d ? -1 : left.d > right.d ? 1 : 0);
  return days.slice(-DAY_KEEP);
}

function applyQuoteDays(charts, rows) {
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const bar = quoteCandle(row);
    if (!bar || !row.key) continue;
    if (!charts[row.key]) charts[row.key] = { name: row.name || "", prec: null, minute: [], day: [] };
    if (row.name && !row.missing) charts[row.key].name = row.name;
    charts[row.key].day = mergeQuoteDay(charts[row.key].day, bar);
  }
}

function sessionIndex(hhmm) {
  const mins = Math.floor(hhmm / 100) * 60 + (hhmm % 100);
  if (mins <= 690) return Math.max(0, Math.min(120, mins - 570));
  if (mins < 780) return 120;
  return Math.max(120, Math.min(240, 120 + (mins - 780)));
}

function quoteOf(focus, rows, indexRow, indexKey) {
  if (focus === indexKey) return indexRow && indexRow.price > 0 ? indexRow : null;
  for (let index = 0; index < rows.length; index++) if (rows[index].key === focus) return rows[index];
  return null;
}

function directionColor(quote, prev, last, colors) {
  if (quote && Number.isFinite(quote.pct) && quote.pct !== 0) return quote.pct > 0 ? colors.up : colors.down;
  if (prev > 0 && last > 0 && last !== prev) return last > prev ? colors.up : colors.down;
  return "$text";
}

function parseSession(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    return null;
  }
  const data = payload && payload.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const keys = Object.keys(data);
  for (let index = 0; index < keys.length; index++) {
    const bucket = data[keys[index]];
    const pack = bucket && bucket.data;
    const rows = pack && pack.data;
    const date = String(pack && pack.date || "");
    if (!Array.isArray(rows) || !/^20\d{6}$/.test(date)) continue;
    const key = symbolKey(keys[index]);
    const ashare = isAshare(key);
    const bars = [];
    for (let row = 0; row < rows.length; row++) {
      const parts = String(rows[row]).split(/\s+/);
      if (!/^\d{3,4}$/.test(parts[0])) continue;
      const hhmm = parts[0].padStart(4, "0");
      const price = Number(parts[1]);
      const hour = Number(hhmm.slice(0, 2));
      const minute = Number(hhmm.slice(2, 4));
      if (!(price > 0) || hour > 23 || minute > 59) continue;
      if (ashare && Number(hhmm) > 1500) continue;
      const volume = Number(parts[2]);
      const amount = Number(parts[3]);
      const bar = { t: date + hhmm, o: price, c: price, h: price, l: price };
      if (volume > 0) bar.v = volume;
      if (amount > 0) bar.a = amount;
      bars.push(bar);
    }
    if (bars.length < 2) continue;
    const quote = quoteFromBucket(keys[index], bucket);
    const prec = Number(bucket.prec);
    return {
      key,
      name: quote && quote.name ? quote.name : "",
      prec: prec > 0 ? prec : null,
      bars,
      quote,
      replace: true
    };
  }
  return null;
}

function parseMinute(text) {
  const session = parseSession(text);
  if (session) return session;
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
    bars: bars.slice(-MINUTE_KEEP),
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

function readKline(source) {
  if (!source || source.status !== "ready" || !source.text) return null;
  return parseKline(source.text);
}

function parseKline(text) {
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
    if (bucket && (Array.isArray(bucket.qfqday) || Array.isArray(bucket.day))) {
      matched = keys[index];
      break;
    }
  }
  if (!matched) return null;
  const bucket = data[matched];
  const series = Array.isArray(bucket.day) ? bucket.day : bucket.qfqday;
  if (!Array.isArray(series)) return null;
  const bars = [];
  const start = Math.max(0, series.length - DAY_KEEP);
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

function mergeCharts(storage, minuteList, dayList) {
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
    if (day.length) charts[storage.kline.key] = { name: storage.kline.name || "", prec: null, minute: [], m30: [], day };
  }
  const preferred = [];
  function touch(key) {
    if (preferred.indexOf(key) < 0) preferred.push(key);
    if (!charts[key]) charts[key] = { name: "", prec: null, minute: [], m30: [], day: [] };
    return charts[key];
  }
  const minutes = minuteList || [];
  for (let index = 0; index < minutes.length; index++) {
    const parsed = minutes[index];
    if (!parsed || !parsed.key) continue;
    const current = touch(parsed.key);
    current.minute = parsed.replace ? parsed.bars.slice(-MINUTE_KEEP) : mergeMinute(current.minute, parsed.bars);
    if (parsed.prec) current.prec = parsed.prec;
    if (parsed.name) current.name = parsed.name;
    if (!parsed.replace) current.m30 = mergeM30(current.m30, aggregate(current.minute, 30, isAshare(parsed.key)));
  }
  const minuteKeys = {};
  for (let index = 0; index < minutes.length; index++) if (minutes[index] && minutes[index].key) minuteKeys[minutes[index].key] = true;
  const days = dayList || [];
  for (let index = 0; index < days.length; index++) {
    const parsed = days[index];
    if (!parsed || !parsed.key || !parsed.bars) continue;
    const current = touch(parsed.key);
    if (parsed.name) current.name = parsed.name;
    current.day = mergeDays(current.day, parsed.bars);
    if (!minuteKeys[parsed.key]) {
      current.minute = [];
      current.m30 = [];
    }
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

function mergeMinute(stored, fresh) {
  const map = {};
  const kept = stored || [];
  for (let index = 0; index < kept.length; index++) {
    const bar = kept[index];
    if (bar && bar.t) map[bar.t] = bar;
  }
  const incoming = fresh || [];
  for (let index = 0; index < incoming.length; index++) {
    const bar = incoming[index];
    if (bar && bar.t) map[bar.t] = bar;
  }
  const stamps = Object.keys(map).sort();
  const out = [];
  for (let index = Math.max(0, stamps.length - MINUTE_KEEP); index < stamps.length; index++) out.push(map[stamps[index]]);
  return out;
}

function cleanChart(item) {
  if (!item || typeof item !== "object") return null;
  const minute = [];
  const rawMinute = Array.isArray(item.minute) ? item.minute : [];
  for (let index = Math.max(0, rawMinute.length - MINUTE_KEEP); index < rawMinute.length; index++) {
    const bar = rawMinute[index];
    if (!bar || !/^20\d{10}$/.test(String(bar.t || ""))) continue;
    const next = { t: String(bar.t), o: Number(bar.o), c: Number(bar.c), h: Number(bar.h), l: Number(bar.l) };
    if (Number(bar.v) > 0) next.v = Number(bar.v);
    if (Number(bar.a) > 0) next.a = Number(bar.a);
    if (next.o > 0 && next.c > 0 && next.h > 0 && next.l > 0) minute.push(next);
  }
  return { name: item.name ? String(item.name) : "", prec: item.prec > 0 ? Number(item.prec) : null, minute, m30: cleanM30(item.m30), day: cleanDayBars(item.day) };
}

function cleanM30(list) {
  const bars = [];
  if (!Array.isArray(list)) return bars;
  for (let index = Math.max(0, list.length - CANDLES); index < list.length; index++) {
    const bar = list[index];
    if (!bar || !/^\d{8}-\d{2}$/.test(String(bar.id || ""))) continue;
    const next = {
      id: String(bar.id),
      d: String(bar.d || ""),
      o: Number(bar.o), c: Number(bar.c), h: Number(bar.h), l: Number(bar.l),
      label: String(bar.label || "")
    };
    if (next.o > 0 && next.c > 0 && next.h > 0 && next.l > 0 && next.h >= next.l) bars.push(next);
  }
  return bars;
}

function mergeM30(stored, fresh) {
  const map = {};
  const kept = stored || [];
  for (let index = 0; index < kept.length; index++) {
    const bar = kept[index];
    if (bar && bar.id) map[bar.id] = bar;
  }
  const incoming = fresh || [];
  for (let index = 0; index < incoming.length; index++) {
    const bar = incoming[index];
    if (bar && bar.id) map[bar.id] = bar;
  }
  const ids = Object.keys(map).sort();
  const out = [];
  for (let index = Math.max(0, ids.length - CANDLES); index < ids.length; index++) out.push(map[ids[index]]);
  return out;
}

function cleanDayBars(list) {
  const bars = [];
  if (!Array.isArray(list)) return bars;
  for (let index = Math.max(0, list.length - DAY_KEEP); index < list.length; index++) {
    const bar = list[index];
    if (!bar) continue;
    const next = copyDay(bar);
    if (next) bars.push(next);
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
  if (alert && alert.cost > 0 && row.price > 0) {
    parts.push("成本 " + trimNumber(alert.cost));
    parts.push(formatSigned((row.price - alert.cost) / alert.cost * 100, 2) + "%");
  } else if (Number.isFinite(row.change)) parts.push(formatSigned(row.change, 2));
  if (alert && alert.pending) parts.push(alert.since.slice(5) + " 起");
  else if (alert && alert.price > 0) parts.push("提醒 " + trimNumber(alert.price));
  return parts.join("  ");
}

function pinnedCanvases(indexRow, rows, colors, indexKey) {
  const items = [];
  if (indexRow && indexRow.price > 0) items.push(indexRow);
  for (let index = 0; index < rows.length; index++) if (rows[index].price > 0) items.push(rows[index]);
  return items.slice(0, 6).map(row => {
    const color = row.pct > 0 ? colors.up : row.pct < 0 ? colors.down : "$muted";
    const name = row.key === indexKey ? indexShort(indexKey, row.name) : row.name;
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

function collectNotices(rows, previous, alerts, plans, sent, threshold, today, now, title) {
  const found = [];
  for (const row of rows) {
    if (!(row.price > 0) || !isFresh(row, now)) continue;
    const prior = number((previous[row.key] || {}).price);
    if (!Number.isFinite(prior)) continue;
    for (const alert of matches(alerts, row)) {
      if (isPending(alert.since, today) || !(alert.price > 0)) continue;
      const side = prior < alert.price && row.price >= alert.price ? "up"
        : prior > alert.price && row.price <= alert.price ? "down" : "";
      if (!side) continue;
      const verb = side === "up" ? "涨破" : "跌破";
      found.push({
        id: ["px", row.key, trimNumber(alert.price), side, row.at || now].join("|"),
        title: cut(title, 16),
        body: cut(row.name + " " + row.priceText + "，" + verb + " " + trimNumber(alert.price), 110)
      });
    }
    for (const plan of matches(plans, row)) {
      if (isPending(plan.since, today)) continue;
      const stop = plan.cost > 0 && plan.stopPct > 0 ? targetPrice(plan.cost, plan.stopPct, -1) : 0;
      if (stop > 0 && prior > stop && row.price <= stop) {
        found.push({
          id: ["sl", row.key, trimNumber(stop), row.at || now].join("|"),
          title: cut(title, 16),
          body: cut(row.name + " " + row.priceText + "，止损 " + trimNumber(plan.stopPct) + "%，跌破 " + trimNumber(stop), 110)
        });
      }
      const take = plan.cost > 0 && plan.takePct > 0 ? targetPrice(plan.cost, plan.takePct, 1) : 0;
      if (take > 0 && prior < take && row.price >= take) {
        found.push({
          id: ["tp", row.key, trimNumber(take), row.at || now].join("|"),
          title: cut(title, 16),
          body: cut(row.name + " " + row.priceText + "，止盈 " + trimNumber(plan.takePct) + "%，涨破 " + trimNumber(take), 110)
        });
      }
    }
  }
  const moves = [];
  for (const row of rows) {
    if (!(threshold > 0) || !(row.price > 0) || !isRecent(row, now) || !(Math.abs(row.pct) >= threshold)) continue;
    const day = quoteDay(row);
    if (!day) continue;
    const side = row.pct > 0 ? "up" : "down";
    const key = ["pct", row.key, side, day].join("|");
    if (sent[key]) continue;
    moves.push({
      pct: row.pct,
      key,
      id: key,
      title: cut(title, 16),
      body: cut(row.name + (side === "up" ? "上涨 " : "下跌 ") + Math.abs(row.pct).toFixed(2) + "%，现价 " + row.priceText, 110)
    });
  }
  moves.sort((left, right) => Math.abs(right.pct) - Math.abs(left.pct));
  for (let index = 0; index < moves.length; index++) {
    const item = moves[index];
    found.push({ id: item.id, key: item.key, title: item.title, body: item.body });
  }
  return found;
}

function readPending(raw, rows) {
  if (!Array.isArray(raw)) return [];
  const live = {};
  for (let index = 0; index < rows.length; index++) if (rows[index] && rows[index].key) live[rows[index].key] = true;
  const filter = rows.length > 0;
  const out = [];
  const seen = {};
  for (let index = 0; index < raw.length && out.length < 16; index++) {
    const item = raw[index];
    if (!item || typeof item !== "object") continue;
    const id = String(item.id || "");
    const title = String(item.title || "");
    const body = String(item.body || "");
    if (!id || !title || !body || seen[id]) continue;
    const symbol = id.split("|")[1] || "";
    if (filter && symbol && !live[symbol]) continue;
    const next = { id, title, body };
    if (item.key) next.key = String(item.key);
    seen[id] = true;
    out.push(next);
  }
  return out;
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
    const change = stamp ? readNumber(fields[stamp.index + 1]) : null;
    const pct = stamp ? readNumber(fields[stamp.index + 2]) : null;
    const symbol = match[1];
    out.push({
      key: symbolKey(symbol),
      symbol,
      name,
      code: fields[2] || symbol,
      priceText,
      price: price > 0 ? price : 0,
      change: Number.isFinite(change) ? change : NaN,
      pct,
      prev: Number(fields[4]) > 0 ? Number(fields[4]) : null,
      open: Number(fields[5]) > 0 ? Number(fields[5]) : null,
      high: stamp && Number(fields[stamp.index + 3]) > 0 ? Number(fields[stamp.index + 3]) : null,
      low: stamp && Number(fields[stamp.index + 4]) > 0 ? Number(fields[stamp.index + 4]) : null,
      amount: readNumber(fields[37]),
      turnover: readNumber(fields[38]),
      amplitude: readNumber(fields[43]),
      at: stamp ? stamp.at : NaN,
      url: /^[A-Za-z0-9.]+$/.test(symbol) ? "https://gu.qq.com/" + symbol : ""
    });
  }
  return out;
}

function splitIndex(parsed, indexKey) {
  let index = null;
  const rest = [];
  for (let cursor = 0; cursor < parsed.length; cursor++) {
    if (parsed[cursor].key === indexKey && !index) index = parsed[cursor];
    else if (parsed[cursor].key !== indexKey) rest.push(parsed[cursor]);
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

function orderQuotes(parsed, tokens, indexKey) {
  const used = {};
  const out = [];
  for (const token of tokens) {
    const key = symbolKey(norm(token));
    if (!key || key === indexKey) continue;
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

function recall(previous, tokens, indexKey) {
  const out = [];
  const used = {};
  const keys = tokens.length ? tokens.map(token => symbolKey(norm(token))).filter(key => key && key !== indexKey) : Object.keys(previous || {}).filter(key => key !== indexKey);
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
      amount: Number.isFinite(row.amount) ? row.amount : null,
      turnover: Number.isFinite(row.turnover) ? row.turnover : null,
      amplitude: Number.isFinite(row.amplitude) ? row.amplitude : null,
      at: Number.isFinite(row.at) ? row.at : null,
      url: row.url || ""
    };
  }
  return quotes;
}

function readList(raw) {
  let rows = [];
  try {
    rows = JSON.parse(raw || "[]");
  } catch (error) {
    rows = [];
  }
  return Array.isArray(rows) ? rows : [];
}

function readAlerts(raw) {
  return readList(raw).map(row => ({
    key: symbolKey(norm(row && row.code)),
    name: textOr(row && row.name, ""),
    price: Number(row && row.price),
    since: String(row && row.since || "")
  })).filter(row => row.key);
}

function readPlans(raw) {
  return readList(raw).map(row => ({
    key: symbolKey(norm(row && row.code)),
    name: textOr(row && row.name, ""),
    cost: Number(row && row.cost),
    stopPct: Number(row && row.stop_pct),
    takePct: Number(row && row.take_pct),
    since: String(row && row.since || "")
  })).filter(row => row.key);
}

function targetPrice(cost, pct, direction) {
  const raw = cost * (1 + direction * pct / 100);
  const cents = Math.round(raw * 100) / 100;
  return cents > 0 ? cents : 0;
}

function alertFor(alerts, plans, row, today) {
  const list = matches(alerts, row);
  const found = list.find(alert => alert.price > 0 || (alert.name && alert.name !== row.name));
  const costed = matches(plans, row).find(plan => plan.cost > 0 && !isPending(plan.since, today));
  if (!found && !costed) return null;
  return {
    price: found ? found.price : 0,
    since: found ? found.since : "",
    pending: found ? isPending(found.since, today) : false,
    cost: costed ? costed.cost : 0
  };
}

function isPending(since, today) {
  return /^\d{4}-\d{2}-\d{2}$/.test(since) && since > today;
}

function matches(alerts, row) {
  return alerts.filter(alert => alert.key === row.key);
}

function pruneSent(sent, rows) {
  const days = {};
  for (const row of rows) {
    const day = quoteDay(row);
    if (row.key && day) days[row.key] = day;
  }
  const next = {};
  for (const key of Object.keys(sent || {})) {
    const parts = key.split("|");
    if (parts[0] !== "pct" || !days[parts[1]] || days[parts[1]] !== parts[3]) continue;
    next[key] = 1;
  }
  return next;
}

function quoteDay(row) {
  if (!row || !Number.isFinite(row.at)) return "";
  return shanghaiDate(row.at * 1000);
}

function applyNames(rows, alerts, plans) {
  for (const row of rows) {
    const named = customName(matches(alerts, row)) || customName(matches(plans, row));
    if (named) row.name = named;
  }
}

function customName(list) {
  const found = list.find(item => item.name && item.name !== "贵州茅台");
  return found ? found.name : "";
}

function phaseOf(tokens, nowMs, source, parsedCount, showingCache) {
  if (!tokens.length) {
    return { id: "idle", label: "等待填写", stale: true, empty: "请填写自选代码", hint: "自选1、自选2各填一只，如 sh600519。上方指数可在设置里改" };
  }
  const kinds = tokens.map(token => symbolKey(norm(token)).slice(0, 2));
  const market = kinds.every(kind => kind === "sh" || kind === "sz" || kind === "bj")
    ? aSharePhase(nowMs) : { id: "mixed", label: "行情" };
  if (source === "unconfigured" && !showingCache) {
    return { id: "offline", label: "等待授权", stale: true, empty: "请授权腾讯行情", hint: "在已安装插件中允许访问腾讯行情" };
  }
  if (showingCache && source !== "ready") {
    return { id: "offline", label: source === "unconfigured" ? "等待授权" : "暂不可用", stale: true, empty: "", hint: "" };
  }
  if (source === "ready" && parsedCount === 0) {
    return {
      id: "offline", label: "暂不可用", stale: true,
      empty: "没有读到这些代码",
      hint: "沪 sh、深 sz、京 bj、港 hk、美 us，用英文逗号且不要空格"
    };
  }
  if (source !== "ready") {
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

function indexKeyOf(settings) {
  const key = symbolKey(norm(textOr(settings && settings.index, "")));
  return key || DEFAULT_INDEX;
}

function indexTitle(key, name) {
  if (name) return cut(name, 5);
  const known = {
    sh000001: "上证指数",
    sz399001: "深证成指",
    sz399006: "创业板指",
    sh000300: "沪深300",
    sh000016: "上证50",
    sh000688: "科创50",
    sh000905: "中证500",
    sz399005: "中小100"
  };
  return known[key] || "指数";
}

function indexShort(key, name) {
  const known = {
    sh000001: "上证",
    sz399001: "深成",
    sz399006: "创业",
    sh000300: "沪深",
    sh000016: "上50",
    sh000688: "科创",
    sh000905: "中证",
    sz399005: "中小"
  };
  return known[key] || cut(name || "指数", 2);
}

function watchTokens(settings, indexKey) {
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
    if (!key || key === indexKey || seen[key]) continue;
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

function readNumber(value) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function indexMove(row) {
  if (!row) return NaN;
  if (Number.isFinite(row.change)) return row.change;
  if (row.price > 0 && row.prev > 0) return row.price - row.prev;
  return NaN;
}

function formatPoints(change) {
  if (!Number.isFinite(change)) return "";
  const rounded = Math.round(change * 100) / 100;
  if (rounded === 0) return "0.00";
  return (rounded > 0 ? "+" : "") + rounded.toFixed(2);
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
