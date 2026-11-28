// 今天吃什么 · 岛仔插件
// 交互：待选页「开始」→ 抽签页「换一个 / 重新来」；筛选条件在插件设置里调整。
// 菜品库格式：[名称, 分类, 荤素(0素/1荤/2均可), 辣度(0不辣/1微辣/2重辣)]

var DISHES = [
    // 米饭
    ["咖喱鸡肉饭", "rice", 1, 0],
    ["黑椒牛柳饭", "rice", 1, 0],
    ["台式卤肉饭", "rice", 1, 0],
    ["照烧鸡腿饭", "rice", 1, 0],
    ["黄焖鸡米饭", "rice", 1, 1],
    ["猪脚饭", "rice", 1, 0],
    ["广式煲仔饭", "rice", 1, 0],
    ["韩式石锅拌饭", "rice", 2, 1],
    ["日式鳗鱼饭", "rice", 1, 0],
    ["番茄牛肉盖饭", "rice", 1, 0],
    ["宫保鸡丁饭", "rice", 1, 1],
    ["鱼香肉丝饭", "rice", 1, 1],
    ["蛋炒饭", "rice", 2, 0],
    ["扬州炒饭", "rice", 2, 0],
    ["回锅肉盖饭", "rice", 1, 1],
    ["麻婆豆腐饭", "rice", 2, 1],
    // 面食
    ["兰州牛肉面", "noodle", 1, 1],
    ["刀削面", "noodle", 1, 1],
    ["炸酱面", "noodle", 1, 0],
    ["热干面", "noodle", 1, 0],
    ["重庆小面", "noodle", 1, 2],
    ["油泼面", "noodle", 1, 1],
    ["葱油拌面", "noodle", 2, 0],
    ["鸡丝凉面", "noodle", 1, 0],
    ["酸辣粉", "noodle", 2, 1],
    ["螺蛳粉", "noodle", 1, 1],
    ["过桥米线", "noodle", 1, 0],
    ["桂林米粉", "noodle", 1, 1],
    ["猪肉白菜水饺", "noodle", 1, 0],
    ["韭菜鸡蛋饺子", "noodle", 2, 0],
    ["煎饺", "noodle", 1, 0],
    ["鲜肉包子", "noodle", 1, 0],
    ["生煎包", "noodle", 1, 0],
    ["馄饨", "noodle", 1, 0],
    ["阳春面", "noodle", 2, 0],
    // 家常菜
    ["红烧肉", "home", 1, 0],
    ["可乐鸡翅", "home", 1, 0],
    ["宫保鸡丁", "home", 1, 1],
    ["鱼香肉丝", "home", 1, 1],
    ["麻婆豆腐", "home", 2, 1],
    ["回锅肉", "home", 1, 1],
    ["青椒肉丝", "home", 1, 0],
    ["番茄炒蛋", "home", 2, 0],
    ["糖醋排骨", "home", 1, 0],
    ["农家小炒肉", "home", 1, 1],
    ["辣子鸡", "home", 1, 2],
    ["酸菜鱼", "home", 1, 1],
    ["水煮牛肉", "home", 1, 2],
    ["清蒸鲈鱼", "home", 1, 0],
    ["油焖大虾", "home", 1, 0],
    ["白灼虾", "home", 1, 0],
    ["干煸四季豆", "home", 2, 1],
    ["地三鲜", "home", 0, 0],
    ["手撕包菜", "home", 0, 0],
    ["蒜蓉西兰花", "home", 0, 0],
    ["凉拌黄瓜", "home", 0, 0],
    ["皮蛋豆腐", "home", 0, 0],
    ["红烧茄子", "home", 0, 0],
    ["鱼香茄子", "home", 2, 1],
    ["京酱肉丝", "home", 1, 0],
    ["糖醋里脊", "home", 1, 0],
    ["锅包肉", "home", 1, 0],
    ["孜然牛肉", "home", 1, 1],
    ["土豆炖牛肉", "home", 1, 0],
    ["啤酒鸭", "home", 1, 0],
    ["香菇滑鸡", "home", 1, 0],
    ["番茄牛腩", "home", 1, 0],
    // 快餐外卖
    ["汉堡薯条", "fast", 1, 0],
    ["炸鸡套餐", "fast", 1, 0],
    ["韩式炸鸡", "fast", 1, 1],
    ["披萨", "fast", 1, 0],
    ["意大利面", "fast", 1, 0],
    ["三明治", "fast", 1, 0],
    ["轻食沙拉", "fast", 0, 0],
    ["寿司", "fast", 2, 0],
    ["麻辣烫", "fast", 1, 2],
    ["冒菜", "fast", 1, 2],
    ["沙县小吃", "fast", 1, 0],
    ["鸡排", "fast", 1, 0],
    ["肉夹馍", "fast", 1, 0],
    ["煎饼果子", "breakfast", 2, 0],
    ["手抓饼", "fast", 2, 0],
    ["关东煮", "fast", 2, 0],
    ["烤冷面", "fast", 2, 1],
    ["肠粉", "breakfast", 1, 0],
    // 火锅烧烤
    ["重庆火锅", "feast", 1, 2],
    ["潮汕牛肉火锅", "feast", 1, 0],
    ["椰子鸡火锅", "feast", 1, 0],
    ["韩式部队锅", "feast", 2, 1],
    ["日式寿喜锅", "feast", 1, 0],
    ["麻辣香锅", "feast", 2, 2],
    ["烧烤撸串", "feast", 1, 1],
    ["烤鱼", "feast", 1, 1],
    ["韩式烤肉", "feast", 1, 0],
    ["自助餐", "feast", 1, 0],
    // 早餐（国民早餐榜单常见款）
    ["豆浆油条", "breakfast", 0, 0],
    ["皮蛋瘦肉粥", "breakfast", 1, 0],
    ["小米粥", "breakfast", 0, 0],
    ["八宝粥", "breakfast", 0, 0],
    ["茶叶蛋", "breakfast", 2, 0],
    ["豆腐脑", "breakfast", 0, 0],
    ["小笼包", "breakfast", 1, 0],
    ["灌汤包", "breakfast", 1, 0],
    ["烧麦", "breakfast", 1, 0],
    ["糯米鸡", "breakfast", 1, 0],
    ["鸡蛋灌饼", "breakfast", 2, 0],
    ["胡辣汤", "breakfast", 1, 1],
    ["牛奶麦片", "breakfast", 0, 0],
    ["疙瘩汤", "breakfast", 2, 0],
    ["粢饭团", "breakfast", 2, 0],
    // 地方菜系
    ["白切鸡", "region", 1, 0],
    ["蜜汁叉烧", "region", 1, 0],
    ["老火靓汤", "region", 1, 0],
    ["莲藕排骨汤", "region", 1, 0],
    ["剁椒鱼头", "region", 1, 2],
    ["毛血旺", "region", 1, 2],
    ["钵钵鸡", "region", 1, 1],
    ["小鸡炖蘑菇", "region", 1, 0],
    ["猪肉炖粉条", "region", 1, 0],
    ["酱骨架", "region", 1, 0],
    ["新疆大盘鸡", "region", 1, 1],
    ["手抓羊肉", "region", 1, 0],
    ["羊肉泡馍", "region", 1, 0],
    ["酸汤鱼", "region", 1, 1],
    ["东坡肉", "region", 1, 0],
    ["西湖醋鱼", "region", 1, 0],
    ["腌笃鲜", "region", 1, 0],
    ["盐水鸭", "region", 1, 0],
    ["北京烤鸭", "region", 1, 0],
    ["臭鳜鱼", "region", 1, 0],
    // 外卖热门补充
    ["鸡公煲", "feast", 1, 1],
    ["肉蟹煲", "feast", 1, 1],
    ["猪肚鸡", "feast", 1, 0],
    ["麻辣拌", "fast", 1, 2],
    ["烤肉拌饭", "fast", 1, 0],
    ["凉皮", "fast", 0, 1],
    ["狼牙土豆", "fast", 0, 1],
    ["肥牛饭", "rice", 1, 0],
    ["咖喱猪排饭", "rice", 1, 0],
    ["花甲粉", "noodle", 1, 1],
    ["干炒牛河", "noodle", 1, 0]
];

