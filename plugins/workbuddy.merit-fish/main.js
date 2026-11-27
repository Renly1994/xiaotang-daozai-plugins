const GOLD = "#FFD25A";
const WOOD = {
    deep: "#6B3F18",
    base: "#8C5727",
    body: "#B87A3E",
    light: "#DDA76B",
    rim: "#5E3813"
};

// 木鱼：正面椭圆中心 (96, 124)，rx 68 / ry 44，顶部中点正好落在 (96, 80)
const HEAD_R = 11.5;
const HANDLE_X = 38;
const HANDLE_Y = 30;
const CONTACT_POS = [96, 72];   // 槌头圆心：木鱼敲击时会下沉 3，球底贴住下沉后的顶沿 83
const RAISED_POS = [96, 54];    // 与落点同一竖线，抬回时不会横跳
const LIFT = CONTACT_POS[1] - RAISED_POS[1];   // 18：靠 bind 在 1 秒内抬回的距离

// 版面：木鱼整体右移，右侧数字区居中，把中间那段空白压掉
const STAGE_DX = 20;
const TEXT_X = 287;
const GREEN = "#3DDC84";   // 连击中但还没进档

// 重置图标：经典双箭头循环（一上一下相对），画在 18×18 容器里居中。
// 宿主不支持 SVG 的 A 圆弧命令，两段圆弧都展开成 C 贝塞尔，宿主和预览器都能画。
// 上弧右端箭头朝下、下弧左端箭头朝上，箭头尖端贴合各自弧端。
const RESET_ICON = "M4.06 6.37C5.03 4.54 6.93 3.40 9.00 3.40C11.07 3.40 12.97 4.54 13.94 6.37 M14.40 4.22L13.94 6.37L11.90 5.55 M13.94 11.63C12.97 13.46 11.07 14.60 9.00 14.60C6.93 14.60 5.03 13.46 4.06 11.63 M3.60 13.78L4.06 11.63L6.10 12.45";

// 连击阶梯：0 档普通、1 档每下 ×2、2 档每下 ×4（封顶二档）。
// 档位只看「当前连击数」，断一次 combo 归 1，直接回 0 档，不会掉回一档。
const TIER_MULT = [1, 2, 4];

function tierOf(combo, need) {
    if (combo >= need * 2) return 2;
    if (combo >= need) return 1;
    return 0;
}

function toInt(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
}

// 允许负数：扣功德会把累计值扣成负的
function comma(value) {
    const number = Math.trunc(Number(value) || 0);
    const text = String(Math.abs(number));
    let out = "";
    for (let index = 0; index < text.length; index++) {
        if (index > 0 && (text.length - index) % 3 === 0) out += ",";
        out += text[index];
    }
    return (number < 0 ? "-" : "") + out;
}

// 超时时长：不足 1 小时说分钟，跨小时说「4小时30分」，避免出现「超时270分钟」这种读不动的数字
function humanGap(sec) {
    const min = Math.max(1, Math.floor(sec / 60));
    if (min < 60) return `${min}分钟`;
    const hour = Math.floor(min / 60);
    const rest = min % 60;
    return rest ? `${hour}小时${rest}分` : `${hour}小时`;
}

function ellipse(cx, cy, rx, ry) {
    const ox = rx * 0.5523;
    const oy = ry * 0.5523;
    return `M${cx - rx} ${cy}C${cx - rx} ${cy - oy} ${cx - ox} ${cy - ry} ${cx} ${cy - ry}`
        + `C${cx + ox} ${cy - ry} ${cx + rx} ${cy - oy} ${cx + rx} ${cy}`
        + `C${cx + rx} ${cy + oy} ${cx + ox} ${cy + ry} ${cx} ${cy + ry}`
        + `C${cx - ox} ${cy + ry} ${cx - rx} ${cy + oy} ${cx - rx} ${cy}Z`;
}

// "08:00" → 28800 秒
function parseClock(value, fallback) {
    const text = typeof value === "string" ? value.trim() : "";
    const match = /^(\d{1,2}):(\d{2})$/.exec(text);
    if (!match) return fallback;
    const hour = clamp(toInt(match[1], 0), 0, 23);
    const minute = clamp(toInt(match[2], 0), 0, 59);
    return hour * 3600 + minute * 60;
}

