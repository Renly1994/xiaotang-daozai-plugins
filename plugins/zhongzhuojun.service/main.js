"use strict";

// Daozai evaluates this file afresh. Only the optional Node CLI at the end opens SSH.
const ENDPOINT = "http://127.0.0.1:17863/status";
const COLORS = { cpu: "#65D6C5", memory: "#F2C177", gpu: "#B59BF8", disk: "#E69AB1", network: "#86BCF4" };
const TARGET = /^(?:[A-Za-z0-9_][A-Za-z0-9_.-]*@)?(?:[A-Za-z0-9_][A-Za-z0-9_.-]*|\[[0-9A-Fa-f:]+\])$/;

function address(value) {
    const text = String(value || "").trim().replace(/^ssh\s+/i, "");
    const parsed = /^(?:-p\s+(\d+)\s+)?((?:[A-Za-z0-9_.-]+@)?(?:[A-Za-z0-9_.-]+|\[[0-9A-Fa-f:]+\]))(?::(\d+))?$/.exec(text);
    if (!parsed || !TARGET.test(parsed[2]) || text.length > 128 || (parsed[1] && parsed[3])) return null;
    const port = Number(parsed[1] || parsed[3] || 22);
    if (port < 1 || port > 65535) return null;
    return { host: parsed[2], port, id: parsed[2] + (port === 22 ? "" : ":" + port) };
}

function savedTargets(values) {
    const targets = [];
    for (let slot = 1; slot <= 4; slot++) {
        const raw = String(values["host" + slot] || "").trim();
        if (!raw || raw === "未设置") continue;
        const entry = address(raw);
        if (!entry) return { issue: "第 " + slot + " 台地址无效，请填写 用户@主机 或 SSH 别名。" };
        if (targets.some(t => t.id === entry.id)) return { issue: "第 " + slot + " 台与前面的 SSH 地址重复。" };
        targets.push({ ...entry, slot });
    }
    return { targets };
}

function bounded(value, min, max) {
    return Number.isFinite(value) && value >= min && value <= max;
}

function percent(value) {
    return bounded(value, 0, 100) ? Math.round(value) + "%" : "—";
}

function size(bytes, rate) {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
    let index = 0;
    while (bytes >= 1024 && index < units.length - 1) {
        bytes /= 1024;
        index++;
    }
    const digits = index && bytes < 100 ? 1 : 0;
    return bytes.toFixed(digits) + " " + units[index] + (rate ? "/s" : "");
}

function caption(text, x, y, fontSize, color, maxWidth, bold) {
    return { text, at: [x, y], size: fontSize, fill: color, max_width: maxWidth, weight: bold ? 700 : 400 };
}

function box(x, y, width, height, r, fill) {
    return { rect: [x, y, width, height], r, fill };
}

function waiting(label, detail, state, selected) {
    const nodes = [
        caption(label, 12, 27, 16, "$text", 360, true),
        caption(detail, 12, 50, 12, "$muted", 360)
    ];
    return { status: { state, label, summary: detail }, canvas: { height: 60, nodes },
        pinned: { text: "服务器", value: label, icon: "chart" },
        storage: { selected: selected || "", records: [] } };
}