var CAT_LABEL = { rice: "米饭", noodle: "面食", home: "家常菜", fast: "快餐外卖", feast: "火锅烧烤", breakfast: "早餐", region: "地方菜", custom: "自定义" };

// 筛选用大类：米饭/面食合并为「米饭面食」，地方菜/火锅烧烤合并为「地方风味」
var CAT_FILTER_LABEL = { all: "全部", home: "家常菜", staple: "米饭面食", breakfast: "早餐", fast: "快餐外卖", treat: "地方风味" };
var CAT_FILTER = {
    all: null,
    home: { home: 1 },
    staple: { rice: 1, noodle: 1 },
    breakfast: { breakfast: 1 },
    fast: { fast: 1 },
    treat: { region: 1, feast: 1 }
};
var MEAT_LABEL = { any: "荤素不忌", meat: "偏爱荤", veg: "偏爱素" };
var MEAT_TAG = { 0: "素", 1: "荤", 2: "荤素" };
var SPICY_LABEL = { any: "辣度随意", mild: "微辣可以", none: "不吃辣" };
var SPICY_TAG = { 0: "不辣", 1: "微辣", 2: "重辣" };

var TIPS = {
    rice: ["配碗热汤，这顿更舒坦。", "米管够，别客气。"],
    noodle: ["趁热呼噜一碗，踏实。", "加点醋，更提味。"],
    home: ["记得多添一碗米饭。", "趁热吃，锅气才在。"],
    fast: ["配杯无糖茶，负担小一点。", "趁热吃，口感最佳。"],
    feast: ["人多才热闹，记得约上朋友。", "留点肚子，慢慢享受。"],
    breakfast: ["早餐要吃好，一天精神足。", "趁热吃，胃也跟着醒。"],
    region: ["一方水土一方味，尝尝正宗的。", "下馆子就要吃得讲究。"],
    custom: ["自己收藏的菜，怎么做都对味。", "私房菜登场，今天的幸运儿。"]
};

