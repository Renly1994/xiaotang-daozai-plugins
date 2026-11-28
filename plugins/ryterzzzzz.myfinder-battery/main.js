// MIT. Read-only adapter; hardware protocols remain in the external reader.
function refresh(input) {
  var now = typeof input.now === "number" && isFinite(input.now) ? input.now : Date.now();
  var retainMs = 600000;
  function text(value, limit) {
    return typeof value === "string" && value.length > 0 && value.length <= limit && !/[\u0000-\u001f\u007f]/.test(value);
  }
  function age(stamp) {
    if (typeof stamp !== "string") return null;
    var at = Date.parse(stamp), delta = now - at;
    return isFinite(at) && delta >= -5000 ? Math.max(0, delta) : null;
  }
  function recent(stamp, seconds) {
    var elapsed = age(stamp);
    return elapsed !== null && elapsed <= seconds * 1000;
  }
  function historical() {
    var old = input.storage && Array.isArray(input.storage.devices) ? input.storage.devices : [];
    var confirmations = input.storage && input.storage.confirmations || {};
    return old.slice(0, 64).filter(function(d) {
      var elapsed = age(d.measuredAtUtc), confirmed = age(confirmations[d.id]);
      return elapsed !== null && confirmed !== null && Math.max(elapsed,confirmed) <= retainMs && text(d.id, 128);
    }).map(function(d) {
      return Object.assign({}, d, {online:false, fresh:false, charging:null});
    });
  }
  function output(devices, confirmations) {
    var kept = Object.create(null);
    devices.forEach(function(d) { if (d.percent !== null && typeof confirmations[d.id] === "string") kept[d.id] = confirmations[d.id]; });
    return {wireless:devices,storage:{devices:devices,confirmations:kept}};
  }
  if (!input.source || input.source.status !== "ready") {
    var previous = historical();
    return output(previous, input.storage && input.storage.confirmations || {});
  }
  var data;
  try { data = JSON.parse(input.source.text); } catch (_) { data = null; }
  if (!data || data.schema !== 1 || !Array.isArray(data.devices) || data.devices.length > 64 || !recent(data.observedAtUtc, 180)) {
    var last = historical();
    return output(last, input.storage && input.storage.confirmations || {});
  }
  var reader = data.reader || {};
  var readerAlive = reader.running === true && reader.ready === true && recent(reader.lastStatusAtUtc, 180);
  var seen = Object.create(null), confirmations = Object.create(null), devices = [];
  data.devices.forEach(function(d) {
    if (!d || !text(d.id, 128) || !text(d.name, 80) || seen[d.id]) return;
    if (["mouse","keyboard","gamepad","headset","headphones"].indexOf(d.kind) < 0) return;
    if (typeof d.vendorId !== "number" || d.vendorId % 1 !== 0 || d.vendorId < 1 || d.vendorId > 65535 ||
        typeof d.productId !== "number" || d.productId % 1 !== 0 || d.productId < 1 || d.productId > 65535) return;
    var transport = typeof d.transport === "string" ? d.transport.toLowerCase().replace(/\s/g, "") : "";
    if (["usb","2.4g","2.4ghz","usb/2.4g","usb/2.4ghz"].indexOf(transport) < 0) return;
    var keep = [d.queriedAtUtc,d.connectionCheckedAtUtc].some(function(t) {
      var elapsed = age(t); return elapsed !== null && elapsed <= retainMs;
    });
    if (!keep) return;
    var budget = d.provider === "asus_keyboard" && d.sourceQuality === "vendor_log" ? 150 : 90;
    var online = readerAlive && d.online === true && d.connectionState === "connected" && recent(d.connectionCheckedAtUtc,budget);
    var valid = typeof d.percent === "number" && isFinite(d.percent) && d.percent % 1 === 0 && d.percent >= 0 && d.percent <= 100;
    var measured = age(d.measuredAtUtc), confirmed = age(d.confirmedAtUtc);
    var retained = valid && measured !== null && confirmed !== null && Math.max(measured,confirmed) <= retainMs;
    var fresh = retained && online && d.fresh === true && d.measurementState === "current" &&
      ["device_reply","vendor_log"].indexOf(d.sourceQuality) >= 0 &&
      recent(d.measuredAtUtc,budget) && recent(d.confirmedAtUtc,budget);
    var charging = fresh && typeof d.charging === "boolean" && recent(d.chargingCheckedAtUtc,budget) ? d.charging : null;
    seen[d.id] = true;
    if (retained) confirmations[d.id] = d.confirmedAtUtc;
    devices.push({id:d.id,name:d.name,kind:d.kind === "headphones" ? "headset" : d.kind,
      vendorId:d.vendorId,productId:d.productId,percent:retained ? d.percent : null,
      online:online,fresh:fresh,charging:charging,approximate:d.approximate === true,
      measuredAtUtc:retained ? d.measuredAtUtc : null,
      connectionCheckedAtUtc:age(d.connectionCheckedAtUtc) !== null ? d.connectionCheckedAtUtc : null,
      chargingCheckedAtUtc:charging !== null ? d.chargingCheckedAtUtc : null,
      freshForSeconds:budget});
  });
  return output(devices,confirmations);
}