function labelFor(device, settings, index) {
    const name = String(settings["name" + (device.slot || index + 1)] || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
    return Array.from(name && name !== "跟随 SSH 名称" ? name : device.id.split("@").pop()).slice(0, 22).join("");
}

function makeRecord(device, previous, now) {
    const d = device;
    const record = { id: d.id, seen: previous?.seen || 0, points: [], rate: [null, null] };
    if (d.state !== "ready") return record;
    if (!Number.isInteger(d.at) || d.at < now - 100 || d.at > now + 5) return record;
    if (!(d.os === "Linux" || d.os === "macOS") || !bounded(d.cpu, 0, 100)) return record;
    const consistent = previous && d.at >= previous.seen && d.at - previous.seen <= 180;
    const points = consistent && Array.isArray(previous.points) ? previous.points.filter(x => bounded(x, 0, 100)).slice(-24) : [];
    if (!points.length || d.at !== previous.seen) points.push(d.cpu);
    record.points = points.slice(-24);
    record.seen = d.at;
    record.live = true;
    if (typeof d.iface === "string" && d.iface && [d.rx, d.tx].every(n => Number.isSafeInteger(n) && n >= 0)) {
        record.net = [d.rx, d.tx];
        record.iface = d.iface.slice(0, 40);
        if (consistent && previous.iface === record.iface && Array.isArray(previous.net)) {
            const elapsed = d.at - previous.seen;
            if (elapsed > 0) {
                record.rate = record.net.map((v, i) => v >= previous.net[i] ? (v - previous.net[i]) / elapsed : null);
            } else if (Array.isArray(previous.rate)) {
                record.rate = previous.rate;
            }
        }
    }
    return record;
}

function metrics(d, gpu, record, settings) {
    const temp = n => bounded(n, -30, 140) ? Math.round(n) + " °C" : "—";
    const entries = [
        ["cpu", "CPU", percent(d.cpu), COLORS.cpu, d.cores ? d.cores + " 核" : ""],
        ["gpu", "GPU", percent(gpu.load), COLORS.gpu, gpu.name || ""],
        ["memory", "内存", percent(usage(d.memUsed, d.memTotal)), COLORS.memory, size(d.memUsed) + " 已用"],
        ["vram", gpu.shared ? "统一显存" : "显存", size(gpu.used), COLORS.gpu, gpu.shared ? "统一内存" : "共 " + size(gpu.total)],
        ["cputemp", "CPU 温度", temp(d.cpuTemp), COLORS.cpu],
        ["gputemp", "GPU 温度", temp(gpu.temp), COLORS.gpu],
        ["disk", "系统盘", percent(d.diskPct), COLORS.disk, size(d.diskTotal)],
        ["down", "下载", size(record.rate[0], true), COLORS.network, record.iface],
        ["up", "上传", size(record.rate[1], true), COLORS.network, record.iface]
    ];
    return entries.map(([key,label,value,color,detail]) => {
        const mode = settings["view_" + key] || (key === "cpu" || key === "memory" ? "both" : "page");
        return {key,label,value,color,detail,page:mode === "page" || mode === "both",pin:mode === "pin" || mode === "both"};
    });
}

function metricGrid(nodes, entries, record, y) {
    for (let i = 0; i < entries.length; i += 3) {
        const row = entries.slice(i, i + 3);
        const w = (367 - (row.length - 1) * 4) / row.length;
        row.forEach((m, j) => {
            const x = 10 + j * (w + 4);
            nodes.push(box(x, y, w, 36, 6, "$card"),
                caption(m.label, x + 7, y + 12, 9, m.color, w - 14),
                caption(m.value, x + 7, y + 29, 14, "$text", w - 14, true));
            if (m.detail) nodes.push({ ...caption(m.detail, x + w - 6, y + 12, 8, "$muted", w - 55), align:"right" });
            if (m.key === "cpu" && record.points.length > 1) {
                const pts = record.points;
                nodes.push({points:pts.map((v,k)=>[x+w-39+k*32/(pts.length-1), y+30-v*0.12]),stroke:m.color,width:1});
            }
        });
        y += 40;
    }
    return y;
}

function rankPanel(nodes, d, rank, modes, y) {
    const rows = Array.isArray(d.ranks?.[rank]) ? d.ranks[rank].slice(0,4) : [];
    const h = 24 + 18 * Math.max(1,Math.ceil(rows.length/2));
    nodes.push(box(10,y,367,h,6,"$card"),caption("进程排行",18,y+14,10,"$text",90,true));
    modes.forEach((key,i)=>{
        const x=197+i*57, hit={action:key};
        nodes.push({...box(x,y+2,53,16,4,key===rank?"$track":"$card"),hit},
            {...caption(["常驻内存","线程数","CPU"][i],x+6,y+14,9,key===rank?COLORS.cpu:"$muted",45),hit});
    });
    if (!rows.length) nodes.push(caption("此设备未提供排行",18,y+34,10,"$muted",250));
    rows.forEach((row,i)=>{
        const x = 18 + (i%2)*181, baseline=y+32+18*Math.floor(i/2);
        const value = rank==="mem" ? size(row.value) : rank==="threads" ? row.value+" 个线程" : row.value+"%";
        nodes.push(caption(String(i+1),x,baseline,9,"$muted",10),
            caption(row.name,x+11,baseline,10,"$text",96),
            {...caption(value,x+169,baseline,10,COLORS.memory,68,true),align:"right"});
        nodes[nodes.length-2].hover={hint:"PID "+row.pid+" · "+String(row.name).slice(0,22)};
    });
    return y+h+4;
}

function pinnedMetrics(name, entries) {
    if (!entries.length) return null;
    const pages=[];
    for (let i=0; i<entries.length; i+=3) {
        const nodes=[caption(name,1,9,8,"$text",72,true)];
        entries.slice(i,i+3).forEach((m,j)=>{
            const slot=j+1,x=(slot%2)*78,y=9+10*Math.floor(slot/2);
            const short = m.value.replace(/\s*([KMGT])iB/g,"$1").replace(" °C","°");
            nodes.push(caption(m.label,x+1,y,8,m.color,35),
                {...caption(short,x+74,y,8,"$text",40,true),align:"right"});
        });
        pages.push({width:156,nodes});
    }
    return {canvas:pages.length===1?pages[0]:pages};
}

function usage(used, total) {
    return total > 0 && bounded(used, 0, total) ? 100 * used / total : null;
}

function ageText(seen, now) {
    if (!seen || seen > now) return "等待首次成功采样";
    const age = now - seen;
    return "上次成功采样 · " + (age < 60 ? "不足 1 分钟前" : Math.floor(age / 60) + " 分钟前");
}

function view(input, clicked) {
    const storage = input.storage || {};
    const source = input.source;
    if (!source || source.status === "unconfigured")
        return waiting("等待授权", "在「已安装」中授权 " + ENDPOINT, "idle");
    if (source.status !== "ready")
        return waiting("采集器未连接", "在 Windows 上启动采集器，再检查回环地址。", "offline", storage.selected);
    let devices;
    try {
        const data = JSON.parse(source.text);
        if (data.version === 1 && data.issue) return waiting("检查采集设置", String(data.issue).slice(0, 90), "idle", storage.selected);
        if (data.version === 1 && Array.isArray(data.devices) && !data.devices.length)
            return waiting("等待设备地址", "在「服务器监视」填入 SSH 地址，然后保存设置。", "idle", storage.selected);
        devices = data.version === 1 && data.devices;
        if (!Array.isArray(devices) || !devices.length || devices.length > 4 ||
            !devices.every(d => d && typeof d.id === "string" && address(d.id)?.id === d.id) ||
            new Set(devices.map(d => d.id)).size !== devices.length) throw Error();
    } catch (_) {
        return waiting("采集数据有误", "请确认授权地址指向服务器监视采集器的 /status。", "error", storage.selected);
    }
    const now = Math.floor((Number.isFinite(input.now) ? input.now : Date.now()) / 1000);
    const previous = Array.isArray(storage.records) ? storage.records : [];
    const records = devices.map(d => makeRecord(d, previous.find(p => p && p.id === d.id), now));
    const names = devices.map((d, i) => labelFor(d, input.settings || {}, i));
    const clickedSlot = /^device[1-4]$/.test(clicked || "") ? Number(clicked.slice(-1)) - 1 : -1;
    let index = devices.findIndex(d => d.id === storage.selected);
    if (devices[clickedSlot]) index = clickedSlot;
    if (index < 0) index = 0;
    const d = devices[index], record = records[index], name = names[index];
    const state = record.live ? "running" : d.state === "pending" ? "idle" : "offline";
    const rankModes = ["mem", "threads", "cpu"];
    const rank = rankModes.includes(clicked) ? clicked : rankModes.includes(storage.rank) ? storage.rank : "mem";
    const gpus = Array.isArray(d.gpus) ? d.gpus : [];
    const oldGpu = storage.selected === d.id && Number.isInteger(storage.gpu) ? Math.max(0, storage.gpu) : 0;
    const gpuIndex = gpus.length ? (oldGpu + (clicked === "nextgpu" ? 1 : 0)) % gpus.length : 0;
    const nodes = [caption(name, 14, 20, 15, "$text", 150, true),
        caption(record.live ? d.os + " · SSH" : "SSH", 166, 19, 10, "$muted", 90)];
    if (devices.length>1) {
        const hit={action:"device"+((index+1)%devices.length+1)};
        nodes.push({...box(292,4,81,21,5,"$card"),hit},
            {...caption("设备 "+(index+1)+"/"+devices.length+"  ›",300,18,10,"$text",70),hit});
    }
    if (record.live && gpus.length>1) {
        const hit={action:"nextgpu"};
        nodes.push({...box(232,4,57,21,5,"$card"),hit},
            {...caption("GPU "+(gpuIndex+1)+" ›",237,18,9,COLORS.gpu,51),hit});
    }
    let height = 74;
    let pinned = {text:Array.from(name).slice(0,12).join(""),value:d.state==="pending"?"正在连接":"离线",icon:"chart"};
    if (record.live) {
        const settings=input.settings || {};
        const all=metrics(d,gpus[gpuIndex] || {},record,settings);
        let y=metricGrid(nodes,all.filter(m=>m.page),record,29);
        if (String(settings.showranks)!=="false") y=rankPanel(nodes,d,rank,rankModes,y);
        if (y===29) {
            nodes.push(caption("可在服务器监视设置中选择展开指标",14,47,10,"$muted",358));
            y=52;
        }
        height=Math.max(40,y+4);
        pinned=pinnedMetrics(name,all.filter(m=>m.pin));
    } else {
        const reason = { auth: "SSH 认证失败，请检查密钥或 ssh-agent。",
            trust: "请在终端连接并核对主机指纹。",
            system: "远端系统或采样命令不受支持。",
            ssh: "SSH 连接失败，请检查主机、网络和 SSH 配置。",
            timeout: "SSH 连接或采样超时。", missing: "Windows 未找到 OpenSSH 客户端。" };
        const detail = d.state === "pending" ? "正在获取第一组读数…" : reason[d.error] || "采样已过期，等待采集器更新。";
        nodes.push(caption(detail, 14, 43, 12, "$text", 367),
            caption(ageText(record.seen, now), 14, 62, 10, "$muted", 367));
    }
    const status = { state, label: name };
    if (record.live) {
        status.observed_at = d.at;
        status.expires_at = d.at + 150;
    }
    return { status, canvas: { height, nodes },
        ...(pinned ? {pinned} : {}),
        storage: { selected: d.id, records, rank, gpu: gpuIndex } };
}

function refresh(input) { return view(input); }
function action(input) { return view(input, input.action?.id); }


// Runs in macOS's system JavaScript interpreter. Read-only AppleSMC float keys.
// M4 sensor groups are documented in the Stats project's Modules/Sensors/values.swift.
function m4Temperatures() {
    ObjC.import("Foundation");
    ObjC.import("IOKit");
    ObjC.bindFunction("mach_task_self", ["unsigned int", []]);
    ObjC.bindFunction("IOConnectCallStructMethod", ["int",
        ["unsigned int", "unsigned int", "void *", "unsigned long", "void *", "void *"]]);
    const service = $.IOServiceGetMatchingService(0, $.IOServiceMatching("AppleSMC"));
    if (!service) return "";
    const port = Ref();
    const opened = $.IOServiceOpen(service, $.mach_task_self(), 0, port) === 0;
    $.IOObjectRelease(service);
    if (!opened) return "";
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    function data(bytes) {
        let encoded = "";
        for (let i = 0; i < bytes.length; i += 3) {
            const word = bytes[i] << 16 | (bytes[i + 1] || 0) << 8 | (bytes[i + 2] || 0);
            encoded += alphabet[word >> 18] + alphabet[word >> 12 & 63] +
                (i + 1 < bytes.length ? alphabet[word >> 6 & 63] : "=") +
                (i + 2 < bytes.length ? alphabet[word & 63] : "=");
        }
        return $.NSData.alloc.initWithBase64EncodedStringOptions($(encoded), 0);
    }
    function reading(key) {
        // 80-byte SMCKeyData: FourCC at 0, byte count at 28, read command at 42.
        const request = new Uint8Array(80);
        for (let i = 0; i < 4; i++) request[i] = key.charCodeAt(3 - i);
        request[28] = 4;
        request[42] = 5;
        const input = data(request), output = $.NSMutableData.dataWithLength(80);
        const count = data([80,0,0,0,0,0,0,0]).mutableCopy;
        if ($.IOConnectCallStructMethod(port[0], 2, input.bytes, 80, output.mutableBytes, count.mutableBytes)) return null;
        const encoded = ObjC.unwrap(output.base64EncodedStringWithOptions(0));
        const bytes = [];
        let bits = 0, word = 0;
        for (const c of encoded) {
            if (c === "=") break;
            word = word << 6 | alphabet.indexOf(c);
            bits += 6;
            if (bits >= 8) { bits -= 8; bytes.push(word >> bits & 255); }
        }
        if (bytes[40] || bytes.length < 52) return null;
        const t = new DataView(Uint8Array.from(bytes).buffer).getFloat32(48, true);
        // Power-gated M4 sensors may report values close to zero when idle.
        return t >= 5 && t <= 130 ? t : null;
    }
    const lines = [];
    try {
        const groups = {cpuTemp: "Te05 Te0S Te09 Te0H Tp01 Tp05 Tp09 Tp0D Tp0V Tp0Y Tp0b Tp0e",
            gpuTemp: "Tg0G Tg0H Tg1U Tg1k Tg0K Tg0L Tg0d Tg0e Tg0j Tg0k"};
        for (const label of Object.keys(groups)) {
            const values = groups[label].split(" ").map(reading).filter(n => n !== null);
            if (values.length) lines.push(label + "=" + (values.reduce((a,b) => a+b, 0) / values.length).toFixed(1));
        }
    } finally { $.IOServiceClose(port[0]); }
    return lines.join("\n");
}

// Optional Windows-side entry point: node main.js --collect user@linux my-mac
// ssh receives a constant POSIX script on stdin. No host name is interpolated in it.
function startCollector(targets) {
    const fixed = targets.map(address);
    if (fixed.length > 4 || fixed.some(t => !t) || new Set(fixed.map(t => t.id)).size !== fixed.length)
        throw Error("最多填写四个不同的 SSH 地址，或仅用 --collect 跟随岛仔的设置。");
    const http = require("node:http");
    const { execFile } = require("node:child_process");
    const probe = String.raw`export LC_ALL=C
os=$(uname -s) || exit 3
case "$os" in
Linux)
    # The first eight aggregate fields exclude the guest counters already in user/nice.
    cpu_sample() { awk '/^cpu / {s=0; for(i=2;i<=9;i++) s+=$i; printf "%.0f %.0f\n",s,$5+$6; exit}' /proc/stat; }
    first=$(cpu_sample)
    sleep 1
    second=$(cpu_sample)
    awk -v p="$first" -v q="$second" 'BEGIN {
        split(p,a); split(q,b); delta=b[1]-a[1];
        if(delta>0) printf "cpu=%.2f\n",100*(delta-b[2]+a[2])/delta
    }'
    awk '/^cpu[0-9]+ /{n++} END{print "cores=" n+0}' /proc/stat
    awk '$1=="MemTotal:"{m=$2} $1=="MemAvailable:"{a=$2;found=1}
        END{if(m && found) printf "memTotal=%.0f\nmemUsed=%.0f\n",m*1024,(m-a)*1024}' /proc/meminfo
    iface=$(awk '$2=="00000000" && $8=="00000000" && (!found || $7+0<metric){metric=$7+0; nic=$1; found=1} END{print nic}' /proc/net/route 2>/dev/null)
    if [ -n "$iface" ]; then
        awk -v nic="$iface:" '$1==nic {print "iface=" substr(nic,1,length(nic)-1); print "rx=" $2; print "tx=" $10}' /proc/net/dev
    fi
    if command -v nvidia-smi >/dev/null 2>&1; then
        nvidia-smi --query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null |
            awk -F ', *' 'NF==5 {print "nvidia=" $1 "|" $2 "|" $3 "|" $4 "|" $5}'
    fi
    for card in /sys/class/drm/card[0-9]*; do
        [ -r "$card/device/vendor" ] && [ "$(cat "$card/device/vendor")" = 0x1002 ] || continue
        case "$card" in *-*) continue;; esac
        dev="$card/device"
        read_stat() { [ -r "$1" ] && cat "$1"; }
        temp=$(read_stat "$dev"/hwmon/hwmon*/temp1_input)
        printf 'amd=%s|%s|%s|%s|%s\n' "$(basename "$card")" "$(read_stat "$dev/gpu_busy_percent")" "$temp" "$(read_stat "$dev/mem_info_vram_used")" "$(read_stat "$dev/mem_info_vram_total")"
    done
    for sensor in /sys/class/hwmon/hwmon*; do
        [ -r "$sensor/name" ] || continue
        case "$(cat "$sensor/name")" in coretemp|k10temp|cpu_thermal|zenpower)
            for entry in "$sensor"/temp*_input; do
                [ ! -r "$entry" ] || cat "$entry"
            done;;
        esac
    done | awk '/^[0-9]+$/ && $1>0 && $1<=140000 {if($1>max) max=$1} END{if(max) print "cpuTemp=" max/1000}'
    processes=$(ps -eo pid=,rss=,pcpu=,nlwp=,comm= 2>/dev/null)
    volume=/
    ;;
Darwin)
    # Keep the second top sample, which measures a one-second interval.
    # Reuse the CPU interval for the four most threaded tasks.
    top -l 2 -s 1 -n 4 -o threads -stats pid,threads,command | awk '
        /^CPU usage:/ {n=0; for(i=2;i<=NF;i++) if($i=="idle"){s=$(i-1);gsub(/%/,"",s);cpu=100-s;seen=1}}
        $1~/^[0-9]+$/ && $2~/^[0-9]+(\/[0-9]+)?$/ && n<4 {
            pid=$1; count=$2+0; sub(/^[[:space:]]*[0-9]+[[:space:]]+[0-9\/]+[[:space:]]+/,"");sub(/[[:space:]]+$/,"");
            rows[++n]="threads=" pid "|" count "|" $0}
        END{if(seen) printf "cpu=%.2f\n",cpu; for(i=1;i<=n;i++) print rows[i]}'
    chip=$(sysctl -n machdep.cpu.brand_string 2>/dev/null)
    printf 'chip=%s\n' "$chip"
    ioreg -r -c IOAccelerator -d 1 -l -w 0 2>/dev/null | awk '/"PerformanceStatistics" = / {
        gsub(/[{}]/,""); n=split($0,parts,",")
        for(i=1;i<=n;i++){
            if(match(parts[i],/"Device Utilization %"=[0-9]+/)){v=substr(parts[i],RSTART,RLENGTH);sub(/.*=/,"",v);print "gpuLoad=" v}
            if(match(parts[i],/"In use system memory"=[0-9]+/)){v=substr(parts[i],RSTART,RLENGTH);sub(/.*=/,"",v);print "gpuShared=" v}
        } exit}'
    case "$chip" in "Apple M4"*)
        /usr/bin/osascript -l JavaScript 2>/dev/null <<'M4_SENSOR_JS'
(${m4Temperatures.toString()})()
M4_SENSOR_JS
        ;;
    esac
    processes=$(ps -A -o pid=,rss=,pcpu=,ucomm= 2>/dev/null | awk '{
        pid=$1; rss=$2; cpu=$3;sub(/^[[:space:]]*[0-9]+[[:space:]]+[0-9]+[[:space:]]+[0-9.]+[[:space:]]+/,"");
        print pid,rss,cpu,0,$0}')
    printf 'cores=%s\n' "$(sysctl -n hw.logicalcpu)"
    total=$(sysctl -n hw.memsize)
    # Approximate physical memory in use: active, wired and compressed pages.
    vm_stat | awk -v total="$total" '/page size of/ {for(i=1;i<=NF;i++) if($i=="of") page=$(i+1)}
        /^Pages active:/ {a=$NF+0; have=1} /^Pages wired down:/ {w=$NF+0}
        /^Pages occupied by compressor:/ {c=$NF+0}
        END{if(have && page>0 && total>0) printf "memTotal=%.0f\nmemUsed=%.0f\n",total,(a+w+c)*page}'
    iface=$(route -n get default 2>/dev/null | awk '/interface:/{print $2;exit}')
    if [ -n "$iface" ]; then
        netstat -ibn -I "$iface" | awk -v nic="$iface" '$1=="Name" {for(i=1;i<=NF;i++) {
            if($i=="Ibytes") rx=i; if($i=="Obytes") tx=i}}
            $1==nic && $3~/^<Link#/ && rx && tx {print "iface=" nic;print "rx=" $rx;print "tx=" $tx;exit}'
    fi
    volume=/
    [ ! -d /System/Volumes/Data ] || volume=/System/Volumes/Data
    ;;
*) exit 3 ;;
esac
# Sort one snapshot locally. Only four process names and values per ranking cross SSH.
rank_processes() {
    printf '%s\n' "$processes" | sort -k"$2","$2"nr | awk -v kind="$1" -v col="$2" '
        NR<=4 && $1~/^[0-9]+$/ && $col~/^[0-9.]+$/ {pid=$1; value=$col; $1=$2=$3=$4=""; sub(/^[ ]+/,"");sub(/[ ]+$/,"");print kind "=" pid "|" value "|" $0}'
}
rank_processes mem 2
rank_processes cpuRank 3
[ "$os" != Linux ] || rank_processes threads 4
printf 'os=%s\n' "$os"
df -Pk "$volume" | awk 'NR==2 {gsub(/%/,"",$5); printf "diskTotal=%.0f\ndiskPct=%s\n",$2*1024,$5}'
`;
    // The SDK supplies the reader a fixed loopback URL. The companion reads only
    // this plugin's saved record from the local install, never writes settings.
    const fs = require("node:fs"), path = require("node:path");
    const dataDir = process.env.DAOZAI_DATA_DIR || path.join(process.env.APPDATA, "Daozai");
    const recordPath = path.join(dataDir, "local-plugins", "local-zhongzhuojun.service.json");
    let current = new Map();
    let issue, lastRequest = 0, lastCheck = 0;
    function config() {
        if (fixed.length) return { targets: fixed.map((t, i) => ({ ...t, slot: i + 1 })) };
        try {
            const record = JSON.parse(fs.readFileSync(recordPath, "utf8").replace(/^\uFEFF/, ""));
            if (record.package?.manifest?.id !== "zhongzhuojun.service") return { issue: "插件安装记录不匹配。" };
            if (!record.enabled) return { issue: "请在岛仔中启用服务器监视。" };
            if (!record.package.manifest.settings?.some(s => s.key === "host1"))
                return { issue: "请安装新版服务器监视，再填写 SSH 地址。" };
            return savedTargets(record.values || {});
        } catch (_) { return { issue: "请从本地模板安装并启用服务器监视。" }; }
    }
    function update() {
        const now = Date.now();
        if (now - lastCheck < 1000) return;
        lastCheck = now;
        const next = config();
        issue = next.issue;
        const entries = new Map();
        for (const target of next.targets || []) {
            const entry = current.get(target.id) || { sample: { id: target.id, state: "pending" }, last: 0 };
            entry.slot = target.slot;
            entries.set(target.id, entry);
            if (now - entry.last >= 30000) {
                entry.last = now;
                collect(target, entry);
            }
        }
        current = entries;
    }
    const sshOptions = ["-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes",
        "-o", "ClearAllForwardings=yes", "-o", "ForwardAgent=no", "-o", "ForwardX11=no",
        "-o", "ConnectTimeout=6", "-o", "ConnectionAttempts=1"];
    function collect(target, entry) {
        const {host, port, id} = target;
        const child = execFile("ssh", [...sshOptions, "-p", String(port), host, "sh -s"], {
            timeout: 15000, maxBuffer: 64 * 1024, windowsHide: true, encoding: "utf8"
        }, (err, stdout, stderr) => {
            const fields = Object.create(null);
            const ranks = { mem: [], cpu: [], threads: [] }, gpus = [];
            for (const line of stdout.split(/\r?\n/)) {
                const m = /^([a-zA-Z]+)=(.+)$/.exec(line);
                if (!m) continue;
                const [, key, value] = m;
                if (key === "nvidia" || key === "amd") {
                    const [name, load, temp, used, total] = value.split("|");
                    const number = (v, scale) => /^\d+(\.\d+)?$/.test(v) ? Number(v) * scale : null;
                    const unit = key === "amd" ? 1 : 1048576;
                    if (gpus.length < 32) gpus.push({ name: (key === "amd" ? "AMD " : "") + name.slice(0, 50),
                        load: number(load, 1), temp: number(temp, key === "amd" ? 0.001 : 1),
                        used: number(used, unit), total: number(total, unit) });
                } else if (["mem", "threads", "cpuRank"].includes(key)) {
                    const row = /^(\d+)\|(\d+(?:\.\d+)?)\|(.+)$/.exec(value);
                    const list = ranks[key === "cpuRank" ? "cpu" : key];
                    if (row && list.length < 4) list.push({ pid: Number(row[1]), value: Number(row[2]) * (key === "mem" ? 1024 : 1),
                        name: row[3].replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 50) });
                } else fields[key] = value;
            }
            const cpu = Number(fields.cpu);
            let error;
            if (err?.killed) error = "timeout";
            else if (err?.code === "ENOENT") error = "missing";
            else if (/host key verification failed|host identification has changed/i.test(stderr)) error = "trust";
            else if (/permission denied|authentication failed/i.test(stderr)) error = "auth";
            else if (err?.code === 3) error = "system";
            else if (err) error = "ssh";
            else if (!bounded(cpu, 0, 100) || !["Linux", "Darwin"].includes(fields.os)) error = "system";
            const at = Math.floor(Date.now() / 1000);
            if (error) {
                if (entry.sample.error !== error) console.error(id + " · " + error + " · " + stderr.trim().split(/\r?\n/).slice(-1)[0]);
                entry.sample = { id, state: "offline", error, at };
                return;
            }
            const result = { id, state: "ready", at, cpu, os: fields.os === "Darwin" ? "macOS" : "Linux" };
            for (const key of ["cores", "memTotal", "memUsed", "diskTotal", "diskPct", "rx", "tx"]) {
                if (/^\d+$/.test(fields[key]) && Number.isSafeInteger(Number(fields[key]))) result[key] = Number(fields[key]);
            }
            if (bounded(Number(fields.cpuTemp), -30, 140)) result.cpuTemp = Number(fields.cpuTemp);
            if (fields.os === "Darwin" && (fields.gpuLoad !== undefined || fields.gpuTemp !== undefined)) {
                const apple = /^Apple M/.test(fields.chip || "");
                gpus.push({ name: apple ? fields.chip.slice(0, 48) : "GPU", shared: apple,
                    load: Number(fields.gpuLoad), temp: Number(fields.gpuTemp),
                    used: apple ? Number(fields.gpuShared) : null });
            }
            result.gpus = gpus;
            result.ranks = ranks;
            if (fields.iface) result.iface = fields.iface.slice(0, 40);
            if (entry.sample.state !== "ready") console.log(id + " · " + result.os + " · 已连接");
            entry.sample = result;
        });
        child.stdin.on("error", () => {}); // SSH may exit before consuming stdin.
        child.stdin.end(probe.replace(/\r\n/g, "\n"));
    }
    const server = http.createServer((req, res) => {
        if (req.method !== "GET" || req.url !== "/status" || req.headers.host !== "127.0.0.1:17863") {
            res.writeHead(404).end();
            return;
        }
        lastRequest = Date.now();
        update();
        const devices = Array.from(current.values(), e => ({ ...e.sample, slot: e.slot }));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ version: 1, devices, issue }));
    });
    server.on("error", err => {
        console.error("采集器无法监听 " + ENDPOINT + " · " + err.message);
        process.exitCode = 1;
    });
    server.listen(17863, "127.0.0.1", () => {
        console.log("岛仔授权地址 " + ENDPOINT + "\n每 30 秒采样，Ctrl+C 停止。");
        if (fixed.length) update();
        setInterval(() => { if (fixed.length || Date.now() - lastRequest < 90000) update(); }, 5000);
    });
}

if (typeof module !== "undefined" && typeof require === "function" && require.main === module) {
    try {
        if (process.argv[2] !== "--collect") throw Error("用法：node main.js --collect");
        startCollector(process.argv.slice(3));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