// 个别菜品的专属贴士（优先于类别贴士，避免文案与菜对不上）
var TIP_OVERRIDES = {
    "猪肉白菜水饺": ["蘸醋配蒜，才是饺子的仪式感。", "刚出锅的饺子最香。"],
    "韭菜鸡蛋饺子": ["素馅清爽，蘸点醋更鲜。", "皮薄馅大，趁热吃。"],
    "煎饺": ["脆底蘸醋，一口一个。", "配碗小米粥，妥了。"],
    "鲜肉包子": ["配碗小米粥或豆浆，舒服。", "刚出锅的最香。"],
    "生煎包": ["先开窗后喝汤，小心烫。", "脆底蘸醋，越嚼越香。"],
    "馄饨": ["连汤带馅，呼噜一碗暖胃。", "撒点香菜虾皮，鲜掉眉毛。"],
    "蛋炒饭": ["粒粒分明才算合格。", "葱花炒香是关键。"],
    "扬州炒饭": ["料足饭香，粒粒分明。", "配碗清汤，解腻。"],
    "鸡丝凉面": ["凉面就图个清爽。", "花生碎多加点，香。"],
    "寿司": ["芥末别贪多，酱油轻蘸。", "先清淡后浓郁，按顺序吃。"],
    "轻食沙拉": ["酱汁最后淋，口感更清爽。", "加颗水煮蛋，蛋白质够了。"],
    "汉堡薯条": ["薯条趁热，凉了就软了。", "饮料换无糖，舒服。"],
    "烤鱼": ["配份宽粉土豆，越煮越香。", "先吃鱼，再涮菜。"],
    "韩式烤肉": ["生菜包肉，一口满足。", "配碗冷面解腻。"],
    "自助餐": ["先逛一圈再拿，别急。", "少拿多次，吃遍全场。"],
    "烧烤撸串": ["趁热撸串，别客套。", "荤素搭配，来点烤蔬菜。"],
    "麻辣香锅": ["荤素自由搭配，一锅端。", "配碗米饭，辣得刚好。"],
    "羊肉泡馍": ["掰馍越小越入味。", "糖蒜配羊肉，绝了。"],
    "北京烤鸭": ["卷饼蘸酱，一口酥香。", "鸭架汤别忘了。"],
    "臭鳜鱼": ["闻着臭吃着香，大胆试。", "鱼肉呈蒜瓣状才算正宗。"],
    "酸汤鱼": ["酸辣开胃，先喝汤。", "鱼肉嫩滑，别煮老。"],
    "花甲粉": ["汤底拌粉，鲜到掉眉。", "粉丝吸满汤汁才好吃。"]
};