// 两个时间点之间，真正落在「扣除时段」里的秒数。
// 只按本地时钟判断，跨天/跨多天都能算；支持的窗口可以跨夜（如 22:00–06:00）。
function inWindowSeconds(fromMs, toMs, startSec, endSec, offsetSec) {
    if (!(toMs > fromMs)) return 0;
    if (startSec === endSec) return Math.floor((toMs - fromMs) / 1000);

    const DAY = 86400000;
    const offsetMs = offsetSec * 1000;
    let cursor = Math.floor((fromMs + offsetMs) / DAY) * DAY - DAY;   // 从前一天零点开始扫
    let total = 0;
    let guard = 0;
    while (cursor <= toMs && guard < 900) {
        const base = cursor - offsetMs;
        const start = base + startSec * 1000;
        const end = base + endSec * 1000 + (endSec <= startSec ? DAY : 0);   // 跨夜窗口落到次日
        const from = Math.max(fromMs, start);
        const to = Math.min(toMs, end);
        if (to > from) total += Math.floor((to - from) / 1000);
        cursor += DAY;
        guard++;
    }
    return total;
}

function fishBody() {
    return [
        { path: ellipse(96, 130, 68, 44), fill: WOOD.deep },
        { path: ellipse(96, 124, 68, 44), fill: WOOD.body },
        { path: "M48 100C76 90 116 89 138 99", stroke: "#3A2008", width: 5.5, cap: "round" },
        { path: ellipse(138, 99, 3.5, 4.5), fill: "#3A2008" }
    ];
}

// 木鱼：被敲时下沉 3px，同样不能靠第二帧复位，下沉量也交给 bind 走回去
function fishNode(down) {
    return {
        id: "fish",
        translate: down ? [0, { bind: "dip", map: [3, 0] }] : [0, 0],
        group: fishBody()
    };
}

// 连击档位光环：一档淡金单环，二档双层亮金——不写文字，靠光的强弱表达倍率。
// 关键：光环必须跟数字用同一个「连击间隔」淡出绑定，否则停手后数字褪回白、光环却要等
// 下一次定时刷新（≥60s）才消失。opacity 走 bind 后，宿主逐帧重绘，到点自动熄灭。
function haloNode(tier) {
    const fade = { opacity: { bind: "tint", map: [1, 0] } };
    if (tier >= 2) {
        return [
            { path: ellipse(96, 128, 77, 52), stroke: "#FFD25A8C", width: 2.4, glow: true, ...fade },
            { path: ellipse(96, 128, 84, 55), stroke: "#FFD25A42", width: 1.4, glow: true, ...fade }
        ];
    }
    return [{ path: ellipse(96, 128, 74, 50), stroke: "#FFD25A66", width: 2, glow: true, ...fade }];
}

// 槌子：原点在槌头圆心，木柄朝右上；落下时压腕，抬起时抬腕
function malletNode(down) {
    return {
        id: "mallet",
        translate: down ? CONTACT_POS : RAISED_POS,
        rotate: down ? 2 : -14,
        animate: { ms: down ? 120 : 240, ease: "spring" },   // 引擎下限就是 120，写 110 会整帧报"画面有误"
        group: [
            { line: [0, 0, HANDLE_X, -HANDLE_Y], stroke: WOOD.base, width: 8, cap: "round" },
            { line: [HANDLE_X * 0.62, -HANDLE_Y * 0.62, HANDLE_X, -HANDLE_Y], stroke: WOOD.deep, width: 8, cap: "round" },
            { circle: [0, 0, HEAD_R], fill: WOOD.body },
            { circle: [0, 0, HEAD_R], stroke: WOOD.rim, width: 2 },
            { path: "M-6 -4C-3.7 -7 -0.4 -8.1 2.9 -7.9", stroke: WOOD.light, width: 2, cap: "round" }
        ]
    };
}

// 落槌那一帧：把槌子套进一个父节点，父节点的 translate 交给 bind。
// 原因：next_refresh_at 到点的定时帧只重算、不重绘画布，靠第二帧抬不回来；
// 而 binds 是宿主逐帧重绘的通道（官方的倒计时、表盘都靠它），所以抬回必须用它。
function malletStack(down) {
    const node = malletNode(down);
    if (!down) return node;
    return {
        id: "swing",
        translate: [0, { bind: "lift", map: [0, -LIFT] }],
        group: [node]
    };
}

