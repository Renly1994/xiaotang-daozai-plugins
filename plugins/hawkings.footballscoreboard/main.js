// 足球比分牌 · 岛仔插件（api 1 / runtime js / owner status）
// 数据：ESPN 公开足球记分板 + 打包在本插件里的 2026-27 赛季赛程。
// 关注球队在比分牌详情页的「选球队」里点选，支持全部 112 支球队与队徽。

const ACCENT = "#35D07F";
const PRE_COLOR = "#63A9FF";
const DANGER = "#FF7A7A";
const MINUTE = 60;
const DAY_MS = 86400000;
const FOLLOW_LIMIT = 12;

// 中文名 -> ESPN 英文队名关键字。英文名可直接填，不必查表。
const ALIASES = {
    "曼城": ["manchester city", "man city"],
    "曼联": ["manchester united", "man united"],
    "利物浦": ["liverpool"],
    "阿森纳": ["arsenal"],
    "切尔西": ["chelsea"],
    "热刺": ["tottenham", "spurs"],
    "纽卡": ["newcastle"],
    "纽卡斯尔": ["newcastle"],
    "维拉": ["aston villa"],
    "布莱顿": ["brighton"],
    "西汉姆": ["west ham"],
    "水晶宫": ["crystal palace"],
    "埃弗顿": ["everton"],
    "富勒姆": ["fulham"],
    "狼队": ["wolves", "wolverhampton"],
    "伯恩茅斯": ["bournemouth"],
    "布伦特福德": ["brentford"],
    "诺丁汉森林": ["nottingham forest"],
    "利兹联": ["leeds"],
    "伯恩利": ["burnley"],
    "桑德兰": ["sunderland"],
    "皇马": ["real madrid"],
    "巴萨": ["barcelona"],
    "马竞": ["atletico madrid", "atletico"],
    "塞维利亚": ["sevilla"],
    "皇家社会": ["real sociedad"],
    "毕尔巴鄂": ["athletic bilbao", "athletic club"],
    "瓦伦西亚": ["valencia"],
    "比利亚雷亚尔": ["villarreal"],
    "贝蒂斯": ["real betis", "betis"],
    "尤文": ["juventus", "juve"],
    "国米": ["inter milan", "internazionale"],
    "国际米兰": ["inter milan", "internazionale"],
    "米兰": ["ac milan", "milan"],
    "那不勒斯": ["napoli"],
    "罗马": ["as roma", "roma"],
    "拉齐奥": ["lazio"],
    "亚特兰大": ["atalanta"],
    "佛罗伦萨": ["fiorentina"],
    "拜仁": ["bayern munich", "bayern"],
    "多特": ["borussia dortmund", "dortmund"],
    "勒沃库森": ["bayer leverkusen", "leverkusen"],
    "莱比锡": ["rb leipzig", "leipzig"],
    "法兰克福": ["eintracht frankfurt", "frankfurt"],
    "斯图加特": ["stuttgart"],
    "门兴": ["monchengladbach", "gladbach"],
    "不莱梅": ["werder bremen", "bremen"],
    "巴黎": ["paris saint germain", "psg"],
    "巴黎圣日耳曼": ["paris saint germain", "psg"],
    "马赛": ["marseille"],
    "里昂": ["lyon"],
    "摩纳哥": ["monaco"],
    "里尔": ["lille"],
    "本菲卡": ["benfica"],
    "波尔图": ["porto"],
    "葡萄牙体育": ["sporting cp", "sporting lisbon"],
    "阿贾克斯": ["ajax"],
    "埃因霍温": ["psv"],
    "费耶诺德": ["feyenoord"],
    "凯尔特人": ["celtic"],
    "流浪者": ["rangers"],
    "加拉塔萨雷": ["galatasaray"],
    "费内巴切": ["fenerbahce"],
    "贝西克塔斯": ["besiktas"],
    "上海海港": ["shanghai port"],
    "上海申花": ["shanghai shenhua"],
    "北京国安": ["beijing guoan"],
    "山东泰山": ["shandong taishan"],
    "成都蓉城": ["chengdu rongcheng"],
    "武汉三镇": ["wuhan three towns"],
    "天津津门虎": ["tianjin jinmen tiger"],
    "浙江队": ["zhejiang"],
    "青岛西海岸": ["qingdao west coast"],
    "青岛海牛": ["qingdao hainiu"],
    "长春亚泰": ["changchun yatai"],
    "深圳新鹏城": ["shenzhen peng city"],
    "梅州客家": ["meizhou hakka"],
    "南通支云": ["nantong zhiyun"],
    "国足": ["china", "china pr"],
    "中国队": ["china", "china pr"],
    "中国": ["china", "china pr"],
    "日本": ["japan"],
    "韩国": ["korea"],
    "阿根廷": ["argentina"],
    "巴西": ["brazil"],
    "法国": ["france"],
    "英格兰": ["england"],
    "西班牙": ["spain"],
    "德国": ["germany"],
    "意大利": ["italy"],
    "葡萄牙": ["portugal"],
    "荷兰": ["netherlands"],
    "比利时": ["belgium"],
    "克罗地亚": ["croatia"],
    "乌拉圭": ["uruguay"],
    "墨西哥": ["mexico"],
    "美国": ["usa", "united states"],
    "摩洛哥": ["morocco"],
    "瑞士": ["switzerland"],
    "丹麦": ["denmark"],
    "波兰": ["poland"],
    "塞尔维亚": ["serbia"],
    "土耳其": ["turkiye", "turkey"],
    "澳大利亚": ["australia"]
};

// 112 支球队（英超/西甲/意甲/德甲/法甲/中超），沙特联已移除。
const TEAM_CN = {
    "349": "伯恩茅斯", "359": "阿森纳", "362": "阿斯顿维拉", "337": "布伦特福德", "331": "布莱顿", "363": "切尔西", "388": "考文垂", "384": "水晶宫", "368": "埃弗顿", "370": "富勒姆", "306": "赫尔城", "373": "伊普斯维奇", "357": "利兹联", "364": "利物浦", "382": "曼城", "360": "曼联", "361": "纽卡斯尔", "393": "诺丁汉森林", "366": "桑德兰", "367": "热刺",
    "96": "阿拉维斯", "93": "毕尔巴鄂竞技", "1068": "马德里竞技", "83": "巴塞罗那", "85": "塞尔塔", "90": "拉科鲁尼亚", "3751": "埃尔切", "88": "西班牙人", "2922": "赫塔菲", "1538": "莱万特", "99": "马拉加", "97": "奥萨苏纳", "87": "桑坦德竞技", "101": "巴列卡诺", "244": "皇家贝蒂斯", "86": "皇家马德里", "89": "皇家社会", "243": "塞维利亚", "94": "瓦伦西亚", "102": "比利亚雷亚尔",
    "103": "AC米兰", "104": "罗马", "105": "亚特兰大", "107": "博洛尼亚", "2925": "卡利亚里", "2572": "科莫", "109": "佛罗伦萨", "4057": "弗洛西诺内", "3263": "热那亚", "110": "国际米兰", "111": "尤文图斯", "112": "拉齐奥", "113": "莱切", "4007": "蒙扎", "114": "那不勒斯", "115": "帕尔马", "3997": "萨索洛", "239": "都灵", "118": "乌迪内斯", "17530": "威尼斯",
    "598": "柏林联合", "131": "勒沃库森", "132": "拜仁慕尼黑", "124": "多特蒙德", "268": "门兴格拉德巴赫", "125": "法兰克福", "3841": "奥格斯堡", "122": "科隆", "127": "汉堡", "2950": "美因茨", "11420": "莱比锡", "126": "弗赖堡", "3307": "帕德博恩", "10388": "埃尔弗斯贝格", "133": "沙尔克04", "7911": "霍芬海姆", "134": "斯图加特", "137": "不莱梅",
    "172": "欧塞尔", "174": "摩纳哥", "7868": "昂热", "6997": "布雷斯特", "3236": "勒阿弗尔", "2697": "勒芒", "175": "朗斯", "166": "里尔", "273": "洛里昂", "167": "里昂", "176": "马赛", "2502": "尼斯", "6851": "巴黎FC", "160": "巴黎圣日耳曼", "169": "雷恩", "180": "斯特拉斯堡", "179": "图卢兹", "170": "特鲁瓦",
    "2052": "北京国安", "21355": "成都蓉城", "131704": "重庆铜梁龙", "22537": "大连英博", "8240": "河南队", "131705": "辽宁铁人", "21910": "青岛海牛", "22198": "青岛西海岸", "7521": "山东泰山", "15515": "上海海港", "977": "上海申花", "22199": "深圳新鹏城", "8239": "天津津门虎", "21506": "武汉三镇", "22536": "云南玉昆", "18203": "浙江队"
};
const CREST_IDS = new Set(["349", "359", "362", "337", "331", "363", "388", "384", "368", "370", "306", "373", "357", "364", "382", "360", "361", "393", "366", "367", "96", "93", "1068", "83", "85", "90", "3751", "88", "2922", "1538", "99", "97", "87", "101", "244", "86", "89", "243", "94", "102", "103", "104", "105", "107", "2925", "2572", "109", "4057", "3263", "110", "111", "112", "113", "4007", "114", "115", "3997", "239", "118", "17530", "598", "131", "132", "124", "268", "125", "3841", "122", "127", "2950", "11420", "126", "3307", "10388", "133", "7911", "134", "137", "172", "174", "7868", "6997", "3236", "2697", "175", "166", "273", "167", "176", "2502", "6851", "160", "169", "180", "179", "170", "2052", "21355", "131704", "22537", "8240", "131705", "21910", "22198", "7521", "15515", "977", "22199", "8239", "21506", "22536", "18203"]);
const TEAM_LEAGUE = {"349":"epl","359":"epl","362":"epl","337":"epl","331":"epl","363":"epl","388":"epl","384":"epl","368":"epl","370":"epl","306":"epl","373":"epl","357":"epl","364":"epl","382":"epl","360":"epl","361":"epl","393":"epl","366":"epl","367":"epl","96":"laliga","93":"laliga","1068":"laliga","83":"laliga","85":"laliga","90":"laliga","3751":"laliga","88":"laliga","2922":"laliga","1538":"laliga","99":"laliga","97":"laliga","87":"laliga","101":"laliga","244":"laliga","86":"laliga","89":"laliga","243":"laliga","94":"laliga","102":"laliga","103":"seriea","104":"seriea","105":"seriea","107":"seriea","2925":"seriea","2572":"seriea","109":"seriea","4057":"seriea","3263":"seriea","110":"seriea","111":"seriea","112":"seriea","113":"seriea","4007":"seriea","114":"seriea","115":"seriea","3997":"seriea","239":"seriea","118":"seriea","17530":"seriea","598":"bundesliga","131":"bundesliga","132":"bundesliga","124":"bundesliga","268":"bundesliga","125":"bundesliga","3841":"bundesliga","122":"bundesliga","127":"bundesliga","2950":"bundesliga","11420":"bundesliga","126":"bundesliga","3307":"bundesliga","10388":"bundesliga","133":"bundesliga","7911":"bundesliga","134":"bundesliga","137":"bundesliga","172":"ligue1","174":"ligue1","7868":"ligue1","6997":"ligue1","3236":"ligue1","2697":"ligue1","175":"ligue1","166":"ligue1","273":"ligue1","167":"ligue1","176":"ligue1","2502":"ligue1","6851":"ligue1","160":"ligue1","169":"ligue1","180":"ligue1","179":"ligue1","170":"ligue1","2052":"csl","21355":"csl","131704":"csl","22537":"csl","8240":"csl","131705":"csl","21910":"csl","22198":"csl","7521":"csl","15515":"csl","977":"csl","22199":"csl","8239":"csl","21506":"csl","22536":"csl","18203":"csl"};
const LEAGUE_TEAMS = {
    "epl": ["349", "359", "362", "337", "331", "363", "388", "384", "368", "370", "306", "373", "357", "364", "382", "360", "361", "393", "366", "367"],
    "laliga": ["96", "93", "1068", "83", "85", "90", "3751", "88", "2922", "1538", "99", "97", "87", "101", "244", "86", "89", "243", "94", "102"],
    "seriea": ["103", "104", "105", "107", "2925", "2572", "109", "4057", "3263", "110", "111", "112", "113", "4007", "114", "115", "3997", "239", "118", "17530"],
    "bundesliga": ["598", "131", "132", "124", "268", "125", "3841", "122", "127", "2950", "11420", "126", "3307", "10388", "133", "7911", "134", "137"],
    "ligue1": ["172", "174", "7868", "6997", "3236", "2697", "175", "166", "273", "167", "176", "2502", "6851", "160", "169", "180", "179", "170"],
    "csl": ["2052", "21355", "131704", "22537", "8240", "131705", "21910", "22198", "7521", "15515", "977", "22199", "8239", "21506", "22536", "18203"]
};
const LEAGUE_LABEL = { epl: "英超", laliga: "西甲", seriea: "意甲", bundesliga: "德甲", ligue1: "法甲", csl: "中超" };
const PICKER_LEAGUES = ["epl", "laliga", "seriea", "bundesliga", "ligue1", "csl"];

const LEAGUE_RULES = [
    ["uefa-champions-league", "欧冠"],
    ["uefa-europa-conference", "欧协联"],
    ["uefa-europa-league", "欧联"],
    ["uefa-nations", "欧国联"],
    ["uefa-euro", "欧洲杯"],
    ["fifa-world-cup", "世界杯"],
    ["fifa-club", "世俱杯"],
    ["english-premier-league", "英超"],
    ["english-fa-cup", "足总杯"],
    ["english-league-cup", "联赛杯"],
    ["english-championship", "英冠"],
    ["spanish-la-liga", "西甲"],
    ["spanish-copa", "国王杯"],
    ["italian-serie-a", "意甲"],
    ["italian-coppa", "意大利杯"],
    ["german-bundesliga", "德甲"],
    ["german-dfb", "德国杯"],
    ["french-ligue-1", "法甲"],
    ["french-coupe", "法国杯"],
    ["chinese-super-league", "中超"],
    ["afc-champions", "亚冠"],
    ["american-major-league-soccer", "美职联"],
    ["liga-mx", "墨超"],
    ["brazilian-serie-a", "巴甲"],
    ["argentine", "阿甲"],
    ["japanese-j1", "J1 联赛"],
    ["k-league", "K 联赛"],
    ["australian-a-league", "澳超"],
    ["copa-libertadores", "解放者杯"],
    ["concacaf", "中北美"]
];

const STATE_LABEL = { in: "进行中", pre: "未开赛", post: "完场", canceled: "已取消", postponed: "已延期" };
const STATE_RANK = { in: 0, pre: 1, post: 2, canceled: 3, postponed: 3 };

const CN_BY_ALIAS = {};
for (const name of Object.keys(ALIASES)) {
    for (const alias of ALIASES[name]) {
        const key = norm(alias);
        if (key && !CN_BY_ALIAS[key]) CN_BY_ALIAS[key] = name;
    }
}
CN_BY_ALIAS["china"] = "中国";
CN_BY_ALIAS["china pr"] = "中国";

function cnName(team) {
    if (team && team.id && TEAM_CN[team.id]) return TEAM_CN[team.id];
    const hay = norm([team.name, team.short].join(" "));
    let best = "";
    let bestLength = 0;
    for (const key of Object.keys(CN_BY_ALIAS)) {
        if (key.length > bestLength && hay.includes(key)) {
            best = CN_BY_ALIAS[key];
            bestLength = key.length;
        }
    }
    return best;
}

function clean(value) {
    return String(value == null ? "" : value).replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
}