var RELAXED_NOTE = "当前筛选没有可选的菜，已放宽条件帮你选";

// ---- 紧凑卡片布局（自绘画布，颜色全部用皮肤令牌，跟随岛仔材质） ----
// 版式：菜名 + 属性标签居中成组 → 按钮 → 一行小贴士（切换即时刷新，保持跟手）
var CANVAS_W = 387;
var MARGIN = 16;
var CONTENT_W = CANVAS_W - MARGIN * 2;

function centerAll(totalW) {
    if (totalW >= CONTENT_W) return MARGIN;
    return Math.round((CANVAS_W - totalW) / 2);
}

// 中文字符按全宽估算，其余按 0.56 倍宽估算（用于标签定位，误差由 max_width 兜底）
function estWidth(text, size) {
    var w = 0;
    for (var i = 0; i < text.length; i++) {
        var c = text.charCodeAt(i);
        w += c >= 0x2E80 ? size : size * 0.56;
    }
    return w;
}

function chipRowWidth(labels) {
    var w = 0;
    for (var i = 0; i < labels.length; i++) {
        w += Math.round(estWidth(labels[i], 13)) + 18 + (i > 0 ? 6 : 0);
    }
    return w;
}

function chipNodes(label, x, y, index) {
    var w = Math.round(estWidth(label, 13)) + 18;
    return {
        nodes: [
            { id: "chip" + index + "-bg", rect: [x, y, w, 24], r: 12, fill: "$accent", opacity: 0.16 },
            { id: "chip" + index + "-tx", text: label, at: [x + 9, y + 17], size: 13, fill: "$accent", max_width: w - 14, lines: 1 }
        ],
        width: w
    };
}

// 标签优先排在名称右侧（起点由调用方按居中结果给出）；放不下则整体居中落到名称下方独立一行
function layoutChips(labels, startX, beside) {
    var nodes = [];
    var x = beside ? startX : centerAll(chipRowWidth(labels));
    var y = beside ? 16 : 50;
    for (var i = 0; i < labels.length; i++) {
        var chip = chipNodes(labels[i], x, y, i);
        if (x + chip.width > CANVAS_W - MARGIN) {
            if (y >= 50) break;
            y = 50;
            x = centerAll(chipRowWidth(labels));
            chip = chipNodes(labels[i], x, y, i);
            if (x + chip.width > CANVAS_W - MARGIN) break;
        }
        nodes.push(chip.nodes[0], chip.nodes[1]);
        x += chip.width + 6;
    }
    return { nodes: nodes, bottom: y + 24 };
}

function buttonNodes(label, x, y, primary, actionId) {
    var w = 150;
    var tw = estWidth(label, 16);
    return [
        { id: "btn-" + actionId, rect: [x, y, w, 38], r: 19, fill: primary ? "$accent" : "$track",
          hit: { action: actionId } },
        { id: "btn-" + actionId + "-tx", text: label, at: [x + Math.round((w - tw) / 2), y + 25], size: 16,
          fill: primary ? "#FFFFFF" : "$text",
          hit: { action: actionId } }
    ];
}

// 标题与标签成组后整体居中；放不下时标题单独居中，标签落到下方独立行
function titleNodes(text, chipsWidth, beside) {
    var nameW = Math.round(estWidth(text, 28));
    if (beside) {
        var cap = Math.round(CONTENT_W - 12 - chipsWidth);
        return {
            id: "title",
            text: text, at: [centerAll(Math.min(nameW, cap) + 12 + chipsWidth), 42],
            size: 28, weight: 600, fill: "$text", max_width: cap, lines: 1
        };
    }
    return {
        id: "title",
        text: text, at: [centerAll(Math.min(nameW, CONTENT_W)), 42],
        size: 28, weight: 600, fill: "$text", max_width: CONTENT_W, lines: 1
    };
}

