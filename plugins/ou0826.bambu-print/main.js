// 拓竹打印进度 · 岛仔状态页插件
//
// 数据来自本机「拓竹打印监控」的只读状态桥（source.read: loopback）。
// 插件不连接打印机、不读取凭据，只解析宿主取回的 JSON 文本。
// 每次 refresh 都从头执行：需要跨次保留的内容（温度折线、上次读数）放在 storage。
//
// 桥的响应格式（bambu_monitor/bridge.py）：
// { api, source, updated, age, printer:{name,model},
//   status:{online, gcode_state, state_text, stage_text, percent, remaining,
//           layer, total_layer, file, nozzle, nozzle_target, bed, bed_target,
//           hms:[], print_error, ams_text} }

var STALE_SECONDS = 20;   // 桥超过这么久没有新数据，按“监控没在刷新”处理
var SERIES_MAX = 40;      // 折线保留点数（每次刷新 1 点，约 40 分钟）

function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
function text(v) { return typeof v === 'string' ? v : ''; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function cut(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function trim(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
var NOW_MS = Date.now();

// 宿主在模拟输入里可以给 now（毫秒或秒），让结果可复现；正常运行取本机时间。
function pickNow(input) {
    var n = input && input.now;
    if (typeof n === 'number' && isFinite(n)) { return n > 1e12 ? n : n * 1000; }
    return Date.now();
}
function nowSec() { return Math.floor(NOW_MS / 1000); }

// 机型 → 包内取模图。两台机器都有「显示名」和「官方代号」两种写法，两种都认。
// 顺序敏感：更长的名字要排在前面（A1 MINI 在 A1 之前、H2D PRO 在 H2D 之前、X1E 在 X1 之前）。
var PRINTER_IMAGES = [
    // 状态桥上报的显示名
    ['A1 MINI', 'images/printer-a1-mini.png'],
    ['A1', 'images/printer-a1.png'],
    ['P1P', 'images/printer-p1p.png'],
    ['P1S', 'images/printer-p1s.png'],
    ['P2S', 'images/printer-p2s.png'],
    ['X1 CARBON', 'images/printer-x1c.png'],
    ['X1E', 'images/printer-x1e.png'],
    ['X1', 'images/printer-x1c.png'],
    ['X2D', 'images/printer-x2d.png'],
    ['A2L', 'images/printer-a2l.png'],
    ['H2D PRO', 'images/printer-h2d-pro.png'],
    ['H2D', 'images/printer-h2d.png'],
    ['H2C', 'images/printer-h2c.png'],
    ['H2S', 'images/printer-h2s.png'],
    // 官方机型代号（BL-P001/C11 这类，手动填机型或原始上报时可能直接是它）
    ['BL-P001', 'images/printer-x1c.png'],
    ['BL-P002', 'images/printer-x1c.png'],
    ['C11', 'images/printer-p1p.png'],
    ['C12', 'images/printer-p1s.png'],
    ['C13', 'images/printer-x1e.png'],
    ['N1', 'images/printer-a1-mini.png'],
    ['N2S', 'images/printer-a1.png'],
    ['N7', 'images/printer-p2s.png'],
    ['O1C', 'images/printer-h2c.png'],
    ['O1D', 'images/printer-h2d.png'],
    ['O1E', 'images/printer-h2d-pro.png'],
    ['O1S', 'images/printer-h2s.png']
];

function printerImage(model) {
    var name = String(model == null ? '' : model).toUpperCase();
    for (var i = 0; i < PRINTER_IMAGES.length; i++) {
        if (name.indexOf(PRINTER_IMAGES[i][0]) >= 0) { return PRINTER_IMAGES[i][1]; }
    }
    return '';
}

// 一条「机型图 + 名称」的横条；识别不到机型时不画。
// 画布宽度固定 387，比状态卡片内区更宽，所以内容统一从 x=24 起，避免压到圆角。
function printerCanvas(model, dim) {
    var image = printerImage(model);
    if (!image) { return null; }
    var hint = dim ? '当前没有新数据' : '本机状态桥 · 每 60 秒取一次';
    return {
        height: 124,
        nodes: [
            { image: image, rect: [20, 0, 112, 124], fit: 'contain', opacity: dim ? 0.42 : 1 },
            { text: cut(model, 16), at: [150, 56], size: 17, weight: 700, fill: dim ? '$muted' : '$text' },
            { text: hint, at: [150, 84], size: 11, fill: '$dim' }
        ]
    };
}

function parseDoc(raw) {
    if (!raw) { return null; }
    try {
        var doc = JSON.parse(raw);
        if (doc && doc.api === 1 && doc.status && typeof doc.status === 'object') { return doc; }
    } catch (e) {}
    return null;
}

function stateOf(gcode) {
    switch (gcode) {
        case 'RUNNING':
        case 'PREPARE':
        case 'SLICING': return 'running';
        case 'PAUSE': return 'paused';
        case 'FINISH': return 'succeeded';
        case 'FAILED': return 'error';
        case 'OFFLINE': return 'offline';
        default: return 'idle';
    }
}

function remainText(minutes) {
    var m = Math.round(minutes);
    if (!(m > 0)) { return ''; }
    var h = Math.floor(m / 60), mm = m % 60;
    if (h > 0 && mm > 0) { return h + ' 小时 ' + mm + ' 分'; }
    if (h > 0) { return h + ' 小时'; }
    return mm + ' 分钟';
}

function tempText(cur, target) {
    if (cur == null) { return ''; }
    var v = Math.round(cur);
    // 到温后当前值和目标值几乎一样，只显示一个数；升温途中才并列。
    if (target == null || Math.abs(cur - target) < 1) { return v + ' °C'; }
    return v + ' / ' + Math.round(target) + ' °C';
}

// 统一的“没有可用数据”出口：保留上次读数，但把原因说清楚。
function idleOut(state, label, summary, last, temps, extraNote, model) {
    var status = {
        state: state,
        label: label,
        summary: summary,
        note: extraNote || summary,
        observed_at: nowSec()
    };
    if (last) {
        if (last.percent != null) { status.progress_pct = clamp(last.percent, 0, 100); }
        if (last.metrics) { status.metrics = last.metrics; }
        var when = last.at ? agoText(nowSec() - last.at) : '';
        var prev = (last.label ? '上次：' + last.label : '') + (when ? '（' + when + '）' : '');
        if (prev) { status.note = cut(prev + '。' + (extraNote || ''), 300); }
    }
    if (temps && temps.length >= 2) { status.series = temps; status.series_label = '喷嘴 °C'; }
    var canvas = printerCanvas(model, true);
    return { status: status, canvas: canvas, storage: { last: last || null, temps: temps || [] } };
}

// 沙箱里的 Date 走 UTC，直接格式化会差时区；统一用相对时间描述新鲜度。
function agoText(seconds) {
    if (seconds == null || !(seconds >= 0)) { return '刚刚'; }
    if (seconds < 60) { return Math.round(seconds) + ' 秒前'; }
    if (seconds < 3600) { return Math.round(seconds / 60) + ' 分钟前'; }
    if (seconds < 86400) { return Math.round(seconds / 3600) + ' 小时前'; }
    return Math.round(seconds / 86400) + ' 天前';
}

function refresh(input) {
    NOW_MS = pickNow(input);
    var source = (input && input.source) || { status: 'unconfigured' };
    var storage = (input && input.storage) || {};
    var last = storage.last || null;
    var temps = Array.isArray(storage.temps) ? storage.temps.slice(-SERIES_MAX) : [];

    // 1) 还没授权本机地址
    if (source.status === 'unconfigured') {
        return idleOut('idle', '请授权本机状态桥',
            '在插件详情「授权数据源」填 http://127.0.0.1:39778/status', last, temps,
            '先启动 BambuMonitor，再把桥地址授权给岛仔。', last && last.model);
    }

    // 2) 桥连不上：监控没在运行（与“打印机离线”分开）
    if (source.status === 'offline') {
        return idleOut('offline', '监控没在运行',
            '启动 BambuMonitor 后自动接入', last, temps,
            '状态桥只在本机回环地址上监听，不需要联网。', last && last.model);
    }

    // 3) 有响应但内容不是 1.0 版快照
    var doc = parseDoc(source.text);
    if (!doc) {
        return idleOut('error', '状态格式不符',
            '桥返回的不是 1.0 版快照，请更新拓竹打印监控', last, temps,
            '需要 bambu_monitor/bridge.py 提供的 /status。', last && last.model);
    }

    var st = doc.status || {};
    var printer = doc.printer || {};
    var model = trim(printer.model) || trim(printer.name) || '拓竹打印机';
    var age = num(doc.age);
    var online = st.online === true;
    var gcode = text(st.gcode_state).toUpperCase();
    var stateWord = trim(st.state_text) || ({
        RUNNING: '打印中', PREPARE: '准备中', SLICING: '切片中', PAUSE: '已暂停',
        FINISH: '已完成', FAILED: '失败', IDLE: '空闲', OFFLINE: '离线'
    }[gcode] || '未知');
    var file = trim(st.file);
    var stage = trim(st.stage_text);
    var percent = num(st.percent);
    var remaining = num(st.remaining);
    var layer = num(st.layer);
    var totalLayer = num(st.total_layer);

    // 4) 桥活着，但打印机没连上
    if (!online) {
        // 桥在、打印机没连上：不把「未知」这种空状态直接摊给用户看。
        var offlineWord = (stateWord && stateWord !== '未知') ? stateWord : '未连接打印机';
        return idleOut('offline', '打印机离线',
            model + ' · ' + offlineWord, last, temps,
            '打印机或云端连接断开；恢复后自动继续。', model);
    }

    // 5) 桥活着、打印机在线，但快照停更（监控界面线程没再刷新）
    if (age != null && age > STALE_SECONDS) {
        return idleOut('offline', '监控没有新数据',
            '已经 ' + Math.round(age) + ' 秒没有收到打印状态', last, temps,
            '检查 BambuMonitor 是否还在运行，或打印机是否掉线。', model);
    }

    var state = stateOf(gcode);
    var observed = nowSec() - (age == null ? 0 : Math.round(age));

    // 百分比进折线，同时记一次喷嘴温度
    var nozzle = num(st.nozzle);
    if (nozzle != null) {
        temps.push(Math.round(nozzle * 10) / 10);
        temps = temps.slice(-SERIES_MAX);
    }

    var metrics = [];
    if (layer != null && totalLayer != null) {
        metrics.push({ label: '层数', value: Math.round(layer) + ' / ' + Math.round(totalLayer) });
    } else if (layer != null) {
        metrics.push({ label: '层数', value: String(Math.round(layer)) });
    }
    var remain = remaining == null ? '' : remainText(remaining);
    // running 时剩余时间由宿主的倒计时组件按秒跳动；暂停/其他状态才补一行文字读数。
    if (remain && state !== 'running') { metrics.push({ label: '剩余', value: remain }); }
    var nozzleText = tempText(num(st.nozzle), num(st.nozzle_target));
    if (nozzleText) { metrics.push({ label: '喷嘴', value: nozzleText }); }
    var bedText = tempText(num(st.bed), num(st.bed_target));
    if (bedText) { metrics.push({ label: '热床', value: bedText }); }

    var items = [];
    if (file) { items.push({ label: '当前任务', detail: cut(file, 80), state: state }); }
    if (stage) { items.push({ label: '当前阶段', detail: cut(stage, 80), state: state }); }
    var hmsCount = Array.isArray(st.hms) ? st.hms.length : 0;
    var printError = num(st.print_error) || 0;
    if (hmsCount > 0) {
        items.push({ label: '打印机告警', detail: 'HMS ' + hmsCount + ' 项，请在屏幕上确认', state: 'error' });
    }

    var alert = '';
    if (printError > 0) {
        alert = '打印机上报错误码 ' + Math.round(printError);
    } else if (hmsCount > 0) {
        alert = '打印机告警 ' + hmsCount + ' 项，请在屏幕上确认';
    }

    var label = stateWord + (file ? ' · ' + cut(file, 26) : '');
    var summary = (stage && stage !== stateWord ? stage + ' · ' : '') + model;

    var ams = trim(st.ams_text);
    var tags = [cut(model, 8), '本机'];
    // 指标固定 2 列，超过 4 项会让网格掉一行；AMS 状态改放到标签里。
    if (ams && ams !== '空闲') { tags.push(cut(ams, 8)); }

    // 紧凑布局只显示两行说明：机型一行，更新情况一行。
    var noteLines = [model + (trim(printer.name) && trim(printer.name) !== model ? ' · ' + trim(printer.name) : '')];
    noteLines.push('状态桥 ' + agoText(age) + '更新，每 60 秒取一次。');

    var status = {
        state: state,
        label: cut(label, 40),
        summary: cut(summary, 120),
        note: cut(noteLines.join('\n'), 300),
        observed_at: observed,
        expires_at: observed + 300,
        tags: tags
    };
    if (percent != null) { status.progress_pct = clamp(percent, 0, 100); }
    if (metrics.length) { status.metrics = metrics; }
    if (items.length) { status.items = items; }
    if (temps.length >= 2) { status.series = temps; status.series_label = '喷嘴 °C'; }
    if (alert) { status.alert = cut(alert, 120); }
    // 剩余时间交给宿主按秒跳动：每次刷新重新对准，避免累计漂移。
    if (remaining != null && remaining > 0 && state === 'running') {
        status.countdown = {
            label: '剩余',
            target_at: observed + Math.round(remaining * 60),
            format: 'HH:mm:ss'
        };
    }

    return {
        status: status,
        canvas: printerCanvas(model, false),
        storage: {
            last: {
                label: cut(label, 60),
                percent: percent == null ? null : clamp(percent, 0, 100),
                metrics: metrics,
                model: model,
                at: observed
            },
            temps: temps
        }
    };
}
