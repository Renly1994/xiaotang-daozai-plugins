// ROG 设备电量状态插件
// 数据来自本机桥接服务（source.read: loopback），JS 沙箱不直接读 HID。
// refresh 每次从头运行，需要记住的内容放进 storage。

// 奥创设备原图（从奥创界面提取，透明底），按设备类别匹配
var ICON = {
  keyboard: 'icon-keyboard.png',
  mouse: 'icon-mouse.png'
};

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function toDevices(text) {
  if (!text) return null;
  try {
    var data = JSON.parse(text);
    if (data && Array.isArray(data.devices)) return data.devices;
  } catch (e) {}
  return null;
}

function shortName(name) {
  if (!name) return 'ROG 设备';
  var n = String(name).replace(/WIRELESS\s+/i, '').replace(/AIMPOINT/i, 'Aimpoint');
  return n.length > 18 ? n.slice(0, 17) + '…' : n;
}

function batteryColor(pct) {
  if (pct >= 60) return '#5BD6A0';
  if (pct >= 25) return '#FFC857';
  return '#FF6B6B';
}

// 画一行设备：图标 + 名称 + 电量条 + 百分比
function deviceRow(dev, top, accent) {
  var kind = dev.kind === 'mouse' ? 'mouse' : 'keyboard';
  var pct = typeof dev.battery === 'number' ? clamp(dev.battery, 0, 100) : null;
  var col = pct === null ? '$dim' : batteryColor(pct);
  var nodes = [];

  // 统一收进岛仔原生框：红框(设备列表)边界 ≈ 逻辑 x 23~364。
  // 图标底框从 x=27 起，离框左 4px；文字/进度条/百分比同步右移，全部落在框内。
  var LEFT = 27, BOX_W = 56, BOX_H = 48, PAD = 5;
  var TEXT_X = 89, BAR_W = 132, PCT_X = 229;
  var natW = kind === 'mouse' ? 83 : 160;
  var natH = kind === 'mouse' ? 160 : 67;
  var scale = Math.min((BOX_W - PAD * 2) / natW, (BOX_H - PAD * 2) / natH);
  var drawW = natW * scale, drawH = natH * scale;
  var dx = LEFT + (BOX_W - drawW) / 2;
  var dy = (BOX_H - drawH) / 2;
  nodes.push({ rect: [LEFT, top, BOX_W, BOX_H], r: 10, fill: '$track' });
  nodes.push({ image: ICON[kind], rect: [dx, top + dy, drawW, drawH], fit: 'contain' });
  nodes.push({
    text: shortName(dev.name), at: [TEXT_X, top + 19], size: 13,
    weight: 700, fill: '$text', max_width: 138
  });

  if (pct === null) {
    nodes.push({ text: dev.online ? '读数中…' : '离线 / 休眠', at: [TEXT_X, top + 40], size: 11, fill: '$muted' });
  } else {
    nodes.push({ rect: [TEXT_X, top + 28, BAR_W, 8], r: 4, fill: '$track' });
    if (pct > 0) {
      nodes.push({ rect: [TEXT_X, top + 28, BAR_W * pct / 100, 8], r: 4, fill: col });
    }
    nodes.push({
      text: (dev.charging ? '⚡ ' : '') + pct + '%', at: [PCT_X, top + 39],
      size: 16, weight: 700, fill: col, align: 'right', max_width: 60
    });
  }
  return nodes;
}

function refresh(input) {
  var source = input.source || {};
  var devices = toDevices(source.text);
  var settings = input.settings || {};
  var accent = settings.accent === 'red' ? '#FF4D4F'
    : settings.accent === 'cyan' ? '#2FD3D0' : '#7B61FF';

  // 未授权 / 离线：返回合法输出，不崩
  if (source.status !== 'ready' || !devices) {
    var msg = source.status === 'unconfigured' ? '请在插件详情授权本机地址'
      : source.status === 'offline' ? '桥接服务未启动' : '暂无设备数据';
    return {
      status: { state: 'offline', label: msg, summary: '启动 rog_battery_bridge.py 后授权 http://127.0.0.1:17358/' },
      canvas: {
        height: 70,
        nodes: [
          { text: 'ROG 设备', at: [39, 28], size: 15, weight: 700, fill: '$text' },
          { text: msg, at: [39, 50], size: 12, fill: '$muted', max_width: 310 }
        ]
      },
      storage: { lastSeen: input.storage ? input.storage.lastSeen : null }
    };
  }

  var shown = devices.filter(function (d) {
    return d.kind === 'keyboard' || d.kind === 'mouse';
  }).slice(0, 2);

  // 用户自定义名称优先，留空则用奥创同步的名字
  shown = shown.map(function (d) {
    var override = d.kind === 'keyboard' ? settings.keyboard_name : settings.mouse_name;
    var copy = {};
    for (var k in d) { if (d.hasOwnProperty(k)) copy[k] = d[k]; }
    if (override && override !== '默认') copy.name = override;
    return copy;
  });

  if (!shown.length) {
    return {
      status: { state: 'idle', label: '未发现 ROG 设备', summary: '奥创未记录设备或接收器未连接' },
      canvas: { height: 70, nodes: [
        { text: '未发现 ROG 设备', at: [39, 42], size: 14, fill: '$muted' }
      ] },
      storage: { lastSeen: Date.now() }
    };
  }

  var height = shown.length * 64 + 10;
  // 不画独立卡片底色：设备行直接落在岛仔原生页面背景上，
  // 与上方标题、下方设备列表连成整体一页，消除中间的边界框。
  var nodes = [];
  for (var i = 0; i < shown.length; i++) {
    nodes = nodes.concat(deviceRow(shown[i], 5 + i * 64, accent));
  }

  var metrics = shown.map(function (d) {
    return {
      label: shortName(d.name),
      value: typeof d.battery === 'number' ? d.battery + '%' + (d.charging ? ' 充电中' : '') : '离线'
    };
  });
  var items = shown.map(function (d) {
    return {
      label: shortName(d.name),
      detail: d.pid + (d.source === 'armoury' ? ' · 奥创同步' : ''),
      state: typeof d.battery === 'number' ? (d.battery < 20 ? 'error' : 'running') : 'offline'
    };
  });
  var low = shown.filter(function (d) { return typeof d.battery === 'number' && d.battery < 20; });
  var label = shown.map(function (d) {
    return (d.kind === 'keyboard' ? '键盘 ' : '鼠标 ') +
      (typeof d.battery === 'number' ? d.battery + '%' : '离线');
  }).join(' · ');

  return {
    status: {
      state: low.length ? 'error' : 'succeeded',
      label: label,
      summary: 'ROG OMNI 接收器 · ' + shown.length + ' 台设备',
      metrics: metrics,
      items: items,
      alert: low.length ? '低电量：' + low.map(function (d) { return shortName(d.name); }).join('、') : undefined,
      tags: ['ROG', 'OMNI'],
      observed_at: Math.floor(Date.now() / 1000)
    },
    canvas: { height: height, nodes: nodes },
    storage: {
      lastSeen: Date.now(),
      lastReading: shown.map(function (d) {
        return { kind: d.kind, battery: d.battery, at: Date.now() };
      })
    }
  };
}