function pageIdle(input, settings) {
    var chips = [
        CAT_FILTER_LABEL[(settings && settings.cat) || "all"] || "全部",
        MEAT_LABEL[(settings && settings.meat) || "any"] || "荤素不忌",
        SPICY_LABEL[(settings && settings.spicy) || "any"] || "辣度随意"
    ];
    var chipsW = chipRowWidth(chips);
    var nameW = Math.round(estWidth("今天吃什么", 28));
    var beside = nameW + 12 + chipsW <= CONTENT_W;
    var title = titleNodes("今天吃什么", chipsW, beside);
    var cap = Math.round(CONTENT_W - 12 - chipsW);
    var chipsL = layoutChips(chips, title.at[0] + Math.min(nameW, cap) + 12, beside);
    var nodes = [title].concat(chipsL.nodes);
    var gy = chipsL.bottom + 18;
    // 问候语居中，前置一个小咖啡图标
    var line = greeting(input);
    var gW = Math.round(estWidth(line, 14));
    var withIcon = 24 + gW <= CONTENT_W;
    var gx = withIcon ? centerAll(24 + gW) : centerAll(Math.min(gW, CONTENT_W));
    if (withIcon) {
        nodes.push({ id: "greet-icon", icon: "coffee", rect: [gx, gy - 15, 17, 17], fill: "$accent" });
    }
    nodes.push({
        id: "greet",
        text: line,
        at: [withIcon ? gx + 23 : gx, gy], size: 14, fill: "$muted",
        max_width: withIcon ? CONTENT_W - 24 : CONTENT_W, lines: 1
    });
    var by = gy + 14;
    nodes = nodes.concat(buttonNodes("开始", centerAll(150), by, true, "start"));
    return { canvas: { height: by + 50, nodes: nodes }, status: { state: "idle", label: "今天吃什么" } };
}

function pagePicked(dish, relaxed) {
    var h = hashOf(dish[0]);
    var tags = [CAT_LABEL[dish[1]] || dish[1]];
    if (dish[1] !== "custom") {
        tags.push(MEAT_TAG[dish[2]]);
        tags.push(SPICY_TAG[dish[3]]);
    }
    var chipsW = chipRowWidth(tags);
    var nameW = Math.round(estWidth(dish[0], 28));
    var beside = nameW + 12 + chipsW <= CONTENT_W;
    var title = titleNodes(dish[0], chipsW, beside);
    var cap = Math.round(CONTENT_W - 12 - chipsW);
    var chipsL = layoutChips(tags, title.at[0] + Math.min(nameW, cap) + 12, beside);
    var nodes = [title].concat(chipsL.nodes);
    var by = chipsL.bottom + 16;
    var bx = centerAll(314);
    nodes = nodes.concat(buttonNodes("换一个", bx, by, true, "reroll"));
    nodes = nodes.concat(buttonNodes("重新来", bx + 164, by, false, "reset"));
    var tips = TIP_OVERRIDES[dish[0]] || TIPS[dish[1]] || TIPS.custom;
    var note = relaxed ? RELAXED_NOTE : tips[(h >>> 3) % tips.length];
    nodes.push({
        id: "note",
        text: note,
        at: [centerAll(Math.min(Math.round(estWidth(note, 13)), CONTENT_W)), by + 56],
        size: 13, fill: relaxed ? "$accent" : "$muted", max_width: CONTENT_W, lines: 1
    });
    return {
        canvas: { height: by + 70, nodes: nodes },
        status: { state: "succeeded", label: dish[0] }
    };
}

// 以下为工具函数：脚本每次调用都从头运行，页面内容必须只由输入决定。

function hashOf(name) {
    var h = 5381;
    for (var i = 0; i < name.length; i++) {
        h = ((h * 33) ^ name.charCodeAt(i)) >>> 0;
    }
    return h;
}

function parseCustomNames(settings) {
    var names = [];
    try {
        var arr = JSON.parse((settings && settings.custom) || "[]");
        if (Object.prototype.toString.call(arr) === "[object Array]") {
            for (var i = 0; i < arr.length; i++) {
                var one = arr[i];
                var n = one && typeof one.name === "string" ? one.name.trim() : "";
                if (n && names.indexOf(n) < 0) names.push(n);
            }
        }
    } catch (e) { /* 设置损坏时忽略自定义菜 */ }
    return names;
}