function computeState(input) {
    const ms = Number(input.now);
    const nowMs = Number.isFinite(ms) ? Math.trunc(ms) : 0;
    const sec = Math.floor(nowMs / 1000);
    const settings = input.settings || {};
    const saved = input.storage || {};
    const offsetMin = input.tz && Number.isFinite(input.tz.offset_minutes)
        ? Math.trunc(input.tz.offset_minutes) : 0;
    const offsetSec = offsetMin * 60;

    const rawTitle = typeof settings.title === "string" ? settings.title.trim() : "";
    const title = rawTitle ? [...rawTitle].slice(0, 6).join("") : "功德";
    const step = clamp(toInt(settings.step, 1), 1, 10000);
    const comboNeed = clamp(toInt(settings.combo, 20), 2, 999);
    const gapSec = clamp(toInt(settings.gap_sec, 1), 1, 120);
    const idleSec = clamp(toInt(settings.idle_min, 30), 1, 1440) * 60;
    const penSec = clamp(toInt(settings.penalty_min, 2), 1, 240) * 60;
    const penStep = clamp(toInt(settings.penalty_step, 1), 1, 10000);
    const winStart = parseClock(settings.active_start, 8 * 3600);
    const winEnd = parseClock(settings.active_end, 19 * 3600);
    const id = (input.action && input.action.id) || "";

    // 累计功德允许为负（超时扣除会扣到负数）
    let total = toInt(saved.total, 0);
    let combo = Math.max(0, toInt(saved.combo, 0));
    let lastMs = Math.max(0, toInt(saved.last_knock_ms, toInt(saved.knock_ms, 0)));
    let away = Math.max(0, toInt(saved.away_sec, 0));
    let penalized = Math.max(0, toInt(saved.penalized, 0));
    let tickMs = Math.max(0, toInt(saved.tick_ms, lastMs));   // 老版本没有 tick_ms：从上次敲击开始算空档
    let knockSec = Math.max(0, toInt(saved.knock_sec, 0));

    // 1) 一键重置：功德数值右下角的小图标按钮，点一次清一次（设置页没有按钮类型）
    if (id === "reset") {
        total = 0;
        combo = 0;
        lastMs = 0;
        away = 0;
        penalized = 0;
        knockSec = 0;
        tickMs = nowMs;   // 从此刻重新计空档，否则重置完会立刻把刚才那段算成超时
    }

    // 2) 把「自上次结算以来、落在生效时段内」的时长累到空档计时里。
    //    「停手」指敲过以后再停：从未敲过（lastMs=0）不累计，避免刚启用就凭空扣分。
    if (lastMs > 0 && tickMs > 0 && nowMs > tickMs) {
        away += inWindowSeconds(tickMs, nowMs, winStart, winEnd, offsetSec);
    }
    tickMs = nowMs;

    // 3) 超时扣功德：超过 idleSec 之后，每 penSec 扣 penStep
    let penaltyNow = 0;
    const over = away - idleSec;
    const target = over > 0 ? Math.min(100000, Math.floor(over / penSec) * penStep) : 0;
    if (target > penalized) {
        penaltyNow = target - penalized;
        total -= penaltyNow;
        penalized = target;
    }

    // 4) 敲击：连击延续则累加 combo，档位由 combo 决定（×1 / ×2 / ×4）
    let gain = 0;
    const aliveBefore = lastMs > 0 && nowMs - lastMs <= gapSec * 1000;
    let tier = aliveBefore ? tierOf(combo, comboNeed) : 0;
    let mult = TIER_MULT[tier];

    if (id === "knock") {
        combo = aliveBefore ? combo + 1 : 1;
        tier = tierOf(combo, comboNeed);
        mult = TIER_MULT[tier];
        gain = step * mult;
        total += gain;
        lastMs = nowMs;
        away = 0;
        penalized = 0;
        knockSec = sec;
    }

    // 5) 超时提示：只有「此刻仍在生效时段内 + 确实已经扣过」才出红字，
    //    避免半夜打开面板挂着一行已经停止扣除的提示。
    const inWindowNow = inWindowSeconds(nowMs - 1000, nowMs, winStart, winEnd, offsetSec) > 0;
    const overSec = Math.max(0, away - idleSec);
    const overtime = overSec > 0 && penalized > 0 && inWindowNow;

    // 7) 此刻算不算「还在连击中」：决定累计数用绿色（连击）还是白色（没敲）
    const alive = lastMs > 0 && nowMs - lastMs <= gapSec * 1000;

    // 6) 落槌帧
    const down = knockSec > 0 && sec <= knockSec;

    let nextRefresh;
    if (down) {
        nextRefresh = knockSec + 1;        // 下一个整秒抬槌
    } else {
        nextRefresh = sec + 60;            // 每分钟结算一次超时扣功德
    }

    return {
        title, step, total, combo, comboNeed, gapSec, mult, tier, gain, down,
        penaltyNow, knockSec, lastMs, away, penalized, tickMs, nextRefresh,
        overtime, overSec, alive
    };
}