function deaccent(text) {
    try {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (error) {
        return text;
    }
}

function norm(value) {
    return deaccent(clean(value).toLowerCase())
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function isCJK(value) {
    return /[\u4e00-\u9fff]/.test(value);
}

function pad(value) {
    return String(value).padStart(2, "0");
}

function cut(value, max) {
    const chars = [...clean(value)];
    return chars.length <= max ? chars.join("") : chars.slice(0, max - 1).join("") + "…";
}

function dayNumber(day) {
    const ms = Date.parse(day + "T00:00:00Z");
    return Number.isFinite(ms) ? Math.floor(ms / DAY_MS) : NaN;
}

function shiftDay(day, amount) {
    return new Date((dayNumber(day) + amount) * DAY_MS).toISOString().slice(0, 10);
}

function validDay(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(dayNumber(value));
}

function localParts(iso, offsetMinutes) {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return { day: "", time: "" };
    const local = new Date(ms + offsetMinutes * 60000);
    return { day: local.toISOString().slice(0, 10), time: local.toISOString().slice(11, 16) };
}

function clockText(ms, offsetMinutes) {
    const local = new Date(ms + offsetMinutes * 60000);
    return pad(local.getUTCHours()) + ":" + pad(local.getUTCMinutes());
}

function dayTitle(day) {
    const date = new Date(day + "T00:00:00Z");
    return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function dateHead(day, today) {
    const diff = dayNumber(day) - dayNumber(today);
    return diff === 0 || diff === 1 ? `${dayLabel(day, today)} · ${dayTitle(day)}` : dayTitle(day);
}

function dayLabel(day, today) {
    const diff = dayNumber(day) - dayNumber(today);
    if (diff === 0) return "今天";
    if (diff === 1) return "明天";
    if (diff === -1) return "昨天";
    return dayTitle(day);
}

function shortDay(day, today) {
    const diff = dayNumber(day) - dayNumber(today);
    if (diff === 0) return "今天";
    if (diff === 1) return "明天";
    if (diff === -1) return "昨天";
    const date = new Date(day + "T00:00:00Z");
    return `${date.getUTCMonth() + 1}.${date.getUTCDate()}`;
}

function listRows(value) {
    if (Array.isArray(value)) return value;
    try {
        const rows = JSON.parse(String(value == null ? "" : value));
        return Array.isArray(rows) ? rows : [];
    } catch (error) {
        return [];
    }
}

function teamFromId(id) {
    const key = clean(id);
    return {
        id: key,
        name: TEAM_CN[key] || key,
        short: TEAM_CN[key] || key,
        abbr: "",
        location: "",
        score: 0,
        pens: 0,
        crest: CREST_IDS.has(key) ? `crests/${key}.png` : ""
    };
}

function selectedTeams(settings, storage) {
    const teams = [];
    const add = id => {
        const key = clean(id);
        if (!key || key === "0" || key === "more" || !TEAM_CN[key]) return;
        if (teams.length >= FOLLOW_LIMIT || teams.some(team => team.id === key)) return;
        teams.push({
            id: key,
            raw: TEAM_CN[key],
            cjk: true,
            label: TEAM_CN[key],
            aliases: (ALIASES[TEAM_CN[key]] || []).slice(),
            tokens: [],
            known: true,
            crest: CREST_IDS.has(key) ? `crests/${key}.png` : ""
        });
    };
    // 球队只在岛体页面的「选球队」里选，设置页不再读取任何球队设置。
    for (const id of (storage && storage.following) || []) add(id);
    return teams;
}

function parseLegacyTeams(raw) {
    const names = String(raw == null ? "" : raw).split(/[,，、;；\n\r]+/).map(clean).filter(Boolean);
    const seen = [];
    const teams = [];
    for (const name of names) {
        const key = norm(name);
        if (!key || seen.includes(key)) continue;
        seen.push(key);
        teams.push(prepareTeam(name));
        if (teams.length >= 4) break;
    }
    return teams;
}

function prepareTeam(name) {
    const cjk = isCJK(name);
    let aliases = [];
    if (ALIASES[name]) {
        aliases = ALIASES[name].slice();
    } else if (cjk) {
        for (const key of Object.keys(ALIASES)) {
            if (name.includes(key) || key.includes(name)) aliases.push(...ALIASES[key]);
        }
    }
    return {
        id: "",
        raw: name,
        cjk,
        label: cjk ? name : "",
        aliases: [...new Set(aliases)],
        tokens: cjk ? [] : norm(name).split(" ").filter(token => token.length >= 2),
        known: !cjk || aliases.length > 0,
        crest: ""
    };
}

function teamHit(team, who) {
    if (who.id && team.id) return team.id === who.id;
    const hay = norm([team.name, team.short, team.abbr, team.location].join(" "));
    if (!hay) return false;
    for (const alias of who.aliases) {
        const key = norm(alias);
        if (key && hay.includes(key)) return true;
    }
    if (who.tokens.length && who.tokens.every(token => hay.includes(token))) return true;
    return false;
}

function scoreOf(value) {
    const number = parseInt(String(value == null ? "" : value), 10);
    return Number.isFinite(number) ? number : 0;
}

function teamOf(competitor) {
    const team = competitor.team || {};
    return {
        id: clean(team.id),
        name: clean(team.displayName) || clean(team.name) || "未知球队",
        short: clean(team.shortDisplayName) || clean(team.displayName) || "未知",
        abbr: clean(team.abbreviation),
        location: clean(team.location),
        score: scoreOf(competitor.score),
        pens: scoreOf(competitor.shootoutScore),
        crest: ""
    };
}

function crestOf(team) {
    return team && team.id && CREST_IDS.has(team.id) ? `crests/${team.id}.png` : "";
}

function matchState(status) {
    const type = String(status.name || "").toUpperCase();
    if (type.includes("CANCELED")) return "canceled";
    if (type.includes("POSTPONED") || type.includes("SUSPENDED")) return "postponed";
    return status.state === "in" ? "in" : status.state === "post" ? "post" : "pre";
}

function leagueOf(event, competition) {
    const slug = String((event.season && event.season.slug) || "").toLowerCase();
    for (const [key, name] of LEAGUE_RULES) {
        if (slug.includes(key)) return name;
    }
    const note = clean(competition.altGameNote);
    const lower = note.toLowerCase();
    if (lower.includes("premier league")) return "英超";
    if (lower.includes("la liga") || lower.includes("laliga")) return "西甲";
    if (lower.includes("serie a")) return "意甲";
    if (lower.includes("bundesliga")) return "德甲";
    if (lower.includes("ligue 1")) return "法甲";
    if (lower.includes("champions league")) return "欧冠";
    if (lower.includes("europa league")) return "欧联";
    if (lower.includes("conference league")) return "欧协联";
    if (lower.includes("world cup")) return "世界杯";
    if (lower.includes("super league")) return "中超";
    return note ? cut(note, 14) : "国际赛事";
}

const ROUND_LEAGUES = new Set(["英超", "西甲", "意甲", "德甲", "法甲", "中超"]);

function recordRound(competition) {
    const competitors = competition && Array.isArray(competition.competitors) ? competition.competitors : [];
    for (const competitor of competitors) {
        const records = Array.isArray(competitor.record) ? competitor.record : [];
        const total = records.find(row => String(row && row.type).toLowerCase() === "total") || records[0];
        const parts = clean(total && total.summary).split("-").map(value => Number(value));
        if (parts.length === 3 && parts.every(value => Number.isFinite(value))) {
            return parts[0] + parts[1] + parts[2] + 1;
        }
    }
    return 0;
}

function fixtureRound(homeId, awayId, date) {
    const day = String(date || "").slice(0, 10);
    for (const row of FIXTURES[homeId] || []) {
        if (String(row.d).slice(0, 10) !== day) continue;
        if (row.h === homeId && row.a === awayId) return Number(row.r) || 0;
    }
    return 0;
}

function buildMatch(event, whoList, today, offset) {
    if (!event || !event.competitions || !event.competitions[0]) return null;
    const competition = event.competitions[0];
    const status = (event.status && event.status.type) || (competition.status && competition.status.type) || {};
    const competitors = competition.competitors || [];
    const homeCompetitor = competitors.find(item => item.homeAway === "home") || competitors[0];
    const awayCompetitor = competitors.find(item => item.homeAway === "away") || competitors[1];
    if (!homeCompetitor || !awayCompetitor) return null;

    const home = teamOf(homeCompetitor);
    const away = teamOf(awayCompetitor);
    home.crest = crestOf(home);
    away.crest = crestOf(away);
    const homeWho = whoList.find(who => teamHit(home, who));
    const awayWho = whoList.find(who => teamHit(away, who));
    if (!homeWho && !awayWho) return null;

    const state = matchState(status);
    const kickoff = Date.parse(event.date);
    const local = localParts(event.date, offset);
    if (local.day !== today && local.day !== shiftDay(today, 1)) return null;
    const detail = clean(status.detail) || clean(status.shortDetail);
    const league = leagueOf(event, competition);
    const round = state === "pre" && ROUND_LEAGUES.has(league)
        ? (fixtureRound(home.id, away.id, event.date) || recordRound(competition))
        : 0;
    return {
        id: String(event.id || competition.id || `${local.day}-${home.abbr}-${away.abbr}`),
        day: local.day,
        time: local.time,
        kickoff: Number.isFinite(kickoff) ? kickoff : 0,
        state,
        detail: detail.replace(/′/g, "'").replace(/'/g, "′"),
        clock: Number((event.status && event.status.clock) || (competition.status && competition.status.clock)) || 0,
        league,
        round,
        venue: clean(competition.venue && competition.venue.fullName),
        home,
        away,
        homeWho,
        awayWho,
        labelHome: homeWho ? (homeWho.label || cnName(home) || home.short) : (cnName(home) || home.short),
        labelAway: awayWho ? (awayWho.label || cnName(away) || away.short) : (cnName(away) || away.short)
    };
}

const BOARD_KEYS = ["board", "chn"];

function parseSources(sources, whoList, today, offset) {
    const bag = sources && typeof sources === "object" ? sources : {};
    const byId = new Map();
    let readyCount = 0;
    let invalidCount = 0;
    let unconfigured = false;
    let events = 0;
    for (const key of BOARD_KEYS) {
        const source = bag[key];
        const status = source && typeof source.status === "string" ? source.status : "unconfigured";
        if (status !== "ready") {
            if (status === "unconfigured") unconfigured = true;
            continue;
        }
        let data;
        try {
            data = JSON.parse(source.text || "");
        } catch (error) {
            invalidCount += 1;
            continue;
        }
        const list = data && Array.isArray(data.events) ? data.events : [];
        events += list.length;
        for (const event of list) {
            const match = buildMatch(event, whoList, today, offset);
            if (match && !byId.has(match.id)) byId.set(match.id, match);
        }
        readyCount += 1;
    }
    if (readyCount) return { ready: true, parsed: true, status: "ready", matches: [...byId.values()], events };
    return {
        ready: false,
        parsed: invalidCount === 0,
        status: invalidCount ? "invalid" : unconfigured ? "unconfigured" : "offline",
        matches: [],
        events
    };
}

function fixtureMatch(item, whoList, offset) {
    const kickoff = Date.parse(item.d);
    if (!Number.isFinite(kickoff)) return null;
    const home = teamFromId(item.h);
    const away = teamFromId(item.a);
    home.crest = crestOf(home);
    away.crest = crestOf(away);
    const homeWho = whoList.find(who => who.id && who.id === item.h);
    const awayWho = whoList.find(who => who.id && who.id === item.a);
    if (!homeWho && !awayWho) return null;
    const local = localParts(item.d, offset);
    return {
        id: String(item.id || `${item.d}-${item.h}-${item.a}`),
        day: local.day,
        time: local.time,
        kickoff,
        state: "pre",
        detail: "未开赛",
        clock: 0,
        league: clean(item.l) || "联赛",
        round: Number(item.r) || 0,
        venue: "",
        home,
        away,
        homeWho,
        awayWho,
        labelHome: homeWho ? (homeWho.label || TEAM_CN[home.id] || home.short) : (TEAM_CN[home.id] || home.short),
        labelAway: awayWho ? (awayWho.label || TEAM_CN[away.id] || away.short) : (TEAM_CN[away.id] || away.short),
        bundled: true
    };
}

function fixtureNextMatches(teams, today, offset, now, seenIds) {
    const out = [];
    const minKick = now - 60000;
    for (const team of teams) {
        const rows = FIXTURES[team.id] || [];
        for (const item of rows) {
            const kickoff = Date.parse(item.d);
            if (!Number.isFinite(kickoff)) continue;
            if (kickoff < minKick) continue;
            const match = fixtureMatch(item, teams, offset);
            if (!match) continue;
            const key = `${match.day}-${match.home.id}-${match.away.id}`;
            if (!seenIds.has(match.id) && !seenIds.has(key)) {
                seenIds.add(match.id);
                seenIds.add(key);
                out.push(match);
            }
            break;
        }
    }
    return out;
}

function rankMatch(match) {
    return STATE_RANK[match.state] == null ? 9 : STATE_RANK[match.state];
}

function sortMatches(matches) {
    matches.sort((a, b) => {
        const rank = rankMatch(a) - rankMatch(b);
        if (rank) return rank;
        return a.state === "post" ? b.kickoff - a.kickoff : a.kickoff - b.kickoff;
    });
}

function summarize(match, today) {
    if (match.state === "in") {
        return `${match.labelHome} ${match.home.score}-${match.away.score} ${match.labelAway} ${match.detail || "LIVE"}`.trim();
    }
    if (match.state === "pre") {
        return `${match.labelHome} vs ${match.labelAway} ${shortDay(match.day, today)} ${match.time}`;
    }
    return `${match.labelHome} ${match.home.score}-${match.away.score} ${match.labelAway} 完场`;
}

function measure(text, size) {
    let width = 0;
    for (const char of String(text)) {
        if (/[\u2e80-\u9fff\uff00-\uffef]/.test(char)) width += size;
        else if (char === " ") width += size * 0.32;
        else if (/[ilI1.,:;'|]/.test(char)) width += size * 0.32;
        else width += size * 0.58;
    }
    return width;
}

function textNode(text, x, y, size, fill, extra) {
    return Object.assign({ text: String(text), at: [x, y], size, fill: fill || "$text" }, extra || {});
}

function statePill(match, today) {
    if (match.state === "in") return { text: match.detail ? `进行中 ${match.detail}` : "进行中", tone: "live" };
    if (match.state === "pre") return { text: `${dayLabel(match.day, today)} ${match.time} 开赛`, tone: "pre" };
    if (match.state === "post") return { text: match.detail && match.detail !== "FT" ? match.detail : "完场", tone: "post" };
    return { text: STATE_LABEL[match.state] || "未开赛", tone: "dead" };
}

function fitLabel(value, maxWidth, size) {
    const text = clean(value);
    if (measure(text, size) <= maxWidth) return text;
    let chars = [...text];
    while (chars.length > 1 && measure(chars.join("") + "…", size) > maxWidth) chars.pop();
    return chars.join("") + "…";
}

function pinDay(day, today) {
    const diff = dayNumber(day) - dayNumber(today);
    if (diff === 0) return "今";
    if (diff === 1) return "明";
    if (diff === -1) return "昨";
    const date = new Date(day + "T00:00:00Z");
    return `${date.getUTCMonth() + 1}.${date.getUTCDate()}`;
}

const SHORT_CN = {
    "拜仁慕尼黑": "拜仁", "多特蒙德": "多特", "巴黎圣日耳曼": "巴黎", "曼彻斯特联": "曼联", "曼彻斯特城": "曼城",
    "托特纳姆热刺": "热刺", "纽卡斯尔联": "纽卡", "阿斯顿维拉": "维拉", "西汉姆联": "西汉姆", "诺丁汉森林": "森林",
    "皇家马德里": "皇马", "巴塞罗那": "巴萨", "马德里竞技": "马竞", "国际米兰": "国米", "AC米兰": "米兰",
    "皇家社会": "皇社", "皇家贝蒂斯": "贝蒂斯", "比利亚雷亚尔": "黄潜", "门兴格拉德巴赫": "门兴", "沃尔夫斯堡": "狼堡",
    "尤文图斯": "尤文", "勒沃库森": "药厂", "RB莱比锡": "莱比锡", "格拉斯哥流浪者": "流浪者",
    "加拉塔萨雷": "加拉塔", "费内巴切": "费内",
    "上海海港": "海港", "上海申花": "申花", "北京国安": "国安", "山东泰山": "泰山", "成都蓉城": "蓉城", "武汉三镇": "三镇",
    "毕尔巴鄂竞技": "毕尔巴鄂", "桑坦德竞技": "桑坦德", "拉科鲁尼亚": "拉科", "弗洛西诺内": "弗洛西",
    "埃尔弗斯贝格": "埃尔弗", "巴黎FC": "巴黎FC", "斯特拉斯堡": "斯特拉斯",
    "重庆铜梁龙": "铜梁龙", "深圳新鹏城": "新鹏城", "天津津门虎": "津门虎", "青岛西海岸": "西海岸"
};

function shortCn(label) {
    const text = clean(label);
    return SHORT_CN[text] || text;
}

function pinnedPair(home, away, scoreText, tone, live) {
    const nodes = [];
    const homeCrest = crestOf(home);
    const awayCrest = crestOf(away);
    nodes.push({ rect: [29, 2, 38, 18], r: 9, fill: "$track" });
    nodes.push({ circle: [15.5, 11, 9], fill: "$track" });
    if (homeCrest) nodes.push({ image: homeCrest, rect: [8, 3.5, 15, 15], fit: "contain" });
    else nodes.push({ circle: [15.5, 11, 4], fill: "$muted" });
    nodes.push({ circle: [80.5, 11, 9], fill: "$track" });
    if (awayCrest) nodes.push({ image: awayCrest, rect: [73, 3.5, 15, 15], fit: "contain" });
    else nodes.push({ circle: [80.5, 11, 4], fill: "$muted" });
    const scoreSize = scoreText === "VS" ? 10 : 13;
    nodes.push(textNode(scoreText, 48, 15.5, scoreSize, "$text", {
        align: "center", weight: 800, max_width: 34
    }));
    return { canvas: { width: 96, height: 22, fit_width: true, nodes } };
}

function pinnedCanvas(match, today) {
    const live = match.state === "in";
    const scoreText = match.state === "pre" ? "VS" : `${match.home.score}-${match.away.score}`;
    const tone = live ? ACCENT : match.state === "pre" ? "$muted" : "$text";
    return pinnedPair(match.home, match.away, scoreText, tone, live);
}

function waitingPinned(teams, view) {
    if (teams.length >= 2) return pinnedPair(teams[0], teams[1], "—", "$muted", false);
    if (teams.length === 1) return pinnedPair(teams[0], null, "—", "$muted", false);
    return emptyPinned(teams, view);
}

function emptyPinned(teams, view) {
    const warn = teams.length > 0 && !view.ready;
    const body = warn ? "赛程暂不可用" : "点岛选球队";
    const max = 126;
    return {
        canvas: {
            width: 148,
            height: 22,
            fit_width: true,
            nodes: [
                { rect: [0, 0, 148, 22], r: 11, fill: "$track" },
                { circle: [10, 11, 3], fill: warn ? DANGER : "$muted" },
                textNode(fitLabel(body, max, 10), 18, 15.5, 10, "$text", { max_width: max })
            ]
        }
    };
}

function footer(nodes, height, view, now, offset) {
    const base = height - 7;
    const extra = view.matches.length > 4 ? ` · 还有 ${view.matches.length - 4} 场` : "";
    nodes.push(textNode(`更新 ${clockText(now, offset)}${extra}`, 8, base, 8.5, "$muted", { max_width: 210 }));
    nodes.push({
        rect: [242, base - 13, 58, 18], r: 5, fill: "$track",
        hover: { fill: "$card" }, hit: { action: "open-picker" }
    });
    nodes.push(textNode("选球队", 271, base - 1, 9, "$text", { align: "center" }));
    nodes.push({
        rect: [309, base - 13, 58, 18], r: 5, fill: "$track",
        hover: { fill: "$card" }, hit: { action: "refresh" }
    });
    nodes.push(textNode("刷新", 338, base - 1, 9, "$text", { align: "center" }));
}

function pickerCanvas(view, now, offset) {
    const nodes = [];
    const league = view.pickerLeague;
    const ids = LEAGUE_TEAMS[league] || [];
    const following = view.following || [];
    nodes.push(textNode("关注球队", 12, 22, 17, "$text", { weight: 800 }));
    nodes.push(textNode(`已选 ${following.length}/${FOLLOW_LIMIT}`, 375, 22, 9.5, "$muted", { align: "right" }));
    nodes.push(textNode("点队徽加入或移除，可跨联赛多选", 12, 38, 9, "$muted", { max_width: 300 }));

    for (let i = 0; i < PICKER_LEAGUES.length; i++) {
        const key = PICKER_LEAGUES[i];
        const x = 6 + i * 63;
        const active = key === league;
        nodes.push({
            rect: [x, 46, 58, 22], r: 6, fill: "$track",
            hover: { fill: "$card" }, hit: { action: `league_${key}` }
        });
        if (active) nodes.push({ rect: [x + 8, 65, 42, 2], r: 1, fill: ACCENT });
        nodes.push(textNode(LEAGUE_LABEL[key], x + 29, 60, 9.5, "$text", { align: "center", weight: active ? 700 : 400 }));
    }

    const startY = 72;
    const cellW = 91;
    const cellH = 46;
    const gapX = 4;
    const gapY = 4;
    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 6 + col * (cellW + gapX);
        const y = startY + row * (cellH + gapY);
        const on = following.includes(id);
        nodes.push({
            rect: [x, y, cellW, cellH], r: 7, fill: "$track",
            hover: { fill: "$card" }, hit: { action: `pick_${id}` }
        });
        if (on) nodes.push({ rect: [x, y, 3, cellH], r: 1.5, fill: ACCENT });
        const crest = CREST_IDS.has(id) ? `crests/${id}.png` : "";
        if (crest) nodes.push({ image: crest, rect: [x + 6, y + 12, 23, 23], fit: "contain" });
        else nodes.push({ circle: [x + 18, y + 24, 10], fill: "$muted" });
        nodes.push(textNode(fitLabel(shortCn(TEAM_CN[id] || id), 54, 10), x + 33, y + 22, 10, "$text", {
            weight: on ? 700 : 500, max_width: 54
        }));
        nodes.push(textNode(LEAGUE_LABEL[TEAM_LEAGUE[id]] || "", x + 33, y + 36, 8, "$muted", { max_width: 54 }));
    }

    const base = 338;
    nodes.push(textNode(following.length ? `已关注：${cut(following.map(id => TEAM_CN[id]).join("、"), 22)}` : "还没有关注球队", 12, base, 9, "$muted", { max_width: 250 }));
    nodes.push({
        rect: [256, base - 13, 58, 21], r: 6, fill: "$track",
        hover: { fill: "$card" }, hit: { action: "clear-following" }
    });
    nodes.push(textNode("清空", 285, base + 1, 9.5, "$text", { align: "center" }));
    nodes.push({
        rect: [319, base - 13, 62, 21], r: 6, fill: "$track",
        hover: { fill: "$card" }, hit: { action: "close-picker" }
    });
    nodes.push({ rect: [327, base + 8, 46, 2], r: 1, fill: ACCENT });
    nodes.push(textNode("完成", 350, base + 1, 9.5, "$text", { align: "center", weight: 700 }));
    return { height: 360, nodes };
}

function pageCanvas(view, now, offset) {
    if (view.picker) return pickerCanvas(view, now, offset);
    const nodes = [];
    if (!view.ready || !view.focus) {
        return emptyPage(view, now, offset);
    }

    const match = view.focus;
    const today = view.today;
    nodes.push({ rect: [8, 8, 3, 15], r: 1.5, fill: ACCENT });
    nodes.push(textNode(match.league, 16, 20, 11, "$text", { weight: 800, max_width: 150 }));
    nodes.push(textNode(dateHead(match.day, today), 379, 20, 9, "$muted", { align: "right", max_width: 170 }));

    // 队徽：半透明感由皮肤底色的圆环托住，再压一条很浅的底影。
    const homeCrest = crestOf(match.home);
    const awayCrest = crestOf(match.away);
    nodes.push({ circle: [38, 54, 27], fill: "$track" });
    nodes.push({ rect: [15, 81, 46, 3], r: 1.5, fill: "$track" });
    if (homeCrest) nodes.push({ image: homeCrest, rect: [11, 27, 54, 54], fit: "contain" });
    nodes.push({ circle: [349, 54, 27], fill: "$track" });
    nodes.push({ rect: [326, 81, 46, 3], r: 1.5, fill: "$track" });
    if (awayCrest) nodes.push({ image: awayCrest, rect: [322, 27, 54, 54], fit: "contain" });

    nodes.push(textNode(shortCn(match.labelHome), 8, 107, 23, "$text", {
        weight: 800, max_width: 150
    }));
    nodes.push(textNode(shortCn(match.labelAway), 379, 107, 23, "$text", {
        weight: 800, align: "right", max_width: 150
    }));

    const preMatch = match.state === "pre";
    nodes.push(textNode(preMatch ? "VS" : `${match.home.score} - ${match.away.score}`, 193.5, 68,
        preMatch ? 24 : 34, "$text", {
            align: "center", weight: 800, max_width: 120,
            ...(match.state === "in" ? { id: `score-${match.id}`, animate: { ms: 220, ease: "linear" } } : {})
        }));

    const pill = statePill(match, today);
    const pillWidth = Math.min(168, measure(pill.text, 9.5) + 18);
    const pillLeft = 193.5 - pillWidth / 2;
    nodes.push({ rect: [pillLeft, 112, pillWidth, 20], r: 10, fill: "$track" });
    if (pill.tone === "live") nodes.push({ circle: [pillLeft + 9, 122, 3], fill: ACCENT });
    nodes.push(textNode(pill.text, 193.5 + (pill.tone === "live" ? 4 : 0), 126, 9.5, "$text", {
        align: "center", weight: 700, max_width: pillWidth - 14
    }));

    const subline = match.state === "pre"
        ? `${match.league}${match.round ? ` · 第${match.round}轮` : ""}`
        : (match.venue || match.league);
    nodes.push(textNode(subline, 193.5, 142, 9.5, "$muted", { align: "center", max_width: 340 }));

    if (match.state === "in") {
        const progress = Math.max(0, Math.min(1, match.clock / 5400));
        nodes.push({ rect: [16, 149, 355, 3], r: 1.5, fill: "$track" });
        if (progress > 0) {
            nodes.push({ rect: [16, 149, Math.max(3, 355 * progress), 3], r: 1.5, fill: ACCENT });
        }
    }

    const others = view.matches.filter(row => row !== match).slice(0, 3);
    let y = 156;
    for (const row of others) {
        const live = row.state === "in";
        const score = row.state === "pre" ? "VS" : `${row.home.score}-${row.away.score}`;
        const hc = crestOf(row.home);
        const ac = crestOf(row.away);
        if (hc) nodes.push({ image: hc, rect: [8, y + 15, 13, 13], fit: "contain" });
        if (ac) nodes.push({ image: ac, rect: [366, y + 15, 13, 13], fit: "contain" });
        nodes.push(textNode(`${row.league} · ${shortDay(row.day, today)} ${row.time}`, 8, y + 9, 8.5, "$muted", { max_width: 220 }));
        nodes.push(textNode(live ? (row.detail || "进行中") : STATE_LABEL[row.state], 379, y + 9, 8.5,
            "$muted", { align: "right", max_width: 90 }));
        nodes.push(textNode(shortCn(row.labelHome), 24, y + 25, 11.5, "$text", { max_width: 118 }));
        nodes.push(textNode(shortCn(row.labelAway), 363, y + 25, 11.5, "$text", { align: "right", max_width: 118 }));
        nodes.push(textNode(score, 193.5, y + 25, 12.5, "$text", { align: "center", weight: 800, max_width: 70 }));
        nodes.push({ rect: [8, y + 32, 371, 1], r: 0.5, fill: "$track" });
        y += 32;
    }

    const height = others.length ? 156 + others.length * 32 + 22 : 168;
    footer(nodes, height, view, now, offset);
    return { height, nodes };
}

function emptyPage(view, now, offset) {
    const nodes = [];
    const teams = view.teams;
    const title = teams.length ? cut(teams.map(team => team.label || team.raw).join("、"), 14) : "还没有关注球队";
    const note = teams.length ? "下一场待公布" : "支持英超 / 西甲 / 意甲 / 德甲 / 法甲 / 中超";
    nodes.push(textNode(title, 193.5, 38, 16, "$text", { align: "center", weight: 800, max_width: 350 }));
    nodes.push(textNode(note, 193.5, 62, 10, "$muted", { align: "center", max_width: 340 }));
    nodes.push({
        rect: [132, 76, 124, 22], r: 6, fill: "$track",
        hover: { fill: "$card" }, hit: { action: "open-picker" }
    });
    nodes.push(textNode("点岛选球队", 194, 91, 10, "$text", { align: "center", weight: 700 }));
    footer(nodes, 130, view, now, offset);
    return { height: 130, nodes };
}

function normalizeStorage(input) {
    const storage = input && input.storage && typeof input.storage === "object" ? input.storage : {};
    return {
        seen: storage.seen && typeof storage.seen === "object" ? storage.seen : {},
        sent: Array.isArray(storage.sent) ? storage.sent.slice(-12) : [],
        pending: Array.isArray(storage.pending) ? storage.pending.slice(-4) : [],
        lastNoticeAt: Number(storage.lastNoticeAt) || 0,
        following: Array.isArray(storage.following) ? storage.following.filter(id => TEAM_CN[clean(id)]).slice(0, FOLLOW_LIMIT).map(clean) : [],
        picker: !!storage.picker,
        pickerLeague: PICKER_LEAGUES.includes(storage.pickerLeague) ? storage.pickerLeague : "epl",
        cache: Array.isArray(storage.cache) ? storage.cache.slice(0, 20) : []
    };
}

function goalNotice(match) {
    const mineHome = !!match.homeWho;
    const mine = mineHome ? match.home : match.away;
    const other = mineHome ? match.away : match.home;
    return {
        id: `goal-${match.id}-${match.home.score}-${match.away.score}`,
        title: `进球 · ${match.league}`,
        body: `${match.labelHome} ${match.home.score}-${match.away.score} ${match.labelAway} · ${match.detail || ""}`.trim()
    };
}

function compute(input) {
    const settings = (input && input.settings) || {};
    const storage = normalizeStorage(input);
    const now = Number(input && input.now) || Date.now();
    const offset = Number(input && input.tz && input.tz.offset_minutes) || 0;
    const today = validDay(input && input.today) ? input.today
        : new Date(now + offset * 60000).toISOString().slice(0, 10);
    const teams = selectedTeams(settings, storage);
    const selected = validDay(settings.date) ? settings.date : today;
    const minKick = selected > today ? dayNumber(selected) * DAY_MS : now;

    let board = parseSources(input && input.sources, teams, today, offset);
    if (!board.ready && storage.cache.length) {
        board = { ready: true, parsed: true, status: "ready", matches: storage.cache, events: board.events };
    }
    const seenIds = new Set();
    for (const match of board.matches) {
        seenIds.add(match.id);
        seenIds.add(`${match.day}-${match.home.id}-${match.away.id}`);
    }
    const fixtures = fixtureNextMatches(teams, today, offset, minKick, seenIds);
    const matches = [...board.matches, ...fixtures];
    sortMatches(matches);
    const liveMatches = matches.filter(match => match.state === "in");
    const nextMatch = matches.filter(match => match.state === "pre")
        .sort((a, b) => a.kickoff - b.kickoff)[0] || null;
    const focus = liveMatches[0] || nextMatch || null;

    // 进球与完场提醒：只比较上一次看到的同一场比赛，避免首次加载就推送。
    const seen = {};
    for (const match of board.matches) {
        seen[match.id] = { h: match.home.score, a: match.away.score, state: match.state };
    }
    const sent = storage.sent.slice();
    const pending = storage.pending.slice();
    if (board.ready) {
        for (const match of board.matches) {
            const before = storage.seen[match.id];
            if (!before) continue;
            if (match.state === "in" && (match.home.score > before.h || match.away.score > before.a)) {
                const notice = goalNotice(match);
                if (!sent.includes(notice.id)) pending.push(notice);
            } else if (before.state === "in" && match.state === "post") {
                const id = `ft-${match.id}`;
                if (!sent.includes(id)) {
                    pending.push({
                        id,
                        title: `完场 · ${match.league}`,
                        body: `${match.labelHome} ${match.home.score}-${match.away.score} ${match.labelAway}`
                    });
                }
            }
        }
    }
    let notice;
    let lastNoticeAt = storage.lastNoticeAt;
    const nowSeconds = Math.floor(now / 1000);
    if (pending.length && nowSeconds - lastNoticeAt >= MINUTE) {
        notice = pending.shift();
        sent.push(notice.id);
        lastNoticeAt = nowSeconds;
    }

    const ready = board.ready || fixtures.length > 0;
    const view = {
        ready,
        boardReady: board.ready,
        parsed: board.parsed,
        status: board.status,
        events: board.events,
        teams,
        following: storage.following,
        matches,
        liveMatches,
        nextMatch,
        focus,
        today,
        selected,
        picker: storage.picker,
        pickerLeague: storage.pickerLeague
    };

    const live = liveMatches.length > 0;
    const summary = live ? summarize(liveMatches[0], today)
        : nextMatch ? `${nextMatch.labelHome} vs ${nextMatch.labelAway} · ${shortDay(nextMatch.day, today)} ${nextMatch.time}`
        : teams.length ? "下一场待公布" : "先选关注球队";

    const nextRefresh = live ? 60 : 300;
    const rotate = liveMatches.slice(0, 3);
    let pinned;
    if (rotate.length > 1) {
        pinned = { canvas: rotate.map(match => pinnedCanvas(match, today).canvas) };
    } else if (rotate.length === 1) {
        pinned = pinnedCanvas(rotate[0], today);
    } else if (nextMatch) {
        pinned = pinnedCanvas(nextMatch, today);
    } else if (teams.length && ready) {
        pinned = waitingPinned(teams, view);
    } else {
        pinned = emptyPinned(teams, view);
    }

    return {
        status: {
            state: ready ? "succeeded" : "offline",
            label: "足球比分",
            summary,
            observed_at: nowSeconds
        },
        canvas: pageCanvas(view, now, offset),
        pinned,
        notice,
        storage: {
            seen,
            sent: sent.slice(-12),
            pending: pending.slice(-4),
            lastNoticeAt,
            following: storage.following,
            picker: storage.picker,
            pickerLeague: storage.pickerLeague,
            cache: board.matches.slice(0, 20)
        },
        next_refresh_at: nowSeconds + nextRefresh
    };
}

function refresh(input) {
    return compute(input);
}

function action(input) {
    const storage = normalizeStorage(input);
    const id = clean(input && input.action && input.action.id);
    if (id === "open-picker") {
        storage.picker = true;
        if (input.settings && input.settings.epl === "more") storage.pickerLeague = "epl";
    } else if (id === "close-picker") {
        storage.picker = false;
    } else if (id === "clear-following") {
        storage.following = [];
        storage.picker = true;
    } else if (id.startsWith("league_")) {
        const league = id.slice(7);
        if (PICKER_LEAGUES.includes(league)) {
            storage.picker = true;
            storage.pickerLeague = league;
        }
    } else if (id.startsWith("pick_")) {
        const teamId = clean(id.slice(5));
        if (TEAM_CN[teamId]) {
            const following = storage.following.slice();
            const index = following.indexOf(teamId);
            if (index >= 0) following.splice(index, 1);
            else if (following.length < FOLLOW_LIMIT) following.push(teamId);
            storage.following = following;
            storage.picker = true;
        }
    } else if (id === "refresh") {
        storage.picker = false;
    }
    return compute(Object.assign({}, input, { storage }));
}


// 2026-27 赛季赛程（打包数据，避免刷新时再占一个网络源）
/* ===== 未来赛程（ESPN 2026-11-26 至 2027-05-31，6 大联赛 + 欧战 + 各国杯赛） ===== */
const FIXTURES = {"101":[{"a":"101","d":"2026-11-28T13:00Z","h":"244","l":"西甲","r":14},{"a":"101","d":"2026-12-01T20:00Z","h":"21290","l":"国王杯"},{"a":"1538","d":"2026-12-05T15:15Z","h":"101","l":"西甲","r":15},{"a":"93","d":"2026-12-09T19:00Z","h":"101","l":"西甲","r":15},{"a":"101","d":"2026-12-12T15:15Z","h":"102","l":"西甲","r":16},{"a":"99","d":"2026-12-20T20:00Z","h":"101","l":"西甲","r":17},{"a":"1068","d":"2027-01-03T20:00Z","h":"101","l":"西甲","r":19},{"a":"101","d":"2027-01-10T20:00Z","h":"90","l":"西甲","r":19},{"a":"243","d":"2027-01-17T20:00Z","h":"101","l":"西甲","r":20},{"a":"101","d":"2027-01-24T20:00Z","h":"3751","l":"西甲","r":21},{"a":"86","d":"2027-01-31T20:00Z","h":"101","l":"西甲","r":23},{"a":"101","d":"2027-02-07T20:00Z","h":"88","l":"西甲","r":23},{"a":"101","d":"2027-02-14T20:00Z","h":"85","l":"西甲","r":24},{"a":"2922","d":"2027-02-21T20:00Z","h":"101","l":"西甲","r":25},{"a":"101","d":"2027-02-28T20:00Z","h":"87","l":"西甲","r":26},{"a":"97","d":"2027-03-07T20:00Z","h":"101","l":"西甲","r":27},{"a":"101","d":"2027-03-14T18:00Z","h":"99","l":"西甲","r":28},{"a":"83","d":"2027-03-21T18:00Z","h":"101","l":"西甲","r":29},{"a":"101","d":"2027-04-04T18:00Z","h":"1538","l":"西甲","r":30},{"a":"89","d":"2027-04-11T18:00Z","h":"101","l":"西甲","r":31},{"a":"101","d":"2027-04-18T18:00Z","h":"96","l":"西甲","r":32},{"a":"101","d":"2027-04-21T18:00Z","h":"94","l":"西甲","r":33},{"a":"102","d":"2027-05-02T18:00Z","h":"101","l":"西甲","r":34},{"a":"90","d":"2027-05-09T18:00Z","h":"101","l":"西甲","r":35},{"a":"101","d":"2027-05-16T18:00Z","h":"1068","l":"西甲","r":36},{"a":"244","d":"2027-05-23T18:00Z","h":"101","l":"西甲","r":37},{"a":"101","d":"2027-05-30T18:00Z","h":"93","l":"西甲","r":38}],"102":[{"a":"102","d":"2026-11-29T17:30Z","h":"85","l":"西甲","r":14},{"a":"102","d":"2026-12-02T20:00Z","h":"6856","l":"国王杯"},{"a":"89","d":"2026-12-05T17:30Z","h":"102","l":"西甲","r":16},{"a":"21922","d":"2026-12-08T17:45Z","h":"102","l":"欧冠"},{"a":"101","d":"2026-12-12T15:15Z","h":"102","l":"西甲","r":16},{"a":"102","d":"2026-12-20T20:00Z","h":"97","l":"西甲","r":17},{"a":"243","d":"2027-01-03T20:00Z","h":"102","l":"西甲","r":18},{"a":"102","d":"2027-01-10T20:00Z","h":"93","l":"西甲","r":19},{"a":"96","d":"2027-01-17T20:00Z","h":"102","l":"西甲","r":20},{"a":"102","d":"2027-01-20T17:45Z","h":"436","l":"欧冠"},{"a":"102","d":"2027-01-24T20:00Z","h":"88","l":"西甲","r":21},{"a":"360","d":"2027-01-27T20:00Z","h":"102","l":"欧冠"},{"a":"87","d":"2027-01-31T20:00Z","h":"102","l":"西甲","r":22},{"a":"102","d":"2027-02-07T20:00Z","h":"2922","l":"西甲","r":23},{"a":"83","d":"2027-02-14T20:00Z","h":"102","l":"西甲","r":24},{"a":"94","d":"2027-02-21T20:00Z","h":"102","l":"西甲","r":25},{"a":"102","d":"2027-02-28T20:00Z","h":"244","l":"西甲","r":26},{"a":"86","d":"2027-03-07T20:00Z","h":"102","l":"西甲","r":27},{"a":"102","d":"2027-03-14T18:00Z","h":"3751","l":"西甲","r":28},{"a":"99","d":"2027-03-21T18:00Z","h":"102","l":"西甲","r":29},{"a":"102","d":"2027-04-04T18:00Z","h":"90","l":"西甲","r":30},{"a":"93","d":"2027-04-11T18:00Z","h":"102","l":"西甲","r":31},{"a":"102","d":"2027-04-18T18:00Z","h":"1538","l":"西甲","r":32},{"a":"1068","d":"2027-04-21T18:00Z","h":"102","l":"西甲","r":33},{"a":"102","d":"2027-05-02T18:00Z","h":"101","l":"西甲","r":34},{"a":"85","d":"2027-05-09T18:00Z","h":"102","l":"西甲","r":35},{"a":"102","d":"2027-05-16T18:00Z","h":"243","l":"西甲","r":36},{"a":"97","d":"2027-05-23T18:00Z","h":"102","l":"西甲","r":37},{"a":"102","d":"2027-05-30T18:00Z","h":"89","l":"西甲","r":38}],"103":[{"a":"103","d":"2026-11-26T17:45Z","h":"435","l":"欧联"},{"a":"103","d":"2026-11-30T19:45Z","h":"2925","l":"意甲","r":13},{"a":"115","d":"2026-12-06T19:45Z","h":"103","l":"意甲","r":14},{"a":"366","d":"2026-12-10T20:00Z","h":"103","l":"欧联"},{"a":"103","d":"2026-12-13T19:45Z","h":"114","l":"意甲","r":15},{"a":"2572","d":"2026-12-19T17:00Z","h":"103","l":"意甲","r":16},{"a":"103","d":"2027-01-02T19:45Z","h":"4007","l":"意甲","r":17},{"a":"109","d":"2027-01-05T19:45Z","h":"103","l":"意甲","r":18},{"a":"103","d":"2027-01-09T17:00Z","h":"104","l":"意甲","r":19},{"a":"4007","d":"2027-01-13T20:00Z","h":"103","l":"意大利杯"},{"a":"239","d":"2027-01-17T20:00Z","h":"103","l":"意甲","r":20},{"a":"103","d":"2027-01-21T20:00Z","h":"490","l":"欧联"},{"a":"103","d":"2027-01-24T20:00Z","h":"4057","l":"意甲","r":21},{"a":"20024","d":"2027-01-28T20:00Z","h":"103","l":"欧联"},{"a":"111","d":"2027-01-31T20:00Z","h":"103","l":"意甲","r":22},{"a":"103","d":"2027-02-07T20:00Z","h":"107","l":"意甲","r":23},{"a":"103","d":"2027-02-14T20:00Z","h":"110","l":"意甲","r":24},{"a":"3263","d":"2027-02-21T20:00Z","h":"103","l":"意甲","r":25},{"a":"103","d":"2027-02-28T20:00Z","h":"2572","l":"意甲","r":26},{"a":"2925","d":"2027-03-07T20:00Z","h":"103","l":"意甲","r":27},{"a":"3997","d":"2027-03-14T18:00Z","h":"103","l":"意甲","r":28},{"a":"103","d":"2027-03-21T18:00Z","h":"105","l":"意甲","r":29},{"a":"4007","d":"2027-04-04T18:00Z","h":"103","l":"意甲","r":30},{"a":"103","d":"2027-04-11T18:00Z","h":"109","l":"意甲","r":31},{"a":"114","d":"2027-04-18T18:00Z","h":"103","l":"意甲","r":32},{"a":"103","d":"2027-04-25T18:00Z","h":"113","l":"意甲","r":33},{"a":"112","d":"2027-05-02T18:00Z","h":"103","l":"意甲","r":34},{"a":"103","d":"2027-05-09T18:00Z","h":"115","l":"意甲","r":35},{"a":"104","d":"2027-05-16T18:00Z","h":"103","l":"意甲","r":36},{"a":"103","d":"2027-05-23T18:00Z","h":"17530","l":"意甲","r":37},{"a":"118","d":"2027-05-30T18:00Z","h":"103","l":"意甲","r":38}],"10388":[{"a":"10388","d":"2026-11-28T14:30Z","h":"122","l":"德甲","r":11},{"a":"134","d":"2026-12-06T16:30Z","h":"10388","l":"德甲","r":12},{"a":"10388","d":"2026-12-12T14:30Z","h":"3307","l":"德甲","r":13},{"a":"127","d":"2026-12-19T14:30Z","h":"10388","l":"德甲","r":14},{"a":"10388","d":"2027-01-09T14:30Z","h":"7911","l":"德甲","r":15},{"a":"125","d":"2027-01-13T17:30Z","h":"10388","l":"德甲","r":16},{"a":"10388","d":"2027-01-17T14:30Z","h":"137","l":"德甲","r":17},{"a":"10388","d":"2027-01-24T16:30Z","h":"131","l":"德甲","r":18},{"a":"268","d":"2027-01-30T20:00Z","h":"10388","l":"德甲","r":19},{"a":"10388","d":"2027-02-06T20:00Z","h":"132","l":"德甲","r":20},{"a":"133","d":"2027-02-13T20:00Z","h":"10388","l":"德甲","r":21},{"a":"598","d":"2027-02-20T20:00Z","h":"10388","l":"德甲","r":22},{"a":"10388","d":"2027-02-27T20:00Z","h":"3841","l":"德甲","r":23},{"a":"11420","d":"2027-03-03T20:00Z","h":"10388","l":"德甲","r":24},{"a":"10388","d":"2027-03-06T20:00Z","h":"2950","l":"德甲","r":25},{"a":"124","d":"2027-03-13T20:00Z","h":"10388","l":"德甲","r":26},{"a":"10388","d":"2027-03-20T18:00Z","h":"126","l":"德甲","r":27},{"a":"122","d":"2027-04-03T18:00Z","h":"10388","l":"德甲","r":28},{"a":"10388","d":"2027-04-10T18:00Z","h":"134","l":"德甲","r":29},{"a":"3307","d":"2027-04-17T18:00Z","h":"10388","l":"德甲","r":30},{"a":"10388","d":"2027-04-24T18:00Z","h":"127","l":"德甲","r":31},{"a":"7911","d":"2027-05-08T18:00Z","h":"10388","l":"德甲","r":32},{"a":"10388","d":"2027-05-15T18:00Z","h":"125","l":"德甲","r":33},{"a":"137","d":"2027-05-22T13:30Z","h":"10388","l":"德甲","r":34}],"104":[{"a":"4007","d":"2026-11-29T17:00Z","h":"104","l":"意甲","r":13},{"a":"104","d":"2026-12-04T19:45Z","h":"107","l":"意甲","r":14},{"a":"2250","d":"2026-12-08T20:00Z","h":"104","l":"欧冠"},{"a":"104","d":"2026-12-13T11:30Z","h":"112","l":"意甲","r":15},{"a":"111","d":"2026-12-19T19:45Z","h":"104","l":"意甲","r":16},{"a":"4057","d":"2027-01-02T17:00Z","h":"104","l":"意甲","r":17},{"a":"104","d":"2027-01-05T17:30Z","h":"17530","l":"意甲","r":18},{"a":"103","d":"2027-01-09T17:00Z","h":"104","l":"意甲","r":19},{"a":"119","d":"2027-01-12T20:00Z","h":"104","l":"意大利杯"},{"a":"104","d":"2027-01-17T20:00Z","h":"105","l":"意甲","r":20},{"a":"104","d":"2027-01-19T20:00Z","h":"887","l":"欧冠"},{"a":"118","d":"2027-01-24T20:00Z","h":"104","l":"意甲","r":21},{"a":"166","d":"2027-01-27T20:00Z","h":"104","l":"欧冠"},{"a":"104","d":"2027-01-31T20:00Z","h":"4007","l":"意甲","r":22},{"a":"239","d":"2027-02-07T20:00Z","h":"104","l":"意甲","r":23},{"a":"115","d":"2027-02-14T20:00Z","h":"104","l":"意甲","r":24},{"a":"104","d":"2027-02-21T20:00Z","h":"3997","l":"意甲","r":25},{"a":"17530","d":"2027-02-28T20:00Z","h":"104","l":"意甲","r":26},{"a":"104","d":"2027-03-07T20:00Z","h":"111","l":"意甲","r":27},{"a":"104","d":"2027-03-14T18:00Z","h":"3263","l":"意甲","r":28},{"a":"113","d":"2027-03-21T18:00Z","h":"104","l":"意甲","r":29},{"a":"107","d":"2027-04-04T18:00Z","h":"104","l":"意甲","r":30},{"a":"104","d":"2027-04-11T18:00Z","h":"110","l":"意甲","r":31},{"a":"112","d":"2027-04-18T18:00Z","h":"104","l":"意甲","r":32},{"a":"104","d":"2027-04-25T18:00Z","h":"4057","l":"意甲","r":33},{"a":"114","d":"2027-05-02T18:00Z","h":"104","l":"意甲","r":34},{"a":"104","d":"2027-05-09T18:00Z","h":"109","l":"意甲","r":35},{"a":"104","d":"2027-05-16T18:00Z","h":"103","l":"意甲","r":36},{"a":"2572","d":"2027-05-23T18:00Z","h":"104","l":"意甲","r":37},{"a":"104","d":"2027-05-30T18:00Z","h":"2925","l":"意甲","r":38}],"105":[{"a":"105","d":"2026-11-26T20:00Z","h":"20710","l":"欧协联"},{"a":"105","d":"2026-11-30T17:30Z","h":"113","l":"意甲","r":13},{"a":"105","d":"2026-12-06T14:00Z","h":"112","l":"意甲","r":14},{"a":"105","d":"2026-12-10T17:45Z","h":"19246","l":"欧协联"},{"a":"3263","d":"2026-12-14T17:30Z","h":"105","l":"意甲","r":15},{"a":"20301","d":"2026-12-17T20:00Z","h":"105","l":"欧协联"},{"a":"114","d":"2026-12-20T19:45Z","h":"105","l":"意甲","r":16},{"a":"105","d":"2027-01-03T14:00Z","h":"118","l":"意甲","r":17},{"a":"2572","d":"2027-01-06T17:00Z","h":"105","l":"意甲","r":18},{"a":"105","d":"2027-01-10T17:00Z","h":"239","l":"意甲","r":19},{"a":"104","d":"2027-01-17T20:00Z","h":"105","l":"意甲","r":20},{"a":"105","d":"2027-01-24T20:00Z","h":"107","l":"意甲","r":21},{"a":"118","d":"2027-01-26T20:00Z","h":"105","l":"意大利杯"},{"a":"109","d":"2027-01-31T20:00Z","h":"105","l":"意甲","r":22},{"a":"112","d":"2027-02-07T20:00Z","h":"105","l":"意甲","r":23},{"a":"105","d":"2027-02-14T20:00Z","h":"3263","l":"意甲","r":24},{"a":"4007","d":"2027-02-21T20:00Z","h":"105","l":"意甲","r":25},{"a":"105","d":"2027-02-28T20:00Z","h":"110","l":"意甲","r":26},{"a":"239","d":"2027-03-07T20:00Z","h":"105","l":"意甲","r":27},{"a":"105","d":"2027-03-14T18:00Z","h":"17530","l":"意甲","r":28},{"a":"103","d":"2027-03-21T18:00Z","h":"105","l":"意甲","r":29},{"a":"105","d":"2027-04-04T18:00Z","h":"3997","l":"意甲","r":30},{"a":"105","d":"2027-04-11T18:00Z","h":"2925","l":"意甲","r":31},{"a":"118","d":"2027-04-18T18:00Z","h":"105","l":"意甲","r":32},{"a":"105","d":"2027-04-25T18:00Z","h":"115","l":"意甲","r":33},{"a":"111","d":"2027-05-02T18:00Z","h":"105","l":"意甲","r":34},{"a":"105","d":"2027-05-09T18:00Z","h":"4057","l":"意甲","r":35},{"a":"105","d":"2027-05-16T18:00Z","h":"2572","l":"意甲","r":36},{"a":"113","d":"2027-05-23T18:00Z","h":"105","l":"意甲","r":37},{"a":"105","d":"2027-05-30T18:00Z","h":"114","l":"意甲","r":38}],"1068":[{"a":"1068","d":"2026-11-28T17:30Z","h":"3751","l":"西甲","r":14},{"a":"1068","d":"2026-12-02T20:30Z","h":"83","l":"西甲","r":15},{"a":"244","d":"2026-12-06T20:00Z","h":"1068","l":"西甲","r":16},{"a":"1068","d":"2026-12-09T20:00Z","h":"148","l":"欧冠"},{"a":"94","d":"2026-12-13T13:00Z","h":"1068","l":"西甲","r":17},{"a":"1068","d":"2026-12-20T20:00Z","h":"85","l":"西甲","r":18},{"a":"1068","d":"2027-01-03T20:00Z","h":"101","l":"西甲","r":19},{"a":"87","d":"2027-01-10T20:00Z","h":"1068","l":"西甲","r":20},{"a":"89","d":"2027-01-17T20:00Z","h":"1068","l":"西甲","r":21},{"a":"1068","d":"2027-01-19T17:45Z","h":"2980","l":"欧冠"},{"a":"1068","d":"2027-01-24T20:00Z","h":"90","l":"西甲","r":22},{"a":"436","d":"2027-01-27T20:00Z","h":"1068","l":"欧冠"},{"a":"88","d":"2027-01-31T20:00Z","h":"1068","l":"西甲","r":23},{"a":"1068","d":"2027-02-14T20:00Z","h":"97","l":"西甲","r":24},{"a":"3751","d":"2027-02-21T20:00Z","h":"1068","l":"西甲","r":25},{"a":"1068","d":"2027-02-28T20:00Z","h":"99","l":"西甲","r":26},{"a":"85","d":"2027-03-07T20:00Z","h":"1068","l":"西甲","r":27},{"a":"1068","d":"2027-03-14T18:00Z","h":"87","l":"西甲","r":28},{"a":"2922","d":"2027-03-21T18:00Z","h":"1068","l":"西甲","r":29},{"a":"1068","d":"2027-04-04T18:00Z","h":"86","l":"西甲","r":30},{"a":"1538","d":"2027-04-11T18:00Z","h":"1068","l":"西甲","r":31},{"a":"243","d":"2027-04-18T18:00Z","h":"1068","l":"西甲","r":32},{"a":"1068","d":"2027-04-21T18:00Z","h":"102","l":"西甲","r":33},{"a":"96","d":"2027-05-02T18:00Z","h":"1068","l":"西甲","r":34},{"a":"1068","d":"2027-05-09T18:00Z","h":"94","l":"西甲","r":35},{"a":"101","d":"2027-05-16T18:00Z","h":"1068","l":"西甲","r":36},{"a":"93","d":"2027-05-23T18:00Z","h":"1068","l":"西甲","r":37},{"a":"1068","d":"2027-05-30T18:00Z","h":"244","l":"西甲","r":38}],"107":[{"a":"107","d":"2026-11-27T19:45Z","h":"17530","l":"意甲","r":13},{"a":"104","d":"2026-12-04T19:45Z","h":"107","l":"意甲","r":14},{"a":"107","d":"2026-12-12T19:45Z","h":"2572","l":"意甲","r":15},{"a":"2923","d":"2026-12-15T20:00Z","h":"107","l":"意大利杯"},{"a":"107","d":"2026-12-20T11:30Z","h":"109","l":"意甲","r":16},{"a":"111","d":"2027-01-03T19:45Z","h":"107","l":"意甲","r":17},{"a":"107","d":"2027-01-06T14:00Z","h":"4057","l":"意甲","r":18},{"a":"3263","d":"2027-01-09T19:45Z","h":"107","l":"意甲","r":19},{"a":"107","d":"2027-01-17T20:00Z","h":"112","l":"意甲","r":20},{"a":"105","d":"2027-01-24T20:00Z","h":"107","l":"意甲","r":21},{"a":"107","d":"2027-01-31T20:00Z","h":"118","l":"意甲","r":22},{"a":"103","d":"2027-02-07T20:00Z","h":"107","l":"意甲","r":23},{"a":"2572","d":"2027-02-14T20:00Z","h":"107","l":"意甲","r":24},{"a":"107","d":"2027-02-21T20:00Z","h":"111","l":"意甲","r":25},{"a":"113","d":"2027-02-28T20:00Z","h":"107","l":"意甲","r":26},{"a":"107","d":"2027-03-07T20:00Z","h":"3997","l":"意甲","r":27},{"a":"114","d":"2027-03-14T18:00Z","h":"107","l":"意甲","r":28},{"a":"107","d":"2027-03-21T18:00Z","h":"4007","l":"意甲","r":29},{"a":"107","d":"2027-04-04T18:00Z","h":"104","l":"意甲","r":30},{"a":"17530","d":"2027-04-11T18:00Z","h":"107","l":"意甲","r":31},{"a":"2925","d":"2027-04-18T18:00Z","h":"107","l":"意甲","r":32},{"a":"107","d":"2027-04-25T18:00Z","h":"110","l":"意甲","r":33},{"a":"109","d":"2027-05-02T18:00Z","h":"107","l":"意甲","r":34},{"a":"107","d":"2027-05-09T18:00Z","h":"239","l":"意甲","r":35},{"a":"4057","d":"2027-05-16T18:00Z","h":"107","l":"意甲","r":36},{"a":"107","d":"2027-05-23T18:00Z","h":"3263","l":"意甲","r":37},{"a":"115","d":"2027-05-30T18:00Z","h":"107","l":"意甲","r":38}],"109":[{"a":"109","d":"2026-11-29T11:30Z","h":"118","l":"意甲","r":13},{"a":"2925","d":"2026-12-07T19:45Z","h":"109","l":"意甲","r":14},{"a":"109","d":"2026-12-13T17:00Z","h":"115","l":"意甲","r":15},{"a":"109","d":"2026-12-16T20:00Z","h":"114","l":"意大利杯"},{"a":"107","d":"2026-12-20T11:30Z","h":"109","l":"意甲","r":16},{"a":"112","d":"2027-01-02T14:00Z","h":"109","l":"意甲","r":17},{"a":"109","d":"2027-01-05T19:45Z","h":"103","l":"意甲","r":18},{"a":"113","d":"2027-01-10T14:00Z","h":"109","l":"意甲","r":19},{"a":"109","d":"2027-01-17T20:00Z","h":"114","l":"意甲","r":20},{"a":"3997","d":"2027-01-24T20:00Z","h":"109","l":"意甲","r":21},{"a":"109","d":"2027-01-31T20:00Z","h":"105","l":"意甲","r":22},{"a":"118","d":"2027-02-07T20:00Z","h":"109","l":"意甲","r":23},{"a":"109","d":"2027-02-14T20:00Z","h":"4057","l":"意甲","r":24},{"a":"110","d":"2027-02-21T20:00Z","h":"109","l":"意甲","r":25},{"a":"109","d":"2027-02-28T20:00Z","h":"239","l":"意甲","r":26},{"a":"17530","d":"2027-03-07T20:00Z","h":"109","l":"意甲","r":27},{"a":"109","d":"2027-03-14T18:00Z","h":"2925","l":"意甲","r":28},{"a":"3263","d":"2027-03-21T18:00Z","h":"109","l":"意甲","r":29},{"a":"109","d":"2027-04-04T18:00Z","h":"2572","l":"意甲","r":30},{"a":"103","d":"2027-04-11T18:00Z","h":"109","l":"意甲","r":31},{"a":"115","d":"2027-04-18T18:00Z","h":"109","l":"意甲","r":32},{"a":"109","d":"2027-04-25T18:00Z","h":"111","l":"意甲","r":33},{"a":"109","d":"2027-05-02T18:00Z","h":"107","l":"意甲","r":34},{"a":"104","d":"2027-05-09T18:00Z","h":"109","l":"意甲","r":35},{"a":"109","d":"2027-05-16T18:00Z","h":"113","l":"意甲","r":36},{"a":"4007","d":"2027-05-23T18:00Z","h":"109","l":"意甲","r":37},{"a":"109","d":"2027-05-30T18:00Z","h":"112","l":"意甲","r":38}],"110":[{"a":"3263","d":"2026-11-28T19:45Z","h":"110","l":"意甲","r":13},{"a":"3263","d":"2026-12-01T20:00Z","h":"110","l":"意大利杯"},{"a":"110","d":"2026-12-05T17:00Z","h":"4057","l":"意甲","r":14},{"a":"110","d":"2026-12-09T20:00Z","h":"124","l":"欧冠"},{"a":"239","d":"2026-12-13T14:00Z","h":"110","l":"意甲","r":15},{"a":"110","d":"2026-12-18T19:45Z","h":"113","l":"意甲","r":16},{"a":"3997","d":"2027-01-03T11:30Z","h":"110","l":"意甲","r":17},{"a":"110","d":"2027-01-06T19:45Z","h":"112","l":"意甲","r":18},{"a":"111","d":"2027-01-10T19:45Z","h":"110","l":"意甲","r":19},{"a":"110","d":"2027-01-17T20:00Z","h":"115","l":"意甲","r":20},{"a":"364","d":"2027-01-19T20:00Z","h":"110","l":"欧冠"},{"a":"17530","d":"2027-01-24T20:00Z","h":"110","l":"意甲","r":21},{"a":"110","d":"2027-01-27T20:00Z","h":"521","l":"欧冠"},{"a":"110","d":"2027-01-31T20:00Z","h":"114","l":"意甲","r":22},{"a":"2925","d":"2027-02-07T20:00Z","h":"110","l":"意甲","r":23},{"a":"103","d":"2027-02-14T20:00Z","h":"110","l":"意甲","r":24},{"a":"110","d":"2027-02-21T20:00Z","h":"109","l":"意甲","r":25},{"a":"105","d":"2027-02-28T20:00Z","h":"110","l":"意甲","r":26},{"a":"110","d":"2027-03-07T20:00Z","h":"118","l":"意甲","r":27},{"a":"110","d":"2027-03-14T18:00Z","h":"239","l":"意甲","r":28},{"a":"4057","d":"2027-03-21T18:00Z","h":"110","l":"意甲","r":29},{"a":"110","d":"2027-04-04T18:00Z","h":"3263","l":"意甲","r":30},{"a":"104","d":"2027-04-11T18:00Z","h":"110","l":"意甲","r":31},{"a":"110","d":"2027-04-18T18:00Z","h":"4007","l":"意甲","r":32},{"a":"107","d":"2027-04-25T18:00Z","h":"110","l":"意甲","r":33},{"a":"110","d":"2027-05-02T18:00Z","h":"2572","l":"意甲","r":34},{"a":"113","d":"2027-05-09T18:00Z","h":"110","l":"意甲","r":35},{"a":"110","d":"2027-05-16T18:00Z","h":"111","l":"意甲","r":36},{"a":"112","d":"2027-05-23T18:00Z","h":"110","l":"意甲","r":37},{"a":"110","d":"2027-05-30T18:00Z","h":"3997","l":"意甲","r":38}],"111":[{"a":"617","d":"2026-11-26T20:00Z","h":"111","l":"欧联"},{"a":"111","d":"2026-11-29T19:45Z","h":"2572","l":"意甲","r":13},{"a":"3997","d":"2026-12-03T20:00Z","h":"111","l":"意大利杯"},{"a":"118","d":"2026-12-06T17:00Z","h":"111","l":"意甲","r":14},{"a":"111","d":"2026-12-10T17:45Z","h":"13083","l":"欧联"},{"a":"4007","d":"2026-12-14T19:45Z","h":"111","l":"意甲","r":15},{"a":"111","d":"2026-12-19T19:45Z","h":"104","l":"意甲","r":16},{"a":"111","d":"2027-01-03T19:45Z","h":"107","l":"意甲","r":17},{"a":"239","d":"2027-01-06T11:30Z","h":"111","l":"意甲","r":18},{"a":"111","d":"2027-01-10T19:45Z","h":"110","l":"意甲","r":19},{"a":"3263","d":"2027-01-17T20:00Z","h":"111","l":"意甲","r":20},{"a":"111","d":"2027-01-21T17:45Z","h":"622","l":"欧联"},{"a":"2925","d":"2027-01-24T20:00Z","h":"111","l":"意甲","r":21},{"a":"89","d":"2027-01-28T20:00Z","h":"111","l":"欧联"},{"a":"111","d":"2027-01-31T20:00Z","h":"103","l":"意甲","r":22},{"a":"3997","d":"2027-02-07T20:00Z","h":"111","l":"意甲","r":23},{"a":"111","d":"2027-02-14T20:00Z","h":"114","l":"意甲","r":24},{"a":"107","d":"2027-02-21T20:00Z","h":"111","l":"意甲","r":25},{"a":"111","d":"2027-02-28T20:00Z","h":"4007","l":"意甲","r":26},{"a":"104","d":"2027-03-07T20:00Z","h":"111","l":"意甲","r":27},{"a":"111","d":"2027-03-14T18:00Z","h":"112","l":"意甲","r":28},{"a":"2572","d":"2027-03-21T18:00Z","h":"111","l":"意甲","r":29},{"a":"111","d":"2027-04-04T18:00Z","h":"239","l":"意甲","r":30},{"a":"113","d":"2027-04-11T18:00Z","h":"111","l":"意甲","r":31},{"a":"111","d":"2027-04-18T18:00Z","h":"17530","l":"意甲","r":32},{"a":"109","d":"2027-04-25T18:00Z","h":"111","l":"意甲","r":33},{"a":"111","d":"2027-05-02T18:00Z","h":"105","l":"意甲","r":34},{"a":"111","d":"2027-05-09T18:00Z","h":"118","l":"意甲","r":35},{"a":"110","d":"2027-05-16T18:00Z","h":"111","l":"意甲","r":36},{"a":"111","d":"2027-05-23T18:00Z","h":"115","l":"意甲","r":37},{"a":"4057","d":"2027-05-30T18:00Z","h":"111","l":"意甲","r":38}],"112":[{"a":"112","d":"2026-11-28T17:00Z","h":"239","l":"意甲","r":13},{"a":"105","d":"2026-12-06T14:00Z","h":"112","l":"意甲","r":14},{"a":"104","d":"2026-12-13T11:30Z","h":"112","l":"意甲","r":15},{"a":"112","d":"2026-12-18T17:30Z","h":"4057","l":"意甲","r":16},{"a":"112","d":"2027-01-02T14:00Z","h":"109","l":"意甲","r":17},{"a":"110","d":"2027-01-06T19:45Z","h":"112","l":"意甲","r":18},{"a":"112","d":"2027-01-10T11:30Z","h":"2572","l":"意甲","r":19},{"a":"107","d":"2027-01-17T20:00Z","h":"112","l":"意甲","r":20},{"a":"112","d":"2027-01-24T20:00Z","h":"4007","l":"意甲","r":21},{"a":"17530","d":"2027-01-31T20:00Z","h":"112","l":"意甲","r":22},{"a":"112","d":"2027-02-07T20:00Z","h":"105","l":"意甲","r":23},{"a":"112","d":"2027-02-14T20:00Z","h":"2925","l":"意甲","r":24},{"a":"114","d":"2027-02-21T20:00Z","h":"112","l":"意甲","r":25},{"a":"112","d":"2027-02-28T20:00Z","h":"3263","l":"意甲","r":26},{"a":"4057","d":"2027-03-07T20:00Z","h":"112","l":"意甲","r":27},{"a":"111","d":"2027-03-14T18:00Z","h":"112","l":"意甲","r":28},{"a":"112","d":"2027-03-21T18:00Z","h":"115","l":"意甲","r":29},{"a":"112","d":"2027-04-04T18:00Z","h":"113","l":"意甲","r":30},{"a":"239","d":"2027-04-11T18:00Z","h":"112","l":"意甲","r":31},{"a":"112","d":"2027-04-18T18:00Z","h":"104","l":"意甲","r":32},{"a":"2572","d":"2027-04-25T18:00Z","h":"112","l":"意甲","r":33},{"a":"112","d":"2027-05-02T18:00Z","h":"103","l":"意甲","r":34},{"a":"3997","d":"2027-05-09T18:00Z","h":"112","l":"意甲","r":35},{"a":"118","d":"2027-05-16T18:00Z","h":"112","l":"意甲","r":36},{"a":"112","d":"2027-05-23T18:00Z","h":"110","l":"意甲","r":37},{"a":"109","d":"2027-05-30T18:00Z","h":"112","l":"意甲","r":38}],"113":[{"a":"105","d":"2026-11-30T17:30Z","h":"113","l":"意甲","r":13},{"a":"113","d":"2026-12-05T19:45Z","h":"114","l":"意甲","r":14},{"a":"3997","d":"2026-12-12T17:00Z","h":"113","l":"意甲","r":15},{"a":"110","d":"2026-12-18T19:45Z","h":"113","l":"意甲","r":16},{"a":"113","d":"2027-01-03T14:00Z","h":"2572","l":"意甲","r":17},{"a":"115","d":"2027-01-06T14:00Z","h":"113","l":"意甲","r":18},{"a":"113","d":"2027-01-10T14:00Z","h":"109","l":"意甲","r":19},{"a":"118","d":"2027-01-17T20:00Z","h":"113","l":"意甲","r":20},{"a":"239","d":"2027-01-24T20:00Z","h":"113","l":"意甲","r":21},{"a":"113","d":"2027-01-31T20:00Z","h":"3263","l":"意甲","r":22},{"a":"114","d":"2027-02-07T20:00Z","h":"113","l":"意甲","r":23},{"a":"113","d":"2027-02-14T20:00Z","h":"4007","l":"意甲","r":24},{"a":"4057","d":"2027-02-21T20:00Z","h":"113","l":"意甲","r":25},{"a":"113","d":"2027-02-28T20:00Z","h":"107","l":"意甲","r":26},{"a":"2572","d":"2027-03-07T20:00Z","h":"113","l":"意甲","r":27},{"a":"113","d":"2027-03-14T18:00Z","h":"115","l":"意甲","r":28},{"a":"113","d":"2027-03-21T18:00Z","h":"104","l":"意甲","r":29},{"a":"112","d":"2027-04-04T18:00Z","h":"113","l":"意甲","r":30},{"a":"113","d":"2027-04-11T18:00Z","h":"111","l":"意甲","r":31},{"a":"113","d":"2027-04-18T18:00Z","h":"3997","l":"意甲","r":32},{"a":"103","d":"2027-04-25T18:00Z","h":"113","l":"意甲","r":33},{"a":"2925","d":"2027-05-02T18:00Z","h":"113","l":"意甲","r":34},{"a":"113","d":"2027-05-09T18:00Z","h":"110","l":"意甲","r":35},{"a":"109","d":"2027-05-16T18:00Z","h":"113","l":"意甲","r":36},{"a":"113","d":"2027-05-23T18:00Z","h":"105","l":"意甲","r":37},{"a":"17530","d":"2027-05-30T18:00Z","h":"113","l":"意甲","r":38}],"114":[{"a":"114","d":"2026-11-29T14:00Z","h":"3997","l":"意甲","r":13},{"a":"113","d":"2026-12-05T19:45Z","h":"114","l":"意甲","r":14},{"a":"570","d":"2026-12-08T20:00Z","h":"114","l":"欧冠"},{"a":"103","d":"2026-12-13T19:45Z","h":"114","l":"意甲","r":15},{"a":"109","d":"2026-12-16T20:00Z","h":"114","l":"意大利杯"},{"a":"114","d":"2026-12-20T19:45Z","h":"105","l":"意甲","r":16},{"a":"114","d":"2027-01-03T17:00Z","h":"115","l":"意甲","r":17},{"a":"2925","d":"2027-01-07T19:45Z","h":"114","l":"意甲","r":18},{"a":"114","d":"2027-01-11T19:45Z","h":"118","l":"意甲","r":19},{"a":"109","d":"2027-01-17T20:00Z","h":"114","l":"意甲","r":20},{"a":"114","d":"2027-01-20T17:45Z","h":"21922","l":"欧冠"},{"a":"114","d":"2027-01-24T20:00Z","h":"2572","l":"意甲","r":21},{"a":"510","d":"2027-01-27T20:00Z","h":"114","l":"欧冠"},{"a":"110","d":"2027-01-31T20:00Z","h":"114","l":"意甲","r":22},{"a":"114","d":"2027-02-07T20:00Z","h":"113","l":"意甲","r":23},{"a":"111","d":"2027-02-14T20:00Z","h":"114","l":"意甲","r":24},{"a":"114","d":"2027-02-21T20:00Z","h":"112","l":"意甲","r":25},{"a":"114","d":"2027-02-28T20:00Z","h":"4057","l":"意甲","r":26},{"a":"115","d":"2027-03-07T20:00Z","h":"114","l":"意甲","r":27},{"a":"114","d":"2027-03-14T18:00Z","h":"107","l":"意甲","r":28},{"a":"17530","d":"2027-03-21T18:00Z","h":"114","l":"意甲","r":29},{"a":"114","d":"2027-04-04T18:00Z","h":"2925","l":"意甲","r":30},{"a":"3997","d":"2027-04-11T18:00Z","h":"114","l":"意甲","r":31},{"a":"114","d":"2027-04-18T18:00Z","h":"103","l":"意甲","r":32},{"a":"118","d":"2027-04-25T18:00Z","h":"114","l":"意甲","r":33},{"a":"114","d":"2027-05-02T18:00Z","h":"104","l":"意甲","r":34},{"a":"4007","d":"2027-05-09T18:00Z","h":"114","l":"意甲","r":35},{"a":"3263","d":"2027-05-16T18:00Z","h":"114","l":"意甲","r":36},{"a":"114","d":"2027-05-23T18:00Z","h":"239","l":"意甲","r":37},{"a":"105","d":"2027-05-30T18:00Z","h":"114","l":"意甲","r":38}],"11420":[{"a":"11420","d":"2026-11-29T14:30Z","h":"126","l":"德甲","r":11},{"a":"11420","d":"2026-12-02T17:00Z","h":"131","l":"德国杯"},{"a":"2950","d":"2026-12-05T14:30Z","h":"11420","l":"德甲","r":12},{"a":"11420","d":"2026-12-08T20:00Z","h":"360","l":"欧冠"},{"a":"11420","d":"2026-12-12T14:30Z","h":"122","l":"德甲","r":13},{"a":"124","d":"2026-12-19T17:30Z","h":"11420","l":"德甲","r":14},{"a":"11420","d":"2027-01-09T14:30Z","h":"3307","l":"德甲","r":15},{"a":"134","d":"2027-01-12T17:30Z","h":"11420","l":"德甲","r":16},{"a":"11420","d":"2027-01-16T14:30Z","h":"7911","l":"德甲","r":17},{"a":"493","d":"2027-01-20T20:00Z","h":"11420","l":"欧冠"},{"a":"11420","d":"2027-01-23T14:30Z","h":"268","l":"德甲","r":18},{"a":"11420","d":"2027-01-27T20:00Z","h":"142","l":"欧冠"},{"a":"137","d":"2027-01-30T20:00Z","h":"11420","l":"德甲","r":19},{"a":"11420","d":"2027-02-06T20:00Z","h":"127","l":"德甲","r":20},{"a":"131","d":"2027-02-13T20:00Z","h":"11420","l":"德甲","r":21},{"a":"11420","d":"2027-02-20T20:00Z","h":"125","l":"德甲","r":22},{"a":"132","d":"2027-02-27T20:00Z","h":"11420","l":"德甲","r":23},{"a":"11420","d":"2027-03-03T20:00Z","h":"10388","l":"德甲","r":24},{"a":"133","d":"2027-03-06T20:00Z","h":"11420","l":"德甲","r":25},{"a":"11420","d":"2027-03-13T20:00Z","h":"3841","l":"德甲","r":26},{"a":"598","d":"2027-03-20T18:00Z","h":"11420","l":"德甲","r":27},{"a":"126","d":"2027-04-03T18:00Z","h":"11420","l":"德甲","r":28},{"a":"11420","d":"2027-04-10T18:00Z","h":"2950","l":"德甲","r":29},{"a":"122","d":"2027-04-17T18:00Z","h":"11420","l":"德甲","r":30},{"a":"11420","d":"2027-04-24T18:00Z","h":"124","l":"德甲","r":31},{"a":"3307","d":"2027-05-08T18:00Z","h":"11420","l":"德甲","r":32},{"a":"11420","d":"2027-05-15T18:00Z","h":"134","l":"德甲","r":33},{"a":"7911","d":"2027-05-22T13:30Z","h":"11420","l":"德甲","r":34}],"115":[{"a":"115","d":"2026-11-28T14:00Z","h":"4057","l":"意甲","r":13},{"a":"115","d":"2026-12-06T19:45Z","h":"103","l":"意甲","r":14},{"a":"109","d":"2026-12-13T17:00Z","h":"115","l":"意甲","r":15},{"a":"115","d":"2026-12-19T14:00Z","h":"3997","l":"意甲","r":16},{"a":"114","d":"2027-01-03T17:00Z","h":"115","l":"意甲","r":17},{"a":"115","d":"2027-01-06T14:00Z","h":"113","l":"意甲","r":18},{"a":"17530","d":"2027-01-10T14:00Z","h":"115","l":"意甲","r":19},{"a":"110","d":"2027-01-17T20:00Z","h":"115","l":"意甲","r":20},{"a":"115","d":"2027-01-24T20:00Z","h":"3263","l":"意甲","r":21},{"a":"115","d":"2027-01-31T20:00Z","h":"2925","l":"意甲","r":22},{"a":"4057","d":"2027-02-07T20:00Z","h":"115","l":"意甲","r":23},{"a":"115","d":"2027-02-14T20:00Z","h":"104","l":"意甲","r":24},{"a":"115","d":"2027-02-21T20:00Z","h":"118","l":"意甲","r":25},{"a":"3997","d":"2027-02-28T20:00Z","h":"115","l":"意甲","r":26},{"a":"115","d":"2027-03-07T20:00Z","h":"114","l":"意甲","r":27},{"a":"113","d":"2027-03-14T18:00Z","h":"115","l":"意甲","r":28},{"a":"112","d":"2027-03-21T18:00Z","h":"115","l":"意甲","r":29},{"a":"115","d":"2027-04-04T18:00Z","h":"17530","l":"意甲","r":30},{"a":"2572","d":"2027-04-11T18:00Z","h":"115","l":"意甲","r":31},{"a":"115","d":"2027-04-18T18:00Z","h":"109","l":"意甲","r":32},{"a":"105","d":"2027-04-25T18:00Z","h":"115","l":"意甲","r":33},{"a":"115","d":"2027-05-02T18:00Z","h":"239","l":"意甲","r":34},{"a":"103","d":"2027-05-09T18:00Z","h":"115","l":"意甲","r":35},{"a":"115","d":"2027-05-16T18:00Z","h":"4007","l":"意甲","r":36},{"a":"111","d":"2027-05-23T18:00Z","h":"115","l":"意甲","r":37},{"a":"115","d":"2027-05-30T18:00Z","h":"107","l":"意甲","r":38}],"118":[{"a":"109","d":"2026-11-29T11:30Z","h":"118","l":"意甲","r":13},{"a":"118","d":"2026-12-06T17:00Z","h":"111","l":"意甲","r":14},{"a":"4057","d":"2026-12-11T19:45Z","h":"118","l":"意甲","r":15},{"a":"118","d":"2026-12-20T17:00Z","h":"3263","l":"意甲","r":16},{"a":"105","d":"2027-01-03T14:00Z","h":"118","l":"意甲","r":17},{"a":"118","d":"2027-01-07T17:30Z","h":"3997","l":"意甲","r":18},{"a":"114","d":"2027-01-11T19:45Z","h":"118","l":"意甲","r":19},{"a":"118","d":"2027-01-17T20:00Z","h":"113","l":"意甲","r":20},{"a":"118","d":"2027-01-24T20:00Z","h":"104","l":"意甲","r":21},{"a":"118","d":"2027-01-26T20:00Z","h":"105","l":"意大利杯"},{"a":"107","d":"2027-01-31T20:00Z","h":"118","l":"意甲","r":22},{"a":"118","d":"2027-02-07T20:00Z","h":"109","l":"意甲","r":23},{"a":"17530","d":"2027-02-14T20:00Z","h":"118","l":"意甲","r":24},{"a":"115","d":"2027-02-21T20:00Z","h":"118","l":"意甲","r":25},{"a":"118","d":"2027-02-28T20:00Z","h":"2925","l":"意甲","r":26},{"a":"110","d":"2027-03-07T20:00Z","h":"118","l":"意甲","r":27},{"a":"118","d":"2027-03-14T18:00Z","h":"2572","l":"意甲","r":28},{"a":"239","d":"2027-03-21T18:00Z","h":"118","l":"意甲","r":29},{"a":"118","d":"2027-04-04T18:00Z","h":"4057","l":"意甲","r":30},{"a":"4007","d":"2027-04-11T18:00Z","h":"118","l":"意甲","r":31},{"a":"118","d":"2027-04-18T18:00Z","h":"105","l":"意甲","r":32},{"a":"118","d":"2027-04-25T18:00Z","h":"114","l":"意甲","r":33},{"a":"3263","d":"2027-05-02T18:00Z","h":"118","l":"意甲","r":34},{"a":"111","d":"2027-05-09T18:00Z","h":"118","l":"意甲","r":35},{"a":"118","d":"2027-05-16T18:00Z","h":"112","l":"意甲","r":36},{"a":"3997","d":"2027-05-23T18:00Z","h":"118","l":"意甲","r":37},{"a":"118","d":"2027-05-30T18:00Z","h":"103","l":"意甲","r":38}],"122":[{"a":"10388","d":"2026-11-28T14:30Z","h":"122","l":"德甲","r":11},{"a":"122","d":"2026-12-01T17:00Z","h":"7884","l":"德国杯"},{"a":"122","d":"2026-12-05T14:30Z","h":"3841","l":"德甲","r":12},{"a":"11420","d":"2026-12-12T14:30Z","h":"122","l":"德甲","r":13},{"a":"122","d":"2026-12-19T14:30Z","h":"2950","l":"德甲","r":14},{"a":"126","d":"2027-01-09T14:30Z","h":"122","l":"德甲","r":15},{"a":"124","d":"2027-01-12T19:30Z","h":"122","l":"德甲","r":16},{"a":"122","d":"2027-01-16T14:30Z","h":"3307","l":"德甲","r":17},{"a":"122","d":"2027-01-24T18:30Z","h":"7911","l":"德甲","r":18},{"a":"134","d":"2027-01-30T20:00Z","h":"122","l":"德甲","r":19},{"a":"122","d":"2027-02-06T20:00Z","h":"137","l":"德甲","r":20},{"a":"127","d":"2027-02-13T20:00Z","h":"122","l":"德甲","r":21},{"a":"122","d":"2027-02-20T20:00Z","h":"268","l":"德甲","r":22},{"a":"125","d":"2027-02-27T20:00Z","h":"122","l":"德甲","r":23},{"a":"122","d":"2027-03-03T20:00Z","h":"133","l":"德甲","r":24},{"a":"598","d":"2027-03-06T20:00Z","h":"122","l":"德甲","r":25},{"a":"122","d":"2027-03-13T20:00Z","h":"131","l":"德甲","r":26},{"a":"132","d":"2027-03-20T18:00Z","h":"122","l":"德甲","r":27},{"a":"122","d":"2027-04-03T18:00Z","h":"10388","l":"德甲","r":28},{"a":"3841","d":"2027-04-10T18:00Z","h":"122","l":"德甲","r":29},{"a":"122","d":"2027-04-17T18:00Z","h":"11420","l":"德甲","r":30},{"a":"2950","d":"2027-04-24T18:00Z","h":"122","l":"德甲","r":31},{"a":"122","d":"2027-05-08T18:00Z","h":"126","l":"德甲","r":32},{"a":"122","d":"2027-05-15T18:00Z","h":"124","l":"德甲","r":33},{"a":"3307","d":"2027-05-22T13:30Z","h":"122","l":"德甲","r":34}],"124":[{"a":"131","d":"2026-11-29T18:30Z","h":"124","l":"德甲","r":11},{"a":"124","d":"2026-12-02T19:45Z","h":"125","l":"德国杯"},{"a":"124","d":"2026-12-06T14:30Z","h":"133","l":"德甲","r":12},{"a":"110","d":"2026-12-09T20:00Z","h":"124","l":"欧冠"},{"a":"3841","d":"2026-12-12T14:30Z","h":"124","l":"德甲","r":13},{"a":"124","d":"2026-12-19T17:30Z","h":"11420","l":"德甲","r":14},{"a":"2950","d":"2027-01-08T19:30Z","h":"124","l":"德甲","r":15},{"a":"124","d":"2027-01-12T19:30Z","h":"122","l":"德甲","r":16},{"a":"126","d":"2027-01-16T14:30Z","h":"124","l":"德甲","r":17},{"a":"124","d":"2027-01-19T20:00Z","h":"362","l":"欧冠"},{"a":"124","d":"2027-01-23T17:30Z","h":"127","l":"德甲","r":18},{"a":"887","d":"2027-01-27T20:00Z","h":"124","l":"欧冠"},{"a":"7911","d":"2027-01-30T20:00Z","h":"124","l":"德甲","r":19},{"a":"124","d":"2027-02-06T20:00Z","h":"3307","l":"德甲","r":20},{"a":"134","d":"2027-02-13T20:00Z","h":"124","l":"德甲","r":21},{"a":"124","d":"2027-02-20T20:00Z","h":"137","l":"德甲","r":22},{"a":"598","d":"2027-02-27T20:00Z","h":"124","l":"德甲","r":23},{"a":"124","d":"2027-03-03T20:00Z","h":"125","l":"德甲","r":24},{"a":"132","d":"2027-03-06T20:00Z","h":"124","l":"德甲","r":25},{"a":"124","d":"2027-03-13T20:00Z","h":"10388","l":"德甲","r":26},{"a":"268","d":"2027-03-20T18:00Z","h":"124","l":"德甲","r":27},{"a":"124","d":"2027-04-03T18:00Z","h":"131","l":"德甲","r":28},{"a":"133","d":"2027-04-10T18:00Z","h":"124","l":"德甲","r":29},{"a":"124","d":"2027-04-17T18:00Z","h":"3841","l":"德甲","r":30},{"a":"11420","d":"2027-04-24T18:00Z","h":"124","l":"德甲","r":31},{"a":"124","d":"2027-05-08T18:00Z","h":"2950","l":"德甲","r":32},{"a":"122","d":"2027-05-15T18:00Z","h":"124","l":"德甲","r":33},{"a":"124","d":"2027-05-22T13:30Z","h":"126","l":"德甲","r":34}],"125":[{"a":"125","d":"2026-11-28T17:30Z","h":"134","l":"德甲","r":11},{"a":"124","d":"2026-12-02T19:45Z","h":"125","l":"德国杯"},{"a":"137","d":"2026-12-05T17:30Z","h":"125","l":"德甲","r":12},{"a":"125","d":"2026-12-12T17:30Z","h":"268","l":"德甲","r":13},{"a":"125","d":"2026-12-19T14:30Z","h":"131","l":"德甲","r":14},{"a":"133","d":"2027-01-09T14:30Z","h":"125","l":"德甲","r":15},{"a":"125","d":"2027-01-13T17:30Z","h":"10388","l":"德甲","r":16},{"a":"132","d":"2027-01-16T17:30Z","h":"125","l":"德甲","r":17},{"a":"598","d":"2027-01-24T14:30Z","h":"125","l":"德甲","r":18},{"a":"125","d":"2027-01-30T20:00Z","h":"3841","l":"德甲","r":19},{"a":"2950","d":"2027-02-06T20:00Z","h":"125","l":"德甲","r":20},{"a":"125","d":"2027-02-13T20:00Z","h":"126","l":"德甲","r":21},{"a":"11420","d":"2027-02-20T20:00Z","h":"125","l":"德甲","r":22},{"a":"125","d":"2027-02-27T20:00Z","h":"122","l":"德甲","r":23},{"a":"124","d":"2027-03-03T20:00Z","h":"125","l":"德甲","r":24},{"a":"125","d":"2027-03-06T20:00Z","h":"127","l":"德甲","r":25},{"a":"3307","d":"2027-03-13T20:00Z","h":"125","l":"德甲","r":26},{"a":"125","d":"2027-03-20T18:00Z","h":"7911","l":"德甲","r":27},{"a":"134","d":"2027-04-03T18:00Z","h":"125","l":"德甲","r":28},{"a":"125","d":"2027-04-10T18:00Z","h":"137","l":"德甲","r":29},{"a":"268","d":"2027-04-17T18:00Z","h":"125","l":"德甲","r":30},{"a":"131","d":"2027-04-24T18:00Z","h":"125","l":"德甲","r":31},{"a":"125","d":"2027-05-08T18:00Z","h":"133","l":"德甲","r":32},{"a":"10388","d":"2027-05-15T18:00Z","h":"125","l":"德甲","r":33},{"a":"125","d":"2027-05-22T13:30Z","h":"132","l":"德甲","r":34}],"126":[{"a":"152","d":"2026-11-26T20:00Z","h":"126","l":"欧协联"},{"a":"11420","d":"2026-11-29T14:30Z","h":"126","l":"德甲","r":11},{"a":"126","d":"2026-12-02T17:00Z","h":"130","l":"德国杯"},{"a":"7911","d":"2026-12-05T14:30Z","h":"126","l":"德甲","r":12},{"a":"443","d":"2026-12-10T17:45Z","h":"126","l":"欧协联"},{"a":"126","d":"2026-12-13T14:30Z","h":"2950","l":"德甲","r":13},{"a":"126","d":"2026-12-17T20:00Z","h":"20028","l":"欧协联"},{"a":"134","d":"2026-12-20T14:30Z","h":"126","l":"德甲","r":14},{"a":"126","d":"2027-01-09T14:30Z","h":"122","l":"德甲","r":15},{"a":"127","d":"2027-01-13T19:30Z","h":"126","l":"德甲","r":16},{"a":"126","d":"2027-01-16T14:30Z","h":"124","l":"德甲","r":17},{"a":"126","d":"2027-01-22T19:30Z","h":"137","l":"德甲","r":18},{"a":"3307","d":"2027-01-30T20:00Z","h":"126","l":"德甲","r":19},{"a":"126","d":"2027-02-06T20:00Z","h":"268","l":"德甲","r":20},{"a":"125","d":"2027-02-13T20:00Z","h":"126","l":"德甲","r":21},{"a":"126","d":"2027-02-20T20:00Z","h":"133","l":"德甲","r":22},{"a":"131","d":"2027-02-27T20:00Z","h":"126","l":"德甲","r":23},{"a":"126","d":"2027-03-03T20:00Z","h":"132","l":"德甲","r":24},{"a":"3841","d":"2027-03-06T20:00Z","h":"126","l":"德甲","r":25},{"a":"126","d":"2027-03-13T20:00Z","h":"598","l":"德甲","r":26},{"a":"10388","d":"2027-03-20T18:00Z","h":"126","l":"德甲","r":27},{"a":"126","d":"2027-04-03T18:00Z","h":"11420","l":"德甲","r":28},{"a":"126","d":"2027-04-10T18:00Z","h":"7911","l":"德甲","r":29},{"a":"2950","d":"2027-04-17T18:00Z","h":"126","l":"德甲","r":30},{"a":"126","d":"2027-04-24T18:00Z","h":"134","l":"德甲","r":31},{"a":"122","d":"2027-05-08T18:00Z","h":"126","l":"德甲","r":32},{"a":"126","d":"2027-05-15T18:00Z","h":"127","l":"德甲","r":33},{"a":"124","d":"2027-05-22T13:30Z","h":"126","l":"德甲","r":34}],"127":[{"a":"132","d":"2026-11-28T14:30Z","h":"127","l":"德甲","r":11},{"a":"127","d":"2026-12-05T14:30Z","h":"598","l":"德甲","r":12},{"a":"133","d":"2026-12-11T19:30Z","h":"127","l":"德甲","r":13},{"a":"127","d":"2026-12-19T14:30Z","h":"10388","l":"德甲","r":14},{"a":"131","d":"2027-01-10T16:30Z","h":"127","l":"德甲","r":15},{"a":"127","d":"2027-01-13T19:30Z","h":"126","l":"德甲","r":16},{"a":"3841","d":"2027-01-16T14:30Z","h":"127","l":"德甲","r":17},{"a":"124","d":"2027-01-23T17:30Z","h":"127","l":"德甲","r":18},{"a":"127","d":"2027-01-30T20:00Z","h":"2950","l":"德甲","r":19},{"a":"11420","d":"2027-02-06T20:00Z","h":"127","l":"德甲","r":20},{"a":"127","d":"2027-02-13T20:00Z","h":"122","l":"德甲","r":21},{"a":"7911","d":"2027-02-20T20:00Z","h":"127","l":"德甲","r":22},{"a":"127","d":"2027-02-27T20:00Z","h":"134","l":"德甲","r":23},{"a":"3307","d":"2027-03-03T20:00Z","h":"127","l":"德甲","r":24},{"a":"125","d":"2027-03-06T20:00Z","h":"127","l":"德甲","r":25},{"a":"127","d":"2027-03-13T20:00Z","h":"268","l":"德甲","r":26},{"a":"137","d":"2027-03-20T18:00Z","h":"127","l":"德甲","r":27},{"a":"127","d":"2027-04-03T18:00Z","h":"132","l":"德甲","r":28},{"a":"598","d":"2027-04-10T18:00Z","h":"127","l":"德甲","r":29},{"a":"127","d":"2027-04-17T18:00Z","h":"133","l":"德甲","r":30},{"a":"10388","d":"2027-04-24T18:00Z","h":"127","l":"德甲","r":31},{"a":"127","d":"2027-05-08T18:00Z","h":"131","l":"德甲","r":32},{"a":"126","d":"2027-05-15T18:00Z","h":"127","l":"德甲","r":33},{"a":"127","d":"2027-05-22T13:30Z","h":"3841","l":"德甲","r":34}],"131":[{"a":"131","d":"2026-11-26T17:45Z","h":"597","l":"欧联"},{"a":"131","d":"2026-11-29T18:30Z","h":"124","l":"德甲","r":11},{"a":"11420","d":"2026-12-02T17:00Z","h":"131","l":"德国杯"},{"a":"268","d":"2026-12-05T14:30Z","h":"131","l":"德甲","r":12},{"a":"1895","d":"2026-12-10T20:00Z","h":"131","l":"欧联"},{"a":"131","d":"2026-12-13T18:30Z","h":"137","l":"德甲","r":13},{"a":"125","d":"2026-12-19T14:30Z","h":"131","l":"德甲","r":14},{"a":"131","d":"2027-01-10T16:30Z","h":"127","l":"德甲","r":15},{"a":"131","d":"2027-01-13T19:30Z","h":"132","l":"德甲","r":16},{"a":"133","d":"2027-01-17T16:30Z","h":"131","l":"德甲","r":17},{"a":"2790","d":"2027-01-21T20:00Z","h":"131","l":"欧联"},{"a":"10388","d":"2027-01-24T16:30Z","h":"131","l":"德甲","r":18},{"a":"131","d":"2027-01-28T20:00Z","h":"167","l":"欧联"},{"a":"131","d":"2027-01-30T20:00Z","h":"598","l":"德甲","r":19},{"a":"3841","d":"2027-02-06T20:00Z","h":"131","l":"德甲","r":20},{"a":"131","d":"2027-02-13T20:00Z","h":"11420","l":"德甲","r":21},{"a":"2950","d":"2027-02-20T20:00Z","h":"131","l":"德甲","r":22},{"a":"131","d":"2027-02-27T20:00Z","h":"126","l":"德甲","r":23},{"a":"7911","d":"2027-03-03T20:00Z","h":"131","l":"德甲","r":24},{"a":"131","d":"2027-03-06T20:00Z","h":"134","l":"德甲","r":25},{"a":"122","d":"2027-03-13T20:00Z","h":"131","l":"德甲","r":26},{"a":"131","d":"2027-03-20T18:00Z","h":"3307","l":"德甲","r":27},{"a":"124","d":"2027-04-03T18:00Z","h":"131","l":"德甲","r":28},{"a":"131","d":"2027-04-10T18:00Z","h":"268","l":"德甲","r":29},{"a":"137","d":"2027-04-17T18:00Z","h":"131","l":"德甲","r":30},{"a":"131","d":"2027-04-24T18:00Z","h":"125","l":"德甲","r":31},{"a":"127","d":"2027-05-08T18:00Z","h":"131","l":"德甲","r":32},{"a":"132","d":"2027-05-15T18:00Z","h":"131","l":"德甲","r":33},{"a":"131","d":"2027-05-22T13:30Z","h":"133","l":"德甲","r":34}],"132":[{"a":"132","d":"2026-11-28T14:30Z","h":"127","l":"德甲","r":11},{"a":"129","d":"2026-12-01T19:45Z","h":"132","l":"德国杯"},{"a":"3307","d":"2026-12-04T19:30Z","h":"132","l":"德甲","r":12},{"a":"494","d":"2026-12-08T20:00Z","h":"132","l":"欧冠"},{"a":"132","d":"2026-12-13T16:30Z","h":"7911","l":"德甲","r":13},{"a":"137","d":"2026-12-18T19:30Z","h":"132","l":"德甲","r":14},{"a":"132","d":"2027-01-09T17:30Z","h":"268","l":"德甲","r":15},{"a":"131","d":"2027-01-13T19:30Z","h":"132","l":"德甲","r":16},{"a":"132","d":"2027-01-16T17:30Z","h":"125","l":"德甲","r":17},{"a":"132","d":"2027-01-20T20:00Z","h":"360","l":"欧冠"},{"a":"132","d":"2027-01-23T14:30Z","h":"134","l":"德甲","r":18},{"a":"244","d":"2027-01-27T20:00Z","h":"132","l":"欧冠"},{"a":"133","d":"2027-01-30T20:00Z","h":"132","l":"德甲","r":19},{"a":"10388","d":"2027-02-06T20:00Z","h":"132","l":"德甲","r":20},{"a":"132","d":"2027-02-13T20:00Z","h":"598","l":"德甲","r":21},{"a":"3841","d":"2027-02-20T20:00Z","h":"132","l":"德甲","r":22},{"a":"132","d":"2027-02-27T20:00Z","h":"11420","l":"德甲","r":23},{"a":"126","d":"2027-03-03T20:00Z","h":"132","l":"德甲","r":24},{"a":"132","d":"2027-03-06T20:00Z","h":"124","l":"德甲","r":25},{"a":"2950","d":"2027-03-13T20:00Z","h":"132","l":"德甲","r":26},{"a":"132","d":"2027-03-20T18:00Z","h":"122","l":"德甲","r":27},{"a":"127","d":"2027-04-03T18:00Z","h":"132","l":"德甲","r":28},{"a":"132","d":"2027-04-10T18:00Z","h":"3307","l":"德甲","r":29},{"a":"7911","d":"2027-04-17T18:00Z","h":"132","l":"德甲","r":30},{"a":"132","d":"2027-04-24T18:00Z","h":"137","l":"德甲","r":31},{"a":"268","d":"2027-05-08T18:00Z","h":"132","l":"德甲","r":32},{"a":"132","d":"2027-05-15T18:00Z","h":"131","l":"德甲","r":33},{"a":"125","d":"2027-05-22T13:30Z","h":"132","l":"德甲","r":34}],"133":[{"a":"133","d":"2026-11-28T14:30Z","h":"3307","l":"德甲","r":11},{"a":"124","d":"2026-12-06T14:30Z","h":"133","l":"德甲","r":12},{"a":"133","d":"2026-12-11T19:30Z","h":"127","l":"德甲","r":13},{"a":"268","d":"2026-12-20T18:30Z","h":"133","l":"德甲","r":14},{"a":"133","d":"2027-01-09T14:30Z","h":"125","l":"德甲","r":15},{"a":"137","d":"2027-01-14T19:30Z","h":"133","l":"德甲","r":16},{"a":"133","d":"2027-01-17T16:30Z","h":"131","l":"德甲","r":17},{"a":"3841","d":"2027-01-23T14:30Z","h":"133","l":"德甲","r":18},{"a":"133","d":"2027-01-30T20:00Z","h":"132","l":"德甲","r":19},{"a":"598","d":"2027-02-06T20:00Z","h":"133","l":"德甲","r":20},{"a":"133","d":"2027-02-13T20:00Z","h":"10388","l":"德甲","r":21},{"a":"126","d":"2027-02-20T20:00Z","h":"133","l":"德甲","r":22},{"a":"133","d":"2027-02-27T20:00Z","h":"2950","l":"德甲","r":23},{"a":"122","d":"2027-03-03T20:00Z","h":"133","l":"德甲","r":24},{"a":"133","d":"2027-03-06T20:00Z","h":"11420","l":"德甲","r":25},{"a":"7911","d":"2027-03-13T20:00Z","h":"133","l":"德甲","r":26},{"a":"133","d":"2027-03-20T18:00Z","h":"134","l":"德甲","r":27},{"a":"3307","d":"2027-04-03T18:00Z","h":"133","l":"德甲","r":28},{"a":"133","d":"2027-04-10T18:00Z","h":"124","l":"德甲","r":29},{"a":"127","d":"2027-04-17T18:00Z","h":"133","l":"德甲","r":30},{"a":"133","d":"2027-04-24T18:00Z","h":"268","l":"德甲","r":31},{"a":"125","d":"2027-05-08T18:00Z","h":"133","l":"德甲","r":32},{"a":"133","d":"2027-05-15T18:00Z","h":"137","l":"德甲","r":33},{"a":"131","d":"2027-05-22T13:30Z","h":"133","l":"德甲","r":34}],"134":[{"a":"125","d":"2026-11-28T17:30Z","h":"134","l":"德甲","r":11},{"a":"7017","d":"2026-12-01T17:00Z","h":"134","l":"德国杯"},{"a":"134","d":"2026-12-06T16:30Z","h":"10388","l":"德甲","r":12},{"a":"166","d":"2026-12-09T20:00Z","h":"134","l":"欧冠"},{"a":"598","d":"2026-12-12T14:30Z","h":"134","l":"德甲","r":13},{"a":"134","d":"2026-12-20T14:30Z","h":"126","l":"德甲","r":14},{"a":"3841","d":"2027-01-09T14:30Z","h":"134","l":"德甲","r":15},{"a":"134","d":"2027-01-12T17:30Z","h":"11420","l":"德甲","r":16},{"a":"2950","d":"2027-01-15T19:30Z","h":"134","l":"德甲","r":17},{"a":"570","d":"2027-01-19T20:00Z","h":"134","l":"欧冠"},{"a":"132","d":"2027-01-23T14:30Z","h":"134","l":"德甲","r":18},{"a":"134","d":"2027-01-27T20:00Z","h":"148","l":"欧冠"},{"a":"134","d":"2027-01-30T20:00Z","h":"122","l":"德甲","r":19},{"a":"7911","d":"2027-02-06T20:00Z","h":"134","l":"德甲","r":20},{"a":"134","d":"2027-02-13T20:00Z","h":"124","l":"德甲","r":21},{"a":"3307","d":"2027-02-20T20:00Z","h":"134","l":"德甲","r":22},{"a":"127","d":"2027-02-27T20:00Z","h":"134","l":"德甲","r":23},{"a":"134","d":"2027-03-03T20:00Z","h":"268","l":"德甲","r":24},{"a":"131","d":"2027-03-06T20:00Z","h":"134","l":"德甲","r":25},{"a":"134","d":"2027-03-13T20:00Z","h":"137","l":"德甲","r":26},{"a":"133","d":"2027-03-20T18:00Z","h":"134","l":"德甲","r":27},{"a":"134","d":"2027-04-03T18:00Z","h":"125","l":"德甲","r":28},{"a":"10388","d":"2027-04-10T18:00Z","h":"134","l":"德甲","r":29},{"a":"134","d":"2027-04-17T18:00Z","h":"598","l":"德甲","r":30},{"a":"126","d":"2027-04-24T18:00Z","h":"134","l":"德甲","r":31},{"a":"134","d":"2027-05-08T18:00Z","h":"3841","l":"德甲","r":32},{"a":"11420","d":"2027-05-15T18:00Z","h":"134","l":"德甲","r":33},{"a":"134","d":"2027-05-22T13:30Z","h":"2950","l":"德甲","r":34}],"137":[{"a":"268","d":"2026-11-27T19:30Z","h":"137","l":"德甲","r":11},{"a":"137","d":"2026-12-05T17:30Z","h":"125","l":"德甲","r":12},{"a":"131","d":"2026-12-13T18:30Z","h":"137","l":"德甲","r":13},{"a":"137","d":"2026-12-18T19:30Z","h":"132","l":"德甲","r":14},{"a":"598","d":"2027-01-10T14:30Z","h":"137","l":"德甲","r":15},{"a":"137","d":"2027-01-14T19:30Z","h":"133","l":"德甲","r":16},{"a":"10388","d":"2027-01-17T14:30Z","h":"137","l":"德甲","r":17},{"a":"126","d":"2027-01-22T19:30Z","h":"137","l":"德甲","r":18},{"a":"137","d":"2027-01-30T20:00Z","h":"11420","l":"德甲","r":19},{"a":"122","d":"2027-02-06T20:00Z","h":"137","l":"德甲","r":20},{"a":"137","d":"2027-02-13T20:00Z","h":"3841","l":"德甲","r":21},{"a":"124","d":"2027-02-20T20:00Z","h":"137","l":"德甲","r":22},{"a":"137","d":"2027-02-27T20:00Z","h":"3307","l":"德甲","r":23},{"a":"2950","d":"2027-03-03T20:00Z","h":"137","l":"德甲","r":24},{"a":"137","d":"2027-03-06T20:00Z","h":"7911","l":"德甲","r":25},{"a":"134","d":"2027-03-13T20:00Z","h":"137","l":"德甲","r":26},{"a":"137","d":"2027-03-20T18:00Z","h":"127","l":"德甲","r":27},{"a":"137","d":"2027-04-03T18:00Z","h":"268","l":"德甲","r":28},{"a":"125","d":"2027-04-10T18:00Z","h":"137","l":"德甲","r":29},{"a":"137","d":"2027-04-17T18:00Z","h":"131","l":"德甲","r":30},{"a":"132","d":"2027-04-24T18:00Z","h":"137","l":"德甲","r":31},{"a":"137","d":"2027-05-08T18:00Z","h":"598","l":"德甲","r":32},{"a":"133","d":"2027-05-15T18:00Z","h":"137","l":"德甲","r":33},{"a":"137","d":"2027-05-22T13:30Z","h":"10388","l":"德甲","r":34}],"1538":[{"a":"87","d":"2026-11-27T20:00Z","h":"1538","l":"西甲","r":14},{"a":"1538","d":"2026-12-01T18:00Z","h":"9449","l":"国王杯"},{"a":"1538","d":"2026-12-05T15:15Z","h":"101","l":"西甲","r":15},{"a":"96","d":"2026-12-12T13:00Z","h":"1538","l":"西甲","r":16},{"a":"1538","d":"2026-12-20T20:00Z","h":"2922","l":"西甲","r":17},{"a":"94","d":"2027-01-03T20:00Z","h":"1538","l":"西甲","r":18},{"a":"1538","d":"2027-01-10T20:00Z","h":"86","l":"西甲","r":20},{"a":"88","d":"2027-01-17T20:00Z","h":"1538","l":"西甲","r":20},{"a":"1538","d":"2027-01-24T20:00Z","h":"93","l":"西甲","r":21},{"a":"89","d":"2027-01-31T20:00Z","h":"1538","l":"西甲","r":23},{"a":"1538","d":"2027-02-07T20:00Z","h":"3751","l":"西甲","r":23},{"a":"99","d":"2027-02-14T20:00Z","h":"1538","l":"西甲","r":24},{"a":"1538","d":"2027-02-21T20:00Z","h":"83","l":"西甲","r":25},{"a":"90","d":"2027-02-28T20:00Z","h":"1538","l":"西甲","r":26},{"a":"1538","d":"2027-03-07T20:00Z","h":"94","l":"西甲","r":27},{"a":"1538","d":"2027-03-14T18:00Z","h":"244","l":"西甲","r":28},{"a":"97","d":"2027-03-21T18:00Z","h":"1538","l":"西甲","r":29},{"a":"101","d":"2027-04-04T18:00Z","h":"1538","l":"西甲","r":30},{"a":"1538","d":"2027-04-11T18:00Z","h":"1068","l":"西甲","r":31},{"a":"102","d":"2027-04-18T18:00Z","h":"1538","l":"西甲","r":32},{"a":"1538","d":"2027-04-21T18:00Z","h":"243","l":"西甲","r":33},{"a":"86","d":"2027-05-02T18:00Z","h":"1538","l":"西甲","r":34},{"a":"1538","d":"2027-05-09T18:00Z","h":"96","l":"西甲","r":35},{"a":"2922","d":"2027-05-16T18:00Z","h":"1538","l":"西甲","r":36},{"a":"1538","d":"2027-05-23T18:00Z","h":"87","l":"西甲","r":37},{"a":"85","d":"2027-05-30T18:00Z","h":"1538","l":"西甲","r":38}],"160":[{"a":"273","d":"2026-11-28T19:45Z","h":"160","l":"法甲","r":12},{"a":"160","d":"2026-12-04T19:45Z","h":"179","l":"法甲","r":13},{"a":"160","d":"2026-12-08T20:00Z","h":"362","l":"欧冠"},{"a":"6851","d":"2026-12-12T16:15Z","h":"160","l":"法甲","r":14},{"a":"160","d":"2027-01-03T19:45Z","h":"175","l":"法甲","r":15},{"a":"160","d":"2027-01-16T16:15Z","h":"7868","l":"法甲","r":16},{"a":"160","d":"2027-01-20T20:00Z","h":"2572","l":"欧冠"},{"a":"172","d":"2027-01-23T19:45Z","h":"160","l":"法甲","r":17},{"a":"432","d":"2027-01-27T20:00Z","h":"160","l":"欧冠"},{"a":"160","d":"2027-01-30T16:15Z","h":"174","l":"法甲","r":18},{"a":"176","d":"2027-02-07T19:45Z","h":"160","l":"法甲","r":19},{"a":"160","d":"2027-02-13T20:00Z","h":"2697","l":"法甲","r":20},{"a":"6997","d":"2027-02-20T20:00Z","h":"160","l":"法甲","r":21},{"a":"175","d":"2027-02-28T19:45Z","h":"160","l":"法甲","r":22},{"a":"169","d":"2027-03-06T20:00Z","h":"160","l":"法甲","r":23},{"a":"160","d":"2027-03-13T20:00Z","h":"172","l":"法甲","r":24},{"a":"180","d":"2027-03-20T18:00Z","h":"160","l":"法甲","r":25},{"a":"160","d":"2027-04-03T18:00Z","h":"6851","l":"法甲","r":26},{"a":"3236","d":"2027-04-10T18:00Z","h":"160","l":"法甲","r":27},{"a":"166","d":"2027-04-17T18:00Z","h":"160","l":"法甲","r":28},{"a":"160","d":"2027-04-24T18:00Z","h":"273","l":"法甲","r":29},{"a":"7868","d":"2027-05-01T18:00Z","h":"160","l":"法甲","r":30},{"a":"160","d":"2027-05-09T18:45Z","h":"167","l":"法甲","r":31},{"a":"2502","d":"2027-05-16T18:00Z","h":"160","l":"法甲","r":32},{"a":"160","d":"2027-05-22T18:00Z","h":"170","l":"法甲","r":33},{"a":"179","d":"2027-05-29T18:00Z","h":"160","l":"法甲","r":34}],"166":[{"a":"166","d":"2026-11-28T19:45Z","h":"2697","l":"法甲","r":12},{"a":"172","d":"2026-12-05T16:15Z","h":"166","l":"法甲","r":13},{"a":"166","d":"2026-12-09T20:00Z","h":"134","l":"欧冠"},{"a":"166","d":"2026-12-13T14:00Z","h":"273","l":"法甲","r":14},{"a":"180","d":"2027-01-03T16:15Z","h":"166","l":"法甲","r":15},{"a":"166","d":"2027-01-15T19:45Z","h":"176","l":"法甲","r":16},{"a":"521","d":"2027-01-19T20:00Z","h":"166","l":"欧冠"},{"a":"6851","d":"2027-01-23T16:15Z","h":"166","l":"法甲","r":17},{"a":"166","d":"2027-01-27T20:00Z","h":"104","l":"欧冠"},{"a":"166","d":"2027-01-31T19:45Z","h":"167","l":"法甲","r":18},{"a":"166","d":"2027-02-06T20:00Z","h":"170","l":"法甲","r":19},{"a":"2502","d":"2027-02-13T20:00Z","h":"166","l":"法甲","r":20},{"a":"273","d":"2027-02-20T20:00Z","h":"166","l":"法甲","r":21},{"a":"166","d":"2027-02-27T20:00Z","h":"172","l":"法甲","r":22},{"a":"176","d":"2027-03-06T20:00Z","h":"166","l":"法甲","r":23},{"a":"166","d":"2027-03-13T20:00Z","h":"6997","l":"法甲","r":24},{"a":"166","d":"2027-03-20T18:00Z","h":"175","l":"法甲","r":25},{"a":"169","d":"2027-04-03T18:00Z","h":"166","l":"法甲","r":26},{"a":"179","d":"2027-04-10T18:00Z","h":"166","l":"法甲","r":27},{"a":"166","d":"2027-04-17T18:00Z","h":"160","l":"法甲","r":28},{"a":"174","d":"2027-04-24T18:00Z","h":"166","l":"法甲","r":29},{"a":"166","d":"2027-05-01T18:00Z","h":"180","l":"法甲","r":30},{"a":"166","d":"2027-05-08T18:00Z","h":"6851","l":"法甲","r":31},{"a":"7868","d":"2027-05-16T18:00Z","h":"166","l":"法甲","r":32},{"a":"166","d":"2027-05-22T18:00Z","h":"3236","l":"法甲","r":33},{"a":"2697","d":"2027-05-29T18:00Z","h":"166","l":"法甲","r":34}],"167":[{"a":"987","d":"2026-11-26T20:00Z","h":"167","l":"欧联"},{"a":"174","d":"2026-11-29T19:45Z","h":"167","l":"法甲","r":12},{"a":"167","d":"2026-12-06T14:00Z","h":"170","l":"法甲","r":13},{"a":"5807","d":"2026-12-10T20:00Z","h":"167","l":"欧联"},{"a":"176","d":"2026-12-13T19:45Z","h":"167","l":"法甲","r":14},{"a":"167","d":"2027-01-03T14:00Z","h":"2697","l":"法甲","r":15},{"a":"273","d":"2027-01-17T19:45Z","h":"167","l":"法甲","r":16},{"a":"167","d":"2027-01-21T17:45Z","h":"11505","l":"欧联"},{"a":"167","d":"2027-01-24T19:45Z","h":"180","l":"法甲","r":17},{"a":"131","d":"2027-01-28T20:00Z","h":"167","l":"欧联"},{"a":"166","d":"2027-01-31T19:45Z","h":"167","l":"法甲","r":18},{"a":"167","d":"2027-02-06T20:00Z","h":"169","l":"法甲","r":19},{"a":"175","d":"2027-02-13T20:00Z","h":"167","l":"法甲","r":20},{"a":"167","d":"2027-02-20T20:00Z","h":"3236","l":"法甲","r":21},{"a":"179","d":"2027-02-27T20:00Z","h":"167","l":"法甲","r":22},{"a":"167","d":"2027-03-06T20:00Z","h":"174","l":"法甲","r":23},{"a":"170","d":"2027-03-13T20:00Z","h":"167","l":"法甲","r":24},{"a":"167","d":"2027-03-21T19:45Z","h":"176","l":"法甲","r":25},{"a":"167","d":"2027-04-03T18:00Z","h":"2502","l":"法甲","r":26},{"a":"180","d":"2027-04-10T18:00Z","h":"167","l":"法甲","r":27},{"a":"167","d":"2027-04-17T18:00Z","h":"7868","l":"法甲","r":28},{"a":"6997","d":"2027-04-24T18:00Z","h":"167","l":"法甲","r":29},{"a":"167","d":"2027-05-01T18:00Z","h":"172","l":"法甲","r":30},{"a":"160","d":"2027-05-09T18:45Z","h":"167","l":"法甲","r":31},{"a":"2697","d":"2027-05-16T18:00Z","h":"167","l":"法甲","r":32},{"a":"167","d":"2027-05-22T18:00Z","h":"273","l":"法甲","r":33},{"a":"6851","d":"2027-05-29T18:00Z","h":"167","l":"法甲","r":34}],"169":[{"a":"169","d":"2026-11-26T20:00Z","h":"147","l":"欧联"},{"a":"169","d":"2026-11-29T16:15Z","h":"179","l":"法甲","r":12},{"a":"6997","d":"2026-12-06T16:15Z","h":"169","l":"法甲","r":13},{"a":"597","d":"2026-12-10T17:45Z","h":"169","l":"欧联"},{"a":"174","d":"2026-12-13T16:15Z","h":"169","l":"法甲","r":14},{"a":"169","d":"2027-01-02T20:00Z","h":"170","l":"法甲","r":15},{"a":"175","d":"2027-01-16T19:45Z","h":"169","l":"法甲","r":16},{"a":"617","d":"2027-01-21T20:00Z","h":"169","l":"欧联"},{"a":"169","d":"2027-01-24T14:00Z","h":"3236","l":"法甲","r":17},{"a":"169","d":"2027-01-28T20:00Z","h":"433","l":"欧联"},{"a":"273","d":"2027-01-31T14:00Z","h":"169","l":"法甲","r":18},{"a":"167","d":"2027-02-06T20:00Z","h":"169","l":"法甲","r":19},{"a":"169","d":"2027-02-13T20:00Z","h":"6997","l":"法甲","r":20},{"a":"179","d":"2027-02-20T20:00Z","h":"169","l":"法甲","r":21},{"a":"169","d":"2027-02-27T20:00Z","h":"176","l":"法甲","r":22},{"a":"169","d":"2027-03-06T20:00Z","h":"160","l":"法甲","r":23},{"a":"169","d":"2027-03-13T20:00Z","h":"2697","l":"法甲","r":24},{"a":"6851","d":"2027-03-20T18:00Z","h":"169","l":"法甲","r":25},{"a":"169","d":"2027-04-03T18:00Z","h":"166","l":"法甲","r":26},{"a":"169","d":"2027-04-10T18:00Z","h":"174","l":"法甲","r":27},{"a":"170","d":"2027-04-17T18:00Z","h":"169","l":"法甲","r":28},{"a":"169","d":"2027-04-24T18:00Z","h":"180","l":"法甲","r":29},{"a":"2502","d":"2027-05-01T18:00Z","h":"169","l":"法甲","r":30},{"a":"3236","d":"2027-05-08T18:00Z","h":"169","l":"法甲","r":31},{"a":"169","d":"2027-05-16T18:00Z","h":"172","l":"法甲","r":32},{"a":"169","d":"2027-05-22T18:00Z","h":"175","l":"法甲","r":33},{"a":"7868","d":"2027-05-29T18:00Z","h":"169","l":"法甲","r":34}],"170":[{"a":"170","d":"2026-11-28T19:45Z","h":"2502","l":"法甲","r":12},{"a":"167","d":"2026-12-06T14:00Z","h":"170","l":"法甲","r":13},{"a":"170","d":"2026-12-12T19:45Z","h":"6997","l":"法甲","r":14},{"a":"169","d":"2027-01-02T20:00Z","h":"170","l":"法甲","r":15},{"a":"170","d":"2027-01-16T19:45Z","h":"172","l":"法甲","r":16},{"a":"174","d":"2027-01-22T19:45Z","h":"170","l":"法甲","r":17},{"a":"170","d":"2027-01-31T16:15Z","h":"176","l":"法甲","r":18},{"a":"166","d":"2027-02-06T20:00Z","h":"170","l":"法甲","r":19},{"a":"170","d":"2027-02-13T20:00Z","h":"6851","l":"法甲","r":20},{"a":"170","d":"2027-02-20T20:00Z","h":"175","l":"法甲","r":21},{"a":"2502","d":"2027-02-27T20:00Z","h":"170","l":"法甲","r":22},{"a":"273","d":"2027-03-06T20:00Z","h":"170","l":"法甲","r":23},{"a":"170","d":"2027-03-13T20:00Z","h":"167","l":"法甲","r":24},{"a":"172","d":"2027-03-20T18:00Z","h":"170","l":"法甲","r":25},{"a":"170","d":"2027-04-03T18:00Z","h":"3236","l":"法甲","r":26},{"a":"7868","d":"2027-04-10T18:00Z","h":"170","l":"法甲","r":27},{"a":"170","d":"2027-04-17T18:00Z","h":"169","l":"法甲","r":28},{"a":"179","d":"2027-04-24T18:00Z","h":"170","l":"法甲","r":29},{"a":"6997","d":"2027-05-01T18:00Z","h":"170","l":"法甲","r":30},{"a":"170","d":"2027-05-08T18:00Z","h":"2697","l":"法甲","r":31},{"a":"170","d":"2027-05-16T18:00Z","h":"180","l":"法甲","r":32},{"a":"160","d":"2027-05-22T18:00Z","h":"170","l":"法甲","r":33},{"a":"170","d":"2027-05-29T18:00Z","h":"174","l":"法甲","r":34}],"172":[{"a":"176","d":"2026-11-29T14:00Z","h":"172","l":"法甲","r":12},{"a":"172","d":"2026-12-05T16:15Z","h":"166","l":"法甲","r":13},{"a":"179","d":"2026-12-11T19:45Z","h":"172","l":"法甲","r":14},{"a":"172","d":"2027-01-02T20:00Z","h":"273","l":"法甲","r":15},{"a":"170","d":"2027-01-16T19:45Z","h":"172","l":"法甲","r":16},{"a":"172","d":"2027-01-23T19:45Z","h":"160","l":"法甲","r":17},{"a":"172","d":"2027-01-30T19:45Z","h":"6851","l":"法甲","r":18},{"a":"174","d":"2027-02-06T20:00Z","h":"172","l":"法甲","r":19},{"a":"180","d":"2027-02-13T20:00Z","h":"172","l":"法甲","r":20},{"a":"172","d":"2027-02-20T20:00Z","h":"2502","l":"法甲","r":21},{"a":"166","d":"2027-02-27T20:00Z","h":"172","l":"法甲","r":22},{"a":"172","d":"2027-03-06T20:00Z","h":"7868","l":"法甲","r":23},{"a":"160","d":"2027-03-13T20:00Z","h":"172","l":"法甲","r":24},{"a":"172","d":"2027-03-20T18:00Z","h":"170","l":"法甲","r":25},{"a":"175","d":"2027-04-03T18:00Z","h":"172","l":"法甲","r":26},{"a":"172","d":"2027-04-10T18:00Z","h":"2697","l":"法甲","r":27},{"a":"273","d":"2027-04-17T18:00Z","h":"172","l":"法甲","r":28},{"a":"172","d":"2027-04-24T18:00Z","h":"176","l":"法甲","r":29},{"a":"167","d":"2027-05-01T18:00Z","h":"172","l":"法甲","r":30},{"a":"172","d":"2027-05-08T18:00Z","h":"6997","l":"法甲","r":31},{"a":"169","d":"2027-05-16T18:00Z","h":"172","l":"法甲","r":32},{"a":"172","d":"2027-05-22T18:00Z","h":"179","l":"法甲","r":33},{"a":"3236","d":"2027-05-29T18:00Z","h":"172","l":"法甲","r":34}],"174":[{"a":"174","d":"2026-11-26T17:45Z","h":"262","l":"欧协联"},{"a":"174","d":"2026-11-29T19:45Z","h":"167","l":"法甲","r":12},{"a":"7868","d":"2026-12-05T19:45Z","h":"174","l":"法甲","r":13},{"a":"174","d":"2026-12-10T20:00Z","h":"331","l":"欧协联"},{"a":"174","d":"2026-12-13T16:15Z","h":"169","l":"法甲","r":14},{"a":"17856","d":"2026-12-17T20:00Z","h":"174","l":"欧协联"},{"a":"2502","d":"2027-01-02T20:00Z","h":"174","l":"法甲","r":15},{"a":"6997","d":"2027-01-17T16:15Z","h":"174","l":"法甲","r":16},{"a":"174","d":"2027-01-22T19:45Z","h":"170","l":"法甲","r":17},{"a":"160","d":"2027-01-30T16:15Z","h":"174","l":"法甲","r":18},{"a":"174","d":"2027-02-06T20:00Z","h":"172","l":"法甲","r":19},{"a":"174","d":"2027-02-13T20:00Z","h":"179","l":"法甲","r":20},{"a":"2697","d":"2027-02-20T20:00Z","h":"174","l":"法甲","r":21},{"a":"174","d":"2027-02-27T20:00Z","h":"6997","l":"法甲","r":22},{"a":"167","d":"2027-03-06T20:00Z","h":"174","l":"法甲","r":23},{"a":"174","d":"2027-03-13T20:00Z","h":"176","l":"法甲","r":24},{"a":"3236","d":"2027-03-20T18:00Z","h":"174","l":"法甲","r":25},{"a":"174","d":"2027-04-03T18:00Z","h":"7868","l":"法甲","r":26},{"a":"169","d":"2027-04-10T18:00Z","h":"174","l":"法甲","r":27},{"a":"180","d":"2027-04-17T18:00Z","h":"174","l":"法甲","r":28},{"a":"174","d":"2027-04-24T18:00Z","h":"166","l":"法甲","r":29},{"a":"273","d":"2027-05-01T18:00Z","h":"174","l":"法甲","r":30},{"a":"174","d":"2027-05-08T18:00Z","h":"175","l":"法甲","r":31},{"a":"6851","d":"2027-05-16T18:00Z","h":"174","l":"法甲","r":32},{"a":"174","d":"2027-05-22T18:00Z","h":"2502","l":"法甲","r":33},{"a":"170","d":"2027-05-29T18:00Z","h":"174","l":"法甲","r":34}],"175":[{"a":"175","d":"2026-11-28T16:15Z","h":"7868","l":"法甲","r":12},{"a":"3236","d":"2026-12-05T19:45Z","h":"175","l":"法甲","r":13},{"a":"2980","d":"2026-12-09T20:00Z","h":"175","l":"欧冠"},{"a":"175","d":"2026-12-12T19:45Z","h":"2502","l":"法甲","r":14},{"a":"160","d":"2027-01-03T19:45Z","h":"175","l":"法甲","r":15},{"a":"175","d":"2027-01-16T19:45Z","h":"169","l":"法甲","r":16},{"a":"382","d":"2027-01-20T20:00Z","h":"175","l":"欧冠"},{"a":"6997","d":"2027-01-23T19:45Z","h":"175","l":"法甲","r":17},{"a":"175","d":"2027-01-27T20:00Z","h":"364","l":"欧冠"},{"a":"175","d":"2027-01-30T19:45Z","h":"179","l":"法甲","r":18},{"a":"7868","d":"2027-02-06T20:00Z","h":"175","l":"法甲","r":19},{"a":"175","d":"2027-02-13T20:00Z","h":"167","l":"法甲","r":20},{"a":"170","d":"2027-02-20T20:00Z","h":"175","l":"法甲","r":21},{"a":"175","d":"2027-02-28T19:45Z","h":"160","l":"法甲","r":22},{"a":"180","d":"2027-03-06T20:00Z","h":"175","l":"法甲","r":23},{"a":"175","d":"2027-03-13T20:00Z","h":"3236","l":"法甲","r":24},{"a":"166","d":"2027-03-20T18:00Z","h":"175","l":"法甲","r":25},{"a":"175","d":"2027-04-03T18:00Z","h":"172","l":"法甲","r":26},{"a":"175","d":"2027-04-10T18:00Z","h":"273","l":"法甲","r":27},{"a":"2502","d":"2027-04-17T18:00Z","h":"175","l":"法甲","r":28},{"a":"175","d":"2027-04-24T18:00Z","h":"6851","l":"法甲","r":29},{"a":"2697","d":"2027-05-01T18:00Z","h":"175","l":"法甲","r":30},{"a":"174","d":"2027-05-08T18:00Z","h":"175","l":"法甲","r":31},{"a":"175","d":"2027-05-16T18:00Z","h":"176","l":"法甲","r":32},{"a":"169","d":"2027-05-22T18:00Z","h":"175","l":"法甲","r":33},{"a":"175","d":"2027-05-29T18:00Z","h":"6997","l":"法甲","r":34}],"17530":[{"a":"107","d":"2026-11-27T19:45Z","h":"17530","l":"意甲","r":13},{"a":"3997","d":"2026-12-07T17:30Z","h":"17530","l":"意甲","r":14},{"a":"17530","d":"2026-12-12T14:00Z","h":"2925","l":"意甲","r":15},{"a":"4007","d":"2026-12-20T14:00Z","h":"17530","l":"意甲","r":16},{"a":"17530","d":"2027-01-02T14:00Z","h":"239","l":"意甲","r":17},{"a":"104","d":"2027-01-05T17:30Z","h":"17530","l":"意甲","r":18},{"a":"17530","d":"2027-01-10T14:00Z","h":"115","l":"意甲","r":19},{"a":"4057","d":"2027-01-17T20:00Z","h":"17530","l":"意甲","r":20},{"a":"17530","d":"2027-01-24T20:00Z","h":"110","l":"意甲","r":21},{"a":"17530","d":"2027-01-31T20:00Z","h":"112","l":"意甲","r":22},{"a":"3263","d":"2027-02-07T20:00Z","h":"17530","l":"意甲","r":23},{"a":"17530","d":"2027-02-14T20:00Z","h":"118","l":"意甲","r":24},{"a":"2925","d":"2027-02-21T20:00Z","h":"17530","l":"意甲","r":25},{"a":"17530","d":"2027-02-28T20:00Z","h":"104","l":"意甲","r":26},{"a":"17530","d":"2027-03-07T20:00Z","h":"109","l":"意甲","r":27},{"a":"105","d":"2027-03-14T18:00Z","h":"17530","l":"意甲","r":28},{"a":"17530","d":"2027-03-21T18:00Z","h":"114","l":"意甲","r":29},{"a":"115","d":"2027-04-04T18:00Z","h":"17530","l":"意甲","r":30},{"a":"17530","d":"2027-04-11T18:00Z","h":"107","l":"意甲","r":31},{"a":"111","d":"2027-04-18T18:00Z","h":"17530","l":"意甲","r":32},{"a":"239","d":"2027-04-25T18:00Z","h":"17530","l":"意甲","r":33},{"a":"17530","d":"2027-05-02T18:00Z","h":"4007","l":"意甲","r":34},{"a":"2572","d":"2027-05-09T18:00Z","h":"17530","l":"意甲","r":35},{"a":"17530","d":"2027-05-16T18:00Z","h":"3997","l":"意甲","r":36},{"a":"103","d":"2027-05-23T18:00Z","h":"17530","l":"意甲","r":37},{"a":"17530","d":"2027-05-30T18:00Z","h":"113","l":"意甲","r":38}],"176":[{"a":"490","d":"2026-11-26T17:45Z","h":"176","l":"欧联"},{"a":"176","d":"2026-11-29T14:00Z","h":"172","l":"法甲","r":12},{"a":"2502","d":"2026-12-06T19:45Z","h":"176","l":"法甲","r":13},{"a":"85","d":"2026-12-10T17:45Z","h":"176","l":"欧联"},{"a":"176","d":"2026-12-13T19:45Z","h":"167","l":"法甲","r":14},{"a":"176","d":"2027-01-02T16:00Z","h":"6997","l":"法甲","r":15},{"a":"166","d":"2027-01-15T19:45Z","h":"176","l":"法甲","r":16},{"a":"176","d":"2027-01-21T20:00Z","h":"256","l":"欧联"},{"a":"176","d":"2027-01-24T16:15Z","h":"273","l":"法甲","r":17},{"a":"441","d":"2027-01-28T20:00Z","h":"176","l":"欧联"},{"a":"170","d":"2027-01-31T16:15Z","h":"176","l":"法甲","r":18},{"a":"176","d":"2027-02-07T19:45Z","h":"160","l":"法甲","r":19},{"a":"7868","d":"2027-02-13T20:00Z","h":"176","l":"法甲","r":20},{"a":"176","d":"2027-02-20T20:00Z","h":"180","l":"法甲","r":21},{"a":"169","d":"2027-02-27T20:00Z","h":"176","l":"法甲","r":22},{"a":"176","d":"2027-03-06T20:00Z","h":"166","l":"法甲","r":23},{"a":"174","d":"2027-03-13T20:00Z","h":"176","l":"法甲","r":24},{"a":"167","d":"2027-03-21T19:45Z","h":"176","l":"法甲","r":25},{"a":"176","d":"2027-04-03T18:00Z","h":"2697","l":"法甲","r":26},{"a":"6997","d":"2027-04-10T18:00Z","h":"176","l":"法甲","r":27},{"a":"176","d":"2027-04-17T18:00Z","h":"3236","l":"法甲","r":28},{"a":"172","d":"2027-04-24T18:00Z","h":"176","l":"法甲","r":29},{"a":"176","d":"2027-05-01T18:00Z","h":"179","l":"法甲","r":30},{"a":"176","d":"2027-05-08T18:00Z","h":"2502","l":"法甲","r":31},{"a":"175","d":"2027-05-16T18:00Z","h":"176","l":"法甲","r":32},{"a":"176","d":"2027-05-22T18:00Z","h":"6851","l":"法甲","r":33},{"a":"273","d":"2027-05-29T18:00Z","h":"176","l":"法甲","r":34}],"179":[{"a":"169","d":"2026-11-29T16:15Z","h":"179","l":"法甲","r":12},{"a":"160","d":"2026-12-04T19:45Z","h":"179","l":"法甲","r":13},{"a":"179","d":"2026-12-11T19:45Z","h":"172","l":"法甲","r":14},{"a":"7868","d":"2027-01-02T20:00Z","h":"179","l":"法甲","r":15},{"a":"179","d":"2027-01-17T14:00Z","h":"6851","l":"法甲","r":16},{"a":"2502","d":"2027-01-23T19:45Z","h":"179","l":"法甲","r":17},{"a":"175","d":"2027-01-30T19:45Z","h":"179","l":"法甲","r":18},{"a":"179","d":"2027-02-06T20:00Z","h":"3236","l":"法甲","r":19},{"a":"174","d":"2027-02-13T20:00Z","h":"179","l":"法甲","r":20},{"a":"179","d":"2027-02-20T20:00Z","h":"169","l":"法甲","r":21},{"a":"179","d":"2027-02-27T20:00Z","h":"167","l":"法甲","r":22},{"a":"2697","d":"2027-03-06T20:00Z","h":"179","l":"法甲","r":23},{"a":"179","d":"2027-03-13T20:00Z","h":"2502","l":"法甲","r":24},{"a":"6997","d":"2027-03-20T18:00Z","h":"179","l":"法甲","r":25},{"a":"179","d":"2027-04-03T18:00Z","h":"180","l":"法甲","r":26},{"a":"179","d":"2027-04-10T18:00Z","h":"166","l":"法甲","r":27},{"a":"6851","d":"2027-04-17T18:00Z","h":"179","l":"法甲","r":28},{"a":"179","d":"2027-04-24T18:00Z","h":"170","l":"法甲","r":29},{"a":"176","d":"2027-05-01T18:00Z","h":"179","l":"法甲","r":30},{"a":"179","d":"2027-05-08T18:00Z","h":"7868","l":"法甲","r":31},{"a":"273","d":"2027-05-16T18:00Z","h":"179","l":"法甲","r":32},{"a":"172","d":"2027-05-22T18:00Z","h":"179","l":"法甲","r":33},{"a":"179","d":"2027-05-29T18:00Z","h":"160","l":"法甲","r":34}],"180":[{"a":"180","d":"2026-11-28T19:45Z","h":"3236","l":"法甲","r":12},{"a":"273","d":"2026-12-05T19:45Z","h":"180","l":"法甲","r":13},{"a":"180","d":"2026-12-12T19:45Z","h":"7868","l":"法甲","r":14},{"a":"180","d":"2027-01-03T16:15Z","h":"166","l":"法甲","r":15},{"a":"2697","d":"2027-01-16T19:45Z","h":"180","l":"法甲","r":16},{"a":"167","d":"2027-01-24T19:45Z","h":"180","l":"法甲","r":17},{"a":"180","d":"2027-01-29T19:45Z","h":"6997","l":"法甲","r":18},{"a":"6851","d":"2027-02-06T20:00Z","h":"180","l":"法甲","r":19},{"a":"180","d":"2027-02-13T20:00Z","h":"172","l":"法甲","r":20},{"a":"176","d":"2027-02-20T20:00Z","h":"180","l":"法甲","r":21},{"a":"3236","d":"2027-02-27T20:00Z","h":"180","l":"法甲","r":22},{"a":"180","d":"2027-03-06T20:00Z","h":"175","l":"法甲","r":23},{"a":"7868","d":"2027-03-13T20:00Z","h":"180","l":"法甲","r":24},{"a":"180","d":"2027-03-20T18:00Z","h":"160","l":"法甲","r":25},{"a":"179","d":"2027-04-03T18:00Z","h":"180","l":"法甲","r":26},{"a":"180","d":"2027-04-10T18:00Z","h":"167","l":"法甲","r":27},{"a":"180","d":"2027-04-17T18:00Z","h":"174","l":"法甲","r":28},{"a":"169","d":"2027-04-24T18:00Z","h":"180","l":"法甲","r":29},{"a":"166","d":"2027-05-01T18:00Z","h":"180","l":"法甲","r":30},{"a":"180","d":"2027-05-08T18:00Z","h":"273","l":"法甲","r":31},{"a":"170","d":"2027-05-16T18:00Z","h":"180","l":"法甲","r":32},{"a":"180","d":"2027-05-22T18:00Z","h":"2697","l":"法甲","r":33},{"a":"2502","d":"2027-05-29T18:00Z","h":"180","l":"法甲","r":34}],"239":[{"a":"112","d":"2026-11-28T17:00Z","h":"239","l":"意甲","r":13},{"a":"239","d":"2026-12-06T11:30Z","h":"3263","l":"意甲","r":14},{"a":"239","d":"2026-12-13T14:00Z","h":"110","l":"意甲","r":15},{"a":"2925","d":"2026-12-20T14:00Z","h":"239","l":"意甲","r":16},{"a":"17530","d":"2027-01-02T14:00Z","h":"239","l":"意甲","r":17},{"a":"239","d":"2027-01-06T11:30Z","h":"111","l":"意甲","r":18},{"a":"105","d":"2027-01-10T17:00Z","h":"239","l":"意甲","r":19},{"a":"239","d":"2027-01-17T20:00Z","h":"103","l":"意甲","r":20},{"a":"239","d":"2027-01-24T20:00Z","h":"113","l":"意甲","r":21},{"a":"4057","d":"2027-01-31T20:00Z","h":"239","l":"意甲","r":22},{"a":"239","d":"2027-02-07T20:00Z","h":"104","l":"意甲","r":23},{"a":"3997","d":"2027-02-14T20:00Z","h":"239","l":"意甲","r":24},{"a":"239","d":"2027-02-21T20:00Z","h":"2572","l":"意甲","r":25},{"a":"109","d":"2027-02-28T20:00Z","h":"239","l":"意甲","r":26},{"a":"239","d":"2027-03-07T20:00Z","h":"105","l":"意甲","r":27},{"a":"110","d":"2027-03-14T18:00Z","h":"239","l":"意甲","r":28},{"a":"239","d":"2027-03-21T18:00Z","h":"118","l":"意甲","r":29},{"a":"111","d":"2027-04-04T18:00Z","h":"239","l":"意甲","r":30},{"a":"239","d":"2027-04-11T18:00Z","h":"112","l":"意甲","r":31},{"a":"3263","d":"2027-04-18T18:00Z","h":"239","l":"意甲","r":32},{"a":"239","d":"2027-04-25T18:00Z","h":"17530","l":"意甲","r":33},{"a":"115","d":"2027-05-02T18:00Z","h":"239","l":"意甲","r":34},{"a":"107","d":"2027-05-09T18:00Z","h":"239","l":"意甲","r":35},{"a":"239","d":"2027-05-16T18:00Z","h":"2925","l":"意甲","r":36},{"a":"114","d":"2027-05-23T18:00Z","h":"239","l":"意甲","r":37},{"a":"239","d":"2027-05-30T18:00Z","h":"4007","l":"意甲","r":38}],"243":[{"a":"243","d":"2026-11-29T20:00Z","h":"89","l":"西甲","r":14},{"a":"243","d":"2026-12-03T18:00Z","h":"21717","l":"国王杯"},{"a":"99","d":"2026-12-07T20:00Z","h":"243","l":"西甲","r":15},{"a":"243","d":"2026-12-11T20:00Z","h":"3751","l":"西甲","r":16},{"a":"87","d":"2026-12-20T20:00Z","h":"243","l":"西甲","r":17},{"a":"243","d":"2027-01-03T20:00Z","h":"102","l":"西甲","r":18},{"a":"85","d":"2027-01-10T20:00Z","h":"243","l":"西甲","r":19},{"a":"243","d":"2027-01-17T20:00Z","h":"101","l":"西甲","r":20},{"a":"243","d":"2027-01-24T20:00Z","h":"94","l":"西甲","r":21},{"a":"93","d":"2027-01-31T20:00Z","h":"243","l":"西甲","r":22},{"a":"243","d":"2027-02-07T20:00Z","h":"244","l":"西甲","r":23},{"a":"88","d":"2027-02-14T20:00Z","h":"243","l":"西甲","r":24},{"a":"86","d":"2027-02-21T20:00Z","h":"243","l":"西甲","r":25},{"a":"243","d":"2027-02-28T20:00Z","h":"97","l":"西甲","r":26},{"a":"89","d":"2027-03-07T20:00Z","h":"243","l":"西甲","r":27},{"a":"243","d":"2027-03-14T18:00Z","h":"96","l":"西甲","r":28},{"a":"3751","d":"2027-03-21T18:00Z","h":"243","l":"西甲","r":29},{"a":"243","d":"2027-04-04T18:00Z","h":"83","l":"西甲","r":30},{"a":"90","d":"2027-04-11T18:00Z","h":"243","l":"西甲","r":31},{"a":"243","d":"2027-04-18T18:00Z","h":"1068","l":"西甲","r":32},{"a":"1538","d":"2027-04-21T18:00Z","h":"243","l":"西甲","r":33},{"a":"243","d":"2027-05-02T18:00Z","h":"85","l":"西甲","r":34},{"a":"243","d":"2027-05-09T18:00Z","h":"87","l":"西甲","r":35},{"a":"102","d":"2027-05-16T18:00Z","h":"243","l":"西甲","r":36},{"a":"2922","d":"2027-05-23T18:00Z","h":"243","l":"西甲","r":37},{"a":"243","d":"2027-05-30T18:00Z","h":"99","l":"西甲","r":38}],"244":[{"a":"101","d":"2026-11-28T13:00Z","h":"244","l":"西甲","r":14},{"a":"244","d":"2026-12-01T20:00Z","h":"22430","l":"国王杯"},{"a":"244","d":"2026-12-06T20:00Z","h":"1068","l":"西甲","r":16},{"a":"2572","d":"2026-12-09T17:45Z","h":"244","l":"欧冠"},{"a":"87","d":"2026-12-12T20:00Z","h":"244","l":"西甲","r":16},{"a":"244","d":"2026-12-20T20:00Z","h":"93","l":"西甲","r":17},{"a":"96","d":"2027-01-03T20:00Z","h":"244","l":"西甲","r":18},{"a":"244","d":"2027-01-10T20:00Z","h":"88","l":"西甲","r":19},{"a":"90","d":"2027-01-17T20:00Z","h":"244","l":"西甲","r":20},{"a":"359","d":"2027-01-20T20:00Z","h":"244","l":"欧冠"},{"a":"244","d":"2027-01-24T20:00Z","h":"86","l":"西甲","r":22},{"a":"244","d":"2027-01-27T20:00Z","h":"132","l":"欧冠"},{"a":"3751","d":"2027-01-31T20:00Z","h":"244","l":"西甲","r":22},{"a":"243","d":"2027-02-07T20:00Z","h":"244","l":"西甲","r":23},{"a":"244","d":"2027-02-14T20:00Z","h":"89","l":"西甲","r":24},{"a":"244","d":"2027-02-21T20:00Z","h":"99","l":"西甲","r":25},{"a":"102","d":"2027-02-28T20:00Z","h":"244","l":"西甲","r":26},{"a":"244","d":"2027-03-07T20:00Z","h":"83","l":"西甲","r":27},{"a":"1538","d":"2027-03-14T18:00Z","h":"244","l":"西甲","r":28},{"a":"244","d":"2027-03-21T18:00Z","h":"87","l":"西甲","r":29},{"a":"85","d":"2027-04-04T18:00Z","h":"244","l":"西甲","r":30},{"a":"244","d":"2027-04-11T18:00Z","h":"96","l":"西甲","r":31},{"a":"93","d":"2027-04-18T18:00Z","h":"244","l":"西甲","r":32},{"a":"244","d":"2027-04-21T18:00Z","h":"2922","l":"西甲","r":33},{"a":"94","d":"2027-05-02T18:00Z","h":"244","l":"西甲","r":34},{"a":"88","d":"2027-05-09T18:00Z","h":"244","l":"西甲","r":35},{"a":"244","d":"2027-05-16T18:00Z","h":"97","l":"西甲","r":36},{"a":"244","d":"2027-05-23T18:00Z","h":"101","l":"西甲","r":37},{"a":"1068","d":"2027-05-30T18:00Z","h":"244","l":"西甲","r":38}],"2502":[{"a":"170","d":"2026-11-28T19:45Z","h":"2502","l":"法甲","r":12},{"a":"2502","d":"2026-12-06T19:45Z","h":"176","l":"法甲","r":13},{"a":"175","d":"2026-12-12T19:45Z","h":"2502","l":"法甲","r":14},{"a":"2502","d":"2027-01-02T20:00Z","h":"174","l":"法甲","r":15},{"a":"3236","d":"2027-01-16T19:45Z","h":"2502","l":"法甲","r":16},{"a":"2502","d":"2027-01-23T19:45Z","h":"179","l":"法甲","r":17},{"a":"2502","d":"2027-01-30T19:45Z","h":"2697","l":"法甲","r":18},{"a":"6997","d":"2027-02-06T20:00Z","h":"2502","l":"法甲","r":19},{"a":"2502","d":"2027-02-13T20:00Z","h":"166","l":"法甲","r":20},{"a":"172","d":"2027-02-20T20:00Z","h":"2502","l":"法甲","r":21},{"a":"2502","d":"2027-02-27T20:00Z","h":"170","l":"法甲","r":22},{"a":"2502","d":"2027-03-06T20:00Z","h":"3236","l":"法甲","r":23},{"a":"179","d":"2027-03-13T20:00Z","h":"2502","l":"法甲","r":24},{"a":"2502","d":"2027-03-20T18:00Z","h":"273","l":"法甲","r":25},{"a":"167","d":"2027-04-03T18:00Z","h":"2502","l":"法甲","r":26},{"a":"6851","d":"2027-04-10T18:00Z","h":"2502","l":"法甲","r":27},{"a":"2502","d":"2027-04-17T18:00Z","h":"175","l":"法甲","r":28},{"a":"7868","d":"2027-04-24T18:00Z","h":"2502","l":"法甲","r":29},{"a":"2502","d":"2027-05-01T18:00Z","h":"169","l":"法甲","r":30},{"a":"176","d":"2027-05-08T18:00Z","h":"2502","l":"法甲","r":31},{"a":"2502","d":"2027-05-16T18:00Z","h":"160","l":"法甲","r":32},{"a":"174","d":"2027-05-22T18:00Z","h":"2502","l":"法甲","r":33},{"a":"2502","d":"2027-05-29T18:00Z","h":"180","l":"法甲","r":34}],"2572":[{"a":"111","d":"2026-11-29T19:45Z","h":"2572","l":"意甲","r":13},{"a":"4050","d":"2026-12-02T20:00Z","h":"2572","l":"意大利杯"},{"a":"2572","d":"2026-12-05T14:00Z","h":"4007","l":"意甲","r":14},{"a":"2572","d":"2026-12-09T17:45Z","h":"244","l":"欧冠"},{"a":"107","d":"2026-12-12T19:45Z","h":"2572","l":"意甲","r":15},{"a":"2572","d":"2026-12-19T17:00Z","h":"103","l":"意甲","r":16},{"a":"113","d":"2027-01-03T14:00Z","h":"2572","l":"意甲","r":17},{"a":"2572","d":"2027-01-06T17:00Z","h":"105","l":"意甲","r":18},{"a":"112","d":"2027-01-10T11:30Z","h":"2572","l":"意甲","r":19},{"a":"2572","d":"2027-01-17T20:00Z","h":"2925","l":"意甲","r":20},{"a":"160","d":"2027-01-20T20:00Z","h":"2572","l":"欧冠"},{"a":"114","d":"2027-01-24T20:00Z","h":"2572","l":"意甲","r":21},{"a":"2572","d":"2027-01-27T20:00Z","h":"83","l":"欧冠"},{"a":"2572","d":"2027-01-31T20:00Z","h":"3997","l":"意甲","r":22},{"a":"4007","d":"2027-02-07T20:00Z","h":"2572","l":"意甲","r":23},{"a":"2572","d":"2027-02-14T20:00Z","h":"107","l":"意甲","r":24},{"a":"239","d":"2027-02-21T20:00Z","h":"2572","l":"意甲","r":25},{"a":"103","d":"2027-02-28T20:00Z","h":"2572","l":"意甲","r":26},{"a":"2572","d":"2027-03-07T20:00Z","h":"113","l":"意甲","r":27},{"a":"118","d":"2027-03-14T18:00Z","h":"2572","l":"意甲","r":28},{"a":"2572","d":"2027-03-21T18:00Z","h":"111","l":"意甲","r":29},{"a":"109","d":"2027-04-04T18:00Z","h":"2572","l":"意甲","r":30},{"a":"2572","d":"2027-04-11T18:00Z","h":"115","l":"意甲","r":31},{"a":"4057","d":"2027-04-18T18:00Z","h":"2572","l":"意甲","r":32},{"a":"2572","d":"2027-04-25T18:00Z","h":"112","l":"意甲","r":33},{"a":"110","d":"2027-05-02T18:00Z","h":"2572","l":"意甲","r":34},{"a":"2572","d":"2027-05-09T18:00Z","h":"17530","l":"意甲","r":35},{"a":"105","d":"2027-05-16T18:00Z","h":"2572","l":"意甲","r":36},{"a":"2572","d":"2027-05-23T18:00Z","h":"104","l":"意甲","r":37},{"a":"3263","d":"2027-05-30T18:00Z","h":"2572","l":"意甲","r":38}],"268":[{"a":"268","d":"2026-11-27T19:30Z","h":"137","l":"德甲","r":11},{"a":"3812","d":"2026-12-01T19:45Z","h":"268","l":"德国杯"},{"a":"268","d":"2026-12-05T14:30Z","h":"131","l":"德甲","r":12},{"a":"125","d":"2026-12-12T17:30Z","h":"268","l":"德甲","r":13},{"a":"268","d":"2026-12-20T18:30Z","h":"133","l":"德甲","r":14},{"a":"132","d":"2027-01-09T17:30Z","h":"268","l":"德甲","r":15},{"a":"268","d":"2027-01-12T19:30Z","h":"3841","l":"德甲","r":16},{"a":"598","d":"2027-01-16T14:30Z","h":"268","l":"德甲","r":17},{"a":"11420","d":"2027-01-23T14:30Z","h":"268","l":"德甲","r":18},{"a":"268","d":"2027-01-30T20:00Z","h":"10388","l":"德甲","r":19},{"a":"126","d":"2027-02-06T20:00Z","h":"268","l":"德甲","r":20},{"a":"268","d":"2027-02-13T20:00Z","h":"2950","l":"德甲","r":21},{"a":"122","d":"2027-02-20T20:00Z","h":"268","l":"德甲","r":22},{"a":"268","d":"2027-02-27T20:00Z","h":"7911","l":"德甲","r":23},{"a":"134","d":"2027-03-03T20:00Z","h":"268","l":"德甲","r":24},{"a":"268","d":"2027-03-06T20:00Z","h":"3307","l":"德甲","r":25},{"a":"127","d":"2027-03-13T20:00Z","h":"268","l":"德甲","r":26},{"a":"268","d":"2027-03-20T18:00Z","h":"124","l":"德甲","r":27},{"a":"137","d":"2027-04-03T18:00Z","h":"268","l":"德甲","r":28},{"a":"131","d":"2027-04-10T18:00Z","h":"268","l":"德甲","r":29},{"a":"268","d":"2027-04-17T18:00Z","h":"125","l":"德甲","r":30},{"a":"133","d":"2027-04-24T18:00Z","h":"268","l":"德甲","r":31},{"a":"268","d":"2027-05-08T18:00Z","h":"132","l":"德甲","r":32},{"a":"3841","d":"2027-05-15T18:00Z","h":"268","l":"德甲","r":33},{"a":"268","d":"2027-05-22T13:30Z","h":"598","l":"德甲","r":34}],"2697":[{"a":"166","d":"2026-11-28T19:45Z","h":"2697","l":"法甲","r":12},{"a":"2697","d":"2026-12-05T19:45Z","h":"6851","l":"法甲","r":13},{"a":"2697","d":"2026-12-12T19:45Z","h":"3236","l":"法甲","r":14},{"a":"167","d":"2027-01-03T14:00Z","h":"2697","l":"法甲","r":15},{"a":"2697","d":"2027-01-16T19:45Z","h":"180","l":"法甲","r":16},{"a":"7868","d":"2027-01-23T19:45Z","h":"2697","l":"法甲","r":17},{"a":"2502","d":"2027-01-30T19:45Z","h":"2697","l":"法甲","r":18},{"a":"2697","d":"2027-02-06T20:00Z","h":"273","l":"法甲","r":19},{"a":"160","d":"2027-02-13T20:00Z","h":"2697","l":"法甲","r":20},{"a":"2697","d":"2027-02-20T20:00Z","h":"174","l":"法甲","r":21},{"a":"6851","d":"2027-02-27T20:00Z","h":"2697","l":"法甲","r":22},{"a":"2697","d":"2027-03-06T20:00Z","h":"179","l":"法甲","r":23},{"a":"169","d":"2027-03-13T20:00Z","h":"2697","l":"法甲","r":24},{"a":"2697","d":"2027-03-20T18:00Z","h":"7868","l":"法甲","r":25},{"a":"176","d":"2027-04-03T18:00Z","h":"2697","l":"法甲","r":26},{"a":"172","d":"2027-04-10T18:00Z","h":"2697","l":"法甲","r":27},{"a":"2697","d":"2027-04-17T18:00Z","h":"6997","l":"法甲","r":28},{"a":"3236","d":"2027-04-24T18:00Z","h":"2697","l":"法甲","r":29},{"a":"2697","d":"2027-05-01T18:00Z","h":"175","l":"法甲","r":30},{"a":"170","d":"2027-05-08T18:00Z","h":"2697","l":"法甲","r":31},{"a":"2697","d":"2027-05-16T18:00Z","h":"167","l":"法甲","r":32},{"a":"180","d":"2027-05-22T18:00Z","h":"2697","l":"法甲","r":33},{"a":"2697","d":"2027-05-29T18:00Z","h":"166","l":"法甲","r":34}],"273":[{"a":"273","d":"2026-11-28T19:45Z","h":"160","l":"法甲","r":12},{"a":"273","d":"2026-12-05T19:45Z","h":"180","l":"法甲","r":13},{"a":"166","d":"2026-12-13T14:00Z","h":"273","l":"法甲","r":14},{"a":"172","d":"2027-01-02T20:00Z","h":"273","l":"法甲","r":15},{"a":"273","d":"2027-01-17T19:45Z","h":"167","l":"法甲","r":16},{"a":"176","d":"2027-01-24T16:15Z","h":"273","l":"法甲","r":17},{"a":"273","d":"2027-01-31T14:00Z","h":"169","l":"法甲","r":18},{"a":"2697","d":"2027-02-06T20:00Z","h":"273","l":"法甲","r":19},{"a":"3236","d":"2027-02-13T20:00Z","h":"273","l":"法甲","r":20},{"a":"273","d":"2027-02-20T20:00Z","h":"166","l":"法甲","r":21},{"a":"7868","d":"2027-02-27T20:00Z","h":"273","l":"法甲","r":22},{"a":"273","d":"2027-03-06T20:00Z","h":"170","l":"法甲","r":23},{"a":"273","d":"2027-03-13T20:00Z","h":"6851","l":"法甲","r":24},{"a":"2502","d":"2027-03-20T18:00Z","h":"273","l":"法甲","r":25},{"a":"273","d":"2027-04-03T18:00Z","h":"6997","l":"法甲","r":26},{"a":"175","d":"2027-04-10T18:00Z","h":"273","l":"法甲","r":27},{"a":"273","d":"2027-04-17T18:00Z","h":"172","l":"法甲","r":28},{"a":"160","d":"2027-04-24T18:00Z","h":"273","l":"法甲","r":29},{"a":"273","d":"2027-05-01T18:00Z","h":"174","l":"法甲","r":30},{"a":"180","d":"2027-05-08T18:00Z","h":"273","l":"法甲","r":31},{"a":"273","d":"2027-05-16T18:00Z","h":"179","l":"法甲","r":32},{"a":"167","d":"2027-05-22T18:00Z","h":"273","l":"法甲","r":33},{"a":"273","d":"2027-05-29T18:00Z","h":"176","l":"法甲","r":34}],"2922":[{"a":"2922","d":"2026-11-26T17:45Z","h":"20025","l":"欧协联"},{"a":"2922","d":"2026-11-30T20:00Z","h":"88","l":"西甲","r":14},{"a":"2922","d":"2026-12-03T18:00Z","h":"22439","l":"国王杯"},{"a":"94","d":"2026-12-06T17:30Z","h":"2922","l":"西甲","r":15},{"a":"20703","d":"2026-12-10T17:45Z","h":"2922","l":"欧协联"},{"a":"2922","d":"2026-12-13T17:30Z","h":"89","l":"西甲","r":17},{"a":"2922","d":"2026-12-17T20:00Z","h":"139","l":"欧协联"},{"a":"1538","d":"2026-12-20T20:00Z","h":"2922","l":"西甲","r":17},{"a":"2922","d":"2027-01-03T20:00Z","h":"86","l":"西甲","r":19},{"a":"2922","d":"2027-01-10T20:00Z","h":"3751","l":"西甲","r":19},{"a":"93","d":"2027-01-17T20:00Z","h":"2922","l":"西甲","r":20},{"a":"97","d":"2027-01-24T20:00Z","h":"2922","l":"西甲","r":21},{"a":"2922","d":"2027-01-31T20:00Z","h":"85","l":"西甲","r":22},{"a":"102","d":"2027-02-07T20:00Z","h":"2922","l":"西甲","r":23},{"a":"2922","d":"2027-02-14T20:00Z","h":"87","l":"西甲","r":24},{"a":"2922","d":"2027-02-21T20:00Z","h":"101","l":"西甲","r":25},{"a":"96","d":"2027-02-28T20:00Z","h":"2922","l":"西甲","r":26},{"a":"2922","d":"2027-03-07T20:00Z","h":"90","l":"西甲","r":27},{"a":"89","d":"2027-03-14T18:00Z","h":"2922","l":"西甲","r":28},{"a":"2922","d":"2027-03-21T18:00Z","h":"1068","l":"西甲","r":29},{"a":"88","d":"2027-04-04T18:00Z","h":"2922","l":"西甲","r":30},{"a":"2922","d":"2027-04-11T18:00Z","h":"94","l":"西甲","r":31},{"a":"86","d":"2027-04-18T18:00Z","h":"2922","l":"西甲","r":32},{"a":"244","d":"2027-04-21T18:00Z","h":"2922","l":"西甲","r":33},{"a":"2922","d":"2027-05-02T18:00Z","h":"99","l":"西甲","r":34},{"a":"3751","d":"2027-05-09T18:00Z","h":"2922","l":"西甲","r":35},{"a":"2922","d":"2027-05-16T18:00Z","h":"1538","l":"西甲","r":36},{"a":"2922","d":"2027-05-23T18:00Z","h":"243","l":"西甲","r":37},{"a":"83","d":"2027-05-30T18:00Z","h":"2922","l":"西甲","r":38}],"2925":[{"a":"103","d":"2026-11-30T19:45Z","h":"2925","l":"意甲","r":13},{"a":"2925","d":"2026-12-07T19:45Z","h":"109","l":"意甲","r":14},{"a":"17530","d":"2026-12-12T14:00Z","h":"2925","l":"意甲","r":15},{"a":"2925","d":"2026-12-20T14:00Z","h":"239","l":"意甲","r":16},{"a":"3263","d":"2027-01-02T11:30Z","h":"2925","l":"意甲","r":17},{"a":"2925","d":"2027-01-07T19:45Z","h":"114","l":"意甲","r":18},{"a":"3997","d":"2027-01-11T17:30Z","h":"2925","l":"意甲","r":19},{"a":"2572","d":"2027-01-17T20:00Z","h":"2925","l":"意甲","r":20},{"a":"2925","d":"2027-01-24T20:00Z","h":"111","l":"意甲","r":21},{"a":"115","d":"2027-01-31T20:00Z","h":"2925","l":"意甲","r":22},{"a":"2925","d":"2027-02-07T20:00Z","h":"110","l":"意甲","r":23},{"a":"112","d":"2027-02-14T20:00Z","h":"2925","l":"意甲","r":24},{"a":"2925","d":"2027-02-21T20:00Z","h":"17530","l":"意甲","r":25},{"a":"118","d":"2027-02-28T20:00Z","h":"2925","l":"意甲","r":26},{"a":"2925","d":"2027-03-07T20:00Z","h":"103","l":"意甲","r":27},{"a":"109","d":"2027-03-14T18:00Z","h":"2925","l":"意甲","r":28},{"a":"2925","d":"2027-03-21T18:00Z","h":"3997","l":"意甲","r":29},{"a":"114","d":"2027-04-04T18:00Z","h":"2925","l":"意甲","r":30},{"a":"105","d":"2027-04-11T18:00Z","h":"2925","l":"意甲","r":31},{"a":"2925","d":"2027-04-18T18:00Z","h":"107","l":"意甲","r":32},{"a":"4007","d":"2027-04-25T18:00Z","h":"2925","l":"意甲","r":33},{"a":"2925","d":"2027-05-02T18:00Z","h":"113","l":"意甲","r":34},{"a":"2925","d":"2027-05-09T18:00Z","h":"3263","l":"意甲","r":35},{"a":"239","d":"2027-05-16T18:00Z","h":"2925","l":"意甲","r":36},{"a":"2925","d":"2027-05-23T18:00Z","h":"4057","l":"意甲","r":37},{"a":"104","d":"2027-05-30T18:00Z","h":"2925","l":"意甲","r":38}],"2950":[{"a":"598","d":"2026-11-28T14:30Z","h":"2950","l":"德甲","r":11},{"a":"2950","d":"2026-12-05T14:30Z","h":"11420","l":"德甲","r":12},{"a":"126","d":"2026-12-13T14:30Z","h":"2950","l":"德甲","r":13},{"a":"122","d":"2026-12-19T14:30Z","h":"2950","l":"德甲","r":14},{"a":"2950","d":"2027-01-08T19:30Z","h":"124","l":"德甲","r":15},{"a":"7911","d":"2027-01-12T19:30Z","h":"2950","l":"德甲","r":16},{"a":"2950","d":"2027-01-15T19:30Z","h":"134","l":"德甲","r":17},{"a":"2950","d":"2027-01-23T14:30Z","h":"3307","l":"德甲","r":18},{"a":"127","d":"2027-01-30T20:00Z","h":"2950","l":"德甲","r":19},{"a":"2950","d":"2027-02-06T20:00Z","h":"125","l":"德甲","r":20},{"a":"268","d":"2027-02-13T20:00Z","h":"2950","l":"德甲","r":21},{"a":"2950","d":"2027-02-20T20:00Z","h":"131","l":"德甲","r":22},{"a":"133","d":"2027-02-27T20:00Z","h":"2950","l":"德甲","r":23},{"a":"2950","d":"2027-03-03T20:00Z","h":"137","l":"德甲","r":24},{"a":"10388","d":"2027-03-06T20:00Z","h":"2950","l":"德甲","r":25},{"a":"2950","d":"2027-03-13T20:00Z","h":"132","l":"德甲","r":26},{"a":"3841","d":"2027-03-20T18:00Z","h":"2950","l":"德甲","r":27},{"a":"2950","d":"2027-04-03T18:00Z","h":"598","l":"德甲","r":28},{"a":"11420","d":"2027-04-10T18:00Z","h":"2950","l":"德甲","r":29},{"a":"2950","d":"2027-04-17T18:00Z","h":"126","l":"德甲","r":30},{"a":"2950","d":"2027-04-24T18:00Z","h":"122","l":"德甲","r":31},{"a":"124","d":"2027-05-08T18:00Z","h":"2950","l":"德甲","r":32},{"a":"2950","d":"2027-05-15T18:00Z","h":"7911","l":"德甲","r":33},{"a":"134","d":"2027-05-22T13:30Z","h":"2950","l":"德甲","r":34}],"306":[{"a":"306","d":"2026-11-29T14:05Z","h":"384","l":"英超","r":12},{"a":"393","d":"2026-12-02T19:30Z","h":"306","l":"英超","r":13},{"a":"306","d":"2026-12-05T15:00Z","h":"349","l":"英超","r":14},{"a":"367","d":"2026-12-14T20:00Z","h":"306","l":"英超","r":15},{"a":"306","d":"2026-12-19T15:00Z","h":"382","l":"英超","r":16},{"a":"364","d":"2026-12-26T17:30Z","h":"306","l":"英超","r":17},{"a":"357","d":"2026-12-29T19:30Z","h":"306","l":"英超","r":18},{"a":"306","d":"2027-01-02T15:00Z","h":"366","l":"英超","r":19},{"a":"306","d":"2027-01-05T19:30Z","h":"393","l":"英超","r":20},{"a":"359","d":"2027-01-16T15:00Z","h":"306","l":"英超","r":21},{"a":"306","d":"2027-01-23T15:00Z","h":"373","l":"英超","r":22},{"a":"384","d":"2027-01-31T14:00Z","h":"306","l":"英超","r":23},{"a":"306","d":"2027-02-06T15:00Z","h":"331","l":"英超","r":24},{"a":"366","d":"2027-02-10T20:00Z","h":"306","l":"英超","r":25},{"a":"306","d":"2027-02-20T15:00Z","h":"364","l":"英超","r":26},{"a":"382","d":"2027-02-27T15:00Z","h":"306","l":"英超","r":27},{"a":"306","d":"2027-03-03T20:00Z","h":"357","l":"英超","r":28},{"a":"306","d":"2027-03-13T15:00Z","h":"362","l":"英超","r":29},{"a":"363","d":"2027-03-20T15:00Z","h":"306","l":"英超","r":30},{"a":"306","d":"2027-04-10T14:00Z","h":"360","l":"英超","r":31},{"a":"388","d":"2027-04-17T14:00Z","h":"306","l":"英超","r":32},{"a":"306","d":"2027-04-24T14:00Z","h":"367","l":"英超","r":33},{"a":"349","d":"2027-05-01T14:00Z","h":"306","l":"英超","r":34},{"a":"306","d":"2027-05-08T14:00Z","h":"368","l":"英超","r":35},{"a":"370","d":"2027-05-15T14:00Z","h":"306","l":"英超","r":36},{"a":"306","d":"2027-05-23T14:00Z","h":"337","l":"英超","r":37},{"a":"361","d":"2027-05-30T15:00Z","h":"306","l":"英超","r":38}],"3236":[{"a":"180","d":"2026-11-28T19:45Z","h":"3236","l":"法甲","r":12},{"a":"3236","d":"2026-12-05T19:45Z","h":"175","l":"法甲","r":13},{"a":"2697","d":"2026-12-12T19:45Z","h":"3236","l":"法甲","r":14},{"a":"3236","d":"2027-01-03T16:15Z","h":"6851","l":"法甲","r":15},{"a":"3236","d":"2027-01-16T19:45Z","h":"2502","l":"法甲","r":16},{"a":"169","d":"2027-01-24T14:00Z","h":"3236","l":"法甲","r":17},{"a":"3236","d":"2027-01-30T19:45Z","h":"7868","l":"法甲","r":18},{"a":"179","d":"2027-02-06T20:00Z","h":"3236","l":"法甲","r":19},{"a":"3236","d":"2027-02-13T20:00Z","h":"273","l":"法甲","r":20},{"a":"167","d":"2027-02-20T20:00Z","h":"3236","l":"法甲","r":21},{"a":"3236","d":"2027-02-27T20:00Z","h":"180","l":"法甲","r":22},{"a":"2502","d":"2027-03-06T20:00Z","h":"3236","l":"法甲","r":23},{"a":"175","d":"2027-03-13T20:00Z","h":"3236","l":"法甲","r":24},{"a":"3236","d":"2027-03-20T18:00Z","h":"174","l":"法甲","r":25},{"a":"170","d":"2027-04-03T18:00Z","h":"3236","l":"法甲","r":26},{"a":"3236","d":"2027-04-10T18:00Z","h":"160","l":"法甲","r":27},{"a":"176","d":"2027-04-17T18:00Z","h":"3236","l":"法甲","r":28},{"a":"3236","d":"2027-04-24T18:00Z","h":"2697","l":"法甲","r":29},{"a":"6851","d":"2027-05-01T18:00Z","h":"3236","l":"法甲","r":30},{"a":"3236","d":"2027-05-08T18:00Z","h":"169","l":"法甲","r":31},{"a":"3236","d":"2027-05-16T18:00Z","h":"6997","l":"法甲","r":32},{"a":"166","d":"2027-05-22T18:00Z","h":"3236","l":"法甲","r":33},{"a":"3236","d":"2027-05-29T18:00Z","h":"172","l":"法甲","r":34}],"3263":[{"a":"3263","d":"2026-11-28T19:45Z","h":"110","l":"意甲","r":13},{"a":"3263","d":"2026-12-01T20:00Z","h":"110","l":"意大利杯"},{"a":"239","d":"2026-12-06T11:30Z","h":"3263","l":"意甲","r":14},{"a":"3263","d":"2026-12-14T17:30Z","h":"105","l":"意甲","r":15},{"a":"118","d":"2026-12-20T17:00Z","h":"3263","l":"意甲","r":16},{"a":"3263","d":"2027-01-02T11:30Z","h":"2925","l":"意甲","r":17},{"a":"4007","d":"2027-01-05T17:30Z","h":"3263","l":"意甲","r":18},{"a":"3263","d":"2027-01-09T19:45Z","h":"107","l":"意甲","r":19},{"a":"3263","d":"2027-01-17T20:00Z","h":"111","l":"意甲","r":20},{"a":"115","d":"2027-01-24T20:00Z","h":"3263","l":"意甲","r":21},{"a":"113","d":"2027-01-31T20:00Z","h":"3263","l":"意甲","r":22},{"a":"3263","d":"2027-02-07T20:00Z","h":"17530","l":"意甲","r":23},{"a":"105","d":"2027-02-14T20:00Z","h":"3263","l":"意甲","r":24},{"a":"3263","d":"2027-02-21T20:00Z","h":"103","l":"意甲","r":25},{"a":"112","d":"2027-02-28T20:00Z","h":"3263","l":"意甲","r":26},{"a":"3263","d":"2027-03-07T20:00Z","h":"4007","l":"意甲","r":27},{"a":"104","d":"2027-03-14T18:00Z","h":"3263","l":"意甲","r":28},{"a":"3263","d":"2027-03-21T18:00Z","h":"109","l":"意甲","r":29},{"a":"110","d":"2027-04-04T18:00Z","h":"3263","l":"意甲","r":30},{"a":"3263","d":"2027-04-11T18:00Z","h":"4057","l":"意甲","r":31},{"a":"3263","d":"2027-04-18T18:00Z","h":"239","l":"意甲","r":32},{"a":"3997","d":"2027-04-25T18:00Z","h":"3263","l":"意甲","r":33},{"a":"3263","d":"2027-05-02T18:00Z","h":"118","l":"意甲","r":34},{"a":"2925","d":"2027-05-09T18:00Z","h":"3263","l":"意甲","r":35},{"a":"3263","d":"2027-05-16T18:00Z","h":"114","l":"意甲","r":36},{"a":"107","d":"2027-05-23T18:00Z","h":"3263","l":"意甲","r":37},{"a":"3263","d":"2027-05-30T18:00Z","h":"2572","l":"意甲","r":38}],"3307":[{"a":"133","d":"2026-11-28T14:30Z","h":"3307","l":"德甲","r":11},{"a":"3307","d":"2026-12-04T19:30Z","h":"132","l":"德甲","r":12},{"a":"10388","d":"2026-12-12T14:30Z","h":"3307","l":"德甲","r":13},{"a":"3307","d":"2026-12-19T14:30Z","h":"3841","l":"德甲","r":14},{"a":"11420","d":"2027-01-09T14:30Z","h":"3307","l":"德甲","r":15},{"a":"3307","d":"2027-01-13T19:30Z","h":"598","l":"德甲","r":16},{"a":"122","d":"2027-01-16T14:30Z","h":"3307","l":"德甲","r":17},{"a":"2950","d":"2027-01-23T14:30Z","h":"3307","l":"德甲","r":18},{"a":"3307","d":"2027-01-30T20:00Z","h":"126","l":"德甲","r":19},{"a":"124","d":"2027-02-06T20:00Z","h":"3307","l":"德甲","r":20},{"a":"3307","d":"2027-02-13T20:00Z","h":"7911","l":"德甲","r":21},{"a":"3307","d":"2027-02-20T20:00Z","h":"134","l":"德甲","r":22},{"a":"137","d":"2027-02-27T20:00Z","h":"3307","l":"德甲","r":23},{"a":"3307","d":"2027-03-03T20:00Z","h":"127","l":"德甲","r":24},{"a":"268","d":"2027-03-06T20:00Z","h":"3307","l":"德甲","r":25},{"a":"3307","d":"2027-03-13T20:00Z","h":"125","l":"德甲","r":26},{"a":"131","d":"2027-03-20T18:00Z","h":"3307","l":"德甲","r":27},{"a":"3307","d":"2027-04-03T18:00Z","h":"133","l":"德甲","r":28},{"a":"132","d":"2027-04-10T18:00Z","h":"3307","l":"德甲","r":29},{"a":"3307","d":"2027-04-17T18:00Z","h":"10388","l":"德甲","r":30},{"a":"3841","d":"2027-04-24T18:00Z","h":"3307","l":"德甲","r":31},{"a":"3307","d":"2027-05-08T18:00Z","h":"11420","l":"德甲","r":32},{"a":"598","d":"2027-05-15T18:00Z","h":"3307","l":"德甲","r":33},{"a":"3307","d":"2027-05-22T13:30Z","h":"122","l":"德甲","r":34}],"331":[{"a":"8089","d":"2026-11-26T17:45Z","h":"331","l":"欧协联"},{"a":"361","d":"2026-11-29T14:05Z","h":"331","l":"英超","r":12},{"a":"331","d":"2026-12-02T20:15Z","h":"349","l":"英超","r":13},{"a":"331","d":"2026-12-05T17:30Z","h":"393","l":"英超","r":14},{"a":"174","d":"2026-12-10T20:00Z","h":"331","l":"欧协联"},{"a":"368","d":"2026-12-13T14:00Z","h":"331","l":"英超","r":15},{"a":"331","d":"2026-12-17T20:00Z","h":"443","l":"欧协联"},{"a":"373","d":"2026-12-20T14:00Z","h":"331","l":"英超","r":16},{"a":"331","d":"2026-12-26T15:00Z","h":"370","l":"英超","r":17},{"a":"331","d":"2026-12-29T19:30Z","h":"367","l":"英超","r":18},{"a":"360","d":"2027-01-02T12:30Z","h":"331","l":"英超","r":19},{"a":"349","d":"2027-01-05T19:30Z","h":"331","l":"英超","r":20},{"a":"331","d":"2027-01-18T20:00Z","h":"337","l":"英超","r":21},{"a":"382","d":"2027-01-23T20:00Z","h":"331","l":"英超","r":22},{"a":"331","d":"2027-01-30T15:00Z","h":"361","l":"英超","r":23},{"a":"306","d":"2027-02-06T15:00Z","h":"331","l":"英超","r":24},{"a":"331","d":"2027-02-10T20:00Z","h":"360","l":"英超","r":25},{"a":"367","d":"2027-02-20T15:00Z","h":"331","l":"英超","r":26},{"a":"331","d":"2027-02-27T15:00Z","h":"373","l":"英超","r":27},{"a":"370","d":"2027-03-03T20:00Z","h":"331","l":"英超","r":28},{"a":"331","d":"2027-03-13T15:00Z","h":"357","l":"英超","r":29},{"a":"388","d":"2027-03-20T15:00Z","h":"331","l":"英超","r":30},{"a":"331","d":"2027-04-10T14:00Z","h":"362","l":"英超","r":31},{"a":"363","d":"2027-04-17T14:00Z","h":"331","l":"英超","r":32},{"a":"331","d":"2027-04-24T14:00Z","h":"368","l":"英超","r":33},{"a":"393","d":"2027-05-01T14:00Z","h":"331","l":"英超","r":34},{"a":"366","d":"2027-05-08T14:00Z","h":"331","l":"英超","r":35},{"a":"331","d":"2027-05-15T14:00Z","h":"384","l":"英超","r":36},{"a":"364","d":"2027-05-23T14:00Z","h":"331","l":"英超","r":37},{"a":"331","d":"2027-05-30T15:00Z","h":"359","l":"英超","r":38}],"337":[{"a":"337","d":"2026-11-28T15:00Z","h":"360","l":"英超","r":12},{"a":"359","d":"2026-12-02T20:15Z","h":"337","l":"英超","r":13},{"a":"382","d":"2026-12-05T20:00Z","h":"337","l":"英超","r":14},{"a":"337","d":"2026-12-12T15:00Z","h":"370","l":"英超","r":15},{"a":"361","d":"2026-12-19T12:30Z","h":"337","l":"英超","r":16},{"a":"337","d":"2026-12-26T15:00Z","h":"373","l":"英超","r":17},{"a":"337","d":"2026-12-30T19:30Z","h":"388","l":"英超","r":18},{"a":"384","d":"2027-01-02T15:00Z","h":"337","l":"英超","r":19},{"a":"337","d":"2027-01-05T19:30Z","h":"359","l":"英超","r":20},{"a":"331","d":"2027-01-18T20:00Z","h":"337","l":"英超","r":21},{"a":"337","d":"2027-01-24T14:00Z","h":"368","l":"英超","r":22},{"a":"360","d":"2027-02-01T20:00Z","h":"337","l":"英超","r":23},{"a":"337","d":"2027-02-06T15:00Z","h":"393","l":"英超","r":24},{"a":"337","d":"2027-02-10T20:00Z","h":"384","l":"英超","r":25},{"a":"388","d":"2027-02-20T15:00Z","h":"337","l":"英超","r":26},{"a":"337","d":"2027-02-27T15:00Z","h":"361","l":"英超","r":27},{"a":"373","d":"2027-03-03T20:00Z","h":"337","l":"英超","r":28},{"a":"337","d":"2027-03-13T15:00Z","h":"366","l":"英超","r":29},{"a":"349","d":"2027-03-20T15:00Z","h":"337","l":"英超","r":30},{"a":"337","d":"2027-04-10T14:00Z","h":"367","l":"英超","r":31},{"a":"357","d":"2027-04-17T14:00Z","h":"337","l":"英超","r":32},{"a":"370","d":"2027-04-24T14:00Z","h":"337","l":"英超","r":33},{"a":"337","d":"2027-05-01T14:00Z","h":"382","l":"英超","r":34},{"a":"362","d":"2027-05-08T14:00Z","h":"337","l":"英超","r":35},{"a":"337","d":"2027-05-15T14:00Z","h":"364","l":"英超","r":36},{"a":"306","d":"2027-05-23T14:00Z","h":"337","l":"英超","r":37},{"a":"337","d":"2027-05-30T15:00Z","h":"363","l":"英超","r":38}],"349":[{"a":"349","d":"2026-11-26T17:45Z","h":"85","l":"欧联"},{"a":"349","d":"2026-11-29T14:05Z","h":"370","l":"英超","r":12},{"a":"331","d":"2026-12-02T20:15Z","h":"349","l":"英超","r":13},{"a":"306","d":"2026-12-05T15:00Z","h":"349","l":"英超","r":14},{"a":"11706","d":"2026-12-10T20:00Z","h":"349","l":"欧联"},{"a":"349","d":"2026-12-13T14:00Z","h":"359","l":"英超","r":15},{"a":"349","d":"2026-12-16T20:00Z","h":"364","l":"联赛杯"},{"a":"388","d":"2026-12-19T15:00Z","h":"349","l":"英超","r":16},{"a":"349","d":"2026-12-26T15:00Z","h":"367","l":"英超","r":17},{"a":"349","d":"2026-12-30T19:30Z","h":"384","l":"英超","r":18},{"a":"362","d":"2027-01-02T17:30Z","h":"349","l":"英超","r":19},{"a":"349","d":"2027-01-05T19:30Z","h":"331","l":"英超","r":20},{"a":"373","d":"2027-01-17T14:00Z","h":"349","l":"英超","r":21},{"a":"349","d":"2027-01-21T17:45Z","h":"987","l":"欧联"},{"a":"349","d":"2027-01-24T14:00Z","h":"393","l":"英超","r":22},{"a":"13083","d":"2027-01-28T20:00Z","h":"349","l":"欧联"},{"a":"370","d":"2027-01-31T14:00Z","h":"349","l":"英超","r":23},{"a":"349","d":"2027-02-06T15:00Z","h":"357","l":"英超","r":24},{"a":"349","d":"2027-02-10T20:00Z","h":"362","l":"英超","r":25},{"a":"384","d":"2027-02-20T15:00Z","h":"349","l":"英超","r":26},{"a":"349","d":"2027-02-27T15:00Z","h":"388","l":"英超","r":27},{"a":"367","d":"2027-03-03T20:00Z","h":"349","l":"英超","r":28},{"a":"361","d":"2027-03-13T15:00Z","h":"349","l":"英超","r":29},{"a":"349","d":"2027-03-20T15:00Z","h":"337","l":"英超","r":30},{"a":"382","d":"2027-04-10T14:00Z","h":"349","l":"英超","r":31},{"a":"349","d":"2027-04-17T14:00Z","h":"368","l":"英超","r":32},{"a":"359","d":"2027-04-24T14:00Z","h":"349","l":"英超","r":33},{"a":"349","d":"2027-05-01T14:00Z","h":"306","l":"英超","r":34},{"a":"360","d":"2027-05-08T14:00Z","h":"349","l":"英超","r":35},{"a":"349","d":"2027-05-15T14:00Z","h":"366","l":"英超","r":36},{"a":"363","d":"2027-05-23T14:00Z","h":"349","l":"英超","r":37},{"a":"349","d":"2027-05-30T15:00Z","h":"364","l":"英超","r":38}],"357":[{"a":"388","d":"2026-11-28T15:00Z","h":"357","l":"英超","r":12},{"a":"357","d":"2026-12-02T19:30Z","h":"382","l":"英超","r":13},{"a":"373","d":"2026-12-05T15:00Z","h":"357","l":"英超","r":14},{"a":"357","d":"2026-12-12T15:00Z","h":"364","l":"英超","r":15},{"a":"370","d":"2026-12-19T15:00Z","h":"357","l":"英超","r":16},{"a":"357","d":"2026-12-26T12:30Z","h":"362","l":"英超","r":17},{"a":"357","d":"2026-12-29T19:30Z","h":"306","l":"英超","r":18},{"a":"368","d":"2027-01-01T20:00Z","h":"357","l":"英超","r":19},{"a":"382","d":"2027-01-06T20:15Z","h":"357","l":"英超","r":20},{"a":"357","d":"2027-01-17T16:30Z","h":"367","l":"英超","r":21},{"a":"363","d":"2027-01-25T20:00Z","h":"357","l":"英超","r":22},{"a":"357","d":"2027-01-31T14:00Z","h":"388","l":"英超","r":23},{"a":"349","d":"2027-02-06T15:00Z","h":"357","l":"英超","r":24},{"a":"357","d":"2027-02-10T20:00Z","h":"368","l":"英超","r":25},{"a":"362","d":"2027-02-20T15:00Z","h":"357","l":"英超","r":26},{"a":"357","d":"2027-02-27T15:00Z","h":"370","l":"英超","r":27},{"a":"306","d":"2027-03-03T20:00Z","h":"357","l":"英超","r":28},{"a":"331","d":"2027-03-13T15:00Z","h":"357","l":"英超","r":29},{"a":"357","d":"2027-03-20T15:00Z","h":"361","l":"英超","r":30},{"a":"393","d":"2027-04-10T14:00Z","h":"357","l":"英超","r":31},{"a":"357","d":"2027-04-17T14:00Z","h":"337","l":"英超","r":32},{"a":"364","d":"2027-04-24T14:00Z","h":"357","l":"英超","r":33},{"a":"357","d":"2027-05-01T14:00Z","h":"373","l":"英超","r":34},{"a":"359","d":"2027-05-08T14:00Z","h":"357","l":"英超","r":35},{"a":"357","d":"2027-05-15T14:00Z","h":"360","l":"英超","r":36},{"a":"366","d":"2027-05-23T14:00Z","h":"357","l":"英超","r":37},{"a":"357","d":"2027-05-30T15:00Z","h":"384","l":"英超","r":38}],"359":[{"a":"382","d":"2026-11-29T16:30Z","h":"359","l":"英超","r":12},{"a":"359","d":"2026-12-02T20:15Z","h":"337","l":"英超","r":13},{"a":"359","d":"2026-12-06T16:30Z","h":"367","l":"英超","r":14},{"a":"86","d":"2026-12-09T20:00Z","h":"359","l":"欧冠"},{"a":"349","d":"2026-12-13T14:00Z","h":"359","l":"英超","r":15},{"a":"360","d":"2026-12-20T16:30Z","h":"359","l":"英超","r":16},{"a":"359","d":"2026-12-27T19:00Z","h":"384","l":"英超","r":17},{"a":"359","d":"2026-12-30T19:30Z","h":"370","l":"英超","r":18},{"a":"373","d":"2027-01-02T15:00Z","h":"359","l":"英超","r":19},{"a":"337","d":"2027-01-05T19:30Z","h":"359","l":"英超","r":20},{"a":"359","d":"2027-01-16T15:00Z","h":"306","l":"英超","r":21},{"a":"359","d":"2027-01-20T20:00Z","h":"244","l":"欧冠"},{"a":"361","d":"2027-01-23T17:30Z","h":"359","l":"英超","r":22},{"a":"21922","d":"2027-01-27T20:00Z","h":"359","l":"欧冠"},{"a":"359","d":"2027-01-31T16:30Z","h":"382","l":"英超","r":23},{"a":"364","d":"2027-02-06T15:00Z","h":"359","l":"英超","r":24},{"a":"359","d":"2027-02-10T20:00Z","h":"373","l":"英超","r":25},{"a":"370","d":"2027-02-20T15:00Z","h":"359","l":"英超","r":26},{"a":"359","d":"2027-02-27T15:00Z","h":"360","l":"英超","r":27},{"a":"384","d":"2027-03-03T20:00Z","h":"359","l":"英超","r":28},{"a":"359","d":"2027-03-13T15:00Z","h":"363","l":"英超","r":29},{"a":"366","d":"2027-03-20T15:00Z","h":"359","l":"英超","r":30},{"a":"359","d":"2027-04-10T14:00Z","h":"388","l":"英超","r":31},{"a":"362","d":"2027-04-17T14:00Z","h":"359","l":"英超","r":32},{"a":"359","d":"2027-04-24T14:00Z","h":"349","l":"英超","r":33},{"a":"367","d":"2027-05-01T14:00Z","h":"359","l":"英超","r":34},{"a":"359","d":"2027-05-08T14:00Z","h":"357","l":"英超","r":35},{"a":"393","d":"2027-05-15T14:00Z","h":"359","l":"英超","r":36},{"a":"359","d":"2027-05-23T14:00Z","h":"368","l":"英超","r":37},{"a":"331","d":"2027-05-30T15:00Z","h":"359","l":"英超","r":38}],"360":[{"a":"337","d":"2026-11-28T15:00Z","h":"360","l":"英超","r":12},{"a":"360","d":"2026-12-02T20:15Z","h":"361","l":"英超","r":13},{"a":"388","d":"2026-12-05T15:00Z","h":"360","l":"英超","r":14},{"a":"11420","d":"2026-12-08T20:00Z","h":"360","l":"欧冠"},{"a":"360","d":"2026-12-13T19:00Z","h":"384","l":"英超","r":15},{"a":"360","d":"2026-12-20T16:30Z","h":"359","l":"英超","r":16},{"a":"393","d":"2026-12-27T16:30Z","h":"360","l":"英超","r":17},{"a":"366","d":"2026-12-30T19:30Z","h":"360","l":"英超","r":18},{"a":"360","d":"2027-01-02T12:30Z","h":"331","l":"英超","r":19},{"a":"361","d":"2027-01-07T20:00Z","h":"360","l":"英超","r":20},{"a":"360","d":"2027-01-16T17:30Z","h":"362","l":"英超","r":21},{"a":"132","d":"2027-01-20T20:00Z","h":"360","l":"欧冠"},{"a":"364","d":"2027-01-24T16:30Z","h":"360","l":"英超","r":22},{"a":"360","d":"2027-01-27T20:00Z","h":"102","l":"欧冠"},{"a":"360","d":"2027-02-01T20:00Z","h":"337","l":"英超","r":23},{"a":"363","d":"2027-02-06T15:00Z","h":"360","l":"英超","r":24},{"a":"331","d":"2027-02-10T20:00Z","h":"360","l":"英超","r":25},{"a":"360","d":"2027-02-20T15:00Z","h":"393","l":"英超","r":26},{"a":"359","d":"2027-02-27T15:00Z","h":"360","l":"英超","r":27},{"a":"360","d":"2027-03-03T20:00Z","h":"366","l":"英超","r":28},{"a":"368","d":"2027-03-13T15:00Z","h":"360","l":"英超","r":29},{"a":"360","d":"2027-03-20T15:00Z","h":"382","l":"英超","r":30},{"a":"306","d":"2027-04-10T14:00Z","h":"360","l":"英超","r":31},{"a":"360","d":"2027-04-17T14:00Z","h":"373","l":"英超","r":32},{"a":"384","d":"2027-04-24T14:00Z","h":"360","l":"英超","r":33},{"a":"360","d":"2027-05-01T14:00Z","h":"388","l":"英超","r":34},{"a":"360","d":"2027-05-08T14:00Z","h":"349","l":"英超","r":35},{"a":"357","d":"2027-05-15T14:00Z","h":"360","l":"英超","r":36},{"a":"360","d":"2027-05-23T14:00Z","h":"367","l":"英超","r":37},{"a":"370","d":"2027-05-30T15:00Z","h":"360","l":"英超","r":38}],"361":[{"a":"361","d":"2026-11-29T14:05Z","h":"331","l":"英超","r":12},{"a":"360","d":"2026-12-02T20:15Z","h":"361","l":"英超","r":13},{"a":"366","d":"2026-12-06T14:00Z","h":"361","l":"英超","r":14},{"a":"361","d":"2026-12-12T15:00Z","h":"373","l":"英超","r":15},{"a":"361","d":"2026-12-19T12:30Z","h":"337","l":"英超","r":16},{"a":"382","d":"2026-12-26T20:00Z","h":"361","l":"英超","r":17},{"a":"393","d":"2026-12-30T19:30Z","h":"361","l":"英超","r":18},{"a":"361","d":"2027-01-03T14:00Z","h":"363","l":"英超","r":19},{"a":"361","d":"2027-01-07T20:00Z","h":"360","l":"英超","r":20},{"a":"370","d":"2027-01-16T15:00Z","h":"361","l":"英超","r":21},{"a":"361","d":"2027-01-23T17:30Z","h":"359","l":"英超","r":22},{"a":"331","d":"2027-01-30T15:00Z","h":"361","l":"英超","r":23},{"a":"361","d":"2027-02-06T15:00Z","h":"368","l":"英超","r":24},{"a":"363","d":"2027-02-10T20:00Z","h":"361","l":"英超","r":25},{"a":"361","d":"2027-02-20T15:00Z","h":"382","l":"英超","r":26},{"a":"337","d":"2027-02-27T15:00Z","h":"361","l":"英超","r":27},{"a":"361","d":"2027-03-03T20:00Z","h":"393","l":"英超","r":28},{"a":"361","d":"2027-03-13T15:00Z","h":"349","l":"英超","r":29},{"a":"357","d":"2027-03-20T15:00Z","h":"361","l":"英超","r":30},{"a":"361","d":"2027-04-10T14:00Z","h":"364","l":"英超","r":31},{"a":"367","d":"2027-04-17T14:00Z","h":"361","l":"英超","r":32},{"a":"373","d":"2027-04-24T14:00Z","h":"361","l":"英超","r":33},{"a":"361","d":"2027-05-01T14:00Z","h":"366","l":"英超","r":34},{"a":"388","d":"2027-05-08T14:00Z","h":"361","l":"英超","r":35},{"a":"361","d":"2027-05-15T14:00Z","h":"362","l":"英超","r":36},{"a":"384","d":"2027-05-23T14:00Z","h":"361","l":"英超","r":37},{"a":"361","d":"2027-05-30T15:00Z","h":"306","l":"英超","r":38}],"362":[{"a":"362","d":"2026-11-28T17:30Z","h":"373","l":"英超","r":12},{"a":"368","d":"2026-12-02T20:15Z","h":"362","l":"英超","r":13},{"a":"384","d":"2026-12-05T15:00Z","h":"362","l":"英超","r":14},{"a":"160","d":"2026-12-08T20:00Z","h":"362","l":"欧冠"},{"a":"362","d":"2026-12-13T16:30Z","h":"388","l":"英超","r":15},{"a":"362","d":"2026-12-21T20:00Z","h":"363","l":"英超","r":16},{"a":"357","d":"2026-12-26T12:30Z","h":"362","l":"英超","r":17},{"a":"364","d":"2026-12-30T20:15Z","h":"362","l":"英超","r":18},{"a":"362","d":"2027-01-02T17:30Z","h":"349","l":"英超","r":19},{"a":"362","d":"2027-01-05T19:30Z","h":"368","l":"英超","r":20},{"a":"360","d":"2027-01-16T17:30Z","h":"362","l":"英超","r":21},{"a":"124","d":"2027-01-19T20:00Z","h":"362","l":"欧冠"},{"a":"362","d":"2027-01-23T15:00Z","h":"370","l":"英超","r":22},{"a":"362","d":"2027-01-27T20:00Z","h":"494","l":"欧冠"},{"a":"373","d":"2027-01-30T15:00Z","h":"362","l":"英超","r":23},{"a":"362","d":"2027-02-06T15:00Z","h":"366","l":"英超","r":24},{"a":"349","d":"2027-02-10T20:00Z","h":"362","l":"英超","r":25},{"a":"362","d":"2027-02-20T15:00Z","h":"357","l":"英超","r":26},{"a":"363","d":"2027-02-27T15:00Z","h":"362","l":"英超","r":27},{"a":"362","d":"2027-03-03T20:00Z","h":"364","l":"英超","r":28},{"a":"306","d":"2027-03-13T15:00Z","h":"362","l":"英超","r":29},{"a":"362","d":"2027-03-20T15:00Z","h":"393","l":"英超","r":30},{"a":"331","d":"2027-04-10T14:00Z","h":"362","l":"英超","r":31},{"a":"362","d":"2027-04-17T14:00Z","h":"359","l":"英超","r":32},{"a":"388","d":"2027-04-24T14:00Z","h":"362","l":"英超","r":33},{"a":"362","d":"2027-05-01T14:00Z","h":"384","l":"英超","r":34},{"a":"362","d":"2027-05-08T14:00Z","h":"337","l":"英超","r":35},{"a":"361","d":"2027-05-15T14:00Z","h":"362","l":"英超","r":36},{"a":"362","d":"2027-05-23T14:00Z","h":"382","l":"英超","r":37},{"a":"367","d":"2027-05-30T15:00Z","h":"362","l":"英超","r":38}],"363":[{"a":"363","d":"2026-11-27T20:00Z","h":"393","l":"英超","r":12},{"a":"384","d":"2026-12-02T19:30Z","h":"363","l":"英超","r":13},{"a":"364","d":"2026-12-05T12:30Z","h":"363","l":"英超","r":14},{"a":"363","d":"2026-12-12T17:30Z","h":"382","l":"英超","r":15},{"a":"362","d":"2026-12-21T20:00Z","h":"363","l":"英超","r":16},{"a":"363","d":"2026-12-27T14:00Z","h":"388","l":"英超","r":17},{"a":"363","d":"2026-12-30T20:15Z","h":"373","l":"英超","r":18},{"a":"361","d":"2027-01-03T14:00Z","h":"363","l":"英超","r":19},{"a":"363","d":"2027-01-06T19:30Z","h":"384","l":"英超","r":20},{"a":"366","d":"2027-01-16T15:00Z","h":"363","l":"英超","r":21},{"a":"363","d":"2027-01-25T20:00Z","h":"357","l":"英超","r":22},{"a":"393","d":"2027-01-30T17:30Z","h":"363","l":"英超","r":23},{"a":"363","d":"2027-02-06T15:00Z","h":"360","l":"英超","r":24},{"a":"363","d":"2027-02-10T20:00Z","h":"361","l":"英超","r":25},{"a":"373","d":"2027-02-20T15:00Z","h":"363","l":"英超","r":26},{"a":"363","d":"2027-02-27T15:00Z","h":"362","l":"英超","r":27},{"a":"388","d":"2027-03-03T20:00Z","h":"363","l":"英超","r":28},{"a":"359","d":"2027-03-13T15:00Z","h":"363","l":"英超","r":29},{"a":"363","d":"2027-03-20T15:00Z","h":"306","l":"英超","r":30},{"a":"370","d":"2027-04-10T14:00Z","h":"363","l":"英超","r":31},{"a":"363","d":"2027-04-17T14:00Z","h":"331","l":"英超","r":32},{"a":"382","d":"2027-04-24T14:00Z","h":"363","l":"英超","r":33},{"a":"363","d":"2027-05-01T14:00Z","h":"364","l":"英超","r":34},{"a":"363","d":"2027-05-08T14:00Z","h":"367","l":"英超","r":35},{"a":"368","d":"2027-05-15T14:00Z","h":"363","l":"英超","r":36},{"a":"363","d":"2027-05-23T14:00Z","h":"349","l":"英超","r":37},{"a":"337","d":"2027-05-30T15:00Z","h":"363","l":"英超","r":38}],"364":[{"a":"364","d":"2026-11-29T12:00Z","h":"368","l":"英超","r":12},{"a":"366","d":"2026-12-02T19:30Z","h":"364","l":"英超","r":13},{"a":"364","d":"2026-12-05T12:30Z","h":"363","l":"英超","r":14},{"a":"437","d":"2026-12-09T20:00Z","h":"364","l":"欧冠"},{"a":"357","d":"2026-12-12T15:00Z","h":"364","l":"英超","r":15},{"a":"349","d":"2026-12-16T20:00Z","h":"364","l":"联赛杯"},{"a":"367","d":"2026-12-19T17:30Z","h":"364","l":"英超","r":16},{"a":"364","d":"2026-12-26T17:30Z","h":"306","l":"英超","r":17},{"a":"364","d":"2026-12-30T20:15Z","h":"362","l":"英超","r":18},{"a":"388","d":"2027-01-02T15:00Z","h":"364","l":"英超","r":19},{"a":"364","d":"2027-01-05T20:15Z","h":"366","l":"英超","r":20},{"a":"384","d":"2027-01-16T15:00Z","h":"364","l":"英超","r":21},{"a":"364","d":"2027-01-19T20:00Z","h":"110","l":"欧冠"},{"a":"364","d":"2027-01-24T16:30Z","h":"360","l":"英超","r":22},{"a":"175","d":"2027-01-27T20:00Z","h":"364","l":"欧冠"},{"a":"368","d":"2027-01-30T12:30Z","h":"364","l":"英超","r":23},{"a":"364","d":"2027-02-06T15:00Z","h":"359","l":"英超","r":24},{"a":"364","d":"2027-02-10T20:00Z","h":"388","l":"英超","r":25},{"a":"306","d":"2027-02-20T15:00Z","h":"364","l":"英超","r":26},{"a":"364","d":"2027-02-27T15:00Z","h":"367","l":"英超","r":27},{"a":"362","d":"2027-03-03T20:00Z","h":"364","l":"英超","r":28},{"a":"373","d":"2027-03-13T15:00Z","h":"364","l":"英超","r":29},{"a":"364","d":"2027-03-20T15:00Z","h":"370","l":"英超","r":30},{"a":"361","d":"2027-04-10T14:00Z","h":"364","l":"英超","r":31},{"a":"364","d":"2027-04-17T14:00Z","h":"393","l":"英超","r":32},{"a":"364","d":"2027-04-24T14:00Z","h":"357","l":"英超","r":33},{"a":"363","d":"2027-05-01T14:00Z","h":"364","l":"英超","r":34},{"a":"364","d":"2027-05-08T14:00Z","h":"382","l":"英超","r":35},{"a":"337","d":"2027-05-15T14:00Z","h":"364","l":"英超","r":36},{"a":"364","d":"2027-05-23T14:00Z","h":"331","l":"英超","r":37},{"a":"349","d":"2027-05-30T15:00Z","h":"364","l":"英超","r":38}],"366":[{"a":"11505","d":"2026-11-26T20:00Z","h":"366","l":"欧联"},{"a":"367","d":"2026-11-29T14:05Z","h":"366","l":"英超","r":12},{"a":"366","d":"2026-12-02T19:30Z","h":"364","l":"英超","r":13},{"a":"366","d":"2026-12-06T14:00Z","h":"361","l":"英超","r":14},{"a":"366","d":"2026-12-10T20:00Z","h":"103","l":"欧联"},{"a":"393","d":"2026-12-13T14:00Z","h":"366","l":"英超","r":15},{"a":"366","d":"2026-12-16T19:30Z","h":"384","l":"联赛杯"},{"a":"384","d":"2026-12-20T14:00Z","h":"366","l":"英超","r":16},{"a":"366","d":"2026-12-26T15:00Z","h":"368","l":"英超","r":17},{"a":"366","d":"2026-12-30T19:30Z","h":"360","l":"英超","r":18},{"a":"306","d":"2027-01-02T15:00Z","h":"366","l":"英超","r":19},{"a":"364","d":"2027-01-05T20:15Z","h":"366","l":"英超","r":20},{"a":"366","d":"2027-01-16T15:00Z","h":"363","l":"英超","r":21},{"a":"366","d":"2027-01-21T20:00Z","h":"441","l":"欧联"},{"a":"388","d":"2027-01-24T14:00Z","h":"366","l":"英超","r":22},{"a":"490","d":"2027-01-28T20:00Z","h":"366","l":"欧联"},{"a":"366","d":"2027-01-31T14:00Z","h":"367","l":"英超","r":23},{"a":"362","d":"2027-02-06T15:00Z","h":"366","l":"英超","r":24},{"a":"366","d":"2027-02-10T20:00Z","h":"306","l":"英超","r":25},{"a":"368","d":"2027-02-20T15:00Z","h":"366","l":"英超","r":26},{"a":"366","d":"2027-02-27T15:00Z","h":"384","l":"英超","r":27},{"a":"360","d":"2027-03-03T20:00Z","h":"366","l":"英超","r":28},{"a":"337","d":"2027-03-13T15:00Z","h":"366","l":"英超","r":29},{"a":"366","d":"2027-03-20T15:00Z","h":"359","l":"英超","r":30},{"a":"373","d":"2027-04-10T14:00Z","h":"366","l":"英超","r":31},{"a":"366","d":"2027-04-17T14:00Z","h":"370","l":"英超","r":32},{"a":"366","d":"2027-04-24T14:00Z","h":"393","l":"英超","r":33},{"a":"361","d":"2027-05-01T14:00Z","h":"366","l":"英超","r":34},{"a":"366","d":"2027-05-08T14:00Z","h":"331","l":"英超","r":35},{"a":"349","d":"2027-05-15T14:00Z","h":"366","l":"英超","r":36},{"a":"366","d":"2027-05-23T14:00Z","h":"357","l":"英超","r":37},{"a":"382","d":"2027-05-30T15:00Z","h":"366","l":"英超","r":38}],"367":[{"a":"367","d":"2026-11-29T14:05Z","h":"366","l":"英超","r":12},{"a":"370","d":"2026-12-03T20:00Z","h":"367","l":"英超","r":13},{"a":"359","d":"2026-12-06T16:30Z","h":"367","l":"英超","r":14},{"a":"367","d":"2026-12-14T20:00Z","h":"306","l":"英超","r":15},{"a":"367","d":"2026-12-19T17:30Z","h":"364","l":"英超","r":16},{"a":"349","d":"2026-12-26T15:00Z","h":"367","l":"英超","r":17},{"a":"331","d":"2026-12-29T19:30Z","h":"367","l":"英超","r":18},{"a":"367","d":"2027-01-03T16:30Z","h":"382","l":"英超","r":19},{"a":"367","d":"2027-01-06T19:30Z","h":"370","l":"英超","r":20},{"a":"357","d":"2027-01-17T16:30Z","h":"367","l":"英超","r":21},{"a":"367","d":"2027-01-24T14:00Z","h":"384","l":"英超","r":22},{"a":"366","d":"2027-01-31T14:00Z","h":"367","l":"英超","r":23},{"a":"367","d":"2027-02-06T15:00Z","h":"373","l":"英超","r":24},{"a":"382","d":"2027-02-10T20:00Z","h":"367","l":"英超","r":25},{"a":"367","d":"2027-02-20T15:00Z","h":"331","l":"英超","r":26},{"a":"364","d":"2027-02-27T15:00Z","h":"367","l":"英超","r":27},{"a":"367","d":"2027-03-03T20:00Z","h":"349","l":"英超","r":28},{"a":"393","d":"2027-03-13T15:00Z","h":"367","l":"英超","r":29},{"a":"367","d":"2027-03-20T15:00Z","h":"368","l":"英超","r":30},{"a":"337","d":"2027-04-10T14:00Z","h":"367","l":"英超","r":31},{"a":"367","d":"2027-04-17T14:00Z","h":"361","l":"英超","r":32},{"a":"306","d":"2027-04-24T14:00Z","h":"367","l":"英超","r":33},{"a":"367","d":"2027-05-01T14:00Z","h":"359","l":"英超","r":34},{"a":"363","d":"2027-05-08T14:00Z","h":"367","l":"英超","r":35},{"a":"367","d":"2027-05-15T14:00Z","h":"388","l":"英超","r":36},{"a":"360","d":"2027-05-23T14:00Z","h":"367","l":"英超","r":37},{"a":"367","d":"2027-05-30T15:00Z","h":"362","l":"英超","r":38}],"368":[{"a":"364","d":"2026-11-29T12:00Z","h":"368","l":"英超","r":12},{"a":"368","d":"2026-12-02T20:15Z","h":"362","l":"英超","r":13},{"a":"370","d":"2026-12-06T14:00Z","h":"368","l":"英超","r":14},{"a":"368","d":"2026-12-13T14:00Z","h":"331","l":"英超","r":15},{"a":"368","d":"2026-12-17T20:00Z","h":"3891","l":"联赛杯"},{"a":"368","d":"2026-12-20T14:00Z","h":"393","l":"英超","r":16},{"a":"366","d":"2026-12-26T15:00Z","h":"368","l":"英超","r":17},{"a":"382","d":"2026-12-29T20:15Z","h":"368","l":"英超","r":18},{"a":"368","d":"2027-01-01T20:00Z","h":"357","l":"英超","r":19},{"a":"362","d":"2027-01-05T19:30Z","h":"368","l":"英超","r":20},{"a":"368","d":"2027-01-16T12:30Z","h":"388","l":"英超","r":21},{"a":"337","d":"2027-01-24T14:00Z","h":"368","l":"英超","r":22},{"a":"368","d":"2027-01-30T12:30Z","h":"364","l":"英超","r":23},{"a":"361","d":"2027-02-06T15:00Z","h":"368","l":"英超","r":24},{"a":"357","d":"2027-02-10T20:00Z","h":"368","l":"英超","r":25},{"a":"368","d":"2027-02-20T15:00Z","h":"366","l":"英超","r":26},{"a":"393","d":"2027-02-27T15:00Z","h":"368","l":"英超","r":27},{"a":"368","d":"2027-03-03T20:00Z","h":"382","l":"英超","r":28},{"a":"368","d":"2027-03-13T15:00Z","h":"360","l":"英超","r":29},{"a":"367","d":"2027-03-20T15:00Z","h":"368","l":"英超","r":30},{"a":"368","d":"2027-04-10T14:00Z","h":"384","l":"英超","r":31},{"a":"349","d":"2027-04-17T14:00Z","h":"368","l":"英超","r":32},{"a":"331","d":"2027-04-24T14:00Z","h":"368","l":"英超","r":33},{"a":"368","d":"2027-05-01T14:00Z","h":"370","l":"英超","r":34},{"a":"306","d":"2027-05-08T14:00Z","h":"368","l":"英超","r":35},{"a":"368","d":"2027-05-15T14:00Z","h":"363","l":"英超","r":36},{"a":"359","d":"2027-05-23T14:00Z","h":"368","l":"英超","r":37},{"a":"368","d":"2027-05-30T15:00Z","h":"373","l":"英超","r":38}],"370":[{"a":"349","d":"2026-11-29T14:05Z","h":"370","l":"英超","r":12},{"a":"370","d":"2026-12-03T20:00Z","h":"367","l":"英超","r":13},{"a":"370","d":"2026-12-06T14:00Z","h":"368","l":"英超","r":14},{"a":"337","d":"2026-12-12T15:00Z","h":"370","l":"英超","r":15},{"a":"370","d":"2026-12-19T15:00Z","h":"357","l":"英超","r":16},{"a":"331","d":"2026-12-26T15:00Z","h":"370","l":"英超","r":17},{"a":"359","d":"2026-12-30T19:30Z","h":"370","l":"英超","r":18},{"a":"370","d":"2027-01-02T15:00Z","h":"393","l":"英超","r":19},{"a":"367","d":"2027-01-06T19:30Z","h":"370","l":"英超","r":20},{"a":"370","d":"2027-01-16T15:00Z","h":"361","l":"英超","r":21},{"a":"362","d":"2027-01-23T15:00Z","h":"370","l":"英超","r":22},{"a":"370","d":"2027-01-31T14:00Z","h":"349","l":"英超","r":23},{"a":"382","d":"2027-02-06T15:00Z","h":"370","l":"英超","r":24},{"a":"393","d":"2027-02-10T20:00Z","h":"370","l":"英超","r":25},{"a":"370","d":"2027-02-20T15:00Z","h":"359","l":"英超","r":26},{"a":"357","d":"2027-02-27T15:00Z","h":"370","l":"英超","r":27},{"a":"370","d":"2027-03-03T20:00Z","h":"331","l":"英超","r":28},{"a":"370","d":"2027-03-13T15:00Z","h":"384","l":"英超","r":29},{"a":"364","d":"2027-03-20T15:00Z","h":"370","l":"英超","r":30},{"a":"370","d":"2027-04-10T14:00Z","h":"363","l":"英超","r":31},{"a":"366","d":"2027-04-17T14:00Z","h":"370","l":"英超","r":32},{"a":"370","d":"2027-04-24T14:00Z","h":"337","l":"英超","r":33},{"a":"368","d":"2027-05-01T14:00Z","h":"370","l":"英超","r":34},{"a":"373","d":"2027-05-08T14:00Z","h":"370","l":"英超","r":35},{"a":"370","d":"2027-05-15T14:00Z","h":"306","l":"英超","r":36},{"a":"388","d":"2027-05-23T14:00Z","h":"370","l":"英超","r":37},{"a":"370","d":"2027-05-30T15:00Z","h":"360","l":"英超","r":38}],"373":[{"a":"362","d":"2026-11-28T17:30Z","h":"373","l":"英超","r":12},{"a":"373","d":"2026-12-01T20:00Z","h":"388","l":"英超","r":13},{"a":"373","d":"2026-12-05T15:00Z","h":"357","l":"英超","r":14},{"a":"361","d":"2026-12-12T15:00Z","h":"373","l":"英超","r":15},{"a":"373","d":"2026-12-20T14:00Z","h":"331","l":"英超","r":16},{"a":"337","d":"2026-12-26T15:00Z","h":"373","l":"英超","r":17},{"a":"363","d":"2026-12-30T20:15Z","h":"373","l":"英超","r":18},{"a":"373","d":"2027-01-02T15:00Z","h":"359","l":"英超","r":19},{"a":"388","d":"2027-01-06T19:30Z","h":"373","l":"英超","r":20},{"a":"373","d":"2027-01-17T14:00Z","h":"349","l":"英超","r":21},{"a":"306","d":"2027-01-23T15:00Z","h":"373","l":"英超","r":22},{"a":"373","d":"2027-01-30T15:00Z","h":"362","l":"英超","r":23},{"a":"367","d":"2027-02-06T15:00Z","h":"373","l":"英超","r":24},{"a":"359","d":"2027-02-10T20:00Z","h":"373","l":"英超","r":25},{"a":"373","d":"2027-02-20T15:00Z","h":"363","l":"英超","r":26},{"a":"331","d":"2027-02-27T15:00Z","h":"373","l":"英超","r":27},{"a":"373","d":"2027-03-03T20:00Z","h":"337","l":"英超","r":28},{"a":"373","d":"2027-03-13T15:00Z","h":"364","l":"英超","r":29},{"a":"384","d":"2027-03-20T15:00Z","h":"373","l":"英超","r":30},{"a":"373","d":"2027-04-10T14:00Z","h":"366","l":"英超","r":31},{"a":"360","d":"2027-04-17T14:00Z","h":"373","l":"英超","r":32},{"a":"373","d":"2027-04-24T14:00Z","h":"361","l":"英超","r":33},{"a":"357","d":"2027-05-01T14:00Z","h":"373","l":"英超","r":34},{"a":"373","d":"2027-05-08T14:00Z","h":"370","l":"英超","r":35},{"a":"382","d":"2027-05-15T14:00Z","h":"373","l":"英超","r":36},{"a":"373","d":"2027-05-23T14:00Z","h":"393","l":"英超","r":37},{"a":"368","d":"2027-05-30T15:00Z","h":"373","l":"英超","r":38}],"3751":[{"a":"1068","d":"2026-11-28T17:30Z","h":"3751","l":"西甲","r":14},{"a":"3751","d":"2026-12-01T20:00Z","h":"5419","l":"国王杯"},{"a":"3751","d":"2026-12-06T13:00Z","h":"97","l":"西甲","r":15},{"a":"243","d":"2026-12-11T20:00Z","h":"3751","l":"西甲","r":16},{"a":"3751","d":"2026-12-20T20:00Z","h":"96","l":"西甲","r":17},{"a":"3751","d":"2027-01-03T20:00Z","h":"99","l":"西甲","r":18},{"a":"2922","d":"2027-01-10T20:00Z","h":"3751","l":"西甲","r":19},{"a":"3751","d":"2027-01-17T20:00Z","h":"83","l":"西甲","r":21},{"a":"101","d":"2027-01-24T20:00Z","h":"3751","l":"西甲","r":21},{"a":"3751","d":"2027-01-31T20:00Z","h":"244","l":"西甲","r":22},{"a":"1538","d":"2027-02-07T20:00Z","h":"3751","l":"西甲","r":23},{"a":"90","d":"2027-02-14T20:00Z","h":"3751","l":"西甲","r":24},{"a":"3751","d":"2027-02-21T20:00Z","h":"1068","l":"西甲","r":25},{"a":"3751","d":"2027-02-28T20:00Z","h":"89","l":"西甲","r":26},{"a":"99","d":"2027-03-07T20:00Z","h":"3751","l":"西甲","r":27},{"a":"102","d":"2027-03-14T18:00Z","h":"3751","l":"西甲","r":28},{"a":"3751","d":"2027-03-21T18:00Z","h":"243","l":"西甲","r":29},{"a":"96","d":"2027-04-04T18:00Z","h":"3751","l":"西甲","r":30},{"a":"3751","d":"2027-04-11T18:00Z","h":"85","l":"西甲","r":31},{"a":"97","d":"2027-04-18T18:00Z","h":"3751","l":"西甲","r":32},{"a":"3751","d":"2027-04-21T18:00Z","h":"86","l":"西甲","r":33},{"a":"88","d":"2027-05-02T18:00Z","h":"3751","l":"西甲","r":34},{"a":"3751","d":"2027-05-09T18:00Z","h":"2922","l":"西甲","r":35},{"a":"93","d":"2027-05-16T18:00Z","h":"3751","l":"西甲","r":36},{"a":"3751","d":"2027-05-23T18:00Z","h":"94","l":"西甲","r":37},{"a":"87","d":"2027-05-30T18:00Z","h":"3751","l":"西甲","r":38}],"382":[{"a":"382","d":"2026-11-29T16:30Z","h":"359","l":"英超","r":12},{"a":"357","d":"2026-12-02T19:30Z","h":"382","l":"英超","r":13},{"a":"382","d":"2026-12-05T20:00Z","h":"337","l":"英超","r":14},{"a":"382","d":"2026-12-08T20:00Z","h":"83","l":"欧冠"},{"a":"363","d":"2026-12-12T17:30Z","h":"382","l":"英超","r":15},{"a":"387","d":"2026-12-15T20:00Z","h":"382","l":"联赛杯"},{"a":"306","d":"2026-12-19T15:00Z","h":"382","l":"英超","r":16},{"a":"382","d":"2026-12-26T20:00Z","h":"361","l":"英超","r":17},{"a":"382","d":"2026-12-29T20:15Z","h":"368","l":"英超","r":18},{"a":"367","d":"2027-01-03T16:30Z","h":"382","l":"英超","r":19},{"a":"382","d":"2027-01-06T20:15Z","h":"357","l":"英超","r":20},{"a":"393","d":"2027-01-16T15:00Z","h":"382","l":"英超","r":21},{"a":"382","d":"2027-01-20T20:00Z","h":"175","l":"欧冠"},{"a":"382","d":"2027-01-23T20:00Z","h":"331","l":"英超","r":22},{"a":"2250","d":"2027-01-27T20:00Z","h":"382","l":"欧冠"},{"a":"359","d":"2027-01-31T16:30Z","h":"382","l":"英超","r":23},{"a":"382","d":"2027-02-06T15:00Z","h":"370","l":"英超","r":24},{"a":"382","d":"2027-02-10T20:00Z","h":"367","l":"英超","r":25},{"a":"361","d":"2027-02-20T15:00Z","h":"382","l":"英超","r":26},{"a":"382","d":"2027-02-27T15:00Z","h":"306","l":"英超","r":27},{"a":"368","d":"2027-03-03T20:00Z","h":"382","l":"英超","r":28},{"a":"382","d":"2027-03-13T15:00Z","h":"388","l":"英超","r":29},{"a":"360","d":"2027-03-20T15:00Z","h":"382","l":"英超","r":30},{"a":"382","d":"2027-04-10T14:00Z","h":"349","l":"英超","r":31},{"a":"384","d":"2027-04-17T14:00Z","h":"382","l":"英超","r":32},{"a":"382","d":"2027-04-24T14:00Z","h":"363","l":"英超","r":33},{"a":"337","d":"2027-05-01T14:00Z","h":"382","l":"英超","r":34},{"a":"364","d":"2027-05-08T14:00Z","h":"382","l":"英超","r":35},{"a":"382","d":"2027-05-15T14:00Z","h":"373","l":"英超","r":36},{"a":"362","d":"2027-05-23T14:00Z","h":"382","l":"英超","r":37},{"a":"382","d":"2027-05-30T15:00Z","h":"366","l":"英超","r":38}],"384":[{"a":"89","d":"2026-11-26T20:00Z","h":"384","l":"欧联"},{"a":"306","d":"2026-11-29T14:05Z","h":"384","l":"英超","r":12},{"a":"384","d":"2026-12-02T19:30Z","h":"363","l":"英超","r":13},{"a":"384","d":"2026-12-05T15:00Z","h":"362","l":"英超","r":14},{"a":"384","d":"2026-12-10T17:45Z","h":"11505","l":"欧联"},{"a":"360","d":"2026-12-13T19:00Z","h":"384","l":"英超","r":15},{"a":"366","d":"2026-12-16T19:30Z","h":"384","l":"联赛杯"},{"a":"384","d":"2026-12-20T14:00Z","h":"366","l":"英超","r":16},{"a":"359","d":"2026-12-27T19:00Z","h":"384","l":"英超","r":17},{"a":"349","d":"2026-12-30T19:30Z","h":"384","l":"英超","r":18},{"a":"384","d":"2027-01-02T15:00Z","h":"337","l":"英超","r":19},{"a":"363","d":"2027-01-06T19:30Z","h":"384","l":"英超","r":20},{"a":"384","d":"2027-01-16T15:00Z","h":"364","l":"英超","r":21},{"a":"433","d":"2027-01-21T20:00Z","h":"384","l":"欧联"},{"a":"367","d":"2027-01-24T14:00Z","h":"384","l":"英超","r":22},{"a":"384","d":"2027-01-28T20:00Z","h":"2790","l":"欧联"},{"a":"384","d":"2027-01-31T14:00Z","h":"306","l":"英超","r":23},{"a":"388","d":"2027-02-06T15:00Z","h":"384","l":"英超","r":24},{"a":"337","d":"2027-02-10T20:00Z","h":"384","l":"英超","r":25},{"a":"384","d":"2027-02-20T15:00Z","h":"349","l":"英超","r":26},{"a":"366","d":"2027-02-27T15:00Z","h":"384","l":"英超","r":27},{"a":"384","d":"2027-03-03T20:00Z","h":"359","l":"英超","r":28},{"a":"370","d":"2027-03-13T15:00Z","h":"384","l":"英超","r":29},{"a":"384","d":"2027-03-20T15:00Z","h":"373","l":"英超","r":30},{"a":"368","d":"2027-04-10T14:00Z","h":"384","l":"英超","r":31},{"a":"384","d":"2027-04-17T14:00Z","h":"382","l":"英超","r":32},{"a":"384","d":"2027-04-24T14:00Z","h":"360","l":"英超","r":33},{"a":"362","d":"2027-05-01T14:00Z","h":"384","l":"英超","r":34},{"a":"384","d":"2027-05-08T14:00Z","h":"393","l":"英超","r":35},{"a":"331","d":"2027-05-15T14:00Z","h":"384","l":"英超","r":36},{"a":"384","d":"2027-05-23T14:00Z","h":"361","l":"英超","r":37},{"a":"357","d":"2027-05-30T15:00Z","h":"384","l":"英超","r":38}],"3841":[{"a":"3841","d":"2026-11-29T16:30Z","h":"7911","l":"德甲","r":11},{"a":"3841","d":"2026-12-02T19:45Z","h":"121","l":"德国杯"},{"a":"122","d":"2026-12-05T14:30Z","h":"3841","l":"德甲","r":12},{"a":"3841","d":"2026-12-12T14:30Z","h":"124","l":"德甲","r":13},{"a":"3307","d":"2026-12-19T14:30Z","h":"3841","l":"德甲","r":14},{"a":"3841","d":"2027-01-09T14:30Z","h":"134","l":"德甲","r":15},{"a":"268","d":"2027-01-12T19:30Z","h":"3841","l":"德甲","r":16},{"a":"3841","d":"2027-01-16T14:30Z","h":"127","l":"德甲","r":17},{"a":"3841","d":"2027-01-23T14:30Z","h":"133","l":"德甲","r":18},{"a":"125","d":"2027-01-30T20:00Z","h":"3841","l":"德甲","r":19},{"a":"3841","d":"2027-02-06T20:00Z","h":"131","l":"德甲","r":20},{"a":"137","d":"2027-02-13T20:00Z","h":"3841","l":"德甲","r":21},{"a":"3841","d":"2027-02-20T20:00Z","h":"132","l":"德甲","r":22},{"a":"10388","d":"2027-02-27T20:00Z","h":"3841","l":"德甲","r":23},{"a":"3841","d":"2027-03-03T20:00Z","h":"598","l":"德甲","r":24},{"a":"3841","d":"2027-03-06T20:00Z","h":"126","l":"德甲","r":25},{"a":"11420","d":"2027-03-13T20:00Z","h":"3841","l":"德甲","r":26},{"a":"3841","d":"2027-03-20T18:00Z","h":"2950","l":"德甲","r":27},{"a":"7911","d":"2027-04-03T18:00Z","h":"3841","l":"德甲","r":28},{"a":"3841","d":"2027-04-10T18:00Z","h":"122","l":"德甲","r":29},{"a":"124","d":"2027-04-17T18:00Z","h":"3841","l":"德甲","r":30},{"a":"3841","d":"2027-04-24T18:00Z","h":"3307","l":"德甲","r":31},{"a":"134","d":"2027-05-08T18:00Z","h":"3841","l":"德甲","r":32},{"a":"3841","d":"2027-05-15T18:00Z","h":"268","l":"德甲","r":33},{"a":"127","d":"2027-05-22T13:30Z","h":"3841","l":"德甲","r":34}],"388":[{"a":"388","d":"2026-11-28T15:00Z","h":"357","l":"英超","r":12},{"a":"373","d":"2026-12-01T20:00Z","h":"388","l":"英超","r":13},{"a":"388","d":"2026-12-05T15:00Z","h":"360","l":"英超","r":14},{"a":"362","d":"2026-12-13T16:30Z","h":"388","l":"英超","r":15},{"a":"388","d":"2026-12-19T15:00Z","h":"349","l":"英超","r":16},{"a":"363","d":"2026-12-27T14:00Z","h":"388","l":"英超","r":17},{"a":"337","d":"2026-12-30T19:30Z","h":"388","l":"英超","r":18},{"a":"388","d":"2027-01-02T15:00Z","h":"364","l":"英超","r":19},{"a":"388","d":"2027-01-06T19:30Z","h":"373","l":"英超","r":20},{"a":"368","d":"2027-01-16T12:30Z","h":"388","l":"英超","r":21},{"a":"388","d":"2027-01-24T14:00Z","h":"366","l":"英超","r":22},{"a":"357","d":"2027-01-31T14:00Z","h":"388","l":"英超","r":23},{"a":"388","d":"2027-02-06T15:00Z","h":"384","l":"英超","r":24},{"a":"364","d":"2027-02-10T20:00Z","h":"388","l":"英超","r":25},{"a":"388","d":"2027-02-20T15:00Z","h":"337","l":"英超","r":26},{"a":"349","d":"2027-02-27T15:00Z","h":"388","l":"英超","r":27},{"a":"388","d":"2027-03-03T20:00Z","h":"363","l":"英超","r":28},{"a":"382","d":"2027-03-13T15:00Z","h":"388","l":"英超","r":29},{"a":"388","d":"2027-03-20T15:00Z","h":"331","l":"英超","r":30},{"a":"359","d":"2027-04-10T14:00Z","h":"388","l":"英超","r":31},{"a":"388","d":"2027-04-17T14:00Z","h":"306","l":"英超","r":32},{"a":"388","d":"2027-04-24T14:00Z","h":"362","l":"英超","r":33},{"a":"360","d":"2027-05-01T14:00Z","h":"388","l":"英超","r":34},{"a":"388","d":"2027-05-08T14:00Z","h":"361","l":"英超","r":35},{"a":"367","d":"2027-05-15T14:00Z","h":"388","l":"英超","r":36},{"a":"388","d":"2027-05-23T14:00Z","h":"370","l":"英超","r":37},{"a":"393","d":"2027-05-30T15:00Z","h":"388","l":"英超","r":38}],"393":[{"a":"363","d":"2026-11-27T20:00Z","h":"393","l":"英超","r":12},{"a":"393","d":"2026-12-02T19:30Z","h":"306","l":"英超","r":13},{"a":"331","d":"2026-12-05T17:30Z","h":"393","l":"英超","r":14},{"a":"393","d":"2026-12-13T14:00Z","h":"366","l":"英超","r":15},{"a":"368","d":"2026-12-20T14:00Z","h":"393","l":"英超","r":16},{"a":"393","d":"2026-12-27T16:30Z","h":"360","l":"英超","r":17},{"a":"393","d":"2026-12-30T19:30Z","h":"361","l":"英超","r":18},{"a":"370","d":"2027-01-02T15:00Z","h":"393","l":"英超","r":19},{"a":"306","d":"2027-01-05T19:30Z","h":"393","l":"英超","r":20},{"a":"393","d":"2027-01-16T15:00Z","h":"382","l":"英超","r":21},{"a":"349","d":"2027-01-24T14:00Z","h":"393","l":"英超","r":22},{"a":"393","d":"2027-01-30T17:30Z","h":"363","l":"英超","r":23},{"a":"337","d":"2027-02-06T15:00Z","h":"393","l":"英超","r":24},{"a":"393","d":"2027-02-10T20:00Z","h":"370","l":"英超","r":25},{"a":"360","d":"2027-02-20T15:00Z","h":"393","l":"英超","r":26},{"a":"393","d":"2027-02-27T15:00Z","h":"368","l":"英超","r":27},{"a":"361","d":"2027-03-03T20:00Z","h":"393","l":"英超","r":28},{"a":"393","d":"2027-03-13T15:00Z","h":"367","l":"英超","r":29},{"a":"362","d":"2027-03-20T15:00Z","h":"393","l":"英超","r":30},{"a":"393","d":"2027-04-10T14:00Z","h":"357","l":"英超","r":31},{"a":"364","d":"2027-04-17T14:00Z","h":"393","l":"英超","r":32},{"a":"366","d":"2027-04-24T14:00Z","h":"393","l":"英超","r":33},{"a":"393","d":"2027-05-01T14:00Z","h":"331","l":"英超","r":34},{"a":"384","d":"2027-05-08T14:00Z","h":"393","l":"英超","r":35},{"a":"393","d":"2027-05-15T14:00Z","h":"359","l":"英超","r":36},{"a":"373","d":"2027-05-23T14:00Z","h":"393","l":"英超","r":37},{"a":"393","d":"2027-05-30T15:00Z","h":"388","l":"英超","r":38}],"3997":[{"a":"114","d":"2026-11-29T14:00Z","h":"3997","l":"意甲","r":13},{"a":"3997","d":"2026-12-03T20:00Z","h":"111","l":"意大利杯"},{"a":"3997","d":"2026-12-07T17:30Z","h":"17530","l":"意甲","r":14},{"a":"3997","d":"2026-12-12T17:00Z","h":"113","l":"意甲","r":15},{"a":"115","d":"2026-12-19T14:00Z","h":"3997","l":"意甲","r":16},{"a":"3997","d":"2027-01-03T11:30Z","h":"110","l":"意甲","r":17},{"a":"118","d":"2027-01-07T17:30Z","h":"3997","l":"意甲","r":18},{"a":"3997","d":"2027-01-11T17:30Z","h":"2925","l":"意甲","r":19},{"a":"4007","d":"2027-01-17T20:00Z","h":"3997","l":"意甲","r":20},{"a":"3997","d":"2027-01-24T20:00Z","h":"109","l":"意甲","r":21},{"a":"2572","d":"2027-01-31T20:00Z","h":"3997","l":"意甲","r":22},{"a":"3997","d":"2027-02-07T20:00Z","h":"111","l":"意甲","r":23},{"a":"3997","d":"2027-02-14T20:00Z","h":"239","l":"意甲","r":24},{"a":"104","d":"2027-02-21T20:00Z","h":"3997","l":"意甲","r":25},{"a":"3997","d":"2027-02-28T20:00Z","h":"115","l":"意甲","r":26},{"a":"107","d":"2027-03-07T20:00Z","h":"3997","l":"意甲","r":27},{"a":"3997","d":"2027-03-14T18:00Z","h":"103","l":"意甲","r":28},{"a":"2925","d":"2027-03-21T18:00Z","h":"3997","l":"意甲","r":29},{"a":"105","d":"2027-04-04T18:00Z","h":"3997","l":"意甲","r":30},{"a":"3997","d":"2027-04-11T18:00Z","h":"114","l":"意甲","r":31},{"a":"113","d":"2027-04-18T18:00Z","h":"3997","l":"意甲","r":32},{"a":"3997","d":"2027-04-25T18:00Z","h":"3263","l":"意甲","r":33},{"a":"4057","d":"2027-05-02T18:00Z","h":"3997","l":"意甲","r":34},{"a":"3997","d":"2027-05-09T18:00Z","h":"112","l":"意甲","r":35},{"a":"17530","d":"2027-05-16T18:00Z","h":"3997","l":"意甲","r":36},{"a":"3997","d":"2027-05-23T18:00Z","h":"118","l":"意甲","r":37},{"a":"110","d":"2027-05-30T18:00Z","h":"3997","l":"意甲","r":38}],"4007":[{"a":"4007","d":"2026-11-29T17:00Z","h":"104","l":"意甲","r":13},{"a":"2572","d":"2026-12-05T14:00Z","h":"4007","l":"意甲","r":14},{"a":"4007","d":"2026-12-14T19:45Z","h":"111","l":"意甲","r":15},{"a":"4007","d":"2026-12-20T14:00Z","h":"17530","l":"意甲","r":16},{"a":"103","d":"2027-01-02T19:45Z","h":"4007","l":"意甲","r":17},{"a":"4007","d":"2027-01-05T17:30Z","h":"3263","l":"意甲","r":18},{"a":"4057","d":"2027-01-09T14:00Z","h":"4007","l":"意甲","r":19},{"a":"4007","d":"2027-01-13T20:00Z","h":"103","l":"意大利杯"},{"a":"4007","d":"2027-01-17T20:00Z","h":"3997","l":"意甲","r":20},{"a":"112","d":"2027-01-24T20:00Z","h":"4007","l":"意甲","r":21},{"a":"104","d":"2027-01-31T20:00Z","h":"4007","l":"意甲","r":22},{"a":"4007","d":"2027-02-07T20:00Z","h":"2572","l":"意甲","r":23},{"a":"113","d":"2027-02-14T20:00Z","h":"4007","l":"意甲","r":24},{"a":"4007","d":"2027-02-21T20:00Z","h":"105","l":"意甲","r":25},{"a":"111","d":"2027-02-28T20:00Z","h":"4007","l":"意甲","r":26},{"a":"3263","d":"2027-03-07T20:00Z","h":"4007","l":"意甲","r":27},{"a":"4007","d":"2027-03-14T18:00Z","h":"4057","l":"意甲","r":28},{"a":"107","d":"2027-03-21T18:00Z","h":"4007","l":"意甲","r":29},{"a":"4007","d":"2027-04-04T18:00Z","h":"103","l":"意甲","r":30},{"a":"4007","d":"2027-04-11T18:00Z","h":"118","l":"意甲","r":31},{"a":"110","d":"2027-04-18T18:00Z","h":"4007","l":"意甲","r":32},{"a":"4007","d":"2027-04-25T18:00Z","h":"2925","l":"意甲","r":33},{"a":"17530","d":"2027-05-02T18:00Z","h":"4007","l":"意甲","r":34},{"a":"4007","d":"2027-05-09T18:00Z","h":"114","l":"意甲","r":35},{"a":"115","d":"2027-05-16T18:00Z","h":"4007","l":"意甲","r":36},{"a":"4007","d":"2027-05-23T18:00Z","h":"109","l":"意甲","r":37},{"a":"239","d":"2027-05-30T18:00Z","h":"4007","l":"意甲","r":38}],"4057":[{"a":"115","d":"2026-11-28T14:00Z","h":"4057","l":"意甲","r":13},{"a":"110","d":"2026-12-05T17:00Z","h":"4057","l":"意甲","r":14},{"a":"4057","d":"2026-12-11T19:45Z","h":"118","l":"意甲","r":15},{"a":"112","d":"2026-12-18T17:30Z","h":"4057","l":"意甲","r":16},{"a":"4057","d":"2027-01-02T17:00Z","h":"104","l":"意甲","r":17},{"a":"107","d":"2027-01-06T14:00Z","h":"4057","l":"意甲","r":18},{"a":"4057","d":"2027-01-09T14:00Z","h":"4007","l":"意甲","r":19},{"a":"4057","d":"2027-01-17T20:00Z","h":"17530","l":"意甲","r":20},{"a":"103","d":"2027-01-24T20:00Z","h":"4057","l":"意甲","r":21},{"a":"4057","d":"2027-01-31T20:00Z","h":"239","l":"意甲","r":22},{"a":"4057","d":"2027-02-07T20:00Z","h":"115","l":"意甲","r":23},{"a":"109","d":"2027-02-14T20:00Z","h":"4057","l":"意甲","r":24},{"a":"4057","d":"2027-02-21T20:00Z","h":"113","l":"意甲","r":25},{"a":"114","d":"2027-02-28T20:00Z","h":"4057","l":"意甲","r":26},{"a":"4057","d":"2027-03-07T20:00Z","h":"112","l":"意甲","r":27},{"a":"4007","d":"2027-03-14T18:00Z","h":"4057","l":"意甲","r":28},{"a":"4057","d":"2027-03-21T18:00Z","h":"110","l":"意甲","r":29},{"a":"118","d":"2027-04-04T18:00Z","h":"4057","l":"意甲","r":30},{"a":"3263","d":"2027-04-11T18:00Z","h":"4057","l":"意甲","r":31},{"a":"4057","d":"2027-04-18T18:00Z","h":"2572","l":"意甲","r":32},{"a":"104","d":"2027-04-25T18:00Z","h":"4057","l":"意甲","r":33},{"a":"4057","d":"2027-05-02T18:00Z","h":"3997","l":"意甲","r":34},{"a":"105","d":"2027-05-09T18:00Z","h":"4057","l":"意甲","r":35},{"a":"4057","d":"2027-05-16T18:00Z","h":"107","l":"意甲","r":36},{"a":"2925","d":"2027-05-23T18:00Z","h":"4057","l":"意甲","r":37},{"a":"4057","d":"2027-05-30T18:00Z","h":"111","l":"意甲","r":38}],"598":[{"a":"598","d":"2026-11-28T14:30Z","h":"2950","l":"德甲","r":11},{"a":"127","d":"2026-12-05T14:30Z","h":"598","l":"德甲","r":12},{"a":"598","d":"2026-12-12T14:30Z","h":"134","l":"德甲","r":13},{"a":"7911","d":"2026-12-20T16:30Z","h":"598","l":"德甲","r":14},{"a":"598","d":"2027-01-10T14:30Z","h":"137","l":"德甲","r":15},{"a":"3307","d":"2027-01-13T19:30Z","h":"598","l":"德甲","r":16},{"a":"598","d":"2027-01-16T14:30Z","h":"268","l":"德甲","r":17},{"a":"598","d":"2027-01-24T14:30Z","h":"125","l":"德甲","r":18},{"a":"131","d":"2027-01-30T20:00Z","h":"598","l":"德甲","r":19},{"a":"598","d":"2027-02-06T20:00Z","h":"133","l":"德甲","r":20},{"a":"132","d":"2027-02-13T20:00Z","h":"598","l":"德甲","r":21},{"a":"598","d":"2027-02-20T20:00Z","h":"10388","l":"德甲","r":22},{"a":"598","d":"2027-02-27T20:00Z","h":"124","l":"德甲","r":23},{"a":"3841","d":"2027-03-03T20:00Z","h":"598","l":"德甲","r":24},{"a":"598","d":"2027-03-06T20:00Z","h":"122","l":"德甲","r":25},{"a":"126","d":"2027-03-13T20:00Z","h":"598","l":"德甲","r":26},{"a":"598","d":"2027-03-20T18:00Z","h":"11420","l":"德甲","r":27},{"a":"2950","d":"2027-04-03T18:00Z","h":"598","l":"德甲","r":28},{"a":"598","d":"2027-04-10T18:00Z","h":"127","l":"德甲","r":29},{"a":"134","d":"2027-04-17T18:00Z","h":"598","l":"德甲","r":30},{"a":"598","d":"2027-04-24T18:00Z","h":"7911","l":"德甲","r":31},{"a":"137","d":"2027-05-08T18:00Z","h":"598","l":"德甲","r":32},{"a":"598","d":"2027-05-15T18:00Z","h":"3307","l":"德甲","r":33},{"a":"268","d":"2027-05-22T13:30Z","h":"598","l":"德甲","r":34}],"6851":[{"a":"6851","d":"2026-11-27T19:45Z","h":"6997","l":"法甲","r":12},{"a":"2697","d":"2026-12-05T19:45Z","h":"6851","l":"法甲","r":13},{"a":"6851","d":"2026-12-12T16:15Z","h":"160","l":"法甲","r":14},{"a":"3236","d":"2027-01-03T16:15Z","h":"6851","l":"法甲","r":15},{"a":"179","d":"2027-01-17T14:00Z","h":"6851","l":"法甲","r":16},{"a":"6851","d":"2027-01-23T16:15Z","h":"166","l":"法甲","r":17},{"a":"172","d":"2027-01-30T19:45Z","h":"6851","l":"法甲","r":18},{"a":"6851","d":"2027-02-06T20:00Z","h":"180","l":"法甲","r":19},{"a":"170","d":"2027-02-13T20:00Z","h":"6851","l":"法甲","r":20},{"a":"6851","d":"2027-02-20T20:00Z","h":"7868","l":"法甲","r":21},{"a":"6851","d":"2027-02-27T20:00Z","h":"2697","l":"法甲","r":22},{"a":"6997","d":"2027-03-06T20:00Z","h":"6851","l":"法甲","r":23},{"a":"273","d":"2027-03-13T20:00Z","h":"6851","l":"法甲","r":24},{"a":"6851","d":"2027-03-20T18:00Z","h":"169","l":"法甲","r":25},{"a":"160","d":"2027-04-03T18:00Z","h":"6851","l":"法甲","r":26},{"a":"6851","d":"2027-04-10T18:00Z","h":"2502","l":"法甲","r":27},{"a":"6851","d":"2027-04-17T18:00Z","h":"179","l":"法甲","r":28},{"a":"175","d":"2027-04-24T18:00Z","h":"6851","l":"法甲","r":29},{"a":"6851","d":"2027-05-01T18:00Z","h":"3236","l":"法甲","r":30},{"a":"166","d":"2027-05-08T18:00Z","h":"6851","l":"法甲","r":31},{"a":"6851","d":"2027-05-16T18:00Z","h":"174","l":"法甲","r":32},{"a":"176","d":"2027-05-22T18:00Z","h":"6851","l":"法甲","r":33},{"a":"6851","d":"2027-05-29T18:00Z","h":"167","l":"法甲","r":34}],"6997":[{"a":"6851","d":"2026-11-27T19:45Z","h":"6997","l":"法甲","r":12},{"a":"6997","d":"2026-12-06T16:15Z","h":"169","l":"法甲","r":13},{"a":"170","d":"2026-12-12T19:45Z","h":"6997","l":"法甲","r":14},{"a":"176","d":"2027-01-02T16:00Z","h":"6997","l":"法甲","r":15},{"a":"6997","d":"2027-01-17T16:15Z","h":"174","l":"法甲","r":16},{"a":"6997","d":"2027-01-23T19:45Z","h":"175","l":"法甲","r":17},{"a":"180","d":"2027-01-29T19:45Z","h":"6997","l":"法甲","r":18},{"a":"6997","d":"2027-02-06T20:00Z","h":"2502","l":"法甲","r":19},{"a":"169","d":"2027-02-13T20:00Z","h":"6997","l":"法甲","r":20},{"a":"6997","d":"2027-02-20T20:00Z","h":"160","l":"法甲","r":21},{"a":"174","d":"2027-02-27T20:00Z","h":"6997","l":"法甲","r":22},{"a":"6997","d":"2027-03-06T20:00Z","h":"6851","l":"法甲","r":23},{"a":"166","d":"2027-03-13T20:00Z","h":"6997","l":"法甲","r":24},{"a":"6997","d":"2027-03-20T18:00Z","h":"179","l":"法甲","r":25},{"a":"273","d":"2027-04-03T18:00Z","h":"6997","l":"法甲","r":26},{"a":"6997","d":"2027-04-10T18:00Z","h":"176","l":"法甲","r":27},{"a":"2697","d":"2027-04-17T18:00Z","h":"6997","l":"法甲","r":28},{"a":"6997","d":"2027-04-24T18:00Z","h":"167","l":"法甲","r":29},{"a":"6997","d":"2027-05-01T18:00Z","h":"170","l":"法甲","r":30},{"a":"172","d":"2027-05-08T18:00Z","h":"6997","l":"法甲","r":31},{"a":"3236","d":"2027-05-16T18:00Z","h":"6997","l":"法甲","r":32},{"a":"6997","d":"2027-05-22T18:00Z","h":"7868","l":"法甲","r":33},{"a":"175","d":"2027-05-29T18:00Z","h":"6997","l":"法甲","r":34}],"7868":[{"a":"175","d":"2026-11-28T16:15Z","h":"7868","l":"法甲","r":12},{"a":"7868","d":"2026-12-05T19:45Z","h":"174","l":"法甲","r":13},{"a":"180","d":"2026-12-12T19:45Z","h":"7868","l":"法甲","r":14},{"a":"7868","d":"2027-01-02T20:00Z","h":"179","l":"法甲","r":15},{"a":"160","d":"2027-01-16T16:15Z","h":"7868","l":"法甲","r":16},{"a":"7868","d":"2027-01-23T19:45Z","h":"2697","l":"法甲","r":17},{"a":"3236","d":"2027-01-30T19:45Z","h":"7868","l":"法甲","r":18},{"a":"7868","d":"2027-02-06T20:00Z","h":"175","l":"法甲","r":19},{"a":"7868","d":"2027-02-13T20:00Z","h":"176","l":"法甲","r":20},{"a":"6851","d":"2027-02-20T20:00Z","h":"7868","l":"法甲","r":21},{"a":"7868","d":"2027-02-27T20:00Z","h":"273","l":"法甲","r":22},{"a":"172","d":"2027-03-06T20:00Z","h":"7868","l":"法甲","r":23},{"a":"7868","d":"2027-03-13T20:00Z","h":"180","l":"法甲","r":24},{"a":"2697","d":"2027-03-20T18:00Z","h":"7868","l":"法甲","r":25},{"a":"174","d":"2027-04-03T18:00Z","h":"7868","l":"法甲","r":26},{"a":"7868","d":"2027-04-10T18:00Z","h":"170","l":"法甲","r":27},{"a":"167","d":"2027-04-17T18:00Z","h":"7868","l":"法甲","r":28},{"a":"7868","d":"2027-04-24T18:00Z","h":"2502","l":"法甲","r":29},{"a":"7868","d":"2027-05-01T18:00Z","h":"160","l":"法甲","r":30},{"a":"179","d":"2027-05-08T18:00Z","h":"7868","l":"法甲","r":31},{"a":"7868","d":"2027-05-16T18:00Z","h":"166","l":"法甲","r":32},{"a":"6997","d":"2027-05-22T18:00Z","h":"7868","l":"法甲","r":33},{"a":"7868","d":"2027-05-29T18:00Z","h":"169","l":"法甲","r":34}],"7911":[{"a":"3746","d":"2026-11-26T20:00Z","h":"7911","l":"欧联"},{"a":"3841","d":"2026-11-29T16:30Z","h":"7911","l":"德甲","r":11},{"a":"7911","d":"2026-12-05T14:30Z","h":"126","l":"德甲","r":12},{"a":"7911","d":"2026-12-10T17:45Z","h":"441","l":"欧联"},{"a":"132","d":"2026-12-13T16:30Z","h":"7911","l":"德甲","r":13},{"a":"7911","d":"2026-12-20T16:30Z","h":"598","l":"德甲","r":14},{"a":"10388","d":"2027-01-09T14:30Z","h":"7911","l":"德甲","r":15},{"a":"7911","d":"2027-01-12T19:30Z","h":"2950","l":"德甲","r":16},{"a":"11420","d":"2027-01-16T14:30Z","h":"7911","l":"德甲","r":17},{"a":"7911","d":"2027-01-21T17:45Z","h":"435","l":"欧联"},{"a":"122","d":"2027-01-24T18:30Z","h":"7911","l":"德甲","r":18},{"a":"622","d":"2027-01-28T20:00Z","h":"7911","l":"欧联"},{"a":"7911","d":"2027-01-30T20:00Z","h":"124","l":"德甲","r":19},{"a":"7911","d":"2027-02-06T20:00Z","h":"134","l":"德甲","r":20},{"a":"3307","d":"2027-02-13T20:00Z","h":"7911","l":"德甲","r":21},{"a":"7911","d":"2027-02-20T20:00Z","h":"127","l":"德甲","r":22},{"a":"268","d":"2027-02-27T20:00Z","h":"7911","l":"德甲","r":23},{"a":"7911","d":"2027-03-03T20:00Z","h":"131","l":"德甲","r":24},{"a":"137","d":"2027-03-06T20:00Z","h":"7911","l":"德甲","r":25},{"a":"7911","d":"2027-03-13T20:00Z","h":"133","l":"德甲","r":26},{"a":"125","d":"2027-03-20T18:00Z","h":"7911","l":"德甲","r":27},{"a":"7911","d":"2027-04-03T18:00Z","h":"3841","l":"德甲","r":28},{"a":"126","d":"2027-04-10T18:00Z","h":"7911","l":"德甲","r":29},{"a":"7911","d":"2027-04-17T18:00Z","h":"132","l":"德甲","r":30},{"a":"598","d":"2027-04-24T18:00Z","h":"7911","l":"德甲","r":31},{"a":"7911","d":"2027-05-08T18:00Z","h":"10388","l":"德甲","r":32},{"a":"2950","d":"2027-05-15T18:00Z","h":"7911","l":"德甲","r":33},{"a":"7911","d":"2027-05-22T13:30Z","h":"11420","l":"德甲","r":34}],"83":[{"a":"83","d":"2026-11-29T15:15Z","h":"90","l":"西甲","r":14},{"a":"1068","d":"2026-12-02T20:30Z","h":"83","l":"西甲","r":15},{"a":"85","d":"2026-12-05T20:00Z","h":"83","l":"西甲","r":16},{"a":"382","d":"2026-12-08T20:00Z","h":"83","l":"欧冠"},{"a":"83","d":"2026-12-12T17:30Z","h":"99","l":"西甲","r":17},{"a":"89","d":"2026-12-20T20:00Z","h":"83","l":"西甲","r":18},{"a":"83","d":"2027-01-03T20:00Z","h":"88","l":"西甲","r":19},{"a":"83","d":"2027-01-10T20:00Z","h":"97","l":"西甲","r":20},{"a":"3751","d":"2027-01-17T20:00Z","h":"83","l":"西甲","r":21},{"a":"83","d":"2027-01-20T20:00Z","h":"2250","l":"欧冠"},{"a":"83","d":"2027-01-24T20:00Z","h":"96","l":"西甲","r":22},{"a":"2572","d":"2027-01-27T20:00Z","h":"83","l":"欧冠"},{"a":"94","d":"2027-01-31T20:00Z","h":"83","l":"西甲","r":23},{"a":"83","d":"2027-02-14T20:00Z","h":"102","l":"西甲","r":24},{"a":"1538","d":"2027-02-21T20:00Z","h":"83","l":"西甲","r":25},{"a":"83","d":"2027-02-28T20:00Z","h":"93","l":"西甲","r":26},{"a":"244","d":"2027-03-07T20:00Z","h":"83","l":"西甲","r":27},{"a":"90","d":"2027-03-14T18:00Z","h":"83","l":"西甲","r":28},{"a":"83","d":"2027-03-21T18:00Z","h":"101","l":"西甲","r":29},{"a":"243","d":"2027-04-04T18:00Z","h":"83","l":"西甲","r":30},{"a":"83","d":"2027-04-11T18:00Z","h":"87","l":"西甲","r":31},{"a":"88","d":"2027-04-18T18:00Z","h":"83","l":"西甲","r":32},{"a":"83","d":"2027-04-21T18:00Z","h":"85","l":"西甲","r":33},{"a":"97","d":"2027-05-02T18:00Z","h":"83","l":"西甲","r":34},{"a":"83","d":"2027-05-09T18:00Z","h":"86","l":"西甲","r":35},{"a":"83","d":"2027-05-16T18:00Z","h":"89","l":"西甲","r":36},{"a":"99","d":"2027-05-23T18:00Z","h":"83","l":"西甲","r":37},{"a":"83","d":"2027-05-30T18:00Z","h":"2922","l":"西甲","r":38}],"85":[{"a":"349","d":"2026-11-26T17:45Z","h":"85","l":"欧联"},{"a":"102","d":"2026-11-29T17:30Z","h":"85","l":"西甲","r":14},{"a":"85","d":"2026-12-02T20:00Z","h":"22080","l":"国王杯"},{"a":"85","d":"2026-12-05T20:00Z","h":"83","l":"西甲","r":16},{"a":"85","d":"2026-12-10T17:45Z","h":"176","l":"欧联"},{"a":"85","d":"2026-12-14T20:00Z","h":"88","l":"西甲","r":16},{"a":"1068","d":"2026-12-20T20:00Z","h":"85","l":"西甲","r":18},{"a":"90","d":"2027-01-03T20:00Z","h":"85","l":"西甲","r":18},{"a":"85","d":"2027-01-10T20:00Z","h":"243","l":"西甲","r":19},{"a":"94","d":"2027-01-17T20:00Z","h":"85","l":"西甲","r":20},{"a":"85","d":"2027-01-21T20:00Z","h":"13083","l":"欧联"},{"a":"85","d":"2027-01-24T20:00Z","h":"87","l":"西甲","r":21},{"a":"987","d":"2027-01-28T20:00Z","h":"85","l":"欧联"},{"a":"2922","d":"2027-01-31T20:00Z","h":"85","l":"西甲","r":22},{"a":"85","d":"2027-02-07T20:00Z","h":"96","l":"西甲","r":23},{"a":"101","d":"2027-02-14T20:00Z","h":"85","l":"西甲","r":24},{"a":"85","d":"2027-02-21T20:00Z","h":"93","l":"西甲","r":25},{"a":"88","d":"2027-02-28T20:00Z","h":"85","l":"西甲","r":26},{"a":"85","d":"2027-03-07T20:00Z","h":"1068","l":"西甲","r":27},{"a":"85","d":"2027-03-14T18:00Z","h":"97","l":"西甲","r":28},{"a":"86","d":"2027-03-21T18:00Z","h":"85","l":"西甲","r":29},{"a":"85","d":"2027-04-04T18:00Z","h":"244","l":"西甲","r":30},{"a":"3751","d":"2027-04-11T18:00Z","h":"85","l":"西甲","r":31},{"a":"85","d":"2027-04-18T18:00Z","h":"90","l":"西甲","r":32},{"a":"83","d":"2027-04-21T18:00Z","h":"85","l":"西甲","r":33},{"a":"243","d":"2027-05-02T18:00Z","h":"85","l":"西甲","r":34},{"a":"85","d":"2027-05-09T18:00Z","h":"102","l":"西甲","r":35},{"a":"85","d":"2027-05-16T18:00Z","h":"99","l":"西甲","r":36},{"a":"89","d":"2027-05-23T18:00Z","h":"85","l":"西甲","r":37},{"a":"85","d":"2027-05-30T18:00Z","h":"1538","l":"西甲","r":38}],"86":[{"a":"96","d":"2026-11-28T20:00Z","h":"86","l":"西甲","r":14},{"a":"86","d":"2026-12-02T18:00Z","h":"89","l":"西甲","r":15},{"a":"86","d":"2026-12-06T15:15Z","h":"93","l":"西甲","r":16},{"a":"86","d":"2026-12-09T20:00Z","h":"359","l":"欧冠"},{"a":"97","d":"2026-12-13T20:00Z","h":"86","l":"西甲","r":17},{"a":"86","d":"2026-12-20T20:00Z","h":"90","l":"西甲","r":18},{"a":"2922","d":"2027-01-03T20:00Z","h":"86","l":"西甲","r":19},{"a":"1538","d":"2027-01-10T20:00Z","h":"86","l":"西甲","r":20},{"a":"86","d":"2027-01-17T20:00Z","h":"99","l":"西甲","r":21},{"a":"4411","d":"2027-01-19T20:00Z","h":"86","l":"欧冠"},{"a":"244","d":"2027-01-24T20:00Z","h":"86","l":"西甲","r":22},{"a":"86","d":"2027-01-27T20:00Z","h":"493","l":"欧冠"},{"a":"86","d":"2027-01-31T20:00Z","h":"101","l":"西甲","r":23},{"a":"93","d":"2027-02-14T20:00Z","h":"86","l":"西甲","r":24},{"a":"86","d":"2027-02-21T20:00Z","h":"243","l":"西甲","r":25},{"a":"94","d":"2027-02-28T20:00Z","h":"86","l":"西甲","r":26},{"a":"86","d":"2027-03-07T20:00Z","h":"102","l":"西甲","r":27},{"a":"88","d":"2027-03-14T18:00Z","h":"86","l":"西甲","r":28},{"a":"86","d":"2027-03-21T18:00Z","h":"85","l":"西甲","r":29},{"a":"1068","d":"2027-04-04T18:00Z","h":"86","l":"西甲","r":30},{"a":"86","d":"2027-04-11T18:00Z","h":"97","l":"西甲","r":31},{"a":"86","d":"2027-04-18T18:00Z","h":"2922","l":"西甲","r":32},{"a":"3751","d":"2027-04-21T18:00Z","h":"86","l":"西甲","r":33},{"a":"86","d":"2027-05-02T18:00Z","h":"1538","l":"西甲","r":34},{"a":"83","d":"2027-05-09T18:00Z","h":"86","l":"西甲","r":35},{"a":"87","d":"2027-05-16T18:00Z","h":"86","l":"西甲","r":36},{"a":"86","d":"2027-05-23T18:00Z","h":"96","l":"西甲","r":37},{"a":"90","d":"2027-05-30T18:00Z","h":"86","l":"西甲","r":38}],"87":[{"a":"87","d":"2026-11-27T20:00Z","h":"1538","l":"西甲","r":14},{"a":"87","d":"2026-12-01T18:00Z","h":"131470","l":"国王杯"},{"a":"90","d":"2026-12-05T13:00Z","h":"87","l":"西甲","r":15},{"a":"87","d":"2026-12-12T20:00Z","h":"244","l":"西甲","r":16},{"a":"87","d":"2026-12-20T20:00Z","h":"243","l":"西甲","r":17},{"a":"93","d":"2027-01-03T20:00Z","h":"87","l":"西甲","r":18},{"a":"87","d":"2027-01-10T20:00Z","h":"1068","l":"西甲","r":20},{"a":"97","d":"2027-01-17T20:00Z","h":"87","l":"西甲","r":20},{"a":"85","d":"2027-01-24T20:00Z","h":"87","l":"西甲","r":21},{"a":"87","d":"2027-01-31T20:00Z","h":"102","l":"西甲","r":22},{"a":"87","d":"2027-02-07T20:00Z","h":"94","l":"西甲","r":23},{"a":"2922","d":"2027-02-14T20:00Z","h":"87","l":"西甲","r":24},{"a":"87","d":"2027-02-21T20:00Z","h":"96","l":"西甲","r":25},{"a":"101","d":"2027-02-28T20:00Z","h":"87","l":"西甲","r":26},{"a":"87","d":"2027-03-07T20:00Z","h":"88","l":"西甲","r":27},{"a":"1068","d":"2027-03-14T18:00Z","h":"87","l":"西甲","r":28},{"a":"244","d":"2027-03-21T18:00Z","h":"87","l":"西甲","r":29},{"a":"87","d":"2027-04-04T18:00Z","h":"93","l":"西甲","r":30},{"a":"83","d":"2027-04-11T18:00Z","h":"87","l":"西甲","r":31},{"a":"87","d":"2027-04-18T18:00Z","h":"89","l":"西甲","r":32},{"a":"99","d":"2027-04-21T18:00Z","h":"87","l":"西甲"},{"a":"87","d":"2027-05-02T18:00Z","h":"90","l":"西甲","r":34},{"a":"243","d":"2027-05-09T18:00Z","h":"87","l":"西甲","r":35},{"a":"87","d":"2027-05-16T18:00Z","h":"86","l":"西甲","r":36},{"a":"1538","d":"2027-05-23T18:00Z","h":"87","l":"西甲","r":37},{"a":"87","d":"2027-05-30T18:00Z","h":"3751","l":"西甲","r":38}],"88":[{"a":"2922","d":"2026-11-30T20:00Z","h":"88","l":"西甲","r":14},{"a":"88","d":"2026-12-04T20:00Z","h":"96","l":"西甲","r":15},{"a":"85","d":"2026-12-14T20:00Z","h":"88","l":"西甲","r":16},{"a":"88","d":"2026-12-20T20:00Z","h":"94","l":"西甲","r":17},{"a":"83","d":"2027-01-03T20:00Z","h":"88","l":"西甲","r":19},{"a":"244","d":"2027-01-10T20:00Z","h":"88","l":"西甲","r":19},{"a":"88","d":"2027-01-17T20:00Z","h":"1538","l":"西甲","r":20},{"a":"102","d":"2027-01-24T20:00Z","h":"88","l":"西甲","r":21},{"a":"88","d":"2027-01-31T20:00Z","h":"1068","l":"西甲","r":23},{"a":"101","d":"2027-02-07T20:00Z","h":"88","l":"西甲","r":23},{"a":"88","d":"2027-02-14T20:00Z","h":"243","l":"西甲","r":24},{"a":"97","d":"2027-02-21T20:00Z","h":"88","l":"西甲","r":25},{"a":"88","d":"2027-02-28T20:00Z","h":"85","l":"西甲","r":26},{"a":"87","d":"2027-03-07T20:00Z","h":"88","l":"西甲","r":27},{"a":"88","d":"2027-03-14T18:00Z","h":"86","l":"西甲","r":28},{"a":"93","d":"2027-03-21T18:00Z","h":"88","l":"西甲","r":29},{"a":"88","d":"2027-04-04T18:00Z","h":"2922","l":"西甲","r":30},{"a":"99","d":"2027-04-11T18:00Z","h":"88","l":"西甲","r":31},{"a":"88","d":"2027-04-18T18:00Z","h":"83","l":"西甲","r":32},{"a":"89","d":"2027-04-21T18:00Z","h":"88","l":"西甲","r":33},{"a":"88","d":"2027-05-02T18:00Z","h":"3751","l":"西甲","r":34},{"a":"88","d":"2027-05-09T18:00Z","h":"244","l":"西甲","r":35},{"a":"94","d":"2027-05-16T18:00Z","h":"88","l":"西甲","r":36},{"a":"88","d":"2027-05-23T18:00Z","h":"90","l":"西甲","r":37},{"a":"96","d":"2027-05-30T18:00Z","h":"88","l":"西甲","r":38}],"89":[{"a":"89","d":"2026-11-26T20:00Z","h":"384","l":"欧联"},{"a":"243","d":"2026-11-29T20:00Z","h":"89","l":"西甲","r":14},{"a":"86","d":"2026-12-02T18:00Z","h":"89","l":"西甲","r":15},{"a":"89","d":"2026-12-05T17:30Z","h":"102","l":"西甲","r":16},{"a":"21615","d":"2026-12-10T20:00Z","h":"89","l":"欧联"},{"a":"2922","d":"2026-12-13T17:30Z","h":"89","l":"西甲","r":17},{"a":"89","d":"2026-12-20T20:00Z","h":"83","l":"西甲","r":18},{"a":"97","d":"2027-01-03T20:00Z","h":"89","l":"西甲","r":19},{"a":"89","d":"2027-01-10T20:00Z","h":"96","l":"西甲","r":20},{"a":"89","d":"2027-01-17T20:00Z","h":"1068","l":"西甲","r":21},{"a":"11706","d":"2027-01-21T17:45Z","h":"89","l":"欧联"},{"a":"99","d":"2027-01-24T20:00Z","h":"89","l":"西甲","r":22},{"a":"89","d":"2027-01-28T20:00Z","h":"111","l":"欧联"},{"a":"89","d":"2027-01-31T20:00Z","h":"1538","l":"西甲","r":23},{"a":"244","d":"2027-02-14T20:00Z","h":"89","l":"西甲","r":24},{"a":"89","d":"2027-02-21T20:00Z","h":"90","l":"西甲","r":25},{"a":"3751","d":"2027-02-28T20:00Z","h":"89","l":"西甲","r":26},{"a":"89","d":"2027-03-07T20:00Z","h":"243","l":"西甲","r":27},{"a":"89","d":"2027-03-14T18:00Z","h":"2922","l":"西甲","r":28},{"a":"96","d":"2027-03-21T18:00Z","h":"89","l":"西甲","r":29},{"a":"94","d":"2027-04-04T18:00Z","h":"89","l":"西甲","r":30},{"a":"89","d":"2027-04-11T18:00Z","h":"101","l":"西甲","r":31},{"a":"87","d":"2027-04-18T18:00Z","h":"89","l":"西甲","r":32},{"a":"89","d":"2027-04-21T18:00Z","h":"88","l":"西甲","r":33},{"a":"93","d":"2027-05-02T18:00Z","h":"89","l":"西甲","r":34},{"a":"89","d":"2027-05-09T18:00Z","h":"97","l":"西甲","r":35},{"a":"83","d":"2027-05-16T18:00Z","h":"89","l":"西甲","r":36},{"a":"89","d":"2027-05-23T18:00Z","h":"85","l":"西甲","r":37},{"a":"102","d":"2027-05-30T18:00Z","h":"89","l":"西甲","r":38}],"90":[{"a":"83","d":"2026-11-29T15:15Z","h":"90","l":"西甲","r":14},{"a":"90","d":"2026-12-02T18:00Z","h":"5464","l":"国王杯"},{"a":"90","d":"2026-12-05T13:00Z","h":"87","l":"西甲","r":15},{"a":"93","d":"2026-12-13T15:15Z","h":"90","l":"西甲","r":16},{"a":"86","d":"2026-12-20T20:00Z","h":"90","l":"西甲","r":18},{"a":"90","d":"2027-01-03T20:00Z","h":"85","l":"西甲","r":18},{"a":"101","d":"2027-01-10T20:00Z","h":"90","l":"西甲","r":19},{"a":"90","d":"2027-01-17T20:00Z","h":"244","l":"西甲","r":20},{"a":"1068","d":"2027-01-24T20:00Z","h":"90","l":"西甲","r":22},{"a":"90","d":"2027-01-31T20:00Z","h":"97","l":"西甲","r":22},{"a":"99","d":"2027-02-07T20:00Z","h":"90","l":"西甲","r":23},{"a":"90","d":"2027-02-14T20:00Z","h":"3751","l":"西甲","r":24},{"a":"89","d":"2027-02-21T20:00Z","h":"90","l":"西甲","r":25},{"a":"90","d":"2027-02-28T20:00Z","h":"1538","l":"西甲","r":26},{"a":"2922","d":"2027-03-07T20:00Z","h":"90","l":"西甲","r":27},{"a":"90","d":"2027-03-14T18:00Z","h":"83","l":"西甲","r":28},{"a":"90","d":"2027-03-21T18:00Z","h":"94","l":"西甲","r":29},{"a":"102","d":"2027-04-04T18:00Z","h":"90","l":"西甲","r":30},{"a":"90","d":"2027-04-11T18:00Z","h":"243","l":"西甲","r":31},{"a":"85","d":"2027-04-18T18:00Z","h":"90","l":"西甲","r":32},{"a":"90","d":"2027-04-21T18:00Z","h":"93","l":"西甲","r":33},{"a":"87","d":"2027-05-02T18:00Z","h":"90","l":"西甲","r":34},{"a":"90","d":"2027-05-09T18:00Z","h":"101","l":"西甲","r":35},{"a":"96","d":"2027-05-16T18:00Z","h":"90","l":"西甲","r":36},{"a":"88","d":"2027-05-23T18:00Z","h":"90","l":"西甲","r":37},{"a":"90","d":"2027-05-30T18:00Z","h":"86","l":"西甲","r":38}],"93":[{"a":"93","d":"2026-11-28T15:15Z","h":"99","l":"西甲","r":13},{"a":"93","d":"2026-12-01T20:00Z","h":"100","l":"国王杯"},{"a":"86","d":"2026-12-06T15:15Z","h":"93","l":"西甲","r":16},{"a":"93","d":"2026-12-09T19:00Z","h":"101","l":"西甲","r":15},{"a":"93","d":"2026-12-13T15:15Z","h":"90","l":"西甲","r":16},{"a":"244","d":"2026-12-20T20:00Z","h":"93","l":"西甲","r":17},{"a":"93","d":"2027-01-03T20:00Z","h":"87","l":"西甲","r":18},{"a":"102","d":"2027-01-10T20:00Z","h":"93","l":"西甲","r":19},{"a":"93","d":"2027-01-17T20:00Z","h":"2922","l":"西甲","r":20},{"a":"1538","d":"2027-01-24T20:00Z","h":"93","l":"西甲","r":21},{"a":"93","d":"2027-01-31T20:00Z","h":"243","l":"西甲","r":22},{"a":"97","d":"2027-02-07T20:00Z","h":"93","l":"西甲","r":23},{"a":"93","d":"2027-02-14T20:00Z","h":"86","l":"西甲","r":24},{"a":"85","d":"2027-02-21T20:00Z","h":"93","l":"西甲","r":25},{"a":"83","d":"2027-02-28T20:00Z","h":"93","l":"西甲","r":26},{"a":"93","d":"2027-03-07T20:00Z","h":"96","l":"西甲","r":27},{"a":"94","d":"2027-03-14T18:00Z","h":"93","l":"西甲","r":28},{"a":"93","d":"2027-03-21T18:00Z","h":"88","l":"西甲","r":29},{"a":"87","d":"2027-04-04T18:00Z","h":"93","l":"西甲","r":30},{"a":"93","d":"2027-04-11T18:00Z","h":"102","l":"西甲","r":31},{"a":"93","d":"2027-04-18T18:00Z","h":"244","l":"西甲","r":32},{"a":"90","d":"2027-04-21T18:00Z","h":"93","l":"西甲","r":33},{"a":"93","d":"2027-05-02T18:00Z","h":"89","l":"西甲","r":34},{"a":"99","d":"2027-05-09T18:00Z","h":"93","l":"西甲","r":35},{"a":"93","d":"2027-05-16T18:00Z","h":"3751","l":"西甲","r":36},{"a":"93","d":"2027-05-23T18:00Z","h":"1068","l":"西甲","r":37},{"a":"101","d":"2027-05-30T18:00Z","h":"93","l":"西甲","r":38}],"94":[{"a":"97","d":"2026-11-29T13:00Z","h":"94","l":"西甲","r":14},{"a":"94","d":"2026-12-03T20:00Z","h":"5401","l":"国王杯"},{"a":"94","d":"2026-12-06T17:30Z","h":"2922","l":"西甲","r":15},{"a":"94","d":"2026-12-13T13:00Z","h":"1068","l":"西甲","r":17},{"a":"88","d":"2026-12-20T20:00Z","h":"94","l":"西甲","r":17},{"a":"94","d":"2027-01-03T20:00Z","h":"1538","l":"西甲","r":18},{"a":"99","d":"2027-01-10T20:00Z","h":"94","l":"西甲","r":19},{"a":"94","d":"2027-01-17T20:00Z","h":"85","l":"西甲","r":20},{"a":"243","d":"2027-01-24T20:00Z","h":"94","l":"西甲","r":21},{"a":"94","d":"2027-01-31T20:00Z","h":"83","l":"西甲","r":23},{"a":"87","d":"2027-02-07T20:00Z","h":"94","l":"西甲","r":23},{"a":"96","d":"2027-02-14T20:00Z","h":"94","l":"西甲","r":24},{"a":"94","d":"2027-02-21T20:00Z","h":"102","l":"西甲","r":25},{"a":"94","d":"2027-02-28T20:00Z","h":"86","l":"西甲","r":26},{"a":"1538","d":"2027-03-07T20:00Z","h":"94","l":"西甲","r":27},{"a":"94","d":"2027-03-14T18:00Z","h":"93","l":"西甲","r":28},{"a":"90","d":"2027-03-21T18:00Z","h":"94","l":"西甲","r":29},{"a":"94","d":"2027-04-04T18:00Z","h":"89","l":"西甲","r":30},{"a":"2922","d":"2027-04-11T18:00Z","h":"94","l":"西甲","r":31},{"a":"94","d":"2027-04-18T18:00Z","h":"99","l":"西甲","r":32},{"a":"101","d":"2027-04-21T18:00Z","h":"94","l":"西甲","r":33},{"a":"94","d":"2027-05-02T18:00Z","h":"244","l":"西甲","r":34},{"a":"1068","d":"2027-05-09T18:00Z","h":"94","l":"西甲","r":35},{"a":"94","d":"2027-05-16T18:00Z","h":"88","l":"西甲","r":36},{"a":"3751","d":"2027-05-23T18:00Z","h":"94","l":"西甲","r":37},{"a":"94","d":"2027-05-30T18:00Z","h":"97","l":"西甲","r":38}],"96":[{"a":"96","d":"2026-11-28T20:00Z","h":"86","l":"西甲","r":14},{"a":"96","d":"2026-12-01T20:00Z","h":"17570","l":"国王杯"},{"a":"88","d":"2026-12-04T20:00Z","h":"96","l":"西甲","r":15},{"a":"96","d":"2026-12-12T13:00Z","h":"1538","l":"西甲","r":16},{"a":"3751","d":"2026-12-20T20:00Z","h":"96","l":"西甲","r":17},{"a":"96","d":"2027-01-03T20:00Z","h":"244","l":"西甲","r":18},{"a":"89","d":"2027-01-10T20:00Z","h":"96","l":"西甲","r":20},{"a":"96","d":"2027-01-17T20:00Z","h":"102","l":"西甲","r":20},{"a":"83","d":"2027-01-24T20:00Z","h":"96","l":"西甲","r":22},{"a":"96","d":"2027-01-31T20:00Z","h":"99","l":"西甲","r":22},{"a":"85","d":"2027-02-07T20:00Z","h":"96","l":"西甲","r":23},{"a":"96","d":"2027-02-14T20:00Z","h":"94","l":"西甲","r":24},{"a":"87","d":"2027-02-21T20:00Z","h":"96","l":"西甲","r":25},{"a":"96","d":"2027-02-28T20:00Z","h":"2922","l":"西甲","r":26},{"a":"93","d":"2027-03-07T20:00Z","h":"96","l":"西甲","r":27},{"a":"243","d":"2027-03-14T18:00Z","h":"96","l":"西甲","r":28},{"a":"96","d":"2027-03-21T18:00Z","h":"89","l":"西甲","r":29},{"a":"96","d":"2027-04-04T18:00Z","h":"3751","l":"西甲","r":30},{"a":"244","d":"2027-04-11T18:00Z","h":"96","l":"西甲","r":31},{"a":"101","d":"2027-04-18T18:00Z","h":"96","l":"西甲","r":32},{"a":"96","d":"2027-04-21T18:00Z","h":"97","l":"西甲","r":33},{"a":"96","d":"2027-05-02T18:00Z","h":"1068","l":"西甲","r":34},{"a":"1538","d":"2027-05-09T18:00Z","h":"96","l":"西甲","r":35},{"a":"96","d":"2027-05-16T18:00Z","h":"90","l":"西甲","r":36},{"a":"86","d":"2027-05-23T18:00Z","h":"96","l":"西甲","r":37},{"a":"96","d":"2027-05-30T18:00Z","h":"88","l":"西甲","r":38}],"97":[{"a":"97","d":"2026-11-29T13:00Z","h":"94","l":"西甲","r":14},{"a":"97","d":"2026-12-03T20:00Z","h":"12587","l":"国王杯"},{"a":"3751","d":"2026-12-06T13:00Z","h":"97","l":"西甲","r":15},{"a":"97","d":"2026-12-13T20:00Z","h":"86","l":"西甲","r":17},{"a":"102","d":"2026-12-20T20:00Z","h":"97","l":"西甲","r":17},{"a":"97","d":"2027-01-03T20:00Z","h":"89","l":"西甲","r":19},{"a":"83","d":"2027-01-10T20:00Z","h":"97","l":"西甲","r":20},{"a":"97","d":"2027-01-17T20:00Z","h":"87","l":"西甲","r":20},{"a":"97","d":"2027-01-24T20:00Z","h":"2922","l":"西甲","r":21},{"a":"90","d":"2027-01-31T20:00Z","h":"97","l":"西甲","r":22},{"a":"97","d":"2027-02-07T20:00Z","h":"93","l":"西甲","r":23},{"a":"1068","d":"2027-02-14T20:00Z","h":"97","l":"西甲","r":24},{"a":"97","d":"2027-02-21T20:00Z","h":"88","l":"西甲","r":25},{"a":"243","d":"2027-02-28T20:00Z","h":"97","l":"西甲","r":26},{"a":"97","d":"2027-03-07T20:00Z","h":"101","l":"西甲","r":27},{"a":"85","d":"2027-03-14T18:00Z","h":"97","l":"西甲","r":28},{"a":"97","d":"2027-03-21T18:00Z","h":"1538","l":"西甲","r":29},{"a":"97","d":"2027-04-04T18:00Z","h":"99","l":"西甲","r":30},{"a":"86","d":"2027-04-11T18:00Z","h":"97","l":"西甲","r":31},{"a":"97","d":"2027-04-18T18:00Z","h":"3751","l":"西甲","r":32},{"a":"96","d":"2027-04-21T18:00Z","h":"97","l":"西甲","r":33},{"a":"97","d":"2027-05-02T18:00Z","h":"83","l":"西甲","r":34},{"a":"89","d":"2027-05-09T18:00Z","h":"97","l":"西甲","r":35},{"a":"244","d":"2027-05-16T18:00Z","h":"97","l":"西甲","r":36},{"a":"97","d":"2027-05-23T18:00Z","h":"102","l":"西甲","r":37},{"a":"94","d":"2027-05-30T18:00Z","h":"97","l":"西甲","r":38}],"99":[{"a":"93","d":"2026-11-28T15:15Z","h":"99","l":"西甲","r":13},{"a":"99","d":"2026-12-03T20:00Z","h":"20821","l":"国王杯"},{"a":"99","d":"2026-12-07T20:00Z","h":"243","l":"西甲","r":15},{"a":"83","d":"2026-12-12T17:30Z","h":"99","l":"西甲","r":17},{"a":"99","d":"2026-12-20T20:00Z","h":"101","l":"西甲","r":17},{"a":"3751","d":"2027-01-03T20:00Z","h":"99","l":"西甲","r":18},{"a":"99","d":"2027-01-10T20:00Z","h":"94","l":"西甲","r":19},{"a":"86","d":"2027-01-17T20:00Z","h":"99","l":"西甲","r":21},{"a":"99","d":"2027-01-24T20:00Z","h":"89","l":"西甲","r":22},{"a":"96","d":"2027-01-31T20:00Z","h":"99","l":"西甲","r":22},{"a":"99","d":"2027-02-07T20:00Z","h":"90","l":"西甲","r":23},{"a":"99","d":"2027-02-14T20:00Z","h":"1538","l":"西甲","r":24},{"a":"244","d":"2027-02-21T20:00Z","h":"99","l":"西甲","r":25},{"a":"1068","d":"2027-02-28T20:00Z","h":"99","l":"西甲","r":26},{"a":"99","d":"2027-03-07T20:00Z","h":"3751","l":"西甲","r":27},{"a":"101","d":"2027-03-14T18:00Z","h":"99","l":"西甲","r":28},{"a":"99","d":"2027-03-21T18:00Z","h":"102","l":"西甲","r":29},{"a":"97","d":"2027-04-04T18:00Z","h":"99","l":"西甲","r":30},{"a":"99","d":"2027-04-11T18:00Z","h":"88","l":"西甲","r":31},{"a":"94","d":"2027-04-18T18:00Z","h":"99","l":"西甲","r":32},{"a":"99","d":"2027-04-21T18:00Z","h":"87","l":"西甲"},{"a":"2922","d":"2027-05-02T18:00Z","h":"99","l":"西甲","r":34},{"a":"99","d":"2027-05-09T18:00Z","h":"93","l":"西甲","r":35},{"a":"85","d":"2027-05-16T18:00Z","h":"99","l":"西甲","r":36},{"a":"99","d":"2027-05-23T18:00Z","h":"83","l":"西甲","r":37},{"a":"243","d":"2027-05-30T18:00Z","h":"99","l":"西甲","r":38}]};