// 合并内置库与用户私房菜（私房菜归类 custom，不受筛选影响，始终可选）
function buildPool(settings) {
    var list = DISHES.slice();
    var names = parseCustomNames(settings);
    for (var i = 0; i < names.length; i++) {
        list.push([names[i], "custom", 2, 0]);
    }
    return list;
}

function filterDishes(list, settings) {
    var catKey = (settings && settings.cat) || "all";
    var catMap = CAT_FILTER[catKey] || null;
    var meat = (settings && settings.meat) || "any";
    var spicy = (settings && settings.spicy) || "any";
    var out = [];
    for (var i = 0; i < list.length; i++) {
        var d = list[i];
        if (d[1] === "custom") { out.push(i); continue; }
        if (catMap && !catMap[d[1]]) continue;
        if (meat === "veg" && d[2] === 1) continue;
        if (meat === "meat" && d[2] === 0) continue;
        if (spicy === "none" && d[3] > 0) continue;
        if (spicy === "mild" && d[3] > 1) continue;
        out.push(i);
    }
    return out;
}

function pickDish(list, indices, currentName) {
    var candidates = [];
    for (var i = 0; i < indices.length; i++) {
        if (list[indices[i]][0] !== currentName) candidates.push(indices[i]);
    }
    if (candidates.length === 0) {
        for (var j = 0; j < indices.length; j++) candidates.push(indices[j]);
    }
    if (candidates.length === 0) return null;
    return list[candidates[Math.floor(Math.random() * candidates.length)]];
}

function findDish(list, name) {
    if (!name) return null;
    for (var i = 0; i < list.length; i++) {
        if (list[i][0] === name) return list[i];
    }
    return null;
}

// 按本机时段给出不同的开场白（now 为 Unix 毫秒，tz 为本机时区）
function greeting(input) {
    var line = "选择困难？点「开始」，帮你随机决定这一顿！";
    try {
        var now = typeof input.now === "number" ? input.now : Date.now();
        var offset = (input.tz && typeof input.tz.offset_minutes === "number")
            ? input.tz.offset_minutes
            : -new Date().getTimezoneOffset();
        var hour = new Date(now + offset * 60000).getUTCHours();
        if (hour >= 5 && hour < 10) line = "早上好！今天早餐吃点啥？点「开始」抽一个！";
        else if (hour < 14) line = "午饭时间到！纠结吃什么？点「开始」帮你选！";
        else if (hour < 21) line = "晚饭想好了吗？点「开始」，今天就吃它！";
        else line = "夜宵时刻！晚上的胃是另一个胃，点「开始」！";
    } catch (e) { /* 时间不可用时用默认文案 */ }
    return line;
}

function refresh(input) {
    input = input || {};
    var settings = input.settings || {};
    var storage = input.storage || {};
    var list = buildPool(settings);
    var picked = findDish(list, storage.picked);
    if (picked) {
        var page = pagePicked(picked, false);
        page.storage = { picked: picked[0] };
        return page;
    }
    // 上次抽中的菜已不存在（如删掉了私房菜）→ 回到待选页并清掉旧记录
    if (storage.picked) {
        var cleared = pageIdle(input, settings);
        cleared.storage = { picked: null };
        return cleared;
    }
    return pageIdle(input, settings);
}

function action(input) {
    input = input || {};
    var settings = input.settings || {};
    var storage = input.storage || {};
    var id = input.action && input.action.id;
    var list = buildPool(settings);

    if (id === "start" || id === "reroll") {
        var indices = filterDishes(list, settings);
        var relaxed = indices.length === 0;
        if (relaxed) {
            indices = [];
            for (var i = 0; i < list.length; i++) indices.push(i);
        }
        var dish = pickDish(list, indices, storage.picked || null);
        if (!dish) {
            var empty = pageIdle(input, settings);
            empty.storage = { picked: null };
            return empty;
        }
        var page = pagePicked(dish, relaxed);
        page.storage = { picked: dish[0] };
        return page;
    }

    if (id === "reset") {
        var idle = pageIdle(input, settings);
        idle.storage = { picked: null };
        return idle;
    }

    // 未知动作：按当前存储重建页面
    var picked = findDish(list, storage.picked);
    if (picked) {
        var again = pagePicked(picked, false);
        again.storage = { picked: picked[0] };
        return again;
    }
    var back = pageIdle(input, settings);
    back.storage = { picked: null };
    return back;
}