function toCanvas(state) {
    const { total, title, down, gain, tier, alive } = state;
    const nodes = [];
    const stage = [];

    stage.push({ path: ellipse(96, 178, 46, 6), fill: "#00000026" });
    if (tier > 0) stage.push(...haloNode(tier));
    stage.push(fishNode(down));
    stage.push(malletStack(down));

    // 敲击反馈：金色迸溅 + 上浮淡出的 +N
    if (gain > 0) {
        const spark = { stroke: GOLD, width: 2.2, cap: "round", opacity: { bind: "spark", map: [1, 0] } };
        stage.push({ path: "M58 72L48 64", ...spark });
        stage.push({ path: "M134 72L144 64", ...spark });
        stage.push({ path: "M62 96L52 102", ...spark });
        stage.push({ path: "M130 96L140 102", ...spark });
        stage.push({
            text: `${title} +${comma(gain)}`, at: [46, 58], size: 12.5,
            align: "center", weight: 800, fill: GOLD, max_width: 96,
            translate: [0, { bind: "rise", map: [0, -14] }],
            opacity: { bind: "flash", map: [1, 0] }
        });
    }

    nodes.push({ translate: [STAGE_DX, 0], group: stage });

    // 整块木鱼都能点；不给 hover 提示，避免鼠标划过就弹「敲一下」
    nodes.push({ rect: [6 + STAGE_DX, 10, 184, 172], r: 60, fill: "#00000000", hit: { action: "knock" } });

    const shown = comma(total);
    const size = shown.length <= 4 ? 46 : shown.length <= 6 ? 38 : shown.length <= 8 ? 30 : 24;
    nodes.push({ text: `累计${title}`, at: [TEXT_X, 82], size: 12, align: "center", fill: "$muted" });
    // 白字打底：没敲击时的常态
    nodes.push({ text: shown, at: [TEXT_X, 126], size, align: "center", weight: 800, fill: "$text", max_width: 186 });

    // 连击中在上面盖一层彩色字：没翻倍=绿，翻倍=金。
    // 用 binds 在「连击间隔上限」内淡出——定时帧不会重绘画布，只有 bind 能自己走完，
    // 所以停手后颜色会自己褪回白，不会一直挂在金色上。
    const tint = alive ? (tier > 0 ? GOLD : GREEN) : "";
    if (tint) {
        nodes.push({
            text: shown, at: [TEXT_X, 126], size, align: "center", weight: 800,
            fill: tint, max_width: 186, opacity: { bind: "tint", map: [1, 0] }
        });
    }

    // 超时提示：挂在累计数正下方，红字一行「超时20分钟 · 功德 -10」。
    // 时长按「已超出的部分」算（50 分钟 − 30 分钟宽限 = 20），扣除额取已结算的累计扣除。
    if (state.overtime) {
        const warn = `超时${humanGap(state.overSec)} · ${title} -${comma(state.penalized)}`;
        nodes.push({
            text: warn, at: [TEXT_X, 166], size: warn.length <= 14 ? 10.5 : 9.5,
            align: "center", weight: 700, fill: "#FF6B6B", max_width: 176
        });
    }

    // 功德数值右下方的重置图标：18px 深灰实心圆 + 灰白 C 形箭头。
    // 宿主把 hint 画在节点上方，按钮放到数值右侧且偏下，提示就落在数值右边，不压住数字。
    const bx = TEXT_X + Math.min(105, 40 + shown.length * 11);
    const by = 150;
    nodes.push({
        rect: [bx, by, 18, 18], r: 9, fill: "#2C3038",
        hover: { fill: "#454B54", hint: "功德归零" },
        hit: { action: "reset" }
    });
    nodes.push({
        translate: [bx, by],
        group: [{ path: RESET_ICON, stroke: "#E8EAED", width: 1.35, cap: "round" }]
    });

    const base = state.knockSec;
    const binds = {};
    // 落槌帧里木鱼/槌子都在用 bind，所以只要 down 就必须给这两个绑定；
    // 否则引用了不存在的 bind，整帧会被引擎拒掉。
    if (down) {
        binds.lift = { progress: [base, base + 1] };
        binds.dip = { progress: [base, base + 1] };
    }
    if (gain > 0) {
        binds.spark = { progress: [base, base + 1] };
        binds.flash = { progress: [base, base + 1] };
        binds.rise = { progress: [base, base + 1] };
    }
    // 彩色字在「连击间隔上限」这段时间里从实色褪到透明，露出底下的白字
    if (tint) {
        binds.tint = { progress: [base, base + state.gapSec] };
    }

    return {
        height: state.overtime ? 200 : 186,
        nodes,
        binds: Object.keys(binds).length ? binds : undefined
    };
}

function refresh(input) {
    const state = computeState(input);
    return {
        status: {
            state: "idle",
            label: state.title,
            summary: `累计 ${comma(state.total)}`
        },
        canvas: toCanvas(state),
        storage: {
            total: state.total,
            combo: state.combo,
            last_knock_ms: state.lastMs,
            away_sec: state.away,
            penalized: state.penalized,
            tick_ms: state.tickMs,
            knock_sec: state.knockSec
        },
        next_refresh_at: state.nextRefresh
    };
}

function action(input) {
    return refresh(input);
}
